// 把每一個頁面在每一種手機寬度下截圖存檔，交給人（或代理）用眼睛看。
//
// ⚠ 為什麼需要這一支：tools/mobilecheck.mjs 量的是「有沒有橫向溢出」與
// 「按鈕有沒有被別的層蓋住」——那是**機器判斷得了**的東西。
// 「這一頁看起來對不對」它量不出來，而實際踩到的三次問題全部是這一類：
//   名片頁被改爆 93px      → 那一輪自動化**全綠**
//   搜尋範圍頁籤被改壞      → 沒抓到，看截圖才發現
//   站名壓在版型招牌上      → 沒抓到，看截圖才發現
//
// 所以這一支不做判斷，只負責把畫面**忠實地留下來**，讓眼睛去看。
//
//   BASE=https://station.vibeaico.com OUT=./shots node tools/shotsweep.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.resolve(process.env.OUT || 'shots');
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { tag: '320', width: 320, height: 568 },
  { tag: '390', width: 390, height: 844 },
  { tag: '768', width: 768, height: 1024 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ── 準備一個有內容的帳號 ──────────────────────────────────────────
// ⚠ 空帳號截出來的圖每一頁都是「還沒有…」，看了等於沒看。
// 要有文章、相簿、照片、留言、嘀咕，版面才會真的被內容撐開。
const setup = await browser.newContext();
const sp = await setup.newPage();
const N = 'shot' + Math.floor(Date.now() / 1000 % 100000);
let POST = '1', ALBUM = '1', PHOTO = '', HALA = '', JOIN = '';
const F = o => new URLSearchParams(o).toString();

await sp.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
{
  const f = sp.locator('form:has(input[name=pass2])');
  await f.locator('input[name=name]').fill(N);
  await f.locator('input[name=nick]').fill('版面巡檢');
  await f.locator('input[name=pass]').fill('test1234');
  await f.locator('input[name=pass2]').fill('test1234');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    f.locator('button[type=submit], input[type=submit], button:not([type])').first().click()]);
}
// 文章（標題刻意長一點，才看得出會不會被切）
for (const [t, b] of [
  ['這是一篇標題刻意寫得很長的測試文章看看會不會被切掉', '第一段內容。\n第二段內容，長一點才看得出行距與斷行。'],
  ['短標題', '內容'],
]) {
  await sp.goto(BASE + `/${N}/blog/new`, { waitUntil: 'domcontentloaded' });
  const pf = sp.locator('form:has(textarea)').first();
  await pf.locator('input[name=title]').fill(t);
  await pf.locator('textarea[name=body]').first().fill(b);
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    pf.locator('input[type=submit], button[type=submit]').first().click()]);
  POST = (sp.url().match(/\/blog\/(\d+)/) || [])[1] || POST;
}
// 相簿 ＋ 照片
await sp.goto(BASE + `/${N}/album`, { waitUntil: 'domcontentloaded' });
{
  const af = sp.locator('form[action$="/album"]').first();
  await af.locator('input[name=title]').fill('測試相簿');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    af.locator('input[type=submit], button[type=submit]').first().click()]);
  ALBUM = await sp.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/album/"]')]
      .map(x => (x.getAttribute('href').match(/\/album\/(\d+)/) || [])[1]).filter(Boolean);
    return a[0] || '1';
  });
}
try {
  const sharp = (await import('sharp')).default;
  const tmp = path.join(os.tmpdir(), 'ss-' + process.pid + '.png');
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 160, b: 210 } } })
    .png().toFile(tmp);
  await sp.goto(BASE + `/${N}/album/${ALBUM}`, { waitUntil: 'domcontentloaded' });
  await sp.locator('input[type=file]').first().setInputFiles([tmp, tmp, tmp]);
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }),
    sp.locator('form:has(input[type=file])').first()
      .locator('input[type=submit], button[type=submit]').first().click()]);
  PHOTO = await sp.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/photo/"]')]
      .map(x => (x.getAttribute('href').match(/\/photo\/(\d+)/) || [])[1]).filter(Boolean);
    return a[0] || '';
  });
  fs.rmSync(tmp, { force: true });
} catch (e) { console.log('[setup] 照片上傳失敗：' + e.message.slice(0, 60)); }
// 留言、嘀咕
const ck = await setup.cookies();
const post = (p, body) => fetch(BASE + p, { method: 'POST', redirect: 'manual',
  headers: { cookie: ck.map(c => c.name + '=' + c.value).join('; '),
             'content-type': 'application/x-www-form-urlencoded', origin: BASE, referer: BASE + p },
  body: F(body) });
