// 「點下去，眼睛看得到變化嗎？」
//
// ⚠ 這一支是為了一個被使用者連續抓到兩次的盲點而寫的。
//
// 相簿總站那四顆搜尋範圍頁籤，使用者回報兩次「不能點」。但當時的測試全綠：
//   tools/tabclick.mjs  量的是「點了之後網址有沒有帶對 type」→ 有，過
//   tools/uicheck --dead 量的是「點了有沒有任何反應」→ radio 被選起來了，算有
// 兩支都在量**機器看得到的狀態改變**，而使用者看的是**畫面有沒有變**。
// 實際情況是選中樣式靠 class 決定、而搬 class 的那段 JS 我們沒做，
// 所以無論點哪一顆，亮的永遠是同一顆。測試綠、畫面壞。
//
// 這一支直接量畫面：點之前截一張、點之後截一張，逐位元組比對。
// 完全一樣＝這顆控制項按下去「什麼都沒發生」，使用者一定會覺得它壞了。
//
// 只點**安全的**控制項：label、role=button、radio/checkbox、錨點連結、
// 明確 type=button 的按鈕。不碰任何會送出表單或改資料的東西。
//
//   BASE=http://127.0.0.1:3433 node tools/visualclick.mjs [路徑…]
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

// 安全的控制項：點下去不會送出表單、不會改資料
const SAFE = [
  'label[for]',
  '[role="button"]',
  'input[type=radio]',
  'input[type=checkbox]',
  'a[href^="#"]',
  'button[type=button]',
  'summary',
].join(', ');

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// 登入（有些控制項只有登入才看得到）
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
const lf = await page.$('form[action="/login"]') || await page.$('form[method=post]');
if (lf) {
  await lf.$$eval('input[name=name]', (els, v) => els[0].value = v, USER);
  await lf.$$eval('input[name=pass]', (els, v) => els[0].value = v, PASS);
  await Promise.all([page.waitForNavigation(), lf.evaluate(f => f.submit())]).catch(() => {});
}

const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/albums', '/blogs', '/', '/rank', `/${USER}`, `/${USER}/album`, `/${USER}/blog`,
     `/${USER}/guestbook`, `/${USER}/settings`, '/search?q=a', '/hala', '/video'];

