// 長頁面要「一個視窗一張」地看，不能用整頁截圖。
//
// ⚠ 為什麼：tools/shotsweep.mjs 用的是 fullPage 截圖，對一般頁面很好用，
// 但碰到很長的頁面就失效了——首頁整頁 7000px、人氣排行 12000px，
// 縮到看得下的尺寸之後只剩一百多像素寬，**細節全部糊掉，等於沒看**。
// 實測就是這樣：五組代理審查那幾張時其實什麼都看不見，回報的描述因此
// 明顯失準。改成照「人怎麼捲就怎麼看」截，第一屏就抓到了導覽列的
// 精靈圖露出下一排。
//
// 另外，fullPage 截圖還有一個假象要知道：position:fixed 的元素（站上底部
// 那條工具列）在整頁截圖裡**只會被畫一次**，落在頁面中段，看起來像蓋住
// 內容。用這一支就不會有那個問題——視窗截圖裡它就在該在的地方。
//
//   BASE=https://station.vibeaico.com OUT=./strip \
//   PAGES="/|首頁,/rank|人氣排行" node tools/stripshot.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const OUT = process.env.OUT;
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const MAX = +(process.env.MAX || 6);
const PAGES = (process.env.PAGES || '').split(',').filter(Boolean).map(s => s.split('|'));

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
});
if (process.env.COOKIES) ctx.addCookies(JSON.parse(process.env.COOKIES));
const page = await ctx.newPage();

for (const [url, name] of PAGES) {
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 40000 });
    const h = await page.evaluate(() => document.body.scrollHeight);
    const n = Math.min(MAX, Math.max(1, Math.ceil(h / H)));
    for (let i = 0; i < n; i++) {
      await page.evaluate(y => window.scrollTo(0, y), i * H);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${name}-${String(i + 1).padStart(2, '0')}.png` });
    }
    console.log(`  ${name}：頁高 ${h}px，截了 ${n} 屏`);
  } catch (e) {
    console.log(`  ${name}：失敗 ${e.message.slice(0, 60)}`);
  }
}
await browser.close();
