// Safari（WebKit）上會不會壞——用真的 Safari 引擎，不是模擬。
//
// ⚠ 為什麼一定要另外測：先前所有的「手機測試」跑的都是 Chromium。
// 在台灣，iPhone 的佔比很高，而 iPhone 上**所有**瀏覽器都是 Safari 的
// WebKit（iOS 規定的），所以 Chromium 全綠不代表 iPhone 沒事。
//
// WebKit 有幾類自己的毛病，Chromium 一輩子都測不到：
//   position:fixed 在鍵盤彈出／捲動慣性時的行為不同
//   100vh 把網址列的高度算進去，底部會被切掉
//   date/time 輸入、-webkit-appearance 的預設樣式差很多
//   flex/grid 的舊語法與 gap 支援度
//   Intl / Date 解析比 Chromium 嚴格（'2024-01-01 10:00' 這種會 NaN）
//
//   BASE=https://station.vibeaico.com node tools/safaricheck.mjs
import { webkit } from 'playwright-core';
import { deleteTestAccount } from './cleanup.mjs';

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '  ' + e)); };

// WebKit 用 Playwright 自己下載的那一份（跟 Chrome 不同，沒有系統版可借）
const browser = await webkit.launch({ headless: !process.env.HEADED });

const DEVICES = [
  { name: 'iPhone Safari', width: 390, height: 844, mobile: true },
  { name: 'iPad Safari',   width: 768, height: 1024, mobile: true },
];

// 先在一個 context 裡註冊，後面各裝置共用 cookie
const setup = await browser.newContext();
const sp = await setup.newPage();
const N = 'sfr' + Math.floor(Date.now() / 1000 % 100000);
let COOKIES = [];
try {
  await sp.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
  const f = sp.locator('form:has(input[name=pass2])');
  await f.locator('input[name=name]').fill(N);
  await f.locator('input[name=nick]').fill('Safari 測試');
  await f.locator('input[name=pass]').fill('test1234');
  await f.locator('input[name=pass2]').fill('test1234');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    f.locator('button[type=submit],input[type=submit],button:not([type])').first().click()]);
  ok('Safari 上註冊得起來', sp.url().includes(N), '停在 ' + sp.url());
  COOKIES = await setup.cookies();
} catch (e) {
  ok('Safari 上註冊得起來', false, e.message.slice(0, 80));
}
await setup.close();

const PAGES = [
  ['/', '首頁'], ['/albums', '相簿總站'], ['/blogs', '網誌總站'],
  ['/rank', '人氣排行'], ['/shop', '無名小舖'], ['/help', '服務說明'],
  ['/login', '登入'], ['/register', '註冊'],
  [`/${N}`, '個人首頁', true], [`/${N}/blog`, '網誌', true],
  [`/${N}/album`, '相簿', true], [`/${N}/guestbook`, '留言板', true],
  [`/${N}/settings`, '個人設定', true], [`/${N}/blog/new`, '發表文章', true],
];

for (const d of DEVICES) {
  console.log(`\n── ${d.name}（${d.width}px）────────────────────────────`);
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    isMobile: d.mobile, hasTouch: d.mobile, deviceScaleFactor: 2,
  });
  if (COOKIES.length) await ctx.addCookies(COOKIES);
  const page = await ctx.newPage();

  // ⚠ JS 例外要抓。WebKit 對某些語法比 Chromium 嚴格，
  // 而畫面上看不出來——腳本從中斷的那一行之後就都沒跑，
  // 表現是「某個按鈕沒反應」而不是「網站壞了」。
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(String(e.message).slice(0, 100)));

  for (const [path, label, needsLogin] of PAGES) {
    if (needsLogin && !COOKIES.length) continue;
    jsErrors.length = 0;
    let r;
    try { r = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 40000 }); }
    catch (e) { ok(`${d.name} ${label} 開得起來`, false, e.message.slice(0, 70)); continue; }
    if (!r || r.status() >= 400) { ok(`${d.name} ${label} 開得起來`, false, 'HTTP ' + (r && r.status())); continue; }

    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    ok(`${d.name} ${label} 不會左右破版`, m.scrollW - m.clientW <= 1,
       `頁面寬 ${m.scrollW}px、螢幕 ${m.clientW}px`);

    ok(`${d.name} ${label} 沒有 JavaScript 例外`, jsErrors.length === 0,
       'WebKit 丟出：' + jsErrors.slice(0, 2).join(' ｜ ') +
       '（腳本從那一行之後就沒再跑，畫面上看不出來，只會覺得某顆按鈕沒反應）');
  }
  await ctx.close();
}

