// 用真的 Chrome 走「登入之後」的站主流程。
//
// 為什麼需要這一支：到目前為止所有的瀏覽器測試都是**訪客視角**——
//   uicheck / clickcheck / linksweep 都沒有登入
//   buttoncheck 有登入，但它是送 HTTP 表單，不是真的在瀏覽器裡按
// 站主每天在用的東西（建相簿、上傳、切割照片、發文、改設定）從來沒有人
// 真的用瀏覽器點過一遍。這一支補上。
//
// ⚠ 會建立與刪除資料，**只對自己開的拋棄式資料庫跑**，不吃外部 BASE。
//
//   node tools/ownerflow.mjs            跑完收工
//   HEADED=1 node tools/ownerflow.mjs   開有畫面的瀏覽器（自己看）
//   SHOTS=1 node tools/ownerflow.mjs    每一步截圖到暫存目錄
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = +(process.env.PORT || 3031);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), 'vibeai-ownerflow-' + PORT);
const SHOT_DIR = path.join(os.tmpdir(), 'vibeai-ownerflow-shots');

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, extra = '') {
  cond ? pass++ : fail++;
  results.push({ name, cond, extra });
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ← ' + extra));
}

let srv;
async function startServer() {
  // ⚠ 先確認埠是空的。被別的 server 佔著的話，我們的 server 起不來，
  // 但 fetch 又連得上（連到的是**別人的**站），test_all 第一步註冊 alpha 就會
  // 撞到「帳號已存在」整串失敗，看起來像「程式壞了」。這個坑踩過一次。
  try {
    const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(2000) });
    if (r.ok) throw new Error(
      `埠 ${PORT} 已經有人在用了（可能是先前除錯留下的 server）。\n`
      + `  用別的埠：PORT=3131 node tools/ownerflow.mjs\n`
      + `  或先關掉：netstat -ano | grep ":${PORT} " 找出 PID 再 taskkill`);
  } catch (e) {
    if (String(e.message).includes('已經有人在用')) throw e;   // 上面那個，往外丟
    /* 連不上＝埠是空的，正常往下走 */
  }
  fs.rmSync(DATA, { recursive: true, force: true });
  srv = spawn(process.execPath, ['src/server.js'],
    { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/'); break; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  // 借 test_all.mjs 灌內容（帳號 alpha/bravo/charlie，密碼 test1234）
  await new Promise((res, rej) => {
    const t = spawn(process.execPath, ['test_all.mjs'],
      { env: { ...process.env, BASE }, stdio: 'ignore' });
    t.on('exit', c => c === 0 ? res() : rej(new Error('test_all 沒過，先修那個再回來')));
  });
}

await startServer();
console.log(`站起來了：${BASE}\n`);

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pg = await ctx.newPage();

// 把主控台錯誤收起來，最後一起報。第三方 iframe 的噪音要濾掉。
const NOISE = /compute-pressure|Permissions policy violation|favicon/i;
const consoleErrors = [];
pg.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
pg.on('pageerror', e => consoleErrors.push('[未捕捉例外] ' + e.message.slice(0, 160)));
// 404 的資源要記下**是哪一個網址**，不然只看到「Failed to load resource」查不下去
const bad404 = [];
pg.on('response', r => { if (r.status() >= 400) bad404.push(r.status() + ' ' + r.url().replace(BASE, '')); });

let step = 0;
async function shot(name) {
  if (!process.env.SHOTS) return;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await pg.screenshot({ path: path.join(SHOT_DIR, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: false });
}
const go = async p => { await pg.goto(BASE + p, { waitUntil: 'networkidle' }); };
const txt = () => pg.evaluate(() => document.body.innerText);

// ── 登入 ────────────────────────────────────────────────────────────────
console.log('=== 登入 ===');
await go('/login');
await pg.fill('input[name=name]', 'alpha');
await pg.fill('input[name=pass]', 'test1234');
// ⚠ 選擇器一定要限定在登入表單裡。頁首有站內搜尋，它的送出鈕在 DOM 裡
// **排在登入鈕前面**，用 'button[type=submit]' 會點到搜尋、送出後跳到 /search?q=，
// 然後後面每一個需要登入的步驟都失敗，看起來像「登入功能壞了」。
await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action="/login"] button[type=submit]')]);
ok('登入之後回到站上', !pg.url().includes('/login'), pg.url());
await shot('login');

// ── 相簿：建立 → 進去 → 編輯 ───────────────────────────────────────────
console.log('\n=== 相簿 ===');
await go('/alpha/album');
const albBefore = await pg.$$eval('a[href*="/alpha/album/"]', a => new Set(a.map(x => x.getAttribute('href'))).size);
const titleInput = await pg.$('form[action$="/album"] input[name=title]');
ok('站主看得到「建立相簿」的表單', !!titleInput);
if (titleInput) {
  await titleInput.fill('瀏覽器測試相簿');
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action$="/album"] input[type=submit], form[action$="/album"] button')]);
  const albAfter = await pg.$$eval('a[href*="/alpha/album/"]', a => new Set(a.map(x => x.getAttribute('href'))).size);
  ok('相簿真的被建出來', albAfter > albBefore, `${albBefore} → ${albAfter}`);
  ok('新相簿的名字出現在畫面上', (await txt()).includes('瀏覽器測試相簿'));
}
await shot('album-list');

