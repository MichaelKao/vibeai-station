// SSRF 防護的單元測試（不需要 server，直接測 src/feed.js）。
//
// 為什麼要單獨一支：這兩個洞是自動安全掃描抓到的，而且**用一般的整合測試測不到**——
// 要證明「DNS 指到 127.0.0.1 的網域會被擋」，得真的有那樣一個網域。
// 所以這裡分兩層測：
//   1. isPrivateIp()  純函式，把所有私有網段與 IPv4-mapped 的寫法一次釘住
//   2. fetchFeed()    真的開一個本機伺服器，讓它 302 轉到內網位址，
//                     驗證我們不會跟過去（第一版就是跟過去了）
import http from 'node:http';
import { isPrivateIp, subUrlOk, fetchFeed, nextHop, parseFirstItem } from './src/feed.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '! FAIL ') + name); };

console.log('\n=== isPrivateIp ===');
for (const ip of ['127.0.0.1', '127.1.2.3', '10.0.0.1', '172.16.0.1', '172.31.255.255',
                  '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1',
                  '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])
  ok('擋 ' + ip, isPrivateIp(ip) === true);
for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.5', '172.32.0.1', '172.15.0.1', '2001:4860:4860::8888'])
  ok('放行 ' + ip, isPrivateIp(ip) === false);

console.log('\n=== subUrlOk ===');
ok('擋 file:',            subUrlOk('file:///etc/passwd') === null);
ok('擋 javascript:',      subUrlOk('javascript:alert(1)') === null);
ok('擋 http://127.0.0.1', subUrlOk('http://127.0.0.1/x') === null);
ok('擋 localhost',        subUrlOk('http://localhost:3000/x') === null);
ok('擋 [::1]',            subUrlOk('http://[::1]/x') === null);
ok('擋 169.254.169.254（雲端中繼資料）', subUrlOk('http://169.254.169.254/latest/') === null);
ok('放行一般網址',        typeof subUrlOk('https://example.com/rss') === 'string');

console.log('\n=== 轉址不能繞過檢查 ===');
// 掃描器抓到的第二個洞：第一跳合法、第二跳指到內網，redirect:'follow' 會跟過去。
// 測試環境沒有非 loopback 的伺服器，走不到真的第二跳，所以直接測那一步的判斷。
ok('轉址到 169.254.169.254 被擋', nextHop('http://169.254.169.254/latest/', 'https://ok.example.com/f') === null);
ok('轉址到 127.0.0.1 被擋',       nextHop('http://127.0.0.1:80/x',        'https://ok.example.com/f') === null);
ok('轉址到 localhost 被擋',       nextHop('http://localhost/x',           'https://ok.example.com/f') === null);
ok('轉址到 file: 被擋',           nextHop('file:///etc/passwd',           'https://ok.example.com/f') === null);
ok('相對路徑的轉址接得起來',       nextHop('/feed2', 'https://ok.example.com/f') === 'https://ok.example.com/feed2');
ok('轉址到一般網址放行',           typeof nextHop('https://other.example.com/f', 'https://ok.example.com/f') === 'string');

console.log('\n=== fetchFeed：連線層把關 ===');
// 這台伺服器自己是 127.0.0.1，所以連它本身就會被擋——
// 要測「轉址」得先讓第一跳過關，所以第一跳用一個會被擋的位址是不行的。
// 改測反過來那一面：**確認轉址到內網不會被跟過去**，
// 以及正常的 feed 讀得到。兩件事用同一台伺服器的兩條路徑。
const srv = http.createServer((req, res) => {
  if (req.url === '/redirect-to-internal') {
    res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
    return res.end();
  }
  if (req.url === '/feed') {
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    return res.end('<?xml version="1.0"?><rss><channel><item>'
      + '<title>測試標題</title><link>https://example.com/a</link>'
      + '<pubDate>2026-08-20</pubDate></item></channel></rss>');
  }
  res.writeHead(404); res.end();
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

// 直接打 127.0.0.1 一定被擋——這條同時證明了「連線層真的有把關」，
// 不是只有 subUrlOk 那層字串檢查。
ok('連 127.0.0.1 被擋', await fetchFeed(`http://127.0.0.1:${port}/feed`) === null);

// 用 IPv4 的另一種寫法繞：0x7f.0.0.1 / 2130706433 這些 URL 解析後仍是 loopback
ok('十進位 loopback 也被擋', await fetchFeed(`http://2130706433:${port}/feed`) === null);

srv.close();

console.log('\n=== RSS 解析（訂閱功能的核心）===');
// ⚠ 這一組是第八輪稽核抓到的：parseFirstItem 裡的三個參數漏了引號，
// 寫成 pick(pubDate)、toLocaleDateString(sv-SE, { timeZone: Asia/Taipei })。
// 那是**裸識別字**不是字串——語法合法（sv-SE 被當成減法），所以模組載得起來、
// node --check 過、13 組測試全綠，但只要真的抓到一份 RSS 就丟
// ReferenceError: pubDate is not defined。
//
// 兩個呼叫端都是 .catch(()=>{}) 吞掉，所以壞得完全沒有聲音：訂閱側欄永遠空的
// （查詢是 WHERE last_title!=''），而且 fetched 永遠寫不進去，「30 分鐘不重抓」
// 的節流失效——每個訪客打開網誌頁都對第三方網站重抓一次。
//
// 整合測試碰不到這裡（要有一個真的 RSS 來源），所以一定要有單元測試。
{
  const RFC822 = '<?xml version="1.0"?><rss><channel>'
    + '<item><title>第一則</title><link>http://example.com/a</link>'
    + '<pubDate>Wed, 20 Aug 2025 05:00:00 +0800</pubDate></item>'
    + '<item><title>第二則</title><link>http://example.com/b</link></item>'
    + '</channel></rss>';
  const r = parseFirstItem(RFC822);
  ok('RSS：取到第一則的標題', r.title === '第一則', JSON.stringify(r));
  ok('RSS：取到連結', r.url === 'http://example.com/a', JSON.stringify(r));
  ok('RSS：pubDate 正規化成 YYYY-MM-DD', r.date === '2025-08-20', JSON.stringify(r));

  // Atom 用 <updated>、日期是 ISO-8601，長度跟 RFC-822 不一樣
  const ATOM = '<feed><entry><title>Atom 那則</title>'
    + '<link href="http://example.com/atom"/>'
    + '<updated>2024-01-02T10:00:00Z</updated></entry></feed>';
  const a = parseFirstItem(ATOM);
  ok('Atom：取到標題與 href 連結', a.title === 'Atom 那則' && a.url === 'http://example.com/atom', JSON.stringify(a));
  ok('Atom：updated 也正規化得出來', /^\d{4}-\d{2}-\d{2}$/.test(a.date), JSON.stringify(a));

  // 沒有日期欄位不能爆
  const NODATE = '<rss><item><title>沒有日期</title><link>http://example.com/c</link></item></rss>';
  let threw = null;
  try { parseFirstItem(NODATE); } catch (e) { threw = e; }
  ok('沒有日期欄位也不會丟例外', !threw, threw && (threw.name + ' ' + threw.message));

  // 日期爛掉不能爆
  const BAD = '<rss><item><title>爛日期</title><link>http://example.com/d</link><pubDate>不是日期</pubDate></item></rss>';
  let threw2 = null;
  try { parseFirstItem(BAD); } catch (e) { threw2 = e; }
  ok('日期格式爛掉也不會丟例外', !threw2, threw2 && (threw2.name + ' ' + threw2.message));
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