await post(`/${N}/guestbook`, { author: '路過的訪客', body: '這是一則留言，長度剛好可以看出換行的樣子。' });
await post(`/${N}/digu`, { body: '今天天氣不錯，隨手寫一句嘀咕。' });
// 哈啦、揪團
try {
  await sp.goto(BASE + '/hala', { waitUntil: 'domcontentloaded' });
  const hf = sp.locator('form:has(textarea)').first();
  await hf.locator('input[name=title]').fill('版面巡檢用的主題');
  await hf.locator('textarea[name=body]').first().fill('內容');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    hf.locator('button[type=submit], input[type=submit]').first().click()]);
  HALA = (sp.url().match(/\/hala\/(\d+)/) || [])[1] || '';
} catch { }
try {
  await sp.goto(BASE + '/join', { waitUntil: 'domcontentloaded' });
  const jf = sp.locator('form:has(textarea)').first();
  await jf.locator('input[name=title]').fill('版面巡檢用的揪團');
  await jf.locator('textarea').first().fill('說明');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    jf.locator('button[type=submit], input[type=submit]').first().click()]);
  JOIN = (sp.url().match(/\/join\/(\d+)/) || [])[1] || '';
} catch { }
const COOKIES = await setup.cookies();
await setup.close();
console.log(`[setup] 帳號 ${N}｜文章 ${POST}｜相簿 ${ALBUM}｜照片 ${PHOTO || '無'}｜哈啦 ${HALA || '無'}｜揪團 ${JOIN || '無'}`);

const PAGES = [
  ['/', 'a01-首頁'],
  ['/albums', 'a02-相簿總站'],
  ['/blogs', 'a03-網誌總站'],
  ['/rank', 'a04-人氣排行'],
  ['/search?q=a', 'a05-搜尋結果'],
  ['/video', 'a06-影音總站'],
  ['/digu', 'a07-嘀咕總站'],
  ['/hala', 'a08-哈啦'],
  ['/join', 'a09-揪團'],
  ['/help', 'a10-服務說明'],
  ['/login', 'a11-登入'],
  ['/register', 'a12-註冊'],
  ['/forgot', 'a13-忘記密碼'],
  ['/shop', 'a14-無名小舖'],
  ['/points', 'a15-點數明細'],
  ['/vip', 'a16-認證申請'],
  ['/svcs/wretch_girl', 'a17-愛正妹'],
  ['/report', 'a18-檢舉'],
  [`/${N}`, 'b01-個人首頁'],
  [`/${N}/blog`, 'b02-網誌'],
  [`/${N}/blog/${POST}`, 'b03-單篇文章'],
  [`/${N}/blog/${POST}/edit`, 'b04-編輯文章'],
  [`/${N}/blog/new`, 'b05-發表文章'],
  [`/${N}/blog/map`, 'b06-文章地圖'],
  [`/${N}/blog/search?q=測試`, 'b07-網誌搜尋'],
  [`/${N}/album`, 'b08-相簿列表'],
  [`/${N}/album/${ALBUM}`, 'b09-單本相簿'],
  ...(PHOTO ? [[`/${N}/photo/${PHOTO}`, 'b10-單張照片']] : []),
  ...(PHOTO ? [[`/${N}/photo/${PHOTO}/crop`, 'b11-裁切照片']] : []),
  ...(PHOTO ? [[`/${N}/album/${ALBUM}/wall`, 'b12-相片牆']] : []),
  ...(PHOTO ? [[`/${N}/album/${ALBUM}/slide`, 'b13-投影片']] : []),
  [`/${N}/guestbook`, 'b14-留言板'],
  [`/${N}/guestbook?tab=new`, 'b15-我要留言'],
  [`/${N}/digu`, 'b16-嘀咕'],
  [`/${N}/card`, 'b17-名片'],
  [`/${N}/friends`, 'b18-好友'],
  [`/${N}/visitors`, 'b19-誰來我家'],
  [`/${N}/favs`, 'b20-我的收藏'],
  [`/${N}/feed`, 'b21-好友動態'],
  [`/${N}/files`, 'b22-網頁空間'],
  [`/${N}/settings`, 'b23-個人設定'],
  ...(HALA ? [[`/hala/${HALA}`, 'c01-哈啦主題']] : []),
  ...(JOIN ? [[`/join/${JOIN}`, 'c02-揪團內頁']] : []),
];

