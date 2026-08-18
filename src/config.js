// 站台識別與素材位置。
//
// 站名與 logo 是整個復刻裡唯一不照抄無名小站的東西，集中在這裡改；
// 其餘版面、色碼、素材一律照 WRETCH_DOM.md 的契約走。

export const SITE_NAME = process.env.SITE_NAME || 'vibeai 小站';
export const SITE_DESC = process.env.SITE_DESC || '相簿・網誌・留言板';
export const SITE_LOGO = process.env.SITE_LOGO || '/img/logo.png';

// 無名素材放在 R2（tools/upload-assets.mjs 推上去的 wretch/ 前綴）。
// 沒設 R2 時回退到 public/img/wretch/，本機開發不需要任何雲端設定。
export const CDN = (process.env.WRETCH_CDN
  || (process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/wretch' : '/img/wretch')
).replace(/\/$/, '');

// public/style.css 是靜態檔，EJS 不會處理它，所以裡面的底圖路徑寫死成本機的
// /img/wretch/…，並且全部集中在 :root 的 --w-* 變數上。
// 這裡在開機時算好一段覆蓋用的 <style>，讓正式站改吃 R2；
// CDN 就是本機路徑時回傳空字串，不多送任何位元組。
const ASSETS = {
  index: { body: 'bga_01.gif', banner: 'banner_clean.gif', sidetitle: 'sidetitle.gif',
    albumtitle: 'album_title.gif', blogtitle: 'blog_title.gif',
    albumgrid: 'album_grid.gif', albumgrid1: 'album_grid1.gif',
    bloggrid: 'blog_grid.gif', bloggrid1: 'blog_grid1.gif',
    c1: 'cycle01_01.gif', c2: 'cycle01_02.gif', c3: 'cycle01_03.gif', c4: 'cycle01_04.gif' },
  album: { body: 'bga_01.gif', banner: 'banner_clean.gif', title: 'titlebg.gif',
    sidetitle: 'sidetitlebga2.gif', grid: 'gridbg_01.gif', grid1: 'gridbg_02.gif',
    gridclass: 'gridclassbg.gif',
    c1: 'cycle01_01.gif', c2: 'cycle01_02.gif', c3: 'cycle01_03.gif', c4: 'cycle01_04.gif' },
  blog: { body: 'bgb_01.gif', banner: 'banner_clean.gif', title: 'titlebgb.gif',
    sidetitle: 'sidetitlebgb2.gif', grid: 'gridbgb_01.gif', grid1: 'gridbgb_02.gif',
    c1: 'cycle02_01.gif', c2: 'cycle02_02.gif', c3: 'cycle02_03.gif', c4: 'cycle02_04.gif',
    img01: 'bg_img_01.gif', img02: 'bg_img_02.jpg', img03: 'bg_img_03.jpg', img04: 'bg_img_04.jpg' },
};

export const CDN_VARS = CDN === '/img/wretch' ? '' :
  '<style>:root{' +
  Object.entries(ASSETS).flatMap(([theme, files]) =>
    Object.entries(files).map(([k, f]) => `--w-${theme}-${k}:url('${CDN}/${theme}/${f}');`)
  ).join('') + '}</style>';

// 三套主題：首頁綠 / 相簿橘 / 網誌藍（見 WRETCH_DOM.md 第 1 節）
//
// 站台層級的頁（首頁、相簿總站、排行榜、登入…）一律綠；
// 個人小站頁跟站主在「網誌樣式」選的 users.theme，沒選過就照當年的預設：
// 網誌藍、其餘（MyPage／相簿／留言板／名片／好友／設定）橘。
export const THEME_FOR = (nav, u) => {
  if (!u) return 't-index';
  if (u.theme) return 't-x-' + u.theme;
  return nav === 'blog' ? 't-blog' : 't-album';
};
