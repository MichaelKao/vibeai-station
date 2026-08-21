// 「每個輸入框都唸得出名字嗎」——無障礙的最低標準。
//
// 讀螢幕軟體唸一個輸入框時，會找這四個東西之一：
//   <label for="它的 id">、把它包起來的 <label>、aria-label、aria-labelledby
// 四個都沒有的話，使用者聽到的只有「編輯方塊」——不知道那一格要填什麼。
// placeholder **不算**：一開始打字就消失，而且多數讀螢幕軟體不唸。
//
// 稽核在 views/settings.ejs 一頁就抓到 14 個。這一支把全站掃一遍，
// 用真的瀏覽器算（accessibility name 是瀏覽器算出來的，字串比對做不到）。
//
//   BASE=http://127.0.0.1:3402 USER_NAME=jaychou USER_PASS=demo1234 node tools/labelcheck.mjs
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

// 一個控制項「有名字」的判定。跟瀏覽器算 accessibility name 的規則同一套，
// 只取實務上會用到的那幾條。
const unnamed = els => els.filter(e => {
  if (e.type === 'hidden' || e.type === 'submit' || e.type === 'button' || e.type === 'reset') return false;
  if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;  // 藏起來的不算
  if (e.getAttribute('aria-label')?.trim()) return false;
  if (e.getAttribute('aria-labelledby')) return false;
  if (e.getAttribute('title')?.trim()) return false;
  if (e.closest('label')) return false;
  if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return false;
  return true;
}).map(e => (e.tagName + '[' + (e.type || '') + '] name=' + (e.name || '(無)')));

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// 登入（很多有表單的頁面要登入才看得到）
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
const lf = await page.$('form[action="/login"]') || await page.$('form[method=post]');
await lf.$eval('input[name=name]', (e, v) => e.value = v, USER);
await lf.$eval('input[name=pass]', (e, v) => e.value = v, PASS);
await Promise.all([page.waitForNavigation(), lf.evaluate(f => f.submit())]);
ok('登入成功', !page.url().endsWith('/login'), '停在 ' + page.url());

const PAGES = ['/login', '/register', '/search?q=a', `/${USER}/settings`, `/${USER}/guestbook`,
  `/${USER}/blog/new`, `/${USER}/album`, `/${USER}/friends`, '/albums', '/blogs', '/hala', '/join'];

for (const path of PAGES) {
  const r = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  if (!r || r.status() >= 400) { ok(`${path} 開得起來`, false, 'HTTP ' + (r && r.status())); continue; }
  const bad = await page.$$eval('input, textarea, select', unnamed);
  ok(`${path} 每個輸入框都有名字`, bad.length === 0, bad.join('　'));
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
