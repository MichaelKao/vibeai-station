// RWD 迭代用：開正式站頁面，注入本機 public/wretch2012-rwd.css（覆蓋線上那份），
// 再量橫向溢出與超寬元素。這樣不必等部署、也不必本機有資料。
//   VW=375 node tools/rwdprobe.mjs [--raw] <路徑…>
//   --raw 不注入，量線上現況
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'https://station-production-6d38.up.railway.app';
const VW = +(process.env.VW || 375);
const args = process.argv.slice(2);
const raw = args.includes('--raw');
const detail = args.includes('--detail');
const paths = args.filter(a => !a.startsWith('--'));
const CSS = fs.readFileSync('public/wretch2012-rwd.css', 'utf8');

const AUDIT = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { overflowX: Math.max(0, document.documentElement.scrollWidth - vw), wide: [] };
  const sel = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    if (el.className && typeof el.className === 'string')
      s += '.' + el.className.trim().split(/\s+/).slice(0,3).join('.');
    return s;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    if (r.width > vw + 2 && (!el.parentElement || el.parentElement.getBoundingClientRect().width <= vw + 2)) {
      let chain = [], p = el;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) chain.push(sel(p));
      out.wide.push({ sel: sel(el), w: Math.round(r.width),
        css: cs.width + '/' + cs.minWidth + '/' + cs.display + '/' + cs.float,
        attrW: el.getAttribute('width') || '', chain: chain.join(' < ') });
    }
  }
  return out;
})()`;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: VW, height: 900 } });
let bad = 0;
for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  if (!raw) await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(150);
  const r = await page.evaluate(AUDIT);
  if (r.overflowX || r.wide.length) {
    bad++;
    console.log(`${p}  溢出 ${r.overflowX}px  超寬 ${r.wide.length}`);
    for (const w of r.wide) {
      console.log(`   ${w.sel} = ${w.w}px  [${w.css}] attrW=${w.attrW}`);
      if (detail) console.log(`      ${w.chain}`);
    }
  }
}
console.log(`\n${paths.length} 頁，${bad} 頁有問題（VW=${VW}${raw ? ' 線上原樣' : ' 注入本機 CSS'}）`);
await browser.close();