let dead = 0;
for (const path of PAGES) {
  const r = await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => null);
  if (!r || r.status() >= 400) { ok(`${path} 開得起來`, false, 'HTTP ' + (r && r.status())); continue; }

  const els = await page.$$(SAFE);
  const silent = [], blocked = [];   // 沒反應的／點不到的
  let tried = 0;

  for (const el of els) {
    // 看不到的、沒有大小的一律跳過
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width < 2 || box.height < 2) continue;
    // ⚠「看得到」不能只看 display/visibility/opacity。
    // 螢幕閱讀器專用的標籤（<label class="hidden">搜尋</label>）在版型裡是用
    // 絕對定位推到畫面外或 clip 起來的——display 是 block、opacity 是 1，
    // 但眼睛看不到、滑鼠也點不到。第一版沒排除它們，於是每一頁都回報
    // 「點不到」，把真正的問題埋在雜訊裡。
    //
    // 判準改成問瀏覽器：這個元素中心點上，真正會收到點擊的是誰？
    // 不是它自己（也不是它的子孫）就代表看不到或被蓋住，跳過。
    const visible = await el.evaluate(e => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity <= 0.05) return false;
      const r = e.getBoundingClientRect();
      // 推到畫面外（visually-hidden 的常見寫法）
      if (r.bottom < 0 || r.right < 0 || r.left > innerWidth || r.top > innerHeight) return false;
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(cx, cy);
      return !!hit && (hit === e || e.contains(hit) || hit.contains(e));
    }).catch(() => false);
    if (!visible) continue;

    // ⚠ 有三種「點了畫面沒變」是**正確行為**，不能算問題：
    //   · 已經選中的 radio／checkbox——再點一次本來就不會變
    //   · disabled 的控制項——它就是不該有反應
    //   · 點擊根本沒送到（被別的元素蓋住）——那是另一個問題，另外回報
    // 第一版沒有排除這些，於是回報了一堆假的（已選的 radio、disabled 的
    // checkbox），真正的問題（沒有聚焦樣式）反而被埋在裡面。
    const skip = await el.evaluate(e => {
      // 元素自己就是控制項的情況
      if (e.disabled === true || e.checked === true) return true;
      // ⚠ <label for="…"> 要看**它指到的那顆控制項**的狀態，不是 label 自己。
      // 少了這一段，預設就選中的那顆頁籤（相簿）會被回報成「點了沒反應」——
      // 那其實是正確行為：再點一次已選中的 radio 本來就不會有任何變化。
      const id = e.getAttribute && e.getAttribute('for');
      if (!id) return false;
      const t = document.getElementById(id);
      return !!t && (t.disabled === true || t.checked === true);
    }).catch(() => false);
    if (skip) continue;

    const label = (await el.evaluate(e => {
      const t = (e.textContent || '').trim().replace(/\s+/g, '').slice(0, 12);
      const id = e.id ? '#' + e.id : (e.getAttribute('for') ? 'for=' + e.getAttribute('for') : '');
      const kind = e.tagName.toLowerCase() + (e.type ? '[' + e.type + ']' : '');
      const on = e.checked === true ? '(已選)' : '';
      return kind + id + on + (t ? ' "' + t + '"' : '');
    }).catch(() => '?')) || '?';

    tried++;
    const urlBefore = page.url();
    const before = await page.screenshot().catch(() => null);
    let clickErr = null;
    await el.click({ timeout: 1500 }).catch(e => { clickErr = e.message.split(String.fromCharCode(10))[0].slice(0, 60); });
    if (clickErr) { blocked.push(label + ` → ${clickErr}`); continue; }
    await page.waitForTimeout(180);

    // 換頁了就是有反應（而且是最明顯的那種）
    if (page.url() !== urlBefore) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
      continue;
    }
    const after = await page.screenshot().catch(() => null);
    if (before && after && Buffer.compare(before, after) === 0) silent.push(label);
  }

  // 點不到（被蓋住）是另一種病，clickcheck.mjs 專門在查，這裡只提醒一聲
  if (blocked.length) console.log(`       （另有 ${blocked.length} 個點不到：` + blocked.slice(0, 3).join('；') + '）');
  // ── 鍵盤走到哪裡看得出來嗎（WCAG 2.4.7 Focus Visible）──────────────
  // ⚠ 這一條是上面那一輪的延伸。原本「點標籤沒反應」的真因是**輸入框
  // 沒有任何聚焦樣式**——2012 年的版型沒寫過，現代瀏覽器的預設外框又被
  // 版型洗掉。後果不是不好看，是用鍵盤的人一路 Tab 過去完全沒有回饋，
  // 只能靠猜自己在哪一格。
  //
  // 上面那組點擊測試涵蓋不到這件事（那些標籤是螢幕閱讀器專用、正確地隱藏
  // 起來，會被可見性判斷跳過），所以這裡直接量：把焦點放到每一個可聚焦的
  // 控制項上，畫面必須有變化。
  // ⚠ 一定要用**真的 Tab 鍵**，不能用 element.focus()。
  // :focus-visible 的整個重點就是「分辨鍵盤與程式／滑鼠」：Chrome 對程式
  // 呼叫的 focus() 不會套用 :focus-visible（文字輸入框是例外）。用 focus()
  // 去測，連結與按鈕會全部被誤判成「沒有聚焦樣式」——第一版就是這樣，
  // 回報了三個假的。按 Tab 才是使用者真正會走的路徑。
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const noRing = [];
  let focusTried = 0;
  for (let n = 0; n < 12; n++) {
    const b4 = await page.screenshot().catch(() => null);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(90);
    const who = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;      // 隱藏的可聚焦元素不算
      // 連結大多沒有 id/name，只印 tag 的話回報等於「a、a、a」，看不出是誰。
      // 帶上文字、class 與座標才追得下去。
      const txt = (e.textContent || '').trim().replace(/s+/g, '').slice(0, 10);
      const cls = typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/s+/)[0] : '';
      return e.tagName.toLowerCase() + (e.type ? '[' + e.type + ']' : '') +
             (e.id ? '#' + e.id : cls) + (e.name ? ' name=' + e.name : '') +
             (txt ? ' "' + txt + '"' : '') + ' @' + Math.round(r.left) + ',' + Math.round(r.top);
    }).catch(() => null);
    if (!who) continue;
    focusTried++;
    const af = await page.screenshot().catch(() => null);
    if (b4 && af && Buffer.compare(b4, af) === 0) noRing.push(who);
  }
  await page.evaluate(() => document.activeElement?.blur());
  ok(`${path} 用 Tab 走過去看得出焦點在哪（走了 ${focusTried} 站）`,
     noRing.length === 0, `${noRing.length} 個聚焦時畫面完全沒變：` + noRing.slice(0, 6).join('、'));

  dead += silent.length;
  ok(`${path} 每個控制項點下去都看得到變化（試了 ${tried} 個）`,
     silent.length === 0, `${silent.length} 個點了畫面完全沒變：` + silent.slice(0, 8).join('、'));
}

await browser.close();
console.log(`\n點了完全沒有畫面變化的控制項共 ${dead} 個`);
console.log(`===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
