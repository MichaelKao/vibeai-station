// 還原度量測：把「原始頁面」與「我們的頁面」的結構拿來逐項比對。
//
// 為什麼不用像素比對：原版格子裡是別人的照片、我們是站上的資料，
// 內容不同就會讓像素差異爆到 40% 以上——那量到的是內容不同，不是版面不同。
//
// 為什麼不連 archive.org：它會拒連（實測重試四次仍失敗），
// 而且「載不到」會被誤判成「原版沒有這個元素」，量出假的 0%。
// 原始 HTML 已經下載在 assets_src2/html/，直接讀檔最可靠也可重現。
//
//   node tools/fidelity.mjs --all              全部頁面
//   node tools/fidelity.mjs --page 好友        只量一頁（開發時用）
//   node tools/fidelity.mjs --all --json out.json   機器可讀，給 agent 用
//   node tools/fidelity.mjs <原始HTML> <我們的路徑> [名稱]
//
// ─────────────────────────────────────────────────────────────
// 2026-08-19 修正（七份測繪報告交叉查出來的量測錯誤，不是版面錯誤）：
//
//  1. 頁面配錯。`album_album_list.html` 其實是**單本相簿的照片列表**
//     （檔內 RAPID 標記 `A_pn: 'album-photo listing'`、網址 album.php?id=X&book=1），
//     舊表把它配給「相簿列表」/:user/album，等於拿 A 頁去對 B 頁，
//     憑空多出 20 個「缺漏」。相簿列表的原版是 album_index_a000000jay.html。
//  2. 單張照片永遠抓相簿第一張。第一張本來就不該有「第一張／上一張」連結
//     （原站 show_hotkey_parameters['first'] 旗標同樣如此），
//     於是 #first/#prev 被誤報成缺漏。改抓中間那張。
//  3. 沒有剝掉 <script>。原版把 FB/G+/Twitter 外掛塞在 document.write 的字串裡，
//     那些不是 HTML 結構；反過來說，我們只要塞一段死 script 就能加分。
//     兩邊都剝掉，這個分數才不能造假。
//
// 分母的處理分兩種，都會印出來，不偷偷藏：
//   NORMALIZE  兩邊都套用的正規化。id 尾巴是「資料決定的」（對方站的帳號、
//              第幾頁）就收斂成命名規則來比，比的是「我們有沒有照同樣規則產 id」。
//   EXCLUDE    真的不該進分母的（使用者貼上的 Word/FB 殘留 class…），
//              每一條都要寫理由，報表會列出被排除了幾個。
//
// 報表同時印「原始」與「可達」兩個百分比：
//   原始 = 命中 / 原版全部（含排除項）—— 跟 2026-08-18 的舊數字可以直接比
//   可達 = 命中 / (原版全部 − 排除項)  —— 這才是我們實際要推到 100% 的分母

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';
const DEMO = process.env.DEMO_USER || 'meimei';

// 原始檔 ↔ 我們的路徑。原始檔都在 assets_src2/html/。
// :PHOTO 會換成「相簿中間那張」的 id，:ALBUM 換成第一本相簿的 id。
const PAGES = [
  ['首頁',     'index_20120610082113.html',             '/'],
  ['相簿列表', 'album_index_a000000jay.html',           `/${DEMO}/album`],
  ['單本相簿', 'album_album_list.html',                 `/${DEMO}/album/:ALBUM`],
  ['單張照片', 'album_show_zh_kellyla.html',            `/${DEMO}/photo/:PHOTO`],
  ['網誌',     'blog_2012_default_skin_afuuu.html',     `/${DEMO}/blog`],
  ['留言板',   'gb_guestbook_a000000010_20131226.html', `/${DEMO}/guestbook`],
  ['名片',     'gb_user_a000000010_20120531.html',      `/${DEMO}/card`],
  ['好友',     'gb_friend_a000001_20131226.html',       `/${DEMO}/friends`],
];

