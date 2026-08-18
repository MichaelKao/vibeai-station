// 還原度量測：把「原始頁面」與「我們的頁面」的結構拿來逐項比對。
//
// 為什麼不用像素比對：原版格子裡是別人的照片、我們是站上的資料，
// 內容不同就會讓像素差異爆到 40% 以上——那量到的是內容不同，不是版面不同。
//
// 為什麼不連 archive.org：它會拒連（實測重試四次仍失敗），
// 而且「載不到」會被誤判成「原版沒有這個元素」，量出假的 0%。
// 原始 HTML 已經下載在 assets_src2/html/，直接讀檔最可靠也可重現。
//
// 量三件事：
//   1. 結構覆蓋率 — 原版有的 id / class，我們做了幾個
//   2. 我們多做的 — 原版沒有、我們自己加的（不一定是錯，但要看得到）
//   3. 逐字文案覆蓋率 — 原版頁面上的中文字串，我們有幾個
//
//   node tools/fidelity.mjs <原始HTML> <我們的網址> [名稱]
//   node tools/fidelity.mjs --all            跑下面 PAGES 表列的全部頁面

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';

// 原始檔 ↔ 我們的路徑。原始檔都在 assets_src2/html/。
const PAGES = [
  ['首頁',     'index_20120610082113.html',        '/'],
  ['相簿列表', 'album_album_list.html',            '/meimei/album'],
  ['單張照片', 'album_show_zh_kellyla.html',       '/meimei/photo/FIRST_PHOTO'],
  ['網誌',     'blog_2012_default_skin_afuuu.html', '/meimei/blog'],
  ['留言板',   'gb_guestbook_a000000010_20131226.html', '/meimei/guestbook'],
  ['名片',     'gb_user_a000000010_20120531.html', '/meimei/card'],
  ['好友',     'gb_friend_a000001_20131226.html',  '/meimei/friends'],
];

// 從 HTML 抽出結構識別字：id 與 class。
// 只看「版面用」的，濾掉一望即知是資料的（純數字、看起來像 hash 的）。
function structure(html) {
  const ids = new Set(), classes = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
    const v = m[1].trim();
    if (v && !/^\d+$/.test(v)) ids.add('#' + v);
  }
  for (const m of html.matchAll(/\bclass="([^"]+)"/g))
    for (const c of m[1].trim().split(/\s+/))
      if (c && !/^\d+$/.test(c)) classes.add('.' + c);
  return { ids, classes };
}

// 抽出畫面上看得到的中文字串（去掉 script/style，取 2 字以上的中文片段）
function chineseStrings(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const out = new Set();
  for (const m of text.matchAll(/[一-鿿]{2,}/g)) out.add(m[0]);
  return out;
}

const pct = (a, b) => b === 0 ? 100 : Math.round(a * 100 / b);

async function compare(name, origFile, ourPath) {
  const p = path.resolve('assets_src2/html', origFile);
  if (!fs.existsSync(p)) return console.log(`${name}: 找不到原始檔 ${origFile}`);
  const orig = fs.readFileSync(p, 'utf8');

  let ours;
  try { ours = await (await fetch(BASE + ourPath)).text(); }
  catch (e) { return console.log(`${name}: 抓不到我們的頁面 ${ourPath} — ${e.message}`); }

  const O = structure(orig), M = structure(ours);
  const oAll = new Set([...O.ids, ...O.classes]);
  const mAll = new Set([...M.ids, ...M.classes]);

  const hit = [...oAll].filter(x => mAll.has(x));
  const missBits = [...oAll].filter(x => !mAll.has(x));
  const extra = [...mAll].filter(x => !oAll.has(x));

  const oz = chineseStrings(orig), mz = chineseStrings(ours);
  const zHit = [...oz].filter(x => mz.has(x));

  console.log(`\n── ${name} ──  原始檔 ${origFile}`);
  console.log(`   結構覆蓋率  ${pct(hit.length, oAll.size)}%  （原版 ${oAll.size} 個 id/class，我們做了 ${hit.length} 個）`);
  console.log(`   文案覆蓋率  ${pct(zHit.length, oz.size)}%  （原版 ${oz.size} 個中文字串，我們有 ${zHit.length} 個）`);
  console.log(`   我們額外加的 ${extra.length} 個 id/class`);
  if (missBits.length) console.log(`   缺的前 12 個：${missBits.slice(0, 12).join(' ')}`);
  return { name, struct: pct(hit.length, oAll.size), text: pct(zHit.length, oz.size) };
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  // 單張照片頁需要一個真的照片 id
  let firstPhoto = null;
  try {
    const alb = await (await fetch(BASE + '/meimei/album')).text();
    const aid = [...alb.matchAll(/\/meimei\/album\/(\d+)/g)].map(m => +m[1])[0];
    const det = await (await fetch(BASE + '/meimei/album/' + aid)).text();
    firstPhoto = [...det.matchAll(/\/meimei\/photo\/(\d+)/g)].map(m => +m[1])[0];
  } catch { }

  const results = [];
  for (const [name, file, p] of PAGES) {
    const url = p.replace('FIRST_PHOTO', firstPhoto ?? '');
    if (url.includes('FIRST_PHOTO') || url.endsWith('/photo/')) { console.log(`\n── ${name} ── 找不到照片 id，跳過`); continue; }
    const r = await compare(name, file, url);
    if (r) results.push(r);
  }
  if (results.length) {
    const avg = k => Math.round(results.reduce((s, r) => s + r[k], 0) / results.length);
    console.log(`\n═══ 全站平均：結構 ${avg('struct')}%　文案 ${avg('text')}% ═══`);
  }
} else if (args.length >= 2) {
  await compare(args[2] || args[0], args[0], args[1]);
} else {
  console.log('用法：node tools/fidelity.mjs --all\n      node tools/fidelity.mjs <原始HTML檔名> <我們的路徑> [名稱]');
}
