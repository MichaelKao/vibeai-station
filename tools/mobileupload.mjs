// 手機上傳得了照片嗎。
//
// ⚠ 為什麼要單獨一支：這是相簿站的核心功能，而我先前的手機測試
// 一次都沒有碰過檔案上傳——mobilecheck 只量版面、mobileflow 走的是
// 純文字的表單。「上傳」在手機上是完全不同的一條路徑：
//   input[type=file] 的外觀與可點區域跟桌機不一樣
//   多檔選取、配額、EXIF、縮圖都是在送出之後才發生
//   失敗時的錯誤訊息要看得到（手機畫面小，訊息被擠掉就等於沒有）
//
//   BASE=http://127.0.0.1:3000 node tools/mobileupload.mjs
import { chromium } from 'playwright-core';
import { deleteTestAccount } from './cleanup.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '  ' + e)); };

// 測試圖用 sharp 真的產一張。
//
// ⚠ 不要手貼一段 base64 當測試圖。第一版就是那樣，貼進去的那串其實
// **檔頭正常、影像資料損壞**——sharp 的 metadata() 只讀檔頭，所以看起來
// 是一張 8×8 的 PNG，真的要解碼時才 libpng read error。
// 結果整支測試報「手機上傳不了照片」，害我先去翻上傳路由找不存在的 bug。
// 圖片相關的測試，測試資料要用真的編碼器產生。
const sharp = (await import('sharp')).default;
const TMP = path.join(os.tmpdir(), 'mup-' + process.pid);
fs.mkdirSync(TMP, { recursive: true });
const IMG = path.join(TMP, 'test-photo.png');
await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 120, b: 40 } } })
  .png().toFile(IMG);
// 一個假裝成圖片的壞檔——錯誤訊息要看得到
const BAD = path.join(TMP, 'not-an-image.png');
fs.writeFileSync(BAD, Buffer.from('這不是圖片，只是純文字'));

// ⚠ 另一種壞法：**檔頭正常、影像資料損壞**。
// 這種檔會通過「這是不是圖片」那道檢查（metadata() 只讀檔頭），
// 要到真的解碼才炸。下載中斷、隨身碟壞軌、傳輸出錯都會產生這種檔，
// 是真實使用者會遇到的。錯誤訊息要講得出「是你的檔壞了」，
// 不然他只會一直重傳同一張。
//
// ⚠ 這個檔案不能用「把好圖的中段塗掉」來做——那樣連 PNG 的 CRC 都對不上，
// sharp 在 metadata() 就回「Input buffer has corrupt header」，被更前面那道
// 擋掉，新的錯誤訊息一次都跑不到，測試會**因為錯的理由而通過**。
// （第一版就是這樣，log 裡查不到解碼失敗那行才發現。）
// 下面這串是真的會過檔頭、解碼才炸的樣本：metadata() 讀成 8×8 的 PNG，
// 實際解碼是 vipspng: libpng read error。
const CORRUPT = path.join(TMP, 'corrupt.png');
fs.writeFileSync(CORRUPT, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR4nGP8//8/AzGAiShV' +
  'oxpHNY5qHNU4qnFU46jGUY0jUyMAd0oD/wR6uEcAAAAASUVORK5CYII=', 'base64'));

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
});
const p = await ctx.newPage();
const N = 'mup' + Math.floor(Date.now() / 1000 % 100000);

await p.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
const rf = p.locator('form:has(input[name=pass2])');
await rf.locator('input[name=name]').fill(N);
await rf.locator('input[name=nick]').fill('上傳測試');
await rf.locator('input[name=pass]').fill('test1234');
await rf.locator('input[name=pass2]').fill('test1234');
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  rf.locator('button[type=submit],input[type=submit],button:not([type])').first().click()]);
ok('準備：註冊得起來', p.url().includes(N));

// 建相簿
await p.goto(BASE + `/${N}/album`, { waitUntil: 'networkidle' });
const af = p.locator('form[action$="/album"]').first();
await af.locator('input[name=title]').fill('手機上傳測試');
await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  af.locator('input[type=submit],button[type=submit]').first().tap()]);
const aid = (await p.evaluate(() => {
  const a = [...document.querySelectorAll('a[href*="/album/"]')]
    .map(x => (x.getAttribute('href').match(/\/album\/(\d+)/) || [])[1]).filter(Boolean);
  return a[0];
}));
ok('準備：建得了相簿', !!aid, '找不到相簿 id');

if (aid) {
  await p.goto(BASE + `/${N}/album/${aid}`, { waitUntil: 'networkidle' });

  // 上傳的入口在手機上要看得到、按得到
  const file = p.locator('input[type=file]').first();
  ok('相簿頁有上傳欄位', await file.count() > 0);
  const box = await file.boundingBox().catch(() => null);
  ok('上傳欄位在手機上看得到（不是 0 尺寸或在畫面外）',
     !!box && box.width > 0 && box.height > 0 && box.y >= 0,
     box ? JSON.stringify(box) : '量不到，可能被藏起來了');

  // 真的傳一張
  await file.setInputFiles(IMG);
  const form = p.locator('form:has(input[type=file])').first();
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    form.locator('input[type=submit],button[type=submit]').first().tap()]);
  const body = await p.textContent('body');
  ok('手機上傳得了照片', /上傳了\s*1\s*張|1\s*pictures|1 張/.test(body),
     '送出後頁面上找不到「上傳了 1 張」——' + body.slice(0, 120).replace(/\s+/g, ' '));

  // 照片真的出現在相簿裡
  await p.goto(BASE + `/${N}/album/${aid}`, { waitUntil: 'networkidle' });
  const n = await p.evaluate(() => document.querySelectorAll('a[href*="/photo/"]').length);
  ok(`照片真的進到相簿裡（${n} 張）`, n > 0, '上傳說成功了，但相簿裡看不到');

  // 壞檔要講清楚，不能默默當成功
  await p.locator('input[type=file]').first().setInputFiles(BAD);
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    p.locator('form:has(input[type=file])').first()
      .locator('input[type=submit],button[type=submit]').first().tap()]);
  const b2 = await p.textContent('body');
  ok('壞檔會講出原因，不會謊稱上傳成功',
     /不能收|失敗|不支援|格式/.test(b2) && !/上傳了\s*1\s*張/.test(b2),
     '畫面上沒有任何說明——使用者只會覺得「傳了但不見了」：' + b2.slice(0, 120).replace(/\s+/g, ' '));

  // 檔頭正常、影像資料損壞的那一種
  await p.goto(BASE + `/${N}/album/${aid}`, { waitUntil: 'networkidle' });
  await p.locator('input[type=file]').first().setInputFiles(CORRUPT);
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    p.locator('form:has(input[type=file])').first()
      .locator('input[type=submit],button[type=submit]').first().tap()]);
  const b3 = await p.textContent('body');
  // ⚠ 這裡要的不只是「有擋下來」，而是**訊息看得懂**。
  // 原本一律回一句「產生不出縮圖」——那句話對使用者毫無意義，
  // 他不知道是自己的檔壞了還是網站壞了，只會一直重傳同一張。
  ok('內容損壞的圖會說是檔案壞了，而不是「產生不出縮圖」',
     /損壞|壞掉/.test(b3) && !/產生不出縮圖/.test(b3),
     '訊息是：' + (b3.match(/不能收[^）]*）/) || ['(找不到訊息)'])[0]);
}

await browser.close();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
await deleteTestAccount(BASE, N);
process.exit(fail ? 1 : 0);
