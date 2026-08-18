// 截圖與比對工具：用來反覆確認復刻程度。
//
// 用系統既有的 Chrome（playwright-core，不另外下載瀏覽器）。
//
//   node tools/shot.mjs shot <網址> <輸出.png> [寬x高]
//        單張截圖（整頁）。
//
//   node tools/shot.mjs pair <名稱> <原版網址> <我們的網址> [寬]
//        同尺寸截原版與我們的版本，輸出 <名稱>.orig.png / <名稱>.mine.png
//        以及 <名稱>.diff.png 與像素差異百分比。
//        原版網址請用 Wayback 的「改寫版」（不加 id_），圖片才會從存檔載入。
//
//   node tools/shot.mjs measure <網址> <選擇器…>
//        量元素的實際位置與尺寸、字級、顏色，用來比對數值而不是靠肉眼。
//
// 輸出預設放 .shots/（已在 .gitignore）。

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.env.SHOT_DIR || path.resolve('.shots');
fs.mkdirSync(OUT, { recursive: true });

const launch = () => chromium.launch({ executablePath: CHROME, args: ['--hide-scrollbars'] });

// Wayback 頁面頂端會插入自己的工具列，那不是無名的一部分，比對前要拿掉。
const STRIP_WAYBACK = `
  for (const sel of ['#wm-ipp-base','#wm-ipp','#donato','.wb-autocomplete-suggestions']) {
    document.querySelectorAll(sel).forEach(n => n.remove());
  }
  document.documentElement.style.marginTop = '0';
  document.body.style.marginTop = '0';
`;

// archive.org 併發一高就會直接拒連（ERR_CONNECTION_REFUSED），
// 而 Chrome 的錯誤頁本身是一個正常的 DOM，會被當成「頁面載好了」而不報錯。
// 所以要主動辨識錯誤頁，並退避重試。
// SENTINEL：頁面上一定要出現的選擇器。archive.org 除了拒連，還會回自己的
// 錯誤頁／「尚未存檔」頁——那些都是正常的 DOM，不檢查哨兵就會把它們當成
// 頁面載好了，量出一堆假數字（曾經因此得到「h2 寬 139」這種不存在的差異）。
const SENTINEL = process.env.SENTINEL || '#wrapper';

const isErrorPage = page => page.evaluate(sentinel =>
  document.body?.classList.contains('neterror') ||
  !!document.querySelector('#main-frame-error') ||
  /^(4|5)\d\d\b/.test(document.title || '') ||
  (!!sentinel && !document.querySelector(sentinel)), SENTINEL);

async function goto(page, url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    if (!(await isErrorPage(page).catch(() => false))) return true;
    const wait = 4000 * i;
    console.error(`  [重試 ${i}/${tries}] 對方拒連，等 ${wait / 1000}s`);
    await page.waitForTimeout(wait);
  }
  console.error('  仍然拿不到頁面，放棄：' + url);
  return false;
}

