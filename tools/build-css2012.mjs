// 2012 版樣式管線。
//
// 不重寫原始 CSS——直接用無名當年那幾支原始檔，只做兩件事：
//   1. 把 url(…) 換成我們的素材位置（相對的 ../img/xxx 和絕對的 l.yimg.com/… 都處理）
//   2. 檢查每一個被引用的圖檔是不是真的抓到了，沒抓到就明確列出來
//
// 這樣做的理由：手抄 92KB 的 CSS 必然會抄錯，而原始檔本身就是最準的規格。
//
//   node tools/build-css2012.mjs                    → 產生 public/*.css（指向本機素材）
//   ASSET_BASE=https://…/wretch2012 node tools/build-css2012.mjs   → 指向 R2
//
// 產出：
//   public/wretch2012.css              首頁
//   public/wretch2012-album.css        相簿個人頁（相簿列表／照片列表／單張照片）
//   public/wretch2012-album-index.css  相簿總站 www.wretch.cc/album（960px 三欄）
//   public/wretch2012-slider.css       相簿幻燈片 slider.php（整頁黑底）
//   public/wretch2012-blog.css         網誌頁
//   public/wretch2012-gb.css           留言板／名片／好友（官方 CSS，不含版型）
//   public/wretch2012-skin-guestbook.css   留言板預設版型 skin 1911
//   public/wretch2012-skin-user.css        名片預設版型（無圖，純 CSS）
//   public/wretch2012-skin-friend.css      好友預設版型 skin 577
//
// 為什麼 gb 那三支版型要單獨出檔、不併進 wretch2012-gb.css：
//   留言板／名片／好友是三個不同的頁面，各自載自己的版型檔，三份版型都寫了
//   html{} 和 body{} 的背景與邊框。併成一支的話後面的會把前面的蓋掉（例如名片版型的
//   body{background:#FFF} 會洗掉留言板版型的 #eff8ff）。原站本來就是一頁一支，照原樣出。

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('assets_src2');
const IMG_OUT = path.resolve('public/img/wretch2012');
const OUT_DIR = path.resolve('public');
const BASE = (process.env.ASSET_BASE || '/img/wretch2012').replace(/\/$/, '');

// ── 素材來源 ────────────────────────────────────────────────────────────────
// assets_src2/img/<代號>/ → public/img/wretch2012/<代號>/
// skin<編號> 是各服務的預設版型素材，出處見 assets_src2/spec/skin.md。
const IMG_GROUPS = [
  'index', 'chrome', 'album', 'blog', 'gb',
  'albumindex',// 相簿總站（l.yimg.com/e/serv/index/album/css/ 底下那 41 張 + 1 張 hp/spirit 虛線）
  'skin117',   // 網誌預設版型
  'skin188',   // 相簿預設版型（灰色版，備用，目前沒串進任何 bundle）
  'skin189',   // 相簿預設版型（粉色版，實際採用）
  'skin577',   // 好友預設版型
  'skin1911',  // 留言板預設版型
];

