// 手機上會不會破版——真的用手機尺寸把每一頁畫出來量。
//
// ⚠ 為什麼要另外一支：tools/touchcheck.mjs 只量「按鈕夠不夠大」與「圖有沒有
// alt」，而且只跑 9 個**未登入的站台層級**頁面。它從來沒有測過：
//   1. 橫向破版（頁面比螢幕寬，要左右拖才看得完）——這是「手機不行」
//      最常見的實際症狀，而且畫面看起來還「有東西」，所以自動化不測就不會發現
//   2. 個人小站的頁面（/<帳號>、/blog、/album、/guestbook）
//   3. 登入後才看得到的畫面
//   4. 不同寬度（iPhone SE 320 是最窄的主流機，很多版型只在 375 以上才對）
//
// 破版的判斷：document.scrollWidth > clientWidth。單純知道「破了」沒有用，
// 所以同時把**是哪一個元素撐出去的**找出來——不然要人工一層一層找。
//
//   node tools/mobilecheck.mjs                        測本機（先自己開站）
//   BASE=https://station.vibeaico.com node tools/mobilecheck.mjs   測正式站
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');

// 三種寬度。320 是 iPhone SE（最窄的主流機），390 是現在最常見的，
// 768 是平板直式——三者各自會踩到不同的 media query 斷點。
const SIZES = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPad 直式', width: 768, height: 1024 },
];

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });

// 先開一個一般的 context 註冊測試帳號，拿到 cookie 給後面的登入頁用。
// ⚠ 一定要測登入後的畫面：站主自己看到的頁面（設定、發文、後台）跟訪客
// 看到的完全不同，而那些正是他每天都在用的。
const setup = await browser.newContext();
const sp = await setup.newPage();
const NAME = 'mtest' + Math.floor(Date.now() / 1000 % 100000);
let COOKIES = [];
let POST_ID = '1', ALBUM_ID = '1', PHOTO_ID = '', HALA_ID = '', JOIN_ID = '';
try {
  await sp.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
  // ⚠ 一定要鎖定「包著 pass2 這一欄的那張表單」再送出。
  // 直接 click('button[type=submit]') 會按到**頁首的搜尋鈕**——它在 DOM 裡
  // 排在註冊表單前面，於是整支測試安靜地跑去 /search，cookie 拿不到，
  // 所有需要登入的頁面全部被跳過，而報表還印「全部通過」。
  const form = sp.locator('form:has(input[name=pass2])');
  await form.locator('input[name=name]').fill(NAME);
  await form.locator('input[name=nick]').fill('手機測試');
  await form.locator('input[name=pass]').fill('test1234');
  await form.locator('input[name=pass2]').fill('test1234');
  await Promise.all([
    sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    form.locator('button[type=submit], input[type=submit], button:not([type])').first().click(),
  ]);
  // 建一篇文章與一本相簿，才有 :id 可以測單篇頁。
  // ⚠ 沒有資料的話這些頁只會 404，測起來全綠但什麼都沒驗到。
  await sp.goto(BASE + `/${NAME}/blog/new`, { waitUntil: 'domcontentloaded' });
  const pf = sp.locator('form:has(textarea)').first();
  await pf.locator('input[name=title]').fill('手機版面測試用的文章標題');
  await pf.locator('textarea[name=body]').first().fill('內容第一段\n內容第二段');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    pf.locator('input[type=submit], button[type=submit]').first().click()]);
  POST_ID = (sp.url().match(/\/blog\/(\d+)/) || [])[1] || '1';
  await sp.goto(BASE + `/${NAME}/album`, { waitUntil: 'domcontentloaded' });
  const af = sp.locator('form[action$="/album"]').first();
  await af.locator('input[name=title]').fill('手機版面測試相簿');
  await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    af.locator('input[type=submit], button[type=submit]').first().click()]);
  ALBUM_ID = (await sp.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/album/"]')]
      .map(x => (x.getAttribute('href').match(/\/album\/(\d+)/) || [])[1]).filter(Boolean);
    return a[0] || '1';
  }));
  // 傳一張照片進去。
  // ⚠ 沒有照片的話，單張照片頁與投影片頁只會導回相簿列表——那兩頁就等於
  // 沒測到，而「單張照片」是相簿站最多人停留的一頁。
  // 圖用 sharp 真的產一張，不要手貼 base64（貼過一次，那串其實檔頭正常、
  // 影像資料損壞，害整支測試報假的失敗）。
  try {
    const sharp = (await import('sharp')).default;
    const tmpImg = path.join(os.tmpdir(), 'mchk-' + process.pid + '.png');
    await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 90, g: 140, b: 200 } } })
      .png().toFile(tmpImg);
    await sp.goto(BASE + `/${NAME}/album/${ALBUM_ID}`, { waitUntil: 'domcontentloaded' });
    await sp.locator('input[type=file]').first().setInputFiles(tmpImg);
    await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      sp.locator('form:has(input[type=file])').first()
        .locator('input[type=submit], button[type=submit]').first().click()]);
    PHOTO_ID = await sp.evaluate(() => {
      const a = [...document.querySelectorAll('a[href*="/photo/"]')]
        .map(x => (x.getAttribute('href').match(/\/photo\/(\d+)/) || [])[1]).filter(Boolean);
      return a[0] || '';
    });
    try { fs.rmSync(tmpImg, { force: true }); } catch {}
  } catch (e) { console.log('[setup] 上傳照片失敗，單張照片頁會跳過：' + e.message.slice(0, 60)); }
  // 開一團，才有 /join/:id 可以測
  try {
    await sp.goto(BASE + '/join', { waitUntil: 'domcontentloaded' });
    const jf = sp.locator('form:has(textarea)').first();
    await jf.locator('input[name=title]').fill('手機版面測試揪團');
    await jf.locator('textarea').first().fill('說明');
    await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      jf.locator('button[type=submit], input[type=submit]').first().click()]);
    JOIN_ID = (sp.url().match(/\/join\/(\d+)/) || [])[1] || '';
  } catch { /* 沒有就跳過那一頁 */ }
  // 發一則哈啦主題，才有 /hala/:id 可以測
  try {
    await sp.goto(BASE + '/hala', { waitUntil: 'domcontentloaded' });
    const hf = sp.locator('form:has(textarea)').first();
    await hf.locator('input[name=title]').fill('手機版面測試主題');
    await hf.locator('textarea[name=body]').first().fill('內容');
    await Promise.all([sp.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      hf.locator('button[type=submit], input[type=submit]').first().click()]);
    HALA_ID = (sp.url().match(/\/hala\/(\d+)/) || [])[1] || '';
  } catch { /* 沒有就跳過那一頁 */ }
  COOKIES = await setup.cookies();
  console.log(`[setup] 測試帳號 ${NAME}，登入後網址 ${sp.url()}，cookie ${COOKIES.length} 個`);
} catch (e) {
  console.log('[setup] 註冊失敗，只測未登入的頁面：' + e.message);
}
await setup.close();

