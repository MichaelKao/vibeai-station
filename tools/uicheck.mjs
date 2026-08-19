// 真的用瀏覽器把每一頁點過一遍：跑版、壞圖、JS 錯誤、點了會爆的按鈕。
//
// 為什麼需要這一支：
//   tools/fidelity.mjs   量「該有的節點在不在」——結構對了，版面還是可能塌
//   tools/emptycheck.mjs 量「格子裡有沒有東西」——有東西，還是可能疊在一起
// 這兩支都是拿 HTML 字串在比，**沒有跑瀏覽器**，所以看不到：
//   CSS 沒載到、元素互相蓋住、橫向捲軸跑出來、圖是壞的、點下去 500。
// 這一支用 playwright-core 開系統的 Chrome，真的把頁面畫出來再檢查。
//
//   node tools/uicheck.mjs <網址…>                 只看頁面本身
//   node tools/uicheck.mjs --click <網址…>          再把頁面上每個可點的東西點一遍
//   node tools/uicheck.mjs --json out.json <網址…>  機器可讀
//
// ⚠ --click 會按到「刪除」這類按鈕。**一定要對拋棄式的資料庫跑**：
//     DATA_DIR=/tmp/x PORT=3009 node src/server.js
//     BASE=http://localhost:3009 node tools/uicheck.mjs --click ...

import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const VIEWPORT = { width: +(process.env.VW || 1280), height: +(process.env.VH || 900) };

const args = process.argv.slice(2);
const doClick = args.includes('--click');
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const urls = args.filter((a, i) =>
  !a.startsWith('--') && !(jsonAt >= 0 && i === jsonAt + 1));

if (!urls.length) {
  console.log('用法：node tools/uicheck.mjs [--click] [--json out.json] <網址…>');
  process.exit(1);
}

// 頁面畫出來之後，在瀏覽器裡量的那些「用 HTML 字串看不出來」的問題。
const AUDIT = `(() => {
  const out = { overflowX: 0, wide: [], broken: [], clipped: [], invisible: [] };
  const vw = document.documentElement.clientWidth;

  // 1) 橫向捲軸：整頁被撐寬就是跑版
  out.overflowX = Math.max(0, document.documentElement.scrollWidth - vw);

  // 2) 比視窗還寬的元素（跑版的元凶）。只報「自己就超寬」的，
  //    父層已經超寬時子層跟著超寬是連鎖反應，報一次就好。
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;               // 固定列本來就貼齊視窗
    if (r.width > vw + 2 && (!el.parentElement ||
        el.parentElement.getBoundingClientRect().width <= vw + 2)) {
      out.wide.push({ sel: sel(el), w: Math.round(r.width), vw });
    }
  }

  // 3) 壞圖：載完了但沒有寬度＝檔案不存在或不是圖
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0)
      out.broken.push(img.getAttribute('src') || '(無 src)');
  }

  // 4) 文字被容器切掉（overflow:hidden 且內容真的超出）
  //    門檻放寬到 12px，而且只看「葉節點」——
  //    容器裡還有區塊子元素時，scrollHeight 差幾 px 多半是換行與行高造成的，
  //    一律報出來的話雜訊會蓋掉真的問題（實測一頁報 20 筆全是誤判）。
  for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,td,span,a')) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden' && cs.overflowY !== 'hidden') continue;
    const t = el.textContent.trim();
    if (!t) continue;
    if ([...el.children].some(c => getComputedStyle(c).display.startsWith('block'))) continue;
    if (el.scrollHeight > el.clientHeight + 12 || el.scrollWidth > el.clientWidth + 12)
      out.clipped.push({ sel: sel(el), t: t.slice(0, 40) });
  }

  function sel(el) {
    if (el.id) return '#' + el.id;
    const c = (el.className || '').toString().trim().split(/\\s+/).filter(Boolean)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  }
  return out;
})()`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--hide-scrollbars'] });
const results = [];
let problems = 0;

for (const u of urls) {
  const url = u.startsWith('http') ? u : BASE + u;
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  const errs = [], bad = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('[未捕捉例外] ' + e.message.slice(0, 200)));
  page.on('requestfailed', r => bad.push(`${r.failure()?.errorText} ${r.url().slice(0, 100)}`));
  page.on('response', r => {
    if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`);
  });

  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(400);
  } catch (e) {
    results.push({ url, status: 0, fatal: e.message.slice(0, 120) });
    console.log(`! ${url}\n    載不起來：${e.message.slice(0, 100)}`);
    problems++;
    await ctx.close();
    continue;
  }

  const a = await page.evaluate(AUDIT);

  // 可點的東西：站內連結、按鈕、送出鈕
  const clickables = await page.evaluate(`(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, input[type=submit]')) {
      const r = el.getBoundingClientRect();
      const label = (el.innerText || el.value || el.getAttribute('title') || '').trim().slice(0, 30);
      const href = el.getAttribute('href') || '';
      if (href.startsWith('#') || href.startsWith('javascript:')) continue;
      out.push({ tag: el.tagName.toLowerCase(), label, href,
                 visible: r.width > 0 && r.height > 0 });
    }
    return out;
  })()`);

  const r = { url, status, errs, bad: [...new Set(bad)], ...a,
              clickable: clickables.length,
              hidden: clickables.filter(c => !c.visible).length };
  results.push(r);

  const flags = [];
  if (status >= 400) flags.push(`HTTP ${status}`);
  if (a.overflowX > 2) flags.push(`橫向溢出 ${a.overflowX}px`);
  if (a.wide.length) flags.push(`超寬元素 ${a.wide.length}`);
  if (a.broken.length) flags.push(`壞圖 ${a.broken.length}`);
  if (a.clipped.length) flags.push(`文字被切 ${a.clipped.length}`);
  if (errs.length) flags.push(`JS 錯誤 ${errs.length}`);
  if (r.bad.length) flags.push(`失敗請求 ${r.bad.length}`);
  if (flags.length) problems++;

  console.log(`${flags.length ? '!' : ' '} ${url}　可點 ${clickables.length}`
    + (flags.length ? `\n    ${flags.join('　')}` : ''));
  for (const w of a.wide.slice(0, 3)) console.log(`      超寬 ${w.sel} ${w.w}px > 視窗 ${w.vw}px`);
  for (const b of a.broken.slice(0, 5)) console.log(`      壞圖 ${b}`);
  for (const c of a.clipped.slice(0, 3)) console.log(`      被切 ${c.sel}「${c.t}」`);
  for (const e of errs.slice(0, 3)) console.log(`      JS  ${e}`);
  for (const b of r.bad.slice(0, 5)) console.log(`      req ${b}`);

  // --click：把頁面上每個可點的東西真的點一遍，看會不會爆
  if (doClick) {
    const seen = new Set();
    for (const c of clickables) {
      if (c.tag !== 'a' || !c.href || seen.has(c.href)) continue;
      seen.add(c.href);
      let target;
      try { target = new URL(c.href, url); } catch { continue; }
      if (target.origin !== new URL(BASE).origin) continue;      // 站外連結不點
      try {
        const resp = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const st = resp?.status() ?? 0;
        if (st >= 400) { console.log(`      ✗ 點「${c.label}」→ HTTP ${st}  ${target.pathname}${target.search}`); problems++; }
      } catch (e) {
        console.log(`      ✗ 點「${c.label}」→ ${e.message.slice(0, 60)}`); problems++;
      }
    }
  }

  await ctx.close();
}

await browser.close();
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
console.log(`\n檢查 ${urls.length} 頁，${problems} 頁有問題`);
process.exit(problems ? 1 : 0);
