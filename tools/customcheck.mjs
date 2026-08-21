// 「客製化自己的小站」真的會生效嗎——用真的瀏覽器量算出來的樣式。
//
// 無名的靈魂功能就是這個：換版型、貼自訂 CSS、放音樂盒、開自訂欄位。
// 這些東西「有沒有存進資料庫」很好驗，但**畫面上有沒有真的變**只有
// 把頁面畫出來、問瀏覽器 getComputedStyle 才知道。中間任何一環斷掉
// （safeCss 過濾太兇、<style> 被別的樣式蓋過、版型沒套到那一頁）
// 使用者的感受都是「我設定了但沒用」。
//
//   BASE=http://127.0.0.1:3404 USER_NAME=jaychou USER_PASS=demo1234 node tools/customcheck.mjs
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

// 送設定：只動指定欄位，其他維持頁面上原本的值（不然會把暱稱洗掉）
async function saveSettings(patch) {
  await page.goto(`${BASE}/${USER}/settings`, { waitUntil: 'domcontentloaded' });
  // ⚠ 一定要等導航真的完成。原本 evaluate 裡呼叫 f.submit() 之後只用
  // waitForLoadState('domcontentloaded')——目前這份文件早就 loaded，
  // 它立刻回傳，接著那句 goto 就把還在飛的 POST 取消掉，設定一個都沒存到，
  // 於是每一條都紅燈，看起來像功能壞了，其實是測試自己寫錯。
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate(p => {
      const f = document.querySelector('form[enctype]');
      for (const [k, v] of Object.entries(p)) {
        const el = f.querySelector(`[name="${k}"]`);
        if (el) el.value = v;
      }
      f.submit();
    }, patch),
  ]);
}

// ── 1. 相簿自訂 CSS ────────────────────────────────────────────────────
await saveSettings({ css: 'body{background-color:rgb(1, 2, 3)}' });
await page.goto(`${BASE}/${USER}/album`, { waitUntil: 'domcontentloaded' });
{
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('相簿自訂 CSS 真的套到相簿頁', bg === 'rgb(1, 2, 3)', '量到 ' + bg);
}
await page.goto(`${BASE}/${USER}`, { waitUntil: 'domcontentloaded' });
{
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('相簿自訂 CSS 也套到小站首頁', bg === 'rgb(1, 2, 3)', '量到 ' + bg);
}

// ── 2. 網誌自訂 CSS 是獨立的一份 ───────────────────────────────────────
await saveSettings({ css_blog: 'body{background-color:rgb(4, 5, 6)}' });
await page.goto(`${BASE}/${USER}/blog`, { waitUntil: 'domcontentloaded' });
{
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('網誌自訂 CSS 套到網誌頁', bg === 'rgb(4, 5, 6)', '量到 ' + bg);
}
await page.goto(`${BASE}/${USER}/album`, { waitUntil: 'domcontentloaded' });
{
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('網誌那份不會汙染到相簿頁', bg === 'rgb(1, 2, 3)', '量到 ' + bg);
}

// ── 3. 危險的 CSS 要被擋掉，但正常的不能被誤殺 ─────────────────────────
{
  const BS = String.fromCharCode(92);
  await saveSettings({ css: 'body{background-color:rgb(7, 8, 9)}@im' + BS + 'port url(//evil.example/x.css);' });
  await page.goto(`${BASE}/${USER}/album`, { waitUntil: 'domcontentloaded' });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('逸出過的 @import 旁邊的正常樣式照樣生效', bg === 'rgb(7, 8, 9)', '量到 ' + bg);
  const sheets = await page.evaluate(() =>
    [...document.styleSheets].map(s => s.href || '').filter(h => h.includes('evil.example')).length);
  ok('逸出過的 @import 沒有載進外部樣式表', sheets === 0);
}

// ── 4. 換版型 ─────────────────────────────────────────────────────────
{
  await saveSettings({ css: '', theme: 'grey' });
  await page.goto(`${BASE}/${USER}/album`, { waitUntil: 'domcontentloaded' });
  const hrefs = await page.$$eval('link[rel=stylesheet]', ls => ls.map(l => l.getAttribute('href')));
  ok('選了灰白版型就載灰白那支 CSS', hrefs.some(h => h && h.includes('188')), hrefs.join(' '));
  await saveSettings({ theme: '' });
  await page.goto(`${BASE}/${USER}/album`, { waitUntil: 'domcontentloaded' });
  const back = await page.$$eval('link[rel=stylesheet]', ls => ls.map(l => l.getAttribute('href')));
  ok('切回預設版型就載回預設那支', back.some(h => h && /wretch2012-album\.css/.test(h)), back.join(' '));
}

// ── 5. 自我介紹與音樂盒 ────────────────────────────────────────────────
{
  await saveSettings({ intro: '這是我的自我介紹測試', music: 'https://example.com/a.mp3' });
  await page.goto(`${BASE}/${USER}`, { waitUntil: 'domcontentloaded' });
  const txt = await page.evaluate(() => document.body.innerText);
  ok('自我介紹出現在小站首頁', txt.includes('這是我的自我介紹測試'));
  const audio = await page.$$eval('audio source, audio', els => els.map(e => e.getAttribute('src') || '').join(' '));
  ok('音樂盒吃得到設定的網址', audio.includes('a.mp3'), audio || '(頁面上沒有 audio)');
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