// 要測的頁面。登入後才看得到的用 own:true 標。
const PAGES = [
  ['/', '首頁'],
  ['/albums', '相簿總站'],
  ['/blogs', '網誌總站'],
  ['/rank', '人氣排行'],
  ['/search?q=a', '搜尋結果'],
  ['/video', '影音'],
  ['/digu', '嘀咕總站'],
  ['/hala', '哈啦'],
  ['/join', '揪團'],
  ['/help', '服務說明'],
  ['/login', '登入'],
  ['/register', '註冊'],
  ['/shop', '無名小舖'],
  [`/${NAME}`, '個人首頁', true],
  [`/${NAME}/blog`, '網誌', true],
  [`/${NAME}/album`, '相簿', true],
  [`/${NAME}/guestbook`, '留言板', true],
  [`/${NAME}/digu`, '嘀咕', true],
  [`/${NAME}/friends`, '好友', true],
  [`/${NAME}/settings`, '個人設定', true],
  [`/${NAME}/blog/new`, '發表文章', true],
  [`/${NAME}/files`, '網頁空間', true],
  ['/points', '點數明細', true],
  ['/vip', '認證申請', true],
  // ⚠ 以下這批是清點「全站 51 個 GET 路由 vs 手機測了 24 個」時補上的。
  // 漏掉的裡面包含**最多人看的兩種頁**——單篇文章與單張照片。
  // 一個網誌／相簿站，訪客絕大多數時間就待在這兩頁上，而它們原本
  // 一次都沒有在手機尺寸下被畫出來過。
  [`/${NAME}/blog/${POST_ID}`, '單篇文章', true],
  [`/${NAME}/album/${ALBUM_ID}`, '單本相簿', true],
  [`/${NAME}/card`, '名片', true],
  [`/${NAME}/blog/map`, '文章地圖', true],
  [`/${NAME}/blog/search?q=a`, '網誌搜尋', true],
  [`/${NAME}/blog/${POST_ID}/edit`, '編輯文章', true],
  [`/${NAME}/album/${ALBUM_ID}/wall`, '相片牆', true],
  [`/${NAME}/favs`, '我的收藏', true],   // ⚠ 收藏掛在小站底下，不是 /favs
  ['/forgot', '忘記密碼', false],
  // 第二批缺口：這些原本也沒在手機尺寸下畫出來過。
  // /photo/:pid 是相簿站訪客停留最久的一頁，卻要有照片才進得去——
  // 所以上面的 setup 才要真的傳一張，不然這一頁永遠測不到。
  ...(PHOTO_ID ? [[`/${NAME}/photo/${PHOTO_ID}`, '單張照片', true]] : []),
  ...(PHOTO_ID ? [[`/${NAME}/album/${ALBUM_ID}/slide`, '投影片', true]] : []),
  ...(HALA_ID ? [[`/hala/${HALA_ID}`, '哈啦主題', false]] : []),
  [`/${NAME}/visitors`, '誰來我家', true],
  [`/${NAME}/feed`, '好友動態', true],
  ['/svcs/wretch_girl', '愛正妹', false],
  ['/report', '檢舉', false],
  // 第三批：把「全站 51 條 GET vs 手機測了幾條」清到只剩非視覺的頁面
  // （RSS、轉址、healthz、舊網址別名那些沒有版面可言的）。
  ...(PHOTO_ID ? [[`/${NAME}/photo/${PHOTO_ID}/crop`, '裁切照片', true]] : []),
  ...(JOIN_ID ? [[`/join/${JOIN_ID}`, '揪團內頁', false]] : []),
  // ⚠ 用一個一定無效的 token。重點不是「還原密碼成功長怎樣」，
  // 而是**失敗的那一頁**——連結過期是最常發生的情況（信件隔天才點開），
  // 而那一頁如果在手機上破版，使用者正處在「進不去自己帳號」的焦慮裡。
  ['/reset/thistokenisnotvalid', '重設密碼（連結失效）', false],
  ['/admin', '後台', true],   // 不是站長會被擋掉，下面有處理
];

