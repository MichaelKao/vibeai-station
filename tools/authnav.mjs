// 「每一頁都找得到登入／登出嗎」——手機與桌機兩種寬度各驗一次。
//
// 為什麼需要這一支：登入與登出的入口只印在頁首，而全站有三套頁首
// （head2012 給總站類頁面、head2012_site 給個人站、head2012in 給網誌內頁）。
// 只要其中一套漏掉，那一整批頁面就完全沒有入口——這不是版面問題，
// 是功能整個消失，所以量橫向溢出的 rwdprobe 與量跑版的 uicheck 都不會叫。
//
// 實際發生過兩次：
//   1. head2012.ejs 從來沒印過登入／註冊（原站的 ul.nav 是有的），
//      於是 /blogs /search /video /digu /join /help 十幾頁訪客登不進去、
//      登入的人登不出來。
//   2. wretch2012-rwd.css 的 `#kukubar-upper .right-side{display:none}`
//      在 999px 以下把整個右半邊藏掉，而帳號選單就在裡面——
//      手機使用者連進來就永遠是訪客。
//
//   BASE=http://127.0.0.1:3401 USER=jaychou PASS=demo1234 node tools/authnav.mjs
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

// 三套頁首各挑幾頁。個人站那幾頁用實際存在的帳號。
const PAGES = ['/', '/albums', '/blogs', '/rank', '/search?q=a', '/video', '/digu',
  '/join', '/hala', '/help', `/${USER}`, `/${USER}/album`, `/${USER}/blog`, `/${USER}/guestbook`];

// 元素「真的看得到」：自己與所有祖先都沒有 display:none / visibility:hidden。
// 直接傳函式給 $$eval，playwright 會自己序列化到瀏覽器裡執行。
const countVisible = els => els.filter(e => {
  let x = e;
  while (x) {
    const cs = getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    x = x.parentElement;
  }
  return true;
}).length;

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });

for (const [w, label] of [[375, '手機 375px'], [1280, '桌機 1280px']]) {
  console.log(`\n── ${label} ──`);
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();

  for (const path of PAGES) {
    const r = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    if (!r || r.status() >= 400) { ok(`${path} 開得起來`, false, 'HTTP ' + (r && r.status())); continue; }
    const n = await page.$$eval('a[href="/login"], a[href^="/login?"]', countVisible);
    ok(`訪客在 ${path} 看得到登入入口`, n > 0);
  }

  // 登入。用表單自己的 submit()，不要點「頁面上第一顆送出鈕」——
  // 那顆常常是頁首的搜尋框，會安靜地跑去 /search，後面整串都是假結果。
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  const lf = await page.$('form[action="/login"]') || await page.$('form[method=post]');
  await lf.$eval('input[name=name]', (e, v) => e.value = v, USER);
  await lf.$eval('input[name=pass]', (e, v) => e.value = v, PASS);
  await Promise.all([page.waitForNavigation(), lf.evaluate(f => f.submit())]);
  ok(`${label}：登入成功`, !page.url().endsWith('/login'), '停在 ' + page.url());

  for (const path of PAGES) {
    const r = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    if (!r || r.status() >= 400) continue;
    // 個人站的登出是收在 .bar-block-click 的下拉選單裡（原站就是這樣）。
    // 「藏在選單裡」不算壞，「連打開選單的鈕都看不到」才算。所以判定放寬成
    // 「自己看得到」或「它的下拉觸發鈕看得到」——也就是一次點擊到得了。
    const n = await page.$$eval('form[action="/logout"] button', els => els.filter(e => {
      const vis = x => { while (x) { const c = getComputedStyle(x);
        if (c.display === 'none' || c.visibility === 'hidden') return false; x = x.parentElement; } return true; };
      if (vis(e)) return true;
      const trigger = e.closest('.bar-block-click, details, .dropdown');
      return !!(trigger && vis(trigger.parentElement || trigger));
    }).length);
    ok(`登入後在 ${path} 一次點擊內到得了登出`, n > 0);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