// ── Safari 上做得完事情嗎 ────────────────────────────────────────────
{
  console.log('\n── Safari 上做得完事情嗎（真的觸控）──────────────────');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  if (COOKIES.length) await ctx.addCookies(COOKIES);
  const p = await ctx.newPage();

  try {
    await p.goto(BASE + `/${N}/blog/new`, { waitUntil: 'networkidle' });
    const pf = p.locator('form:has(textarea)').first();
    await pf.locator('input[name=title]').fill('Safari 發的文');
    await pf.locator('textarea[name=body]').first().fill('在 Safari 上打的內容');
    await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      pf.locator('input[type=submit],button[type=submit]').first().tap()]);
    await p.goto(BASE + `/${N}/blog`, { waitUntil: 'networkidle' });
    ok('Safari 上發得了文', (await p.textContent('body')).includes('Safari 發的文'));
  } catch (e) { ok('Safari 上發得了文', false, e.message.slice(0, 80)); }

  try {
    await p.goto(BASE + `/${N}/guestbook?tab=new`, { waitUntil: 'networkidle' });
    const gf = p.locator('form[action*="guestbook"]').first();
    await gf.locator('textarea[name=body]').first().fill('Safari 留言');
    await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      gf.locator('input[type=submit],button[type=submit]').first().tap()]);
    await p.goto(BASE + `/${N}/guestbook`, { waitUntil: 'networkidle' });
    ok('Safari 上留得了言', (await p.textContent('body')).includes('Safari 留言'));
  } catch (e) { ok('Safari 上留得了言', false, e.message.slice(0, 80)); }

  // 登出：Safari 對 form + button 的處理跟 Chromium 有過差異
  try {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const lo = p.locator('form[action="/logout"] button').first();
    if (await lo.count()) {
      await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), lo.tap()]);
      ok('Safari 上登得出去', /會員登入|Login/.test(await p.textContent('body')));
    } else ok('首頁有登出按鈕', false, '找不到');
  } catch (e) { ok('Safari 上登得出去', false, e.message.slice(0, 80)); }

  await ctx.close();
}

// ── iOS Safari 專屬的坑 ──────────────────────────────────────────────
//
// 這幾項在 Chromium 上**完全不存在**，所以前面所有測試都測不到，
// 但它們就是真實 iPhone 使用者說「這網站在手機上很難用」的來源。
{
  console.log('\n── iOS Safari 專屬的坑 ────────────────────────────');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  });
  if (COOKIES.length) await ctx.addCookies(COOKIES);
  const p = await ctx.newPage();

  // 1) 輸入框字級 < 16px → iOS 一聚焦就把整頁放大
  //
  // ⚠ 這是 iPhone 上最惱人也最常見的一個，而且**只有 iOS 會這樣**：
  // Safari 認為小於 16px 的輸入框「太小看不清楚」，於是使用者一點進去打字，
  // 整個頁面就自動縮放，打完還不會縮回去——版面歪掉、要自己雙指縮回原狀。
  // 原站是 2012 年的桌機站，滿滿都是 12px 的輸入框，直接搬過來必踩。
  //
  // 站上的版型刻意保留 12px 字級（還原度），所以解法不是把字改大，
  // 是在 RWD 圖層裡只對「窄螢幕的輸入框」給 16px。
  for (const [url, label] of [['/login', '登入'], ['/register', '註冊'],
                              ['/forgot', '忘記密碼'], [`/${N}/blog/new`, '發表文章'],
                              [`/${N}/guestbook?tab=new`, '留言']]) {
    try {
      const r = await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 });
      if (!r || r.status() >= 400) continue;
    } catch { continue; }
    const small = await p.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll(
        'input[type=text],input[type=password],input[type=email],input[type=url],' +
        'input[type=search],input[type=number],input:not([type]),textarea,select')) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;      // 看不到的不算
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) bad.push((el.name || el.id || el.tagName.toLowerCase()) + ' ' + fs + 'px');
      }
      return [...new Set(bad)].slice(0, 5);
    });
    ok(`${label} 的輸入框在 iOS 不會一點就放大整頁`, small.length === 0,
       '字級小於 16px：' + small.join('、') +
       '——iPhone 使用者一點進去打字，整頁就被自動放大，打完也不會縮回去');
  }

  // 2) 100vh 在 iOS 會把網址列的高度算進去
  // ⚠ 結果是頁面底部被網址列蓋掉一截，最常見的災情是「送出鈕看不到」。
  const vh = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const s = el.style.height + ' ' + el.style.minHeight;
      if (/100vh/.test(s)) bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
    }
    return bad.slice(0, 5);
  });
  ok('沒有用 100vh 撐高度（iOS 會把網址列算進去）', vh.length === 0, vh.join('、'));

  await ctx.close();
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
await deleteTestAccount(BASE, N);
process.exit(fail ? 1 : 0);