// 找出「是誰撐出去的」。
//
// 在頁面裡跑：走一遍所有元素，回報右邊界超過視窗寬度的那些。
// 只回報最外層的幾個——一個 table 撐出去的話它底下每一格都會超出，
// 全部印出來只是噪音。
const FIND_OVERFLOW = `(() => {
  const w = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const right = r.right + window.scrollX;
    if (right <= w + 1) continue;
    // 祖先已經被記下來就跳過，只留最外層的那一個
    if (bad.some(b => b.el.contains(el))) continue;
    bad.push({ el, right });
  }
  return bad.slice(0, 4).map(b => {
    const el = b.el;
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    const txt = (el.textContent || '').trim().slice(0, 24).replace(/\\s+/g, ' ');
    return el.tagName.toLowerCase() + id + cls +
      ' 右邊界 ' + Math.round(b.right) + 'px' + (txt ? ' 「' + txt + '」' : '');
  });
})()`;

for (const size of SIZES) {
  console.log(`\n── ${size.name}（${size.width}px）────────────────────────────`);
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  if (COOKIES.length) await ctx.addCookies(COOKIES);
  const page = await ctx.newPage();

  for (const [path, label, needsLogin] of PAGES) {
    if (needsLogin && !COOKIES.length) continue;
    let r;
    try { r = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }); }
    catch (e) { ok(`${size.name} ${label} 開得起來`, false, e.message.slice(0, 60)); continue; }
    // ⚠ 後台只有站長進得去。測試帳號不是站長就會被擋，那不是壞掉——
    // 但也不能默默當成通過，不然「後台在手機上破版」永遠不會被發現。
    // 印一行說它被跳過了，讓人知道這一頁**沒有**被驗到。
    if (label === '後台' && r.status() === 403) {
      console.log(`  （跳過 ${size.name} 後台：這個測試帳號不是站長。` +
        '要驗後台的版面，跑的時候給 ADMIN_USERS=' + NAME + '）');
      continue;
    }
    // ⚠ 有些頁面**正確的行為就是回 4xx**，但它們仍然要畫出一個看得懂的畫面。
    // 重設密碼的連結失效（信件隔天才點開，最常發生）就是這種：回 400 是對的，
    // 但那一頁如果在手機上破版，使用者正處在「進不去自己帳號」的焦慮裡。
    // 所以這裡不能一律把 4xx 當成失敗——要區分「壞掉」與「合理的錯誤頁」。
    const expectErr = label.includes('連結失效');
    if (!r || (r.status() >= 400 && !(expectErr && r.status() === 400))) {
      ok(`${size.name} ${label} 開得起來`, false, 'HTTP ' + (r && r.status())); continue;
    }
    if (expectErr) {
      const t = await page.textContent('body');
      ok(`${size.name} ${label} 有講清楚發生什麼事`,
         /失效|過期|重新|無效|再試/.test(t),
         '只回 400 卻沒有說明，使用者不知道該怎麼辦：' + t.slice(0, 80).replace(/\s+/g, ' '));
    }

    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      meta: document.querySelector('meta[name=viewport]')?.content || '',
    }));

    // ⚠ 沒有 viewport meta 的話，手機瀏覽器會假裝自己是 980px 寬的桌機再縮小，
    // 整頁字小到看不見。這是「手機完全不能用」最經典的一種。
    ok(`${size.name} ${label} 有 viewport meta`, /width=device-width/.test(m.meta),
       'content=' + (m.meta || '(沒有)'));

    // 容許 1px 的四捨五入
    const over = m.scrollW - m.clientW;
    if (over > 1) {
      const who = await page.evaluate(FIND_OVERFLOW);
      ok(`${size.name} ${label} 不會左右破版`, false,
         `頁面寬 ${m.scrollW}px、螢幕 ${m.clientW}px，多出 ${over}px。撐出去的是：\n` +
         who.map(s => '        ' + s).join('\n'));
    } else {
      ok(`${size.name} ${label} 不會左右破版`, true);
    }
  }
  await ctx.close();
}

