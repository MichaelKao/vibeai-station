// 「頁籤／範圍切換真的有作用嗎」——用真的 Chrome 點下去再看結果。
//
// 為什麼需要這一支：tools/uicheck.mjs --dead 找的是「點了完全沒反應」的控制項，
// 但 /albums 頁首那四顆搜尋範圍（相簿／網誌／影音／網頁）是 radio+label，
// 點下去 radio 真的會被選起來——對 uicheck 來說「有反應」，所以它回報 0 問題。
// 實際上後端根本不讀 type，送出去的結果四顆都一樣，使用者的感受是「不能點」。
//
// 這一支補的就是那個盲點：點頁籤 → 送出 → **比對結果頁真的變了**。
//   BASE=http://127.0.0.1:3400 node tools/tabclick.mjs
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const page = await browser.newPage();

// ── /albums 頁首的四顆搜尋範圍 ─────────────────────────────────────────
const TABS = [
  ['相簿', 'photo', '相簿（'],
  ['網誌', 'site',  '網誌（'],
  ['影音', 'video', '影音（'],
  ['網頁', 'web',   '站友（'],
];
for (const [label, type, heading] of TABS) {
  await page.goto(BASE + '/albums', { waitUntil: 'domcontentloaded' });
  await page.click(`#search_tab label[title^="${label}"]`);
  const checked = await page.$eval(`#search_tab input[value]:checked`, el => el.value);
  await page.fill('#search_keyword', 'a');
  await Promise.all([page.waitForNavigation(), page.click('#search_submit')]);
  const url = page.url();
  // 只看主欄：側欄的「搜尋結果」清單本來就會列出各區名稱
  const body = await page.$eval('.main', el => el.innerHTML);
  ok(`點「${label}」→ 網址帶對範圍（type=${type}）`, url.includes('type=' + type), url + ' radio=' + checked);
  ok(`點「${label}」→ 結果頁真的只印那一區`, body.includes(heading), '找不到 ' + heading);
  // 「全部」以外的範圍，不該印出別區的標題
  if (type !== 'web') {
    const others = ['站友（', '相簿（', '網誌（', '影音（'].filter(h => h !== heading);
    ok(`點「${label}」→ 其他區沒有被印出來`, !others.some(h => body.includes(h)),
       others.filter(h => body.includes(h)).join(' '));
  }
}

// ── 結果頁自己那排範圍頁籤（純連結，沒有 JS 也要能切）────────────────
await page.goto(BASE + '/search?q=a', { waitUntil: 'domcontentloaded' });
const scopeLinks = await page.$$eval('.w2-search-scope a', as => as.map(a => a.textContent.trim()));
ok('結果頁有一排範圍頁籤', scopeLinks.length === 5, scopeLinks.join(','));
for (const t of ['相簿', '網誌', '影音']) {
  await page.goto(BASE + '/search?q=a', { waitUntil: 'domcontentloaded' });
  await Promise.all([page.waitForNavigation(), page.click(`.w2-search-scope a:text-is("${t}")`)]);
  ok(`結果頁的「${t}」頁籤點得動`, (await page.content()).includes(t + '（'), page.url());
  const on = await page.$eval('.w2-search-scope a.on', a => a.textContent.trim()).catch(() => '');
  ok(`結果頁的「${t}」頁籤會標成目前選取`, on === t, '目前標的是 ' + on);
}

await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