// ── 各分頁的 CSS 串接順序 ──────────────────────────────────────────────────
// [說明, 來源檔, 素材代號]；素材代號 null＝這支沒有 url()，不用改寫。
// 順序照當年頁面 <link> 的順序，cascade 才會一樣。
//
// 每個 bundle 可以帶兩個旗標：
//   absolute:true  連 http(s)://… 的絕對網址也改寫（首頁那支刻意維持 false，輸出才逐位元不變）
//   bare:true      連 url(檔名.jpg) 這種「沒有任何路徑、跟 CSS 同目錄」的也改寫
//                  ——相簿總站那兩支就是這樣寫的（url(h4_bg.jpg)），不開這個旗標會整組漏掉
const BUNDLES = {
  'wretch2012.css': {
    title: '首頁',
    note:
      ' * 版面主檔 wfp-css_201205171100.css 從 2012-05 到 2013 關站都沒再改過\n' +
      ' * （已 diff 過 2013 末版，只多了關站公告框的 .notification 一組規則）。\n' +
      ' * 出處與逐條說明見 assets_src2/spec/index.md。',
    absolute: false,                       // 首頁只改相對路徑，維持既有輸出不動
    parts: [
      ['YUI 3.2.0 reset + fonts（字級基準，原站就是載這個）', 'css/index_yui320_reset-fonts.css', null],
      ['首頁版面主檔 wfp-css_201205171100.css（2012-05～關站未再改動）', 'css/index_wfp-css_201205171100.css', 'index'],
      ['chameleon.css（換膚／腰帶寬度覆蓋）', 'css/index_chameleon.css', 'index'],
    ],
  },

  // 相簿：album_show_zh_kellyla.html 的 <link> 順序
  //   版型 → font → newButton → newPanel → photowall → sharing → kukubar
  'wretch2012-album.css': {
    title: '相簿頁',
    note:
      ' * 版型是相簿預設版型 skin 1/189（檔頭寫「無名小站預設相簿樣式, 使用者可以亂改」）。\n' +
      ' * 相簿頁沒有官方版面 CSS，整頁靠 table + 版型檔，表格寬 700px、縮圖格 120px。\n' +
      ' * 出處見 assets_src2/spec/skin.md。',
    absolute: true,
    parts: [
      ['相簿預設版型 skin 1/189', 'css/album_default_skin189.css', 'skin189'],
      ['album/css/font.css（字級）', 'css/album_font.css', 'album'],
      ['album/css/newButton.css', 'css/album_newButton.css', 'album'],
      ['album/css/newPanel.css', 'css/album_newPanel.css', 'album'],
      ['album/css/photowall_overlay.css（照片牆）', 'css/album_photowall_overlay.css', 'album'],
      // 照片頁那個「換用新版相片頁」推廣浮層（#remindvers）的樣式。
      // 之前沒進 bundle，浮層就變成一坨沒有樣式的項目符號掉在版面最下面。
      // 這支同時提供 .hidden{display:none}，浮層預設收起來也靠它。
      ['album/css/spp_promotion.css（#remindvers 推廣浮層）', 'css/album_spp_promotion.css', 'album'],
      ['common/css/sharing.css（pic.wretch.cc 版）', 'css/album_sharing.css', 'album'],
      ['common/css/kukubar.css（內頁工具列）', 'css/chrome_kukubar.css', 'chrome'],
    ],
  },

  // 相簿灰色版型：只換版型那一層，官方那幾支完全相同。
  // 使用者在「相簿樣式」選灰色時載這支（見 src/skins.js）。
  'wretch2012-album-188.css': {
    title: '相簿頁（灰色版型 skin 1/188）',
    note:
      ' * 與 wretch2012-album.css 唯一的差別是版型那一層換成 skin 1/188，\n' +
      ' * 它的檔頭同樣寫著「無名小站預設相簿樣式, 使用者可以亂改」，是另一套原廠配色。',
    absolute: true,
    parts: [
      ['相簿版型 skin 1/188（灰）', 'css/album_default_skin188.css', 'skin188'],
      ['album/css/font.css（字級）', 'css/album_font.css', 'album'],
      ['album/css/newButton.css', 'css/album_newButton.css', 'album'],
      ['album/css/newPanel.css', 'css/album_newPanel.css', 'album'],
      ['album/css/photowall_overlay.css（照片牆）', 'css/album_photowall_overlay.css', 'album'],
      // 照片頁那個「換用新版相片頁」推廣浮層（#remindvers）的樣式。
      // 之前沒進 bundle，浮層就變成一坨沒有樣式的項目符號掉在版面最下面。
      // 這支同時提供 .hidden{display:none}，浮層預設收起來也靠它。
      ['album/css/spp_promotion.css（#remindvers 推廣浮層）', 'css/album_spp_promotion.css', 'album'],
      ['common/css/sharing.css（pic.wretch.cc 版）', 'css/album_sharing.css', 'album'],
      ['common/css/kukubar.css（內頁工具列）', 'css/chrome_kukubar.css', 'chrome'],
    ],
  },

  // 相簿總站 www.wretch.cc/album：album_service_index_20121211.html 的 <link> 順序
  //   fix.css（版面骨架）→ index.css（配色）。這頁沒有 kukubar——存檔裡整頁搜不到
  //   kukubar 三個字，它有自己的 #header（logo + 搜尋列）與 #footer。
  'wretch2012-album-index.css': {
    title: '相簿總站 www.wretch.cc/album',
    note:
      ' * 容器 #container1 寬 960px＝左欄 143 +8 ＋ 中欄 486 ＋ 右欄 315。\n' +
      ' * 相簿格 .album_list li 是 108×160（縮圖 108×108 ＋ 文字 42），\n' +
      ' * 和個人相簿頁的 120×120 不一樣——總站與個人頁本來就是兩套版面。\n' +
      ' * 素材是 l.yimg.com/e/serv/index/album/css/ 底下那批，2012 快照全部抓得到。',
    absolute: true,
    bare: true,
    parts: [
      ['index/album/css/fix.css（版面骨架）', 'css/assets_l_index-album-css_fix.css', 'albumindex'],
      ['index/album/css/index.css（配色）', 'css/assets_l_index-album-css_index.css', 'albumindex'],
    ],
  },

  // 幻燈片 slider.php：album_slider.html 只載這一支（reset 已經寫在同一個檔裡）。
  // 這頁也沒有 kukubar，整頁黑底、圖片置中，#slidewrap 1024×1024。
  'wretch2012-slider.css': {
    title: '相簿幻燈片 slider.php',
    note:
      ' * album_slider.html 的唯一一支 <link>（album/user/css/slider.css），\n' +
      ' * 檔頭自帶 YUI reset。整頁 html{color:#fff;background:#000}。\n' +
      ' * 它引用的 btn.gif / wretch_ch.gif 在 img/album/ 裡，路徑寫的是\n' +
      ' * pic.wretch.cc/serv/…（少一層 /e/），靠檔名比對接得回來。',
    absolute: true,
    parts: [['album/user/css/slider.css', 'css/album_slider.css', 'album']],
  },

  // 網誌：blog_2012_default_skin_afuuu.html 的 <link> 順序
  //   top → 版型 → sharing → font → trackback → kukubar
  'wretch2012-blog.css': {
    title: '網誌頁',
    note:
      ' * 版型是網誌預設版型 skin 1/117（檔頭寫「無名小站預設樣式，使用者可以亂改」）。\n' +
      ' * 總寬 750px＝主欄 #content 530 + 側欄 #links 200 + 間距 20。\n' +
      ' * 出處見 assets_src2/spec/skin.md 與 assets_src2/spec/blog.md。',
    absolute: true,
    parts: [
      ['blog/css/top.css（版型之前先載）', 'css/blog_top.css', null],
      ['網誌預設版型 skin 1/117', 'css/blog_default_skin117_afuuu_blog.css', 'skin117'],
      ['common/css/sharing.css（l.yimg 版）', 'css/chrome_sharing.css', 'chrome'],
      ['blog/css/font.css（字級）', 'css/blog_font.css', 'blog'],
      ['blog/css/trackback.css', 'css/blog_trackback.css', 'blog'],
      ['common/css/kukubar.css（內頁工具列）', 'css/chrome_kukubar.css', 'chrome'],
    ],
  },

  // 留言板／名片／好友的官方 CSS。三個頁面共用這一支，版型另外出檔。
  //   留言板 layout → namecard → 〔版型〕→ overwrite
  //   好友　 fix    → 〔版型〕→ select
  //   名片　 〔版型〕→ user/font
  'wretch2012-gb.css': {
    title: '留言板／名片／好友（官方 CSS，不含版型）',
    note:
      ' * 這支只有官方那幾層：留言板 layout/namecard/overwrite、好友 fix/select、名片 font，\n' +
      ' * 最後是 kukubar。三個頁面各自的預設版型是另外三支 wretch2012-skin-*.css，\n' +
      ' * 因為它們都寫了 html{}/body{} 背景，併在一起會互相蓋掉。\n' +
      ' * 留言板容器 958px（#content 612 / #sidebar 330）。出處見 assets_src2/spec/skin.md。',
    absolute: true,
    parts: [
      ['guestbook/css/layout.css（reset＋留言板版面骨架）', 'css/gb_layout.css', 'gb'],
      ['guestbook/css/namecard.css（留言板上的名片小卡 298px）', 'css/gb_namecard.css', null],
      ['guestbook/css/overwrite.css（蓋在版型之上的官方修正）', 'css/gb_overwrite.css', null],
      ['friend/css/fix.css（好友頁骨架）', 'css/gb_friend_fix.css', 'gb'],
      ['friend/css/select.css（好友頁下拉選單）', 'css/gb_friend_select.css', 'gb'],
      ['user/css/font.css（名片字級）', 'css/gb_user_font.css', null],
      ['common/css/kukubar.css（內頁工具列）', 'css/chrome_kukubar.css', 'chrome'],
    ],
  },

  'wretch2012-skin-guestbook.css': {
    title: '留言板預設版型 skin 1/1911',
    note: ' * 單獨出檔，套在 wretch2012-gb.css 的 layout/namecard 之後、overwrite 之前。',
    absolute: true,
    parts: [['留言板預設版型 skin 1/1911', 'css/gb_default_skin1911_guestbook.css', 'skin1911']],
  },

  'wretch2012-skin-user.css': {
    title: '名片預設版型（無素材）',
    note: ' * 單獨出檔，套在名片頁 user/css/font.css 之前。這支完全沒有引用圖檔。',
    absolute: true,
    parts: [['名片預設版型', 'css/gb_default_user.css', null]],
  },

  'wretch2012-skin-friend.css': {
    title: '好友預設版型 skin 5/577',
    note: ' * 單獨出檔，套在 friend/css/fix.css 之後、friend/css/select.css 之前。',
    absolute: true,
    parts: [['好友預設版型 skin 5/577', 'css/gb_default_skin577_friend.css', 'skin577']],
  },
};

