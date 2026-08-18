// 版型（無名的「相簿樣式／網誌樣式」）
//
// 無名的個人頁長相是由**版型**決定的：每個使用者挑一套版型，站台就載那一支
// 版型 CSS（當年是存成 f12.wretch.yimg.com/<帳號>/files/album.css）。
// 這裡照同樣的做法做——不是我們 2005 版自創的 `t-x-*` body class。
//
// 版型來源全部是從 Internet Archive 取回的**原廠檔**，判定依據見
// assets_src2/spec/skin.md：先量「已知是預設」的網誌 skin117 在隨機抽樣裡只佔 5%
// （因為大家都換過版型），以此為基準，其餘版型的出現率才站得住。
//
// 要加新版型：把版型 CSS 放 assets_src2/css/、素材放 assets_src2/img/skin<編號>/，
// 在 tools/build-css2012.mjs 的 BUNDLES 加一支，再回到這裡登記。

// 使用者可選的版型。id 存在 users.theme 欄位。
export const SKINS = [
  {
    id: '',                       // 空字串＝預設，跟原站一樣
    name: '粉紅（預設）',
    note: '無名的相簿預設版型 skin 1/189',
    swatch: ['#F9E3E7', '#C86B7E'],
    css: { album: '/wretch2012-album.css' },
  },
  {
    id: 'grey',
    name: '灰白',
    note: '無名的相簿版型 skin 1/188，另一套原廠配色',
    swatch: ['#EDEDED', '#8A8A8A'],
    css: { album: '/wretch2012-album-188.css' },
  },
];

export const isSkin = id => SKINS.some(s => s.id === (id || ''));

// 各服務的版型檔。沒有為該服務定義變體的版型就回退到預設那一套——
// 目前只有相簿抓到兩套原廠配色，網誌／留言板／名片／好友各只有一套。
const FALLBACK = {
  album: '/wretch2012-album.css',
  blog: '/wretch2012-blog.css',
  guestbook: '/wretch2012-skin-guestbook.css',
  user: '/wretch2012-skin-user.css',
  friend: '/wretch2012-skin-friend.css',
};

export function skinCss(service, id) {
  const skin = SKINS.find(s => s.id === (id || '')) || SKINS[0];
  return skin.css?.[service] || FALLBACK[service] || FALLBACK.album;
}
