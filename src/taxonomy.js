// 站內分類 —— 逐字取自無名小站原始頁面（見 WRETCH_SPEC.md 第 5-3、5-4 節）

/** 相簿站內分類 24 類 */
export const ALBUM_TOPICS = [
  '國內旅遊','國外旅遊','美食記錄','流行時尚','圖像創作','美學設計',
  '專業攝影','蒐集收藏','電腦通訊','電玩動漫','交通工具','心肝寵物',
  '展覽活動','自然觀察','運動體育','影視娛樂','拍賣市集','特定節日',
  '學園生活','朋友團體','家庭親情','情侶合照','女生個人','男生個人',
];

/** 網誌站內分類 12 類 */
export const BLOG_TOPICS = [
  '創作','旅遊','生活','運動','娛樂','流行',
  '科技','學習','財經','社會','心情','團體',
];

/** 相簿地區 */
export const PLACES = ['台灣','香港與澳門','中國','世界各地'];

/** 心情／天氣（網誌發文用） */
export const MOODS = ['開心','難過','生氣','無聊','想睡','戀愛','忙碌','放空','感動','驚訝'];
export const WEATHERS = ['晴','多雲','陰','雨','雷雨','颱風','下雪','熱','冷'];

export const isAlbumTopic = t => ALBUM_TOPICS.includes(t);
export const isBlogTopic  = t => BLOG_TOPICS.includes(t);
export const isPlace      = p => PLACES.includes(p);
