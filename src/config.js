// 站台識別與素材位置。
//
// 站名與 logo 是整個復刻裡唯一不照抄無名小站的東西，集中在這裡改；
// 其餘版面、色碼、素材一律照 WRETCH_DOM.md 的契約走。

export const SITE_NAME = process.env.SITE_NAME || 'vibeai 小站';
export const SITE_DESC = process.env.SITE_DESC || '相簿・網誌・留言板';
export const SITE_LOGO = process.env.SITE_LOGO || '/img/logo.png';

// 素材根。views 的 #static-path（kukubar 用來組素材網址的那個 hidden input）會讀它。
//
// 預設指 2012 的素材集。**不要再指 /img/wretch**——那是 2005 版的素材，
// 已經隨著 2005 殘骸一起刪掉了（見 HANDOFF.md 待辦 A-2）。
// 設了 R2 就走 R2，本機開發不需要任何雲端設定。
export const CDN = (process.env.WRETCH_CDN
  || (process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/wretch2012' : '/img/wretch2012')
).replace(/\/$/, '');
