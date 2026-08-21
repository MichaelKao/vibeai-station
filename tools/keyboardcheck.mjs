// 「只用鍵盤能不能操作」——Tab 選得到，Enter 按得動。
//
// ⚠ 稽核抓到的是 kukubar 那幾顆「展開」：原站寫成 <span tabindex="3">，
// tabindex 讓它**選得到**，但瀏覽器只對 <button> 與 <a href> 把 Enter／Space
// 轉成 click——span 不會。用鍵盤的人 Tab 到那顆按下去完全沒反應，
// 底下整個選單（我的小站／我的相簿／個人設定／登出）永遠打不開。
// 這種問題滑鼠測試一輩子都測不到，所以要用真的按鍵去驗。
//
//   BASE=http://127.0.0.1:3403 node tools/keyboardcheck.mjs
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const USER = process.env.USER_NAME || 'alpha';
const PASS = process.env.USER_PASS || 'test1234';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
const lf = await page.$('form[action="/login"]') || await page.$('form[method=post]');
await lf.$eval('input[name=name]', (e, v) => e.value = v, USER);
await lf.$eval('input[name=pass]', (e, v) => e.value = v, PASS);
await Promise.all([page.waitForNavigation(), lf.evaluate(f => f.submit())]);
ok('登入成功', !page.url().endsWith('/login'), '停在 ' + page.url());

for (const path of [`/${USER}`, `/${USER}/album`, `/${USER}/blog`, `/${USER}/guestbook`]) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });

  const btns = await page.$$('#kukubar-upper [role="button"], #kukubar-lower [role="button"]');
  ok(`${path} 的「展開」有被標成按鈕`, btns.length > 0, '一顆都沒有');

  for (const [n, btn] of btns.entries()) {
    // 只用鍵盤：先 focus，再按 Enter
    await btn.focus();
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    if (focused !== 'button') { ok(`${path} 第 ${n + 1} 顆展開 Tab 選得到`, false, 'focus 跑到 ' + focused); continue; }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const opened = await btn.evaluate(el => {
      const blk = el.closest('.bar-block-click');
      return !!(blk && blk.classList.contains('expanded-btn'));
    });
    ok(`${path} 第 ${n + 1} 顆展開按 Enter 打得開`, opened);
    const aria = await btn.getAttribute('aria-expanded');
    ok(`${path} 第 ${n + 1} 顆展開會回報 aria-expanded`, aria === String(opened), 'aria-expanded=' + aria);
    // 收回去，免得影響下一顆
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
