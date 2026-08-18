// 無名小站素材管線
//
// assets_src/ 裡是從 Internet Archive 取回的原始 GIF（見 WRETCH_SPEC.md 第 0 節的快照網址）。
// 其中三個原檔在存檔中只留下維護頁、沒有真正的圖，這支腳本用「同一套美術的另一個色版」
// 逐像素換色補回來——不是重畫，是把既有像素做色彩映射，所以形狀、鋸齒、邊緣全部一致：
//
//   album/cycle01_04.gif  ← blog/cycle02_04.gif   （用 cycle02_03→cycle01_03 學到的精確調色盤對照表）
//   index/bga_01.gif      ← album/bga_01.gif      （橘 #E48A41 → 綠 #A1D344，保留每個像素的明度差）
//   index/sidetitle.gif   ← album/sidetitlebga2.gif（橘 #F4A948 → 綠 #9BC946）
//
// 另外產生去掉「無名小站 WRETCH」字樣的乾淨橫幅，位置留給站方自己的 logo。
//
// 執行：node tools/build-assets.mjs

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('assets_src');
const OUT = path.resolve('public/img/wretch');

const log = (...a) => console.log(...a);

// ---------- 色彩工具 ----------
const key = (r, g, b) => (r << 16) | (g << 8) | b;

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
// 最常出現的不透明色＝底色
function dominant(data) {
  const m = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const k = key(data[i], data[i + 1], data[i + 2]);
    m.set(k, (m.get(k) || 0) + 1);
  }
  const [k] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return [(k >> 16) & 255, (k >> 8) & 255, k & 255];
}
const writeGif = (data, w, h, out) =>
  sharp(data, { raw: { width: w, height: h, channels: 4 } }).gif({ effort: 10 }).toFile(out);

// ---------- 1. 逐像素調色盤對照：用 A→B 的對應關係，把 C 轉成 D ----------
// cycle02_03 與 cycle01_03 是同一張圖的藍／橘兩色版，形狀完全相同，
// 因此可以逐像素建出「藍色碼 → 橘色碼」的對照表，再套到 cycle02_04 上。
async function paletteTransfer({ fromA, toA, applyTo, out }) {
  const A = await raw(fromA), B = await raw(toA), C = await raw(applyTo);
  if (A.w !== B.w || A.h !== B.h) throw new Error(`調色盤學習來源尺寸不符: ${fromA} vs ${toA}`);

  const map = new Map();                       // 藍 → 橘
  for (let i = 0; i < A.data.length; i += 4) {
    const k = key(A.data[i], A.data[i + 1], A.data[i + 2]);
    if (!map.has(k)) map.set(k, [B.data[i], B.data[i + 1], B.data[i + 2]]);
  }
  const known = [...map.keys()].map(k => [(k >> 16) & 255, (k >> 8) & 255, k & 255, k]);

  const outBuf = Buffer.alloc(C.data.length);
  let exact = 0, near = 0;
  for (let i = 0; i < C.data.length; i += 4) {
    const r = C.data[i], g = C.data[i + 1], b = C.data[i + 2];
    let hit = map.get(key(r, g, b));
    if (hit) exact++;
    else {                                     // 對照表沒有的色：取歐氏距離最近的一個
      near++;
      let best = null, bd = Infinity;
      for (const [kr, kg, kb, k] of known) {
        const d = (kr - r) ** 2 + (kg - g) ** 2 + (kb - b) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      hit = map.get(best);
    }
    outBuf[i] = hit[0]; outBuf[i + 1] = hit[1]; outBuf[i + 2] = hit[2]; outBuf[i + 3] = C.data[i + 3];
  }
  await writeGif(outBuf, C.w, C.h, out);
  const pct = (exact * 100 / (exact + near)).toFixed(1);
  log(`  ✓ ${path.basename(out)}  ${C.w}x${C.h}  對照表命中 ${pct}%（${map.size} 色）`);
}

// ---------- 2. 換色：保留每個像素相對底色的明度差 ----------
// 白色（飽和度 0）原樣保留，這樣圓角的白邊不會被染色。
async function recolor({ from, baseHex, targetHex, out }) {
  const { data, w, h } = await raw(from);
  const src = baseHex ? hex2rgb(baseHex) : dominant(data);
  const [sh, ss, sl] = rgb2hsl(...src);
  const [th, ts, tl] = rgb2hsl(...hex2rgb(targetHex));
  const sRatio = ss > 0.01 ? ts / ss : 1;

  const outBuf = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [hh, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.04) {                                  // 白／灰：不動
      outBuf[i] = data[i]; outBuf[i + 1] = data[i + 1]; outBuf[i + 2] = data[i + 2];
    } else {
      const [r, g, b] = hsl2rgb(
        (th + (hh - sh)) % 1 < 0 ? (th + (hh - sh)) % 1 + 1 : (th + (hh - sh)) % 1,
        Math.min(1, Math.max(0, s * sRatio)),
        Math.min(1, Math.max(0, l + (tl - sl))));
      outBuf[i] = r; outBuf[i + 1] = g; outBuf[i + 2] = b;
    }
    outBuf[i + 3] = data[i + 3];
  }
  await writeGif(outBuf, w, h, out);
  log(`  ✓ ${path.basename(out)}  ${w}x${h}  ${baseHex || '#' + src.map(v => v.toString(16).padStart(2, '0')).join('')} → ${targetHex}`);
}

