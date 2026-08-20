// 唯讀全站連結掃描：從幾個入口廣度優先爬站內連結，回報非 2xx／3xx 的頁面。
// **只送 GET**，不碰任何表單或會改資料的動作，所以對正式站跑是安全的。
//   BASE=https://… node tools/linksweep.mjs [--max 400]
//
// 為什麼需要這一支：tools/uicheck.mjs 是一頁一頁指定網址去看版面，
// 但「哪一頁連到一個會 500 的網址」只有真的把整站爬過才找得到。
// /:name/album/rss 全站 500（具名路由被 /album/:id 吃掉）就是這樣抓到的。
const BASE = process.env.BASE || 'http://localhost:3000';
const MAX = +(process.argv[process.argv.indexOf('--max') + 1] || 400);
const SEEDS = ['/', '/albums', '/blogs', '/rank', '/search', '/help', '/video', '/digu',
  '/join', '/hala', '/svcs/wretch_girl', '/meimei', '/meimei/album', '/meimei/blog',
  '/meimei/guestbook', '/meimei/card', '/meimei/friends', '/meimei/favs', '/meimei/visitors'];
// 這些會改狀態或是登出，爬蟲不要碰
const SKIP = /^\/(logout|login\?next|report)/;
// href 是從 HTML 純字串比對抓的，會連 <script> 裡用字串組出來的網址一起抓到
// （例如 "/' + encodeURIComponent(name) + '/friends"）。那不是頁面上真的存在的連結，
// 濾掉，不然每次都會多三筆假的 404。
const BOGUS = /[+'`${}]|encodeURI/;

const seen = new Set(), bad = [], queue = SEEDS.map(p => [p, '(入口)']);
let n = 0;
while (queue.length && n < MAX) {
  const [p, ref] = queue.shift();
  if (seen.has(p) || SKIP.test(p) || BOGUS.test(p)) continue;
  seen.add(p); n++;
  let r;
  try { r = await fetch(BASE + p, { redirect: 'manual' }); }
  catch (e) { bad.push([p, 'fetch failed: ' + e.message, ref]); continue; }
  if (r.status >= 400) { bad.push([p, r.status, ref]); continue; }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('text/html')) continue;
  const html = await r.text();
  for (const m of html.matchAll(/href="(\/[^"#?]*(?:\?[^"#]*)?)"/g)) {
    const href = m[1];
    // 壞連結一定要講得出「是哪一頁連過去的」，不然回頭找不到源頭
    if (!seen.has(href) && queue.length + n < MAX * 2) queue.push([href, p]);
  }
}
console.log(`掃了 ${n} 頁`);
if (bad.length) {
  console.log(`\n有問題 ${bad.length}：`);
  for (const [p, st, ref] of bad) console.log(`  ${st}  ${p}   ← 來自 ${ref}`);
} else console.log('全部 2xx/3xx，沒有壞連結');