// ── 照片：進單本 → 開切割頁 ─────────────────────────────────────────────
console.log('\n=== 照片與切割 ===');
// ⚠ 要挑**有照片的**相簿。上一步剛建的「瀏覽器測試相簿」是空的，
// 而它排在最前面（ORDER BY id DESC），直接取第一個會抓到空相簿，
// 然後「相簿裡有照片可以點」就永遠 FAIL。
const albumHrefs = await pg.$$eval('a[href*="/alpha/album/"]',
  as => [...new Set(as.map(a => a.getAttribute('href')))].filter(h => /\/album\/[0-9]+$/.test(h)));
let firstAlbum = null;
for (const h of albumHrefs) {
  await pg.goto(BASE + h, { waitUntil: 'networkidle' });
  if (await pg.$('a[href*="/alpha/photo/"]')) { firstAlbum = h; break; }
}
if (firstAlbum) {
  await pg.goto(BASE + firstAlbum, { waitUntil: 'networkidle' });
  ok('單本相簿打得開', pg.url().includes('/album/'));
  const photo = await pg.$('a[href*="/alpha/photo/"]');
  if (photo) {
    await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), photo.click()]);
    ok('照片頁打得開', pg.url().includes('/photo/'));
    ok('大圖有載出來', await pg.$eval('#DisplayImage', i => i.naturalWidth > 0).catch(() => false));
    await shot('photo');
    const crop = await pg.$('a[href$="/crop"]');
    ok('站主看得到「切割照片」', !!crop);
    if (crop) {
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), crop.click()]);
      ok('切割頁打得開', pg.url().includes('/crop'));
      ok('切割頁有照片可以拖曳', await pg.$eval('#cropimg', i => i.naturalWidth > 0).catch(() => false));
      // 在圖上拖出一個範圍，確認四個數字欄位真的跟著變
      const box = await pg.$('#stage');
      if (box) {
        const b = await box.boundingBox();
        await pg.mouse.move(b.x + 20, b.y + 20);
        await pg.mouse.down();
        await pg.mouse.move(b.x + 120, b.y + 100, { steps: 8 });
        await pg.mouse.up();
        const w = await pg.$eval('#fw', i => +i.value);
        const h = await pg.$eval('#fh', i => +i.value);
        ok('拖曳之後寬高欄位有更新', w > 0 && h > 0 && w < 2000, `w=${w} h=${h}`);
        await shot('crop');
        await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('#cropform input[type=submit]')]);
        ok('切割送出後回到照片頁', pg.url().includes('/photo/'), pg.url());
        ok('切割後大圖還在（沒有變成破圖）', await pg.$eval('#DisplayImage', i => i.naturalWidth > 0).catch(() => false));
      }
    }
  } else ok('相簿裡有照片可以點', false, '沒找到照片連結');
}

// ── 網誌：發文 → 看文章 → 迴響 ─────────────────────────────────────────
console.log('\n=== 網誌 ===');
await go('/alpha/blog/new');
ok('發表文章的頁面打得開', !pg.url().includes('/login'));
const hasTitle = await pg.$('input[name=title]');
if (hasTitle) {
  await pg.fill('input[name=title]', '瀏覽器測試文章');
  await pg.fill('textarea[name=body]', '這是用真的瀏覽器發的文章。');
  const placeSel = await pg.$('#ed_place');
  if (placeSel) await pg.selectOption('#ed_place', '台灣');
  ok('文章可以選地區（看地圖要用）', !!placeSel);
  // ⚠ 同樣要限定在發文表單裡：頁首與側欄都有搜尋表單，它們的送出鈕排在前面。
  // 而且發文那個 <form> **沒有 action**（送到當前網址），不能用 action 選，
  // 改成從標題欄位往上找它所屬的表單，再點那個表單裡的送出鈕。
  const postSubmit = pg.locator('input[name=title]')
    .locator('xpath=ancestor::form[1]')
    .locator('button[type=submit], input[type=submit]').first();
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), postSubmit.click()]);
  ok('發文之後導到那篇文章', /\/alpha\/blog\/\d+/.test(pg.url()), pg.url());
  ok('文章內容出現在畫面上', (await txt()).includes('這是用真的瀏覽器發的文章'));
  await shot('post');
  // 迴響
  const cmt = await pg.$('textarea[name=body]');
  if (cmt) {
    await cmt.fill('站主自己回一則');
    await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action$="/comment"] input[type=submit], form[action$="/comment"] button')]);
    ok('迴響送得出去而且看得到', (await txt()).includes('站主自己回一則'));
  }
}

