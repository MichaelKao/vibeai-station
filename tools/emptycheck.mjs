// 空頁檢查：把站上每一頁掃一遍，找出「看起來空空的」地方。
//
// 為什麼要有這支：還原度（tools/fidelity.mjs）量的是**版面結構**對不對，
// 它不在乎格子裡有沒有東西——24 個分類頁全都是空的，結構還原度照樣 100%。
// 但人一眼看到的是「這站是不是死的」，所以另外量三件事：
//
//   1. 空狀態字串   view 裡那些「還沒有…」「目前沒有…」的提示有沒有出現
//   2. 圖片         每頁的 <img> 有幾張、有沒有指到預設圖（/img/avatar.png）
//   3. 假照片       站上的照片檔有沒有純色色塊（抓圖失敗時的退路）
//
//   node tools/emptycheck.mjs            掃全站
//   node tools/emptycheck.mjs --photos   只查照片是不是真的

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';
const DEMO = process.env.DEMO_USER || 'meimei';
const DATA = process.env.DATA_DIR || 'data';

// view 裡實際會印的空狀態字串（grep views/ 抓出來的）
const EMPTY_HINTS = [
  '還沒有', '目前沒有', '尚無', '沒有任何', '還是空的', '第一個吧',
  '目前還沒', '沒有符合', '找不到', '快來上傳',
];

// 要掃的頁。分類頁用 ?topic= 逐一帶入，那是最容易整片空掉的地方。
async function pages() {
  const { ALBUM_TOPICS, BLOG_TOPICS } = await import('../src/taxonomy.js');
  const list = [
    ['首頁', '/'],
    ['相簿總站', '/albums'],
    ['網誌總站', '/blogs'],
    ['排行榜', '/rank'],
    ['服務說明', '/help'],
    ['MyPage', `/${DEMO}`],
    ['相簿列表', `/${DEMO}/album`],
    ['網誌', `/${DEMO}/blog`],
    ['留言板', `/${DEMO}/guestbook`],
    ['站方公告', `/${DEMO}/guestbook?tab=bulletin`],
    ['名片', `/${DEMO}/card`],
    ['好友', `/${DEMO}/friends`],
    ['影音', `/${DEMO}/video`],
    ['嘀咕', `/${DEMO}/digu`],
    ['我的收藏', `/${DEMO}/favs`],
    ['誰來我家', `/${DEMO}/visitors`],
  ];
  for (const t of ALBUM_TOPICS) list.push([`相簿分類:${t}`, '/albums?topic=' + encodeURIComponent(t)]);
  for (const t of BLOG_TOPICS) list.push([`網誌分類:${t}`, '/blogs?topic=' + encodeURIComponent(t)]);
  for (let c = 0; c <= 3; c++) list.push([`好友關係 c=${c}`, `/${DEMO}/friends?c=${c}`]);
  return list;
}

// 純色色塊偵測：抓圖失敗時的退路會產生單一顏色的 JPEG，檔案特別小。
// 640x480 的真實照片壓到 q82 幾乎都在 20KB 以上，色塊只有幾 KB。
//
// **只看資料庫真的指到的檔案**。直接掃整個 uploads 目錄會把歷次 seed 留下的
// 孤兒檔一起算進來（實測 1033 個檔案裡有 700 個是沒人指到的舊檔），
// 量出來的「色塊比例」就完全是假的。
async function fakePhotos() {
  const dir = path.join(DATA, 'uploads');
  if (!fs.existsSync(dir)) return { total: 0, fake: [] };
  const { all } = await import('../src/db.js');
  const rows = await all("SELECT url FROM photos WHERE url LIKE '/uploads/%'");
  const fake = [];
  for (const r of rows) {
    const f = path.join(dir, path.basename(r.url));
    try { if (fs.statSync(f).size < 8000) fake.push(path.basename(r.url)); }
    catch { fake.push(path.basename(r.url) + '（檔案不見了）'); }
  }
  return { total: rows.length, fake };
}

if (process.argv.includes('--photos')) {
  const { total, fake } = await fakePhotos();
  console.log(`大圖 ${total} 張，疑似色塊（<8KB）${fake.length} 張`);
  if (fake.length) console.log('  ' + fake.slice(0, 20).join('\n  '));
  process.exit(fake.length ? 1 : 0);
}

const bad = [];
for (const [name, url] of await pages()) {
  let html;
  try {
    const r = await fetch(BASE + url);
    if (!r.ok) { bad.push([name, url, `HTTP ${r.status}`]); continue; }
    html = await r.text();
  } catch (e) { bad.push([name, url, e.message]); continue; }

  const hit = EMPTY_HINTS.filter(h => html.includes(h));
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
  const real = imgs.filter(s => s.startsWith('/uploads/')).length;
  const dflt = imgs.filter(s => s === '/img/avatar.png').length;

  const flag = hit.length ? '空狀態' : (real === 0 ? '沒有照片' : '');
  console.log(`${flag ? '! ' : '  '}${name.padEnd(18)} 照片 ${String(real).padStart(3)}`
    + `  預設頭像 ${String(dflt).padStart(2)}`
    + (hit.length ? `  ← 出現：${hit.join('／')}` : ''));
  if (flag) bad.push([name, url, flag + (hit.length ? '：' + hit.join('／') : '')]);
}

const { total, fake } = await fakePhotos();
console.log(`\n照片檔：大圖 ${total} 張，疑似色塊 ${fake.length} 張`);
console.log(bad.length ? `\n有 ${bad.length} 頁還是空的：\n` + bad.map(b => `  ${b[0]}  ${b[1]}  ${b[2]}`).join('\n')
                       : '\n全部頁面都有內容。');
