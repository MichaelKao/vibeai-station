// 「看得到卻點不到」的連結掃描。
//
// tools/uicheck.mjs --dead 是真的按下去（會改資料，只能對拋棄式資料庫跑）。
// 這一支不按，改成問瀏覽器：這個連結的中心點，實際上會收到點擊的是誰？
// 不是自己 ＝ 被別的元素蓋住了，看得到但點不到。**唯讀，對正式站安全**。
//   BASE=https://… VW=375 node tools/clickcheck.mjs <路徑…>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const VW = +(process.env.VW || 1280);
// 迭代用：INJECT=a.css,b.css 把本機那幾支 CSS 注入到頁面最後蓋掉線上那份，
// 改一輪量一輪、不必等部署（同 tools/rwdprobe.mjs 的做法）。
const INJECT = (process.env.INJECT || '').split(',').filter(Boolean)
  .map(f => fs.readFileSync(f, 'utf8'));

const AUDIT = `(() => {
  const out = [];
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
    (typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\s+/).slice(0,2).join('.') : '');
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/')) continue;          // 只看站內連結
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    // 本來就藏起來的（未展開的頁籤、下拉、圖片替換文字）不算壞
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let hidden = false;
    for (let p = a; p; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.visibility === 'hidden' || c.display === 'none' || c.opacity === '0') { hidden = true; break; }
    }
    if (hidden) continue;
    const bad = [];
    if (r.width === 0 || r.height === 0) bad.push('尺寸 0');
    if (cs.pointerEvents === 'none') bad.push('pointer-events:none');
    // ⚠ 先把連結捲到畫面正中間再判。
    // #kukubar-lower 是**固定在視窗底部**的工具列，頁面一載入時，
    // 剛好落在它後面的連結都會被判成「被蓋住」——但那些連結只要捲一下
    // 就跑出來了，其實點得到。不捲就判會生出一大批假的壞連結。
    if (r.width && r.height) {
      a.scrollIntoView({ block: 'center' });
      const r2 = a.getBoundingClientRect();
      const el = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
      if (el && !(el === a || a.contains(el) || el.contains(a)))
        bad.push('被 ' + name(el) + ' 蓋住');
    }
    if (bad.length) out.push({ t: (a.textContent || '').trim().slice(0, 16), href, w: Math.round(r.width), h: Math.round(r.height), why: bad.join(' / ') });
  }
  return out;
})()`;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: VW, height: 900 } });
let bad = 0;
for (const p of process.argv.slice(2)) {
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  for (const css of INJECT) await page.addStyleTag({ content: css });
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await page.evaluate(AUDIT);
  if (r.length) {
    bad++;
    console.log(`! ${p}  點不到的連結 ${r.length}`);
    for (const x of r.slice(0, 8)) console.log(`    「${x.t}」 ${x.href}  ${x.w}x${x.h}  ${x.why}`);
  }
}
console.log(`\n檢查 ${process.argv.length - 2} 頁，${bad} 頁有點不到的連結（VW=${VW}）`);
await browser.close();