// ── 正規化：兩邊都套 ──────────────────────────────────────────
// 只收斂「尾巴由資料決定」的 id。命名規則對上就算數，尾巴的值本來就不可能一樣。
const NORMALIZE = [
  { re: /^#u_.+$/,          to: '#u_*',         why: '好友清單每人一個 id，尾巴是帳號' },
  { re: /^#page_link_\d+$/, to: '#page_link_*', why: '留言板頁碼，個數由留言筆數決定' },
  { re: /^#pagelink_\d+$/,  to: '#pagelink_*',  why: '好友頁頁碼，個數由好友人數決定' },
  { re: /^#f_\d+$/,         to: '#f_*',         why: '相片/文章序號' },
];

// ── 排除：只從「原版」那邊拿掉，不會讓我們多做的東西消失 ──────
// 每一條都要有理由。報表會印出被排除幾個、為什麼。
const EXCLUDE = [
  { re: /^\.(MsoNormal|messageBody)$/,
    why: '使用者從 Word／信件貼上來的殘留 class，是內容不是版面' },
  { re: /^\.(uiInfoTable|profileInfoTable|uiList|uiListItem|uiListVerticalItemBorder|mtm|data)$/,
    why: '使用者把 Facebook 頁面複製貼進文章帶進來的 class，是內容不是版面' },
  { re: /^\.(announcement-close|shutdown)$/,
    why: '2013 年底的關站公告，本站不會宣布關站' },
];

const normalize = s => {
  for (const n of NORMALIZE) if (n.re.test(s)) return n.to;
  return s;
};
const excluded = s => EXCLUDE.find(e => e.re.test(s));

// 從 HTML 抽出結構識別字：id 與 class。
// 先剝掉 script/style/註解——那裡面的字串不是 DOM 結構（見檔頭第 3 點）。
function structure(html) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const out = new Set();
  for (const m of clean.matchAll(/\bid="([^"]+)"/g)) {
    const v = m[1].trim();
    if (v && !/^\d+$/.test(v)) out.add(normalize('#' + v));
  }
  for (const m of clean.matchAll(/\bclass="([^"]+)"/g))
    for (const c of m[1].trim().split(/\s+/))
      if (c && !/^\d+$/.test(c)) out.add(normalize('.' + c));
  return out;
}

// 抽出畫面上看得到的中文字串（去掉 script/style，取 2 字以上的中文片段）
//
// ⚠ 這個數字**不要拿來當還原度**。原版頁面上的中文大多是別人的內容
// （相簿名、文章、留言）和我們沒有的功能，量到的是內容差異不是版面差異。
// 留著只是為了看「模板用詞」有沒有跟上（例如 2012 是「回上一層」不是「回頂端」）。
function chineseStrings(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const out = new Set();
  for (const m of text.matchAll(/[一-鿿]{2,}/g)) out.add(m[0]);
  return out;
}

const pct = (a, b) => b === 0 ? 100 : Math.round(a * 100 / b);

async function compare(name, origFile, ourPath) {
  const p = path.resolve('assets_src2/html', origFile);
  if (!fs.existsSync(p)) { console.log(`${name}: 找不到原始檔 ${origFile}`); return null; }
  const orig = fs.readFileSync(p, 'utf8');

  let ours;
  try {
    const r = await fetch(BASE + ourPath);
    if (!r.ok) { console.log(`${name}: ${ourPath} 回 HTTP ${r.status}`); return null; }
    ours = await r.text();
  } catch (e) { console.log(`${name}: 抓不到我們的頁面 ${ourPath} — ${e.message}`); return null; }

  const O = structure(orig), M = structure(ours);
  const all = [...O];
  const keep = all.filter(x => !excluded(x));          // 可達分母
  const hit = keep.filter(x => M.has(x));
  const miss = keep.filter(x => !M.has(x));
  const skipped = all.filter(x => excluded(x));
  const extra = [...M].filter(x => !O.has(x));

  const oz = chineseStrings(orig), mz = chineseStrings(ours);
  const zHit = [...oz].filter(x => mz.has(x));

  const reach = pct(hit.length, keep.length);
  const raw = pct(all.filter(x => M.has(x)).length, all.length);

  console.log(`\n── ${name} ──  ${origFile}  →  ${ourPath}`);
  console.log(`   結構還原度  可達 ${reach}%  （分母 ${keep.length}，命中 ${hit.length}，缺 ${miss.length}）`
    + `   ／ 原始 ${raw}%（分母 ${all.length}）`);
  if (skipped.length) {
    const byWhy = new Map();
    for (const s of skipped) {
      const w = excluded(s).why;
      byWhy.set(w, [...(byWhy.get(w) || []), s]);
    }
    for (const [why, list] of byWhy) console.log(`   排除 ${list.length}：${list.join(' ')}　← ${why}`);
  }
  console.log(`   文案覆蓋率  ${pct(zHit.length, oz.size)}%（僅供參考，見檔頭說明）　我們額外加的 ${extra.length} 個`);
  if (miss.length) console.log(`   缺：${miss.join(' ')}`);

  return { name, file: origFile, url: ourPath, reach, raw, denom: keep.length, hit: hit.length, miss, extra, skipped };
}

// ── 找出量測要用的相簿 / 照片 id ──────────────────────────────
// 照片一定要取「中間那張」：第一張沒有上一張，原站同樣不印 #first/#prev，
// 拿第一張去量會把正常行為誤報成缺漏。
async function pickIds() {
  try {
    const alb = await (await fetch(`${BASE}/${DEMO}/album`)).text();
    const aid = [...alb.matchAll(new RegExp(`/${DEMO}/album/(\\d+)`, 'g'))].map(m => +m[1])[0];
    if (!aid) return {};
    const det = await (await fetch(`${BASE}/${DEMO}/album/${aid}`)).text();
    const pids = [...new Set([...det.matchAll(new RegExp(`/${DEMO}/photo/(\\d+)`, 'g'))].map(m => +m[1]))];
    return { album: aid, photo: pids[Math.floor(pids.length / 2)] ?? pids[0] };
  } catch { return {}; }
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? (args[jsonAt + 1] || 'fidelity.json') : null;
const pageAt = args.indexOf('--page');
const only = pageAt >= 0 ? args[pageAt + 1] : null;

if (args[0] === '--all' || only) {
  const { album, photo } = await pickIds();
  const results = [];
  for (const [name, file, tpl] of PAGES) {
    if (only && name !== only) continue;
    const url = tpl.replace(':ALBUM', album ?? '').replace(':PHOTO', photo ?? '');
    if (url.includes(':ALBUM') || url.includes(':PHOTO') || /\/(album|photo)\/$/.test(url)) {
      console.log(`\n── ${name} ── 站上還沒有相簿／照片，跳過`); continue;
    }
    const r = await compare(name, file, url);
    if (r) results.push(r);
  }
  if (results.length) {
    const avg = k => Math.round(results.reduce((s, r) => s + r[k], 0) / results.length);
    console.log('\n═══ 全站平均：結構可達 ' + avg('reach') + '%　（原始 ' + avg('raw') + '%）═══');
    for (const r of results) console.log(`     ${r.name.padEnd(6, '　')} 可達 ${String(r.reach).padStart(3)}%   缺 ${r.miss.length}`);
  }
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1)); console.log(`\n（明細寫到 ${jsonOut}）`); }
} else if (args.length >= 2) {
  await compare(args[2] || args[0], args[0], args[1]);
} else {
  console.log('用法：node tools/fidelity.mjs --all\n'
    + '      node tools/fidelity.mjs --page 好友\n'
    + '      node tools/fidelity.mjs --all --json out.json\n'
    + '      node tools/fidelity.mjs <原始HTML檔名> <我們的路徑> [名稱]');
}