// ---------- 3. 乾淨橫幅：抽一段沒有字的泡泡區，鏡射拼成整條 ----------
// 原始橫幅左側烤死了「無名小站 WRETCH」logo、部分版本右側還有站方標語。
// 這裡取中段乾淨的泡泡，左右鏡射補滿 750x100，配色與原檔完全相同，
// 左上角就空出來給站方自己的 logo。
async function cleanBanner({ from, cleanX, cleanW, out }) {
  const meta = await sharp(from).metadata();
  const W = meta.width, H = meta.height;
  const slice = await sharp(from).extract({ left: cleanX, top: 0, width: cleanW, height: H }).toBuffer();
  const mirrored = await sharp(slice).flop().toBuffer();

  const tiles = [];
  for (let x = 0, i = 0; x < W; x += cleanW, i++)
    tiles.push({ input: i % 2 ? mirrored : slice, left: x, top: 0 });

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles).extract({ left: 0, top: 0, width: W, height: H })
    .gif({ effort: 10 }).toFile(out);
  log(`  ✓ ${path.basename(out)}  ${W}x${H}  取 x=${cleanX}..${cleanX + cleanW} 乾淨區鏡射拼接`);
}

// ---------- 4. 洗掉圖上烤死的「無名小站」字樣 ----------
// joinfree_index.gif（150x60，首頁右欄的免費註冊圖）左上角有「無名小站」四個字，
// 其餘「FREE 免費註冊」是通用的。把那塊挖成透明，站名由旁邊的文字提供。
async function eraseWordmark({ from, rect, out }) {
  const { data, w, h } = await raw(from);
  const [x0, y0, x1, y1] = rect;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      data[(y * w + x) * 4 + 3] = 0;                 // 只清 alpha，不動顏色
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .gif({ effort: 10 }).toFile(out);
  log(`  ✓ ${path.basename(out)}  ${w}x${h}  挖除 x${x0}..${x1} y${y0}..${y1} 的字樣`);
}

// ---------- 主流程 ----------
const copied = [];
function copyTree(sub) {
  const s = path.join(SRC, sub), d = path.join(OUT, sub);
  fs.mkdirSync(d, { recursive: true });
  for (const f of fs.readdirSync(s)) {
    fs.copyFileSync(path.join(s, f), path.join(d, f));
    copied.push(`${sub}/${f}`);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
log('[1/4] 複製原始素材');
for (const sub of ['album', 'blog', 'index', 'icon']) copyTree(sub);
log(`  ✓ ${copied.length} 個原檔`);

log('[2/4] 逐像素調色盤對照補齊缺檔');
await paletteTransfer({
  fromA: `${SRC}/blog/cycle02_03.gif`, toA: `${SRC}/album/cycle01_03.gif`,
  applyTo: `${SRC}/blog/cycle02_04.gif`, out: `${OUT}/album/cycle01_04.gif`,
});

log('[3/4] 換色補齊首頁綠色系缺檔');
// 首頁 body 底色取自原始 index/new.css：BACKGROUND: url(img/bga_01.gif) #a1d344
await recolor({ from: `${SRC}/album/bga_01.gif`, baseHex: '#E48A41', targetHex: '#A1D344', out: `${OUT}/index/bga_01.gif` });
// 首頁側欄標題條：對應相簿版的 #F4A948，換成首頁綠系（同 album_grid1.gif 的 #9BC946）
await recolor({ from: `${SRC}/album/sidetitlebga2.gif`, baseHex: '#F4A948', targetHex: '#9BC946', out: `${OUT}/index/sidetitle.gif` });

log('[4/4] 產生去 logo 的乾淨橫幅');
await cleanBanner({ from: `${SRC}/album/bannerbga2.gif`, cleanX: 300, cleanW: 250, out: `${OUT}/album/banner_clean.gif` });
await cleanBanner({ from: `${SRC}/blog/bannerbgb2.gif`, cleanX: 300, cleanW: 250, out: `${OUT}/blog/banner_clean.gif` });
await cleanBanner({ from: `${SRC}/index/bannerbg.gif`, cleanX: 210, cleanW: 250, out: `${OUT}/index/banner_clean.gif` });
await eraseWordmark({ from: `${SRC}/icon/joinfree_index.gif`, rect: [0, 0, 82, 22], out: `${OUT}/icon/joinfree_index.gif` });

const count = (d) => fs.readdirSync(path.join(OUT, d)).length;
log(`\n完成 → public/img/wretch/`);
for (const d of ['album', 'blog', 'index', 'icon']) log(`  ${d}/  ${count(d)} 檔`);
