// 抓外部 RSS（網誌側欄的「我的訂閱」＝原站的 #boxRssList）。
//
// 這是全站**唯一**一處「伺服器主動去連使用者給的網址」，也就是 SSRF 的入口，
// 所以整支單獨一個檔，防護寫在一起、看得完。
//
// ── 為什麼不是「檢查網址字串」就好 ────────────────────────────────────
// 第一版我只用正則檢查主機名（擋 127.、10.、192.168.…）。自動安全掃描把它
// 打回來，而且說得對，兩個洞都是真的：
//
//   1. **DNS 才是決定連去哪裡的東西，不是字串**。
//      `http://evil.example.com/` 完全通過字串檢查，但那個網域的 A 記錄可以
//      指到 127.0.0.1 或 169.254.169.254（雲端的中繼資料位址）。
//      主機名長得再正常都沒有用。
//   2. **跟著轉址就等於沒檢查**。第一跳是 https://evil.example.com（合法），
//      它回一個 302 指到 http://169.254.169.254/latest/meta-data/ ——
//      `redirect:'follow'` 會乖乖跟過去。
//
// ── 現在的做法 ────────────────────────────────────────────────────────
// 不用 fetch，改用 node:http/https，因為它們可以換掉 `lookup`：
//   * 每一跳都先 subUrlOk() 檢查協定
//   * 連線前由 safeLookup() 做 DNS，**解析出來的每一個位址**都要通過
//     私有網段檢查，不通過就直接不連
//   * 通過檢查之後，**把那個已經驗過的位址交給連線用**——
//     這一步是關鍵：如果先查一次 DNS 檢查、再讓底層自己查第二次，
//     中間那一瞬間對方可以把 DNS 換掉（DNS rebinding），檢查就白做了
//   * 轉址自己處理，最多 3 跳，每一跳重跑上面全部
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

const MAX_BYTES = 256 * 1024;   // RSS 的第一個 <item> 一定在前面，不必整份吃進來
const TIMEOUT   = 6000;
const MAX_HOPS  = 3;

// 私有／保留位址。用數值比對，不要用字串開頭比對——
// '10.0.0.1' 用字串比得出來，但 '::ffff:10.0.0.1'（IPv4-mapped IPv6）比不出來，
// 而那是同一個位址。
export function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (!v) return true;                       // 認不得就當成危險
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;                              // 10.0.0.0/8
    if (p[0] === 127) return true;                             // 127.0.0.0/8 loopback
    if (p[0] === 0) return true;                               // 0.0.0.0/8
    if (p[0] === 169 && p[1] === 254) return true;             // 169.254.0.0/16 link-local（雲端中繼資料）
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16.0.0/12
    if (p[0] === 192 && p[1] === 168) return true;             // 192.168.0.0/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;// 100.64.0.0/10 CGNAT
    if (p[0] >= 224) return true;                              // 多播與保留
    return false;
  }
  const s = ip.toLowerCase();
  if (s === '::1' || s === '::') return true;                  // loopback / unspecified
  // IPv4-mapped（::ffff:127.0.0.1）拆出來用 v4 的規則再判一次
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIp(m[1]);
  if (/^f[cd]/.test(s)) return true;                           // fc00::/7 unique local
  if (/^fe[89ab]/.test(s)) return true;                        // fe80::/10 link-local
  return false;
}

export function subUrlOk(raw) {
  let u; try { u = new URL(raw); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  // 主機名本身就是 IP 的話，這裡先擋一次（省一次 DNS）；
  // 是網域的話交給 safeLookup 判——字串看不出它會解析到哪裡。
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateIp(host)) return null;
  if (/^localhost$/i.test(host)) return null;
  return u.toString();
}

// 給 http.request 用的 lookup：查完就地檢查，然後把**驗過的位址**回傳，
// 底層直接拿去連，不會再查第二次（這樣才擋得住 DNS rebinding）。
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return callback(err);
    const list = Array.isArray(addrs) ? addrs : [addrs];
    for (const a of list) {
      if (isPrivateIp(a.address))
        return callback(new Error('拒絕連線：' + hostname + ' 指向內部位址 ' + a.address));
    }
    const first = list[0];
    if (options && options.all) return callback(null, list);
    callback(null, first.address, first.family);
  });
}