let n = 0;
for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  await ctx.addCookies(COOKIES);
  const page = await ctx.newPage();
  for (const [url, label] of PAGES) {
    try {
      const r = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 40000 });
      if (!r) continue;
      if (process.env.STRIP) {
        // ⚠ 逐屏模式：一個視窗一張，人怎麼捲就怎麼看。
        //
        // 整頁截圖（下面那個分支）有兩個會害人誤判的陷阱：
        //   1. 長頁面縮到看不見——首頁 7000px、人氣排行 12000px，
        //      縮到能顯示的尺寸只剩一百多像素寬，細節全糊掉。
        //   2. position:fixed 的元素只會被畫一次，落在頁面中段，
        //      看起來像蓋住內容（實際上它一直貼在視窗下緣）。
        // 五組代理審查整頁截圖時，這兩個陷阱各害它們誤報了一輪。
        // 逐屏截圖兩個問題都沒有。
        const h = await page.evaluate(() => document.body.scrollHeight);
        const screens = Math.min(+(process.env.MAXSCREENS || 5),
                                 Math.max(1, Math.ceil(h / size.height)));
        for (let i = 0; i < screens; i++) {
          await page.evaluate(y => window.scrollTo(0, y), i * size.height);
          await page.waitForTimeout(350);
          await page.screenshot({
            path: path.join(OUT, `${label}_${size.tag}_${String(i + 1).padStart(2, '0')}.png`) });
          n++;
        }
      } else {
        // 整頁截圖：一般長度的頁面用這個看得比較快
        await page.screenshot({ path: path.join(OUT, `${label}_${size.tag}.png`), fullPage: true });
        n++;
      }
    } catch (e) { console.log(`  ✗ ${label} ${size.tag}：${e.message.slice(0, 50)}`); }
  }
  await ctx.close();
  console.log(`[${size.tag}px] 完成`);
}
await browser.close();
console.log(`\n共 ${n} 張，存在 ${OUT}`);

// ⚠ 真的把測試帳號刪掉，不要只是印一行「清理」。
//
// 這一支原本只印 `[清理] 測試帳號 X` 就結束——**根本沒刪**。
// 對正式站跑了兩輪之後，人氣排行的第 42～44 名全是測試帳號
// （版面巡檢、溢出測試…），而且是後來逐屏看排行榜截圖才發現的。
// 訊息說做了、實際沒做，比不印還糟：看的人會以為清乾淨了。
//
// 刪除走帳號自己的路徑（要密碼），密碼對不上就跳過——萬一哪天名字
// 撞到真人的帳號，這一道會擋住。
try {
  const form = o => new URLSearchParams(o).toString();
  const H = { 'content-type': 'application/x-www-form-urlencoded', origin: BASE };
  const r = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual',
    headers: H, body: form({ name: N, pass: 'test1234' }) });
  const ck = r.headers.getSetCookie()?.[0]?.split(';')[0];
  if (r.status === 302 && ck) {
    await fetch(BASE + `/${N}/settings/delete`, { method: 'POST', redirect: 'manual',
      headers: { ...H, cookie: ck, referer: BASE + `/${N}/settings` },
      body: form({ pass: 'test1234' }) });
  }
  const gone = (await fetch(BASE + '/' + N)).status === 404;
  console.log(`[清理] 測試帳號 ${N}：${gone ? '已刪除' : '⚠ 刪不掉，請手動處理'}`);
} catch (e) {
  console.log(`[清理] 測試帳號 ${N}：⚠ 刪除時出錯（${e.message.slice(0, 40)}），請手動處理`);
}
