// 手機上「按得到嗎」與「圖唸得出是什麼嗎」。
//
// 兩件事一起量，因為兩件事都只在**真的畫出來**之後才知道：
//
//   1. 觸控目標大小。手指的接觸面積大約 44×44 CSS px（Apple 的人機介面指南
//      與 WCAG 2.5.5 都是這個數字）。比這個小的連結在手機上按不準，
//      使用者會連按好幾次、按到旁邊那一顆。原站是 2012 年的桌機站，
//      滿滿都是 12px 的小字連結，直接搬到手機上等於不能用。
//   2. 圖片的 alt。沒有 alt 的 <img> 如果**是連結的唯一內容**，讀螢幕軟體
//      只能唸出網址（一長串 /uploads/uuid.jpg），使用者完全不知道那是什麼。
//
// 只看「畫面上真的看得到」的元素，藏起來的不算。
//
//   BASE=http://127.0.0.1:3404 node tools/touchcheck.mjs
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
// 門檻用 WCAG 2.5.8「目標大小（最小）」的 24×24 CSS px——那是 AA 等級的
// 硬性標準。2.5.5（進階，AAA）要求 44×44，本站的導覽與清單類連結有做到，
// 但分頁的個位數數字（28×40）之類天生就窄，硬撐成 44 寬會讓分頁列爆版。
const MIN = +(process.env.MIN_TAP || 24);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/', '/albums', '/blogs', '/rank', '/search?q=a', '/video', '/hala', '/join', '/help'];

let totalSmall = 0, totalNoAlt = 0;
for (const path of PAGES) {
  const r = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (!r || r.status() >= 400) { ok(`${path} 開得起來`, false, 'HTTP ' + (r && r.status())); continue; }

  // ── viewport meta 一定要有 ────────────────────────────────────────
  // ⚠ 沒有這一行，手機瀏覽器會用 980px 的虛擬視窗排版再整頁縮到約四成，
  // 而 @media (max-width:999px) 因為算出來的寬度是 980 而**一條都不會觸發**——
  // 整支 RWD 白做。稽核在 /albums 與 /slide 抓到（那兩頁自己起 <head>，
  // 不吃共用的 partials）。
  const vp = await page.$$eval('meta[name="viewport"]', els => els.map(e => e.content));
  ok(`${path} 有 viewport meta`, vp.some(v => /width\s*=\s*device-width/i.test(v)), JSON.stringify(vp));

  const small = await page.$$eval('a[href], button, input[type=submit], [role=button]', (els, min) => {
    const out = [];
    for (const e of els) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // 整段文字連結（一行字裡的一個詞）不算——那是內文，不是控制項
      if (e.tagName === 'A' && e.closest('p, .w2-sub, .description, blockquote')) continue;
      if (r.width < min || r.height < min)
        out.push(`${Math.round(r.width)}x${Math.round(r.height)} ${(e.textContent || '').trim().slice(0, 12) || e.tagName}`);
    }
    return out;
  }, MIN);

  const noAlt = await page.$$eval('a img, button img', els =>
    els.filter(e => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if ((e.getAttribute('alt') || '').trim()) return false;
      // 連結裡除了這張圖還有文字的話，讀螢幕唸得出來，不算問題
      const link = e.closest('a, button');
      return !(link && (link.textContent || '').trim());
    }).map(e => (e.getAttribute('src') || '').slice(-40)));

  // ── 主要內容有沒有被推到看不見的地方 ────────────────────────────────
  // ⚠ 這一條是 /albums 教出來的。那一頁在手機上開起來是「一片空白」，
  // 但 rwdprobe 回報 0 問題——它只量橫向溢出。真正的病因是版型把搜尋表單
  // 寫成 position:absolute; width:500px，375px 下算出來寬度是 0，
  // 於是關鍵字那排每個字自己換一行（實測 0px 寬 × 721px 高），
  // 把相簿清單整個推到 y=2200 以下。結構在、連結都對、沒有溢出，
  // 就是沒有人看得到。
  //
  // 判準：第一個「內容」元素要出現在兩個螢幕高度之內。
  const contentTop = await page.evaluate(() => {
    const sel = ['#album li img', '.w2-albumgrid li img', '.w2-bloglist li', '.w2-ranklist li',
                 '#main_content li', '.mod .bd li', 'article', '.content'];
    // ⚠ 要取「最早出現的內容」，不是「第一個對得上的選擇器」。
    // 原本寫成 for…return 第一個 querySelector 有結果的，於是 /rank 明明
    // 排行榜在 y=267，卻因為 .w2-albumgrid 排在清單前面而回報 y=2299。
    let top = Infinity;
    for (const s of sel) {
      const e = document.querySelector(s);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      if (r.height) top = Math.min(top, Math.round(r.top + scrollY));
    }
    return top === Infinity ? -1 : top;
  });
  const LIMIT = 800 * 2;
  ok(`${path} 主要內容沒有被推到看不見的地方`,
     contentTop < 0 || contentTop <= LIMIT,
     `第一個內容元素在 y=${contentTop}（超過 ${LIMIT}）`);


  totalSmall += small.length; totalNoAlt += noAlt.length;
  ok(`${path} 沒有小於 ${MIN}px 的控制項`, small.length === 0, `${small.length} 個：` + small.slice(0, 6).join('　'));
  ok(`${path} 沒有「只有圖又沒有 alt」的連結`, noAlt.length === 0, `${noAlt.length} 個：` + noAlt.slice(0, 4).join('　'));
}

await browser.close();
console.log(`\n小於 ${MIN}px 的控制項共 ${totalSmall} 個，缺 alt 的圖連結共 ${totalNoAlt} 個`);
console.log(`===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