// ── 看地圖 ──────────────────────────────────────────────────────────────
console.log('\n=== 看地圖 ===');
await go('/alpha/blog');
const mapLink = await pg.$('a[href$="/blog/map"]');
ok('側欄有「看地圖」', !!mapLink);
if (mapLink) {
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), mapLink.click()]);
  ok('看地圖打得開', pg.url().includes('/blog/map'));
  ok('地圖頁列出剛才那篇（台灣）', (await txt()).includes('瀏覽器測試文章'), await txt().then(t => t.slice(0, 120)));
  await shot('map');
}

// ── 設定：自訂欄位與訂閱 ────────────────────────────────────────────────
console.log('\n=== 設定 ===');
await go('/alpha/settings');
ok('設定頁打得開', pg.url().includes('/settings'));
const folderForm = await pg.$('form[action$="/folders"]');
ok('有「網誌側欄自訂欄位」的新增表單', !!folderForm);
if (folderForm) {
  await pg.fill('form[action$="/folders"] input[name=title]', '【瀏覽器測試】');
  await pg.fill('form[action$="/folders"] textarea[name=body]', '這是自訂欄位的內容');
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action$="/folders"] input[type=submit]')]);
  await go('/alpha/blog');
  ok('自訂欄位出現在網誌側欄', (await txt()).includes('【瀏覽器測試】'));
  ok('自訂欄位用原版的 boxFolder 結構', await pg.$('#boxFolder') !== null);
}
await go('/alpha/settings');
const subForm = await pg.$('form[action$="/subs"]');
ok('有「我的訂閱」的表單', !!subForm);
if (subForm) {
  // ⚠ 這裡**不能**訂閱 http://127.0.0.1:… ——那正好會被 src/feed.js 的 SSRF
  // 防護擋掉（擋內網位址是刻意的，不是 bug）。所以這一步反過來驗：
  // 送一個內網網址進去，確認它**沒有**被建立。
  await pg.fill('form[action$="/subs"] input[name=title]', '內網測試');
  await pg.fill('form[action$="/subs"] input[name=url]', 'http://127.0.0.1:9/rss');
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action$="/subs"] input[type=submit]')]);
  ok('訂閱擋掉內網位址（SSRF 防護）', !(await txt()).includes('127.0.0.1:9'));
  // 外部 feed 沒辦法在離線測試裡驗，那一段由 test_ssrf.mjs 負責
}
await shot('settings');

// ── 好友分組 ────────────────────────────────────────────────────────────
console.log('\n=== 好友分組 ===');
await go('/alpha/friends');
ok('好友頁打得開', pg.url().includes('/friends'));
const grpForm = await pg.$('form[action$="/friendgroups"]');
ok('有「新增分類」的表單', !!grpForm);
if (grpForm) {
  await pg.fill('form[action$="/friendgroups"] input[name=name]', '瀏覽器測試組');
  await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }), pg.click('form[action$="/friendgroups"] input[type=submit]')]);
  ok('分類建立成功', (await txt()).includes('瀏覽器測試組'));
  const opt = await pg.$('#cateSelect option');
  ok('#cateSelect 的 value 是數字（照原版的 group id）',
    await pg.$$eval('#cateSelect option', os => os.every(o => /^-?\d+$/.test(o.value))).catch(() => false));
}
await shot('friends');

// ── 收尾 ────────────────────────────────────────────────────────────────
console.log('\n=== 主控台 ===');
ok('全程沒有 JS 錯誤', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' ｜ '));
const uniq404 = [...new Set(bad404)];
ok('全程沒有載不到的資源', uniq404.length === 0, uniq404.slice(0, 8).join(' ｜ '));

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
if (process.env.SHOTS) console.log(`截圖在 ${SHOT_DIR}`);
await browser.close();
srv.kill();
process.exit(fail ? 1 : 0);