// ── 按得到嗎：有沒有東西蓋在按鈕上面 ────────────────────────────────
//
// ⚠ 破版只是「手機不行」的其中一種。另一種更氣人的是**按了沒反應**：
// 畫面看起來完全正常，但某個浮層／固定工具列蓋在按鈕上，手指點下去
// 被那一層吃掉。這種問題截圖看不出來、量寬度也量不到，只有真的去問
// 「這個座標點下去會打到誰」才知道。
//
// 站上有一條固定在底部的工具列（kukubar，#footer-switch 那一條），
// 在桌機上不礙事，在 568px 高的 iPhone SE 上它蓋掉的比例大得多。
{
  console.log('\n── 按得到嗎（有沒有東西蓋住）────────────────────────');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  if (COOKIES.length) await ctx.addCookies(COOKIES);
  const page = await ctx.newPage();

  const CHECK = `(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, input[type=submit]')) {
      const r = el.getBoundingClientRect();
      // 只看畫面上真的看得到、而且在視窗內的
      if (r.width < 4 || r.height < 4) continue;
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      // ⚠ 被祖先裁切掉的元素要跳過，不然會誤判。
      // 站上底部的工具列有幾個**收合的**下拉選單，收合的做法是外層
      // overflow:hidden 把高度壓掉——裡面的連結還是有 getBoundingClientRect，
      // 只是被裁在外面看不到。不濾掉的話，那幾條「熱門相簿」「人氣排行榜」
      // 每次都會被報成「被工具列按鈕蓋住」，而它們本來就不該點得到。
      // （第一版就是這樣誤報了四條，實測量出來連結在 y=61、按鈕在 y=819，
      //   根本沒有重疊。）
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (!/hidden|clip|scroll|auto/.test(acs.overflow + acs.overflowX + acs.overflowY)) continue;
        const ar = a.getBoundingClientRect();
        if (r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1 ||
            r.right <= ar.left + 1 || r.left >= ar.right - 1) { clipped = true; break; }
      }
      if (clipped) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit) continue;
      // 打到自己或自己的小孩都算按得到
      if (hit === el || el.contains(hit) || hit.contains(el)) continue;
      const name = (el.textContent || el.value || '').trim().slice(0, 20) || el.tagName;
      const blk = hit.tagName.toLowerCase() +
        (hit.id ? '#' + hit.id : '') +
        (typeof hit.className === 'string' && hit.className.trim()
          ? '.' + hit.className.trim().split(/\\s+/)[0] : '');
      out.push('「' + name + '」被 ' + blk + ' 蓋住');
    }
    return [...new Set(out)].slice(0, 6);
  })()`;

  for (const [path, label, needsLogin] of PAGES) {
    if (needsLogin && !COOKIES.length) continue;
    try {
      const r = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
      if (!r || r.status() >= 400) continue;
    } catch { continue; }
    // ⚠ 要在**兩個捲動位置**都量，而且只有兩次都被蓋住才算數。
    //
    // 底部那條工具列是 position:fixed——它跟著視窗走。所以「現在被它蓋住」
    // 不等於「點不到」：使用者往下捲一點，那顆按鈕就從工具列底下出來了。
    // 只看一個位置的話會誤報一整排（第一版就報了留言板側欄的四條連結，
    // 實際上捲到底那一次是通過的）。
    //
    // 真正點不到的，是**捲到哪裡都還在別人下面**的那些。
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const top = new Set(await page.evaluate(CHECK));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    const bottom = new Set(await page.evaluate(CHECK));
    const blocked = [...top].filter(s => bottom.has(s));
    ok(`${label} 沒有怎麼捲都點不到的按鈕`, blocked.length === 0,
       '手指點下去會被別的東西吃掉，而且捲到哪裡都一樣：\n' +
       blocked.map(s => '        ' + s).join('\n'));
  }
  await ctx.close();
}


await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
