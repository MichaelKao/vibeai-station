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
  const { ALBUM_TOPICS, BLOG_TOPICS, PLACES } = await import('../src/taxonomy.js');
  const list = [
    ['首頁', '/'],
    ['相簿總站', '/albums'],
    ['網誌總站', '/blogs'],
    ['影音總站', '/video'],
    ['嘀咕總站', '/digu'],
    ['揪團總站', '/join'],
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
  for (const pl of PLACES) list.push([`相簿地區:${pl}`, '/albums?place=' + encodeURIComponent(pl)]);
  for (let c = 0; c <= 3; c++) list.push([`好友關係 c=${c}`, `/${DEMO}/friends?c=${c}`]);

  // 站上真的存在的一本相簿／一張照片／一篇文章，拿來測「單一項目」那幾頁。
  // 這些頁沒有列表頁那麼容易發現是空的，但點進去空空的一樣很傷。
  // 注意：**不要**用樣板字串組正規式。樣板字串會把 \d 這種無效跳脫的反斜線吃掉，
  // 組出來的 pattern 變成 (d+)，永遠比不到，這幾頁就會無聲無息地沒被檢查到。
  // 用一般字串相接，反斜線才留得住。
  const idRx = svc => new RegExp('/' + DEMO + '/' + svc + '/([0-9]+)', 'g');
  try {
    const alb = await (await fetch(`${BASE}/${DEMO}/album`)).text();
    const aid = [...alb.matchAll(idRx('album'))].map(m => +m[1])[0];
    if (aid) {
      list.push(['單本相簿', `/${DEMO}/album/${aid}`]);
      list.push(['一頁瀏覽', `/${DEMO}/album/${aid}?all=1`]);
      list.push(['幻燈片', `/${DEMO}/album/${aid}/slide`]);
      list.push(['相片牆(瀑布)', `/${DEMO}/album/${aid}/wall`]);
      list.push(['相片牆(馬賽克)', `/${DEMO}/album/${aid}/wall?style=angel`]);
      const det = await (await fetch(`${BASE}/${DEMO}/album/${aid}`)).text();
      const pid = [...det.matchAll(idRx('photo'))].map(m => +m[1])[1];
      if (pid) list.push(['單張照片', `/${DEMO}/photo/${pid}`]);
    }
    const bl = await (await fetch(`${BASE}/${DEMO}/blog`)).text();
    const bid = [...bl.matchAll(idRx('blog'))].map(m => +m[1])[0];
    if (bid) list.push(['單篇文章', `/${DEMO}/blog/${bid}`]);
    // 月份彙整：拿站上真的有文章的月份
    const ym = (bl.match(/\?ym=(\d{4}-\d{2})/) || [])[1];
    if (ym) list.push([`月份彙整 ${ym}`, `/${DEMO}/blog?ym=${ym}`]);
  } catch { }

  // 搜尋關鍵字要挑站上真的有的（/search 只比對相簿標題與文章標題／內文），
  // 拿「台灣」去測會查無結果——那是關鍵字選錯，不是站壞了。
  list.push(['站內搜尋', '/search?q=' + encodeURIComponent('夜市')]);
  list.push(['網誌搜尋', `/${DEMO}/blog/search?q=` + encodeURIComponent('的')]);
  list.push(['網誌 RSS', `/${DEMO}/blog/rss`]);
  list.push(['留言板 我要留言', `/${DEMO}/guestbook?tab=new`]);
  try {
    const jl = await (await fetch(`${BASE}/join`)).text();
    const j = [...jl.matchAll(/\/join\/([0-9]+)/g)].map(m => +m[1])[0];
    if (j) list.push(['單一揪團', `/join/${j}`]);
  } catch { }
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
  // 數「內容圖」出現幾次，不要只數 <img src>：
  //   /uploads/     站上自己的照片。幻燈片是把整本放進一段 JSON 給 JS 用的，
  //                 只數 <img> 會把它誤判成沒有照片
  //   i.ytimg.com   影音的縮圖直接用 YouTube 的，不會落在 /uploads/
  //   r2.dev        正式站的照片存在 Cloudflare R2，網址是 pub-….r2.dev，不是 /uploads/。
  //                 少了這一條，對正式站跑會整排誤報「沒有照片」——照片其實都在。
  const real = (html.match(/\/uploads\/|i\.ytimg\.com|r2\.dev\//g) || []).length;
  const dflt = (html.match(/\/img\/avatar\.png/g) || []).length;

  // 頁面上真正指向站內內容的連結有幾條。用它來分辨兩種「出現空狀態字串」：
  //   真的空   分類頁沒有任何相簿 → 連結數 0，要報
  //   分區空   搜尋頁「找不到相符的站友」但相簿與文章有一堆 → 連結數很多，不用報
  // 只比對整頁有沒有那幾個字，會把後者誤判成空頁。
  const links = (html.match(/href="\/[^"]*\/(album|blog|photo|guestbook|video|digu)/g) || []).length;

  // 這幾頁本來就不該有照片：說明頁是純文字、RSS 是 XML。
  const NO_PHOTO_OK = ['服務說明', '網誌 RSS'];
  const flag = (hit.length && links < 3 && real < 3) ? '空狀態'
    : (real === 0 && !NO_PHOTO_OK.includes(name)) ? '沒有照片' : '';
  console.log(`${flag ? '! ' : '  '}${name.padEnd(18)} 照片 ${String(real).padStart(3)}`
    + `  預設頭像 ${String(dflt).padStart(2)}`
    + `  連結 ${String(links).padStart(3)}`
    + (hit.length ? `  ← 出現：${hit.join('／')}` : ''));
  if (flag) bad.push([name, url, flag + (hit.length ? '：' + hit.join('／') : '')]);
}

const { total, fake } = await fakePhotos();
console.log(`\n照片檔：大圖 ${total} 張，疑似色塊 ${fake.length} 張`);
console.log(bad.length ? `\n有 ${bad.length} 頁還是空的：\n` + bad.map(b => `  ${b[0]}  ${b[1]}  ${b[2]}`).join('\n')
                       : '\n全部頁面都有內容。');