// ── 複製素材 ────────────────────────────────────────────────────────────────
// 子目錄（例如 gb/Smileys/ 那 20 張表情圖）也要一起複製並保留目錄結構：
// 它們不是被 CSS 的 url() 引用的，是被 HTML 直接 <img> 引用的（留言板的表情列），
// 只掃平面檔案會漏掉。子目錄裡的檔名不進 have 索引——url() 改寫只按平面檔名找。
fs.rmSync(IMG_OUT, { recursive: true, force: true });
let copied = 0;
const have = new Map();                        // 代號 → Set(檔名)，只收平面層
for (const g of IMG_GROUPS) {
  const from = path.join(SRC, 'img', g);
  if (!fs.existsSync(from)) { console.log(`  素材 ${g}/  來源目錄不存在`); continue; }
  const to = path.join(IMG_OUT, g);
  fs.mkdirSync(to, { recursive: true });
  const names = new Set();
  let sub = 0;
  for (const f of fs.readdirSync(from)) {
    if (fs.statSync(path.join(from, f)).isDirectory()) {
      fs.cpSync(path.join(from, f), path.join(to, f), { recursive: true });
      sub += fs.readdirSync(path.join(to, f)).length;
      continue;
    }
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    names.add(f); copied++;
  }
  copied += sub;
  have.set(g, names);
  console.log(`  素材 ${g}/  ${names.size} 檔${sub ? `（＋子目錄 ${sub} 檔）` : ''}`);
}

