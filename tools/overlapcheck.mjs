// 文字重疊檢查：兩塊字真的疊在一起，眼睛看得到的那種。
//
// ⚠ 這一支存在的理由：截圖審查在這件事上很不可靠。代理回報過二十幾次
// 「重疊」，查證後幾乎都是「上下相鄰被當成相疊」。反過來也有：768px 首頁
// 「熱門網誌」黑底區真的疊字（.recommended-links 是 position:absolute
// 釘在右欄底部，窄螢幕左欄變滿寬就落在同一個位置），那一次代理反而是對的。
// 用量的就不會兩邊都錯。
//
// 判定分三關，缺一不可：
//   1. 兩個矩形真的相交（相鄰不算，留 4px 容差）
//   2. 不是螢幕外的無障礙標籤（負縮排、被推出畫面）
//   3. **捲到那個位置，交集中心實際畫出來的是這兩個之一**
//      —— 第 3 關最重要。少了它，被別的區塊蓋在底下、根本看不到的
//      元素也會被算成重疊；只有第 3 關能分辨「疊在一起」與「藏在下面」。
//      注意一定要先捲過去：不捲的話摺線以下全部落在畫面外，
//      整批被跳過，工具會安靜地印出「沒問題」——那是假通過。
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE || 'http://127.0.0.1:3999').replace(/\/$/, '');
const WIDTHS = (process.env.WIDTHS || '320,390,768').split(',').map(Number);

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '\n' + e)); };

const PAGES = [['/', '首頁'], ['/albums', '相簿總站'], ['/blogs', '網誌總站'],
  ['/rank', '人氣排行'], ['/hala', '哈啦'], ['/shop', '小舖'], ['/login', '登入'],
  ['/register', '註冊'], ['/wretch01', '個人首頁'], ['/wretch01/blog', '網誌'],
  ['/wretch01/album', '相簿'], ['/wretch01/guestbook', '留言板'], ['/wretch01/card', '名片']];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const W of WIDTHS) {
  console.log(`\n── ${W}px ──────────────────────────────────`);
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const [url, name] of PAGES) {
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch { console.log(`  -    ${name} 開不起來，略過`); continue; }
    const hits = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const clip = e => {
        // ⚠ 跨行的 inline 元素（例如公告清單裡換行的 <a>），
        // getBoundingClientRect 給的是「涵蓋所有行」的聯集框，會把上下
        // 相鄰的行整個包進來，看起來像疊字。改用最高的那一個逐行框。
        const rects = [...e.getClientRects()];
        let r = rects.length > 1
          ? rects.reduce((m, x) => (x.height > m.height ? x : m), rects[0])
          : e.getBoundingClientRect();
        let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        // 祖先若 overflow:hidden/auto，露出來的只有交集那一塊。
        // 少了這一步，被裁掉的部分會被當成還在畫面上，於是「Album」
        // 這種在 30px 高的框裡放 37px 文字的元素就會誤報成疊字。
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const oc = getComputedStyle(p);
          if (!/hidden|auto|scroll/.test(oc.overflow + oc.overflowX + oc.overflowY)) continue;
          const pr = p.getBoundingClientRect();
          box.left = Math.max(box.left, pr.left); box.top = Math.max(box.top, pr.top);
          box.right = Math.min(box.right, pr.right); box.bottom = Math.min(box.bottom, pr.bottom);
        }
        box.width = box.right - box.left; box.height = box.bottom - box.top;
        return box;
      };
      const els = [...document.querySelectorAll('body *')].filter(e => !e.children.length
        && (e.textContent || '').trim().length > 1
        && getComputedStyle(e).visibility !== 'hidden');
      const sy = window.scrollY;
      const box = els.map(e => { const c = getComputedStyle(e), r = clip(e); return { e, c,
          r: { left: r.left, top: r.top + sy, right: r.right, bottom: r.bottom + sy, width: r.width, height: r.height } }; })
        .filter(x => x.r.width > 2 && x.r.height > 2 && x.r.right > 0 && x.r.left < innerWidth
          && parseInt(x.c.textIndent || '0') > -1000);
      const cand = [];
      for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
        const a = box[i].r, c = box[j].r;
        const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
        const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ox <= 4 || oy <= 4) continue;
        if (box[i].e.contains(box[j].e) || box[j].e.contains(box[i].e)) continue;
        cand.push({ i, j, ox, oy, cx: Math.max(a.left, c.left) + ox / 2, cy: Math.max(a.top, c.top) + oy / 2 });
      }
      const pa = el => { const a = []; for (let x = el; x && x.tagName !== "BODY"; x = x.parentElement) a.unshift(x.tagName.toLowerCase() + (x.className ? "." + x.className.toString().trim().split(/s+/).slice(0, 2).join(".") : "")); return a.slice(-3).join(">"); };
      const out = [];
      for (const k of cand) {
        // 捲到那一段再問「這個點畫的是誰」——不捲就只驗得到第一屏
        window.scrollTo(0, Math.max(0, k.cy - innerHeight / 2));
        await sleep(30);
        const A = box[k.i].e, B = box[k.j].e;
        // ⚠ 捲動之後要**重新量一次**再判。頁面有延遲載入的區塊，捲下去
        // 之後高度會變，先前算出的座標就不對了——拿舊座標去點，會點到
        // 不相干的東西並回報成疊字（實測首頁誤報過 487x37px 的假重疊）。
        const ar = A.getBoundingClientRect(), br = B.getBoundingClientRect();
        const ox2 = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const oy2 = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (ox2 <= 4 || oy2 <= 4) continue;
        const cx2 = Math.max(ar.left, br.left) + ox2 / 2;
        const vy = Math.max(ar.top, br.top) + oy2 / 2;
        if (vy < 0 || vy > innerHeight) continue;
        const hit = document.elementFromPoint(cx2, vy);
        if (!hit) continue;
        if (hit === A || hit === B || A.contains(hit) || B.contains(hit))
          out.push(`${Math.round(ox2)}x${Math.round(oy2)}px @y=${Math.round(vy + window.scrollY)}
         A 「${A.textContent.trim().slice(0, 14)}」 ${pa(A)}
         B 「${B.textContent.trim().slice(0, 14)}」 ${pa(B)}`);
      }
      return [...new Set(out)].slice(0, 6);
    });
    ok(`${name} 沒有看得見的疊字`, hits.length === 0, hits.map(h => '       ' + h).join('\n'));
  }
  await ctx.close();
}
await browser.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
