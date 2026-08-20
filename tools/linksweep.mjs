// 唯讀全站連結掃描：從幾個入口廣度優先爬站內連結，回報非 2xx／3xx 的頁面。
// **只送 GET**，不碰任何表單或會改資料的動作，所以對正式站跑是安全的。
//   BASE=https://… node tools/linksweep.mjs [--max 400]
const BASE = process.env.BASE || 'http://localhost:3000';
const MAX = +(process.argv[process.argv.indexOf('--max') + 1] || 400);
const SEEDS = ['/', '/albums', '/blogs', '/rank', '/search', '/help', '/video', '/digu',
  '/join', '/hala', '/svcs/wretch_girl', '/meimei', '/meimei/album', '/meimei/blog',
  '/meimei/guestbook', '/meimei/card', '/meimei/friends', '/meimei/favs', '/meimei/visitors'];
// 這些會改狀態或是登出，爬蟲不要碰
const SKIP = /^\/(logout|login\?next|report)/;
const seen = new Set(), bad = [], queue = [...SEEDS];
let n = 0;
while (queue.length && n < MAX) {
  const p = queue.shift();
  if (seen.has(p) || SKIP.test(p)) continue;
  seen.add(p); n++;
  let r;
  try { r = await fetch(BASE + p, { redirect: 'manual' }); }
  catch (e) { bad.push([p, 'fetch failed: ' + e.message]); continue; }
  if (r.status >= 400) { bad.push([p, r.status]); continue; }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('text/html')) continue;
  const html = await r.text();
  for (const m of html.matchAll(/href="(\/[^"#?]*(?:\?[^"#]*)?)"/g)) {
    const href = m[1];
    if (!seen.has(href) && queue.length + n < MAX * 2) queue.push(href);
  }
}
console.log(`掃了 ${n} 頁`);
if (bad.length) { console.log(`\n有問題 ${bad.length}：`); for (const [p, s] of bad) console.log(`  ${s}  ${p}`); }
else console.log('全部 2xx/3xx，沒有壞連結');