// 備援索引：assets_src2/img/common/**（當年是按來源主機分目錄存的，檔名沒改）。
// 上面那幾個平面目錄找不到的檔名，就到這裡撈，撈到就順手複製進該分組。
const spare = new Map();                       // 檔名 → 絕對路徑
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (!spare.has(f)) spare.set(f, p);
  }
})(path.join(SRC, 'img', 'common'));
console.log(`  備援索引 common/**  ${spare.size} 檔`);

// ── url() 改寫 ──────────────────────────────────────────────────────────────
const missing = new Set();

// l.yimg.com/e/style/<目錄>/<版型編號>/<檔名> → 版型素材，改指 skin<版型編號>/
const STYLE_RE = /(?:https?:)?\/\/[^/]*yimg\.com\/e\/style\/\d+\/(\d+)\/([^/?#]+)/i;

function resolveUrl(raw, group) {
  const clean = raw.split('?')[0].split('#')[0];
  const m = STYLE_RE.exec(clean);
  const g = m ? `skin${m[1]}` : group;
  const name = m ? m[2] : clean.split('/').pop();
  if (!name) return null;

  if (have.get(g)?.has(name)) return `${g}/${name}`;

  // 這個分組沒有 → 其他分組找找看
  for (const [og, set] of have) if (set.has(name)) return `${og}/${name}`;

  // 還是沒有 → common/** 備援，撈到就複製進本分組
  const sp = spare.get(name);
  if (sp) {
    const to = path.join(IMG_OUT, g);
    fs.mkdirSync(to, { recursive: true });
    fs.copyFileSync(sp, path.join(to, name));
    if (!have.has(g)) have.set(g, new Set());
    have.get(g).add(name);
    copied++;
    return `${g}/${name}`;
  }

  missing.add(`${g}/${name}`);
  return `${g}/${name}`;                       // 照樣改寫，讓 404 看得出來是哪一支
}

// absolute=false 時只處理 ../img/xxx（首頁維持原本行為，輸出不變）
// bare=true 時再多處理 url(檔名.jpg)：跟 CSS 同目錄的裸檔名（相簿總站那兩支就是這樣寫的）
function rewrite(css, group, absolute, bare) {
  if (!group && !absolute) return css;
  return css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (whole, q, raw) => {
    const u = raw.trim();
    if (/^(data:|#)/i.test(u)) return whole;
    const isRel = u.startsWith('../img/');
    const isBare = bare && !/^(https?:)?\/\//.test(u) && !u.startsWith('/') && !u.includes('/');
    if (!isRel && !isBare && !absolute) return whole;
    if (!isRel && !isBare && !/^(https?:)?\/\//.test(u)) return whole;   // 其他相對路徑不動
    const rel = resolveUrl(u, group || 'chrome');
    return rel ? `url(${BASE}/${rel})` : whole;
  });
}

// ── 產檔 ────────────────────────────────────────────────────────────────────
const built = [];
for (const file of Object.keys(BUNDLES)) {
  const b = BUNDLES[file];
  const chunks = [];
  for (const [title, rel, group] of b.parts) {
    const p = path.join(SRC, rel);
    if (!fs.existsSync(p)) { console.error(`  !! 缺檔 ${rel}`); continue; }
    const css = rewrite(fs.readFileSync(p, 'utf8'), group, b.absolute, b.bare);
    chunks.push(`/* ===== ${title}  <${rel}> ===== */\n${css}`);
  }
  const header = `/* 無名小站 2012 最後版樣式 — ${b.title}
 *
 * 這個檔是 tools/build-css2012.mjs 產生的，**請不要手改**——
 * 改了下次重建就會被蓋掉。要調整請改 assets_src2/css/ 底下的來源，或改建置腳本。
 *
 * 內容是無名當年的原始 CSS，只把 url(…) 改指到 ${BASE}/。
${b.note}
 */
`;
  const out = path.join(OUT_DIR, file);
  fs.writeFileSync(out, header + chunks.join('\n\n'), 'utf8');
  built.push([file, fs.statSync(out).size]);
}

console.log('');
for (const [f, size] of built) console.log(`→ public/${f}  ${(size / 1024).toFixed(1)} KB`);
console.log(`\n素材共 ${copied} 檔　素材前綴 ${BASE}`);

if (missing.size) {
  console.log(`\n!! CSS 有引用但素材沒抓到（${missing.size} 個）：`);
  for (const m of [...missing].sort()) console.log('   ' + m);
  console.log('   → 這些位置在畫面上會是空白，要回 Wayback 補抓。');
} else {
  console.log('\n所有被引用的素材都到齊了。');
}