function once(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET',
      lookup: safeLookup,
      headers: { 'user-agent': 'vibeai-station/1.0 (+feed reader)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
      timeout: TIMEOUT,
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve({ redirect: res.headers.location || '' });
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let len = 0; const chunks = [];
      res.on('data', c => {
        len += c.length;
        if (len > MAX_BYTES) { req.destroy(); return; }   // 對方餵無止盡的串流也卡不住我們
        chunks.push(c);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => resolve(null));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// 抓回來的東西一律當成不可信的字串：只取文字，輸出時逸出（樣板用 <%= %>）。
// 不引 XML 解析器——RSS 與 Atom 的第一則用字串比對就夠，
// 而且解析器本身還要再擔心 XXE（外部實體）那一類問題。
// export 是為了讓 test_ssrf.mjs 能直接餵一段 RSS 進來驗解析結果。
// ⚠ 這一支只要有一個字打錯就會在執行期丟例外，而兩個呼叫端都是 catch 吞掉，
// 所以它**必須**有單元測試——整合測試碰不到（要有一個真的 RSS 來源）。
export function parseFirstItem(xml) {
  const item = xml.match(/<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/i)?.[0] || '';
  const pick = tag => {
    const m = item.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim() : '';
  };
  const link = pick('link') || item.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
  return {
    title: pick('title').slice(0, 120),
    url: subUrlOk(link) || '',
    // ⚠ 這幾個參數原本漏了引號，寫成 pick(pubDate)、toLocaleDateString(sv-SE,
    // { timeZone: Asia/Taipei })。那是**裸識別字**不是字串：語法合法
    //（sv-SE 被當成減法、Asia/Taipei 被當成除法），所以模組載得起來、
    // 靜態檢查與現有測試都不會叫，但只要真的抓到一份 RSS 就丟
    // ReferenceError: pubDate is not defined。
    //
    // 兩個呼叫端都是 .catch(()=>{}) 吞掉，於是壞得完全沒有聲音：
    //   1. last_title 永遠是空字串，而側欄的查詢是 WHERE last_title!=''，
    //      「我的訂閱」那一塊**永遠不會出現**。使用者以為是對方網站的問題。
    //   2. 例外是在 UPDATE subs SET fetched=? 之前丟出來的，fetched 一輩子
    //      是空的，「30 分鐘內不重抓」的節流完全失效——每一次有人打開這個人
    //      的網誌頁（不必登入），伺服器就對他訂的每一個網址各發一次請求。
    // 日期正規化成 YYYY-MM-DD。RSS 的 pubDate 是 RFC-822、Atom 是 ISO-8601，
    // 兩種長度不一樣——側欄如果盲切前 16 個字，非 RFC-822 的來源會印出
    // 「(2026-08-20  05:0)」這種切壞的字串。在抓回來的時候就統一格式。
    date: (() => {
      const raw = (pick('pubDate') || pick('updated') || pick('published')).slice(0, 60);
      const t = Date.parse(raw);
      return Number.isNaN(t)
        ? raw.slice(0, 10)
        : new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    })(),
  };
}

// 轉址目標要重跑同一套檢查——這正是掃描器抓到的第二個洞：
// 第一跳合法、第二跳指到內網，`redirect:'follow'` 會乖乖跟過去。
// 抽成獨立函式是為了測得到：要在測試裡走到「第一跳成功、第二跳是內網」
// 得有一台非 loopback 的伺服器，本機測試環境給不出來。
export function nextHop(location, base) {
  if (!location) return null;
  try { return subUrlOk(new URL(location, base).toString()); }
  catch { return null; }
}

export async function fetchFeed(startUrl) {
  let url = subUrlOk(startUrl);
  for (let hop = 0; url && hop < MAX_HOPS; hop++) {
    const r = await once(url).catch(() => null);
    if (!r) return null;
    if (r.redirect) { url = nextHop(r.redirect, url); continue; }
    return parseFirstItem(r.body);
  }
  return null;
}