async function capture(page, url, { width = 1280, height = 900, full = true } = {}) {
  await page.setViewportSize({ width, height });
  await goto(page, url);
  if (url.includes('web.archive.org')) await page.evaluate(STRIP_WAYBACK).catch(() => {});
  await page.waitForTimeout(300);
  return page.screenshot({ fullPage: full });
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'shot') {
  const [url, out, size] = rest;
  const [w, h] = (size || '1280x900').split('x').map(Number);
  const b = await launch(); const p = await b.newPage();
  fs.writeFileSync(path.resolve(out), await capture(p, url, { width: w, height: h }));
  await b.close();
  console.log('→', path.resolve(out));

} else if (cmd === 'pair') {
  const [name, origUrl, mineUrl, widthArg] = rest;
  const width = +(widthArg || 1280);
  const b = await launch();

  const p1 = await b.newPage();
  const a = await capture(p1, origUrl, { width });
  const p2 = await b.newPage();
  const c = await capture(p2, mineUrl, { width });
  await b.close();

  const fa = path.join(OUT, `${name}.orig.png`), fc = path.join(OUT, `${name}.mine.png`);
  fs.writeFileSync(fa, a); fs.writeFileSync(fc, c);

  // 兩張高度通常不同，比對只取共同高度的部分
  const A = PNG.sync.read(a), C = PNG.sync.read(c);
  const w = Math.min(A.width, C.width), h = Math.min(A.height, C.height);
  const crop = (src) => {
    const d = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++)
      src.data.copy(d.data, y * w * 4, y * src.width * 4, y * src.width * 4 + w * 4);
    return d;
  };
  const ca = crop(A), cc = crop(C), diff = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cc.data, diff.data, w, h, { threshold: 0.12 });
  const fd = path.join(OUT, `${name}.diff.png`);
  fs.writeFileSync(fd, PNG.sync.write(diff));

  console.log(`原版 ${A.width}x${A.height}  我們 ${C.width}x${C.height}`);
  console.log(`比對區 ${w}x${h}　差異像素 ${n}　= ${(n * 100 / (w * h)).toFixed(2)}%`);
  console.log(fa); console.log(fc); console.log(fd);

} else if (cmd === 'measure') {
  const [url, ...sels] = rest;
  const b = await launch(); const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  await goto(p, url);
  if (url.includes('web.archive.org')) await p.evaluate(STRIP_WAYBACK).catch(() => {});
  for (const sel of sels) {
    const r = await p.evaluate(s => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect(), c = getComputedStyle(e);
      return {
        rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
        font: `${c.fontSize} / ${c.lineHeight} ${c.fontWeight} ${c.fontFamily.split(',')[0]}`,
        color: c.color, background: c.backgroundColor,
        bgImage: c.backgroundImage === 'none' ? '' : c.backgroundImage.slice(0, 120),
        border: c.border, padding: c.padding, margin: c.margin, radius: c.borderRadius,
      };
    }, sel).catch(() => null);
    console.log(sel.padEnd(28), r ? JSON.stringify(r) : '(查無此元素)');
  }
  await b.close();

} else if (cmd === 'tree') {
  // 把整頁的版面藍圖倒出來：每個可見元素的 tag/id/class + 位置尺寸 + 關鍵樣式。
  // 這是復刻時最有用的東西——比對數值，不用靠肉眼猜。
  const [url, out, maxDepthArg] = rest;
  const maxDepth = +(maxDepthArg || 12);
  const b = await launch(); const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  if (!await goto(p, url)) { await b.close(); process.exit(1); }
  if (url.includes('web.archive.org')) await p.evaluate(STRIP_WAYBACK).catch(() => {});

  const dump = await p.evaluate((maxDepth) => {
    const lines = [];
    const seenColors = new Map();
    const note = (k, v) => { if (v && v !== 'rgba(0, 0, 0, 0)') seenColors.set(v, (seenColors.get(v) || 0) + 1); };
    const walk = (el, depth) => {
      if (depth > maxDepth) return;
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      // display:none 整棵都不用看；但零尺寸的浮動容器要繼續往下走，
      // 否則會像第一版那樣整個子樹被砍掉（只倒得出 21 個元素）。
      if (c.display === 'none' || c.visibility === 'hidden') return;
      const tiny = r.width < 4 || r.height < 4;
      if (tiny) { for (const ch of el.children) walk(ch, depth); return; }
      note('bg', c.backgroundColor); note('fg', c.color);
      const id = el.id ? '#' + el.id : '';
      const cls = (typeof el.className === 'string' && el.className.trim())
        ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      const bits = [`${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)}`];
      if (c.backgroundColor !== 'rgba(0, 0, 0, 0)') bits.push('bg:' + c.backgroundColor);
      if (c.backgroundImage !== 'none') bits.push('bgimg:' + c.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '').split('/').pop().slice(0, 40));
      if (c.borderRadius !== '0px') bits.push('r:' + c.borderRadius);
      if (c.borderTopWidth !== '0px' || c.borderLeftWidth !== '0px')
        bits.push('bd:' + c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor);
      const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      if (txt) bits.push(`font:${c.fontSize}/${c.lineHeight} ${c.fontWeight} ${c.color}`, `text:"${txt.slice(0, 40)}"`);
      lines.push('  '.repeat(depth) + el.tagName.toLowerCase() + id + cls + '  ' + bits.join('  '));
      for (const ch of el.children) walk(ch, depth + 1);
    };
    walk(document.body, 0);
    const colors = [...seenColors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
      .map(([c, n]) => `${c}  ×${n}`);
    return { lines, colors };
  }, maxDepth);

  const text = `# 版面藍圖  ${url}\n\n## 出現最多的顏色\n${dump.colors.join('\n')}\n\n## 元素樹\n${dump.lines.join('\n')}\n`;
  fs.writeFileSync(path.resolve(out), text, 'utf8');
  await b.close();
  console.log(`→ ${path.resolve(out)}　${dump.lines.length} 個元素`);

} else if (cmd === 'geo') {
  // 幾何比對：同一批選擇器在原版與我們的版本上，寬高與「相對於自己容器的位移」差多少。
  //
  // 為什麼不用像素比對：原版格子裡是真實照片、我們是站上的資料，
  // 而且只要有一個區塊高度不同，底下全部跟著位移，像素差異就會爆掉——
  // 那個數字量到的是內容不同，不是版面不同。要逼近 100% 要看的是這裡。
  const [origUrl, mineUrl, listFile] = rest;
  // 高度容差（px）。預設 1：逼近 100% 時要看得到每一個像素的落差。
  const TOL = +(process.env.GEO_TOL || 1);
  // 註解用 //，不能用 #——# 是 ID 選擇器的開頭，用它當註解會把整份清單吃掉。
  const sels = fs.readFileSync(path.resolve(listFile), 'utf8')
    .split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('//'));

  const probe = async (url) => {
    const p = await b.newPage();
    await p.setViewportSize({ width: 1280, height: 900 });
    await goto(p, url);
    if (url.includes('web.archive.org')) await p.evaluate(STRIP_WAYBACK).catch(() => {});
    const r = await p.evaluate(sels => Object.fromEntries(sels.map(s => {
      const e = document.querySelector(s);
      if (!e) return [s, null];
      const b = e.getBoundingClientRect();
      // 以 #wrapper（970px 主容器）為共同原點。用 offsetParent 會因為兩邊
      // 的定位脈絡不同而誤報位移；固定原點才比得出真正的版面差異。
      const par = document.querySelector('#wrapper') || document.body;
      const pb = par.getBoundingClientRect();
      const c = getComputedStyle(e);
      return [s, {
        w: Math.round(b.width), h: Math.round(b.height),
        dx: Math.round(b.x - pb.x), dy: Math.round(b.y - pb.y),
        fs: c.fontSize, bg: c.backgroundColor, fg: c.color,
      }];
    })), sels);
    await p.close();
    return r;
  };

  const b = await launch();
  const A = await probe(origUrl), B = await probe(mineUrl);
  await b.close();

  let same = 0, diff = 0, missing = 0;
  const rows = [];
  for (const s of sels) {
    const a = A[s], c = B[s];
    if (!a && !c) { rows.push(['—   ', s, '兩邊都沒有這個元素']); missing++; continue; }
    if (!a) { rows.push(['原缺 ', s, '原版沒有，我們多做了']); missing++; continue; }
    if (!c) { rows.push(['未做 ', s, `原版 ${a.w}x${a.h} @${a.dx},${a.dy}`]); missing++; continue; }
    const d = [];
    if (a.w !== c.w) d.push(`寬 ${a.w}→${c.w}`);
    if (Math.abs(a.h - c.h) > TOL) d.push(`高 ${a.h}→${c.h}`);
    if (Math.abs(a.dx - c.dx) > 2) d.push(`左位移 ${a.dx}→${c.dx}`);
    if (a.fs !== c.fs) d.push(`字級 ${a.fs}→${c.fs}`);
    if (a.bg !== c.bg) d.push(`底色 ${a.bg}→${c.bg}`);
    if (a.fg !== c.fg) d.push(`字色 ${a.fg}→${c.fg}`);
    if (d.length) { rows.push(['差異 ', s, d.join('  ')]); diff++; }
    else { same++; }
  }
  for (const [tag, sel, note] of rows) console.log(tag, sel.padEnd(30), note);
  const total = same + diff + missing;
  console.log(`\n相符 ${same} / 差異 ${diff} / 缺漏 ${missing}　共 ${total}　→ 相符率 ${(same * 100 / total).toFixed(1)}%`);

} else {
  console.log(`用法:
  node tools/shot.mjs shot <網址> <輸出.png> [寬x高]
  node tools/shot.mjs pair <名稱> <原版網址> <我們的網址> [寬]
  node tools/shot.mjs measure <網址> <CSS選擇器…>
  node tools/shot.mjs tree <網址> <輸出.md> [最大深度]
  node tools/shot.mjs geo <原版網址> <我們的網址> <選擇器清單.txt>`);
}
