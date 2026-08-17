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

/** 名片欄位選項 */
export const ZODIACS = ['牡羊座','金牛座','雙子座','巨蟹座','獅子座','處女座',
  '天秤座','天蠍座','射手座','摩羯座','水瓶座','雙魚座'];
export const BLOODS = ['A','B','O','AB'];
export const SEXES = ['男生','女生'];
export const CITIES = ['基隆','台北','新北','桃園','新竹','苗栗','台中','彰化','南投',
  '雲林','嘉義','台南','高雄','屏東','宜蘭','花蓮','台東','澎湖','金門','馬祖','海外'];

/** 版面樣式（無名的「網誌樣式」）。auto = 相簿橘／網誌藍，跟原站預設一致。 */
export const THEMES = [
  { id:'',        name:'預設（相簿橘／網誌藍）', sw1:'#DE750B', sw2:'#326EC8' },
  { id:'orange',  name:'經典橘',   sw1:'#E48A41', sw2:'#FFD196' },
  { id:'blue',    name:'經典藍',   sw1:'#447AC4', sw2:'#8AB9F4' },
  { id:'pink',    name:'甜心粉',   sw1:'#C94F7C', sw2:'#FBD7E4' },
  { id:'green',   name:'草地綠',   sw1:'#4E8B3B', sw2:'#D8EEC4' },
  { id:'purple',  name:'夢幻紫',   sw1:'#6B4E9B', sw2:'#DCD2F0' },
  { id:'black',   name:'酷炫黑',   sw1:'#333333', sw2:'#555555' },
  { id:'cyan',    name:'海洋藍',   sw1:'#1E7C8C', sw2:'#CFECF1' },
  { id:'brown',   name:'咖啡棕',   sw1:'#6B4A2F', sw2:'#E6D5C3' },
];
export const isTheme = t => THEMES.some(x => x.id === t);

export const isAlbumTopic = t => ALBUM_TOPICS.includes(t);
export const isBlogTopic  = t => BLOG_TOPICS.includes(t);
export const isPlace      = p => PLACES.includes(p);
