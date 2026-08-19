// 塞一批展示用資料，讓版面在本機跑得起來、看得出對不對。
//
// 只在本機用（會直接寫 DATA_DIR 底下的 station.db）。照片用 sharp 就地生成純色圖，
// 不對外抓圖，所以離線也能跑。
//
//   node tools/seed-demo.mjs          追加
//   node tools/seed-demo.mjs --reset  先清空再塞

import { all, one, run } from '../src/db.js';
import { hash, salt } from '../src/auth.js';
import fs from 'node:fs';
import path from 'node:path';
import { save, remove, hasR2 } from '../src/storage.js';
import sharp from 'sharp';

const reset = process.argv.includes('--reset');
if (reset) {
  // 先把檔案刪掉再刪資料列。只 DELETE 資料列的話，上傳目錄會留下一堆
  // 沒有人指到的孤兒檔——跑三次就累積了七百多個，正式站有 R2 時那是真的在燒錢。
  // 走 storage.remove() 才會連 R2 上的一起刪。
  let gone = 0;
  for (const r of await all("SELECT url, thumb FROM photos")) {
    await remove(r.url); if (r.thumb && r.thumb !== r.url) await remove(r.thumb);
    gone += 2;
  }
  for (const r of await all("SELECT avatar FROM users WHERE avatar LIKE '/uploads/%'")) {
    await remove(r.avatar); gone++;
  }
  for (const t of ['photo_comments', 'photos', 'albums', 'comments', 'trackbacks', 'favs',
    'posts', 'guestbook', 'visitors', 'friends', 'acts', 'sysmsg', 'reports', 'notices',
    'videos', 'digu', 'users'])
    await run(`DELETE FROM ${t}`);
  console.log(`已清空（順便刪掉 ${gone} 個舊檔案）`);
}

const pick = (a, i) => a[i % a.length];

// ---- 時間 ----
// 站上的東西**不能全部都是今天建立的**。全部同一天的話，網誌的「文章日曆」
// 只有一格有顏色、「月份彙整」只有一個月、相簿列表的日期整排一樣——
// 那是一眼就看得出來的假資料。所以把時間攤在過去約兩年。
//
// 用固定的算式（不是亂數）算日期，重跑才會得到同樣的畫面，可以比對。
// 格式要跟 src/db.js 的 created 欄位一致：台北時間的 'YYYY-MM-DD HH:MM:SS'。
const DAY_MS = 86400000;
const NOW_MS = Date.now();
const stamp = (daysAgo, hourSeed = 0) => {
  const t = NOW_MS - Math.round(daysAgo * DAY_MS)
    - ((hourSeed * 7) % 24) * 3600000 - ((hourSeed * 13) % 60) * 60000;
  return new Date(t).toLocaleString('sv-SE').slice(0, 19);
};
// 第 i 個項目要落在幾天前：越舊的東西越少，跟真的站一樣（最近比較活躍）。
//
// ⚠ 呼叫時記得**把序號倒過來**（例如 spread(total - seq, total)）。
// 站上到處都是 ORDER BY id DESC，如果先插入的反而日期比較新，
// 列表就會出現「8月9日、5月26日、6月5日」這種跳來跳去的順序，一眼就看得出是假的。
// 倒過來之後「id 越大＝日期越新」，既有的排序查詢就都對得起來。
const spread = (i, total, maxDays = 730) => Math.round(maxDays * Math.pow(i / Math.max(1, total), 1.6));


// ---- 站友 ----
const USERS = [
  ['vibeai', '站長', '這裡是站長的小站，有問題歡迎留言。', 1],
  ['xiaoming', '小明', '一個喜歡拍照的普通人。', 0],
  ['ahua', '阿華', '吃飯睡覺打東東。', 0],
  ['meimei', '美美', '愛漂亮愛自拍愛旅行♥', 0],
  ['jaychou', '傑倫', '哎喲不錯喔。', 0],
  ['linda', 'Linda', 'Keep calm and carry on.', 0],
  ['a-bao', '阿寶', '台南人，最愛牛肉湯。', 0],
  ['tinatina', 'Tina', '正在存錢去日本。', 0],
];

// 站上有幾個地方**只有資料夠多才會長出結構**，量還原度時就會缺那些節點：
//   好友頁一頁 25 人 → 要 26 位以上好友才有 #pagelink_*、#listBottom 才吃得到東西
//   留言板一頁 10 則 → 要 11 則以上才有 #page_control_top / #page_link_2 / #next
// 主要示範帳號只有 8 位，湊不出 26 位好友，所以再補一批「只有帳號」的站友。
// 這批不配相簿與網誌（抓照片很慢），只有暱稱與大頭貼。
const EXTRA_NICKS = ['小魚', '阿凱', '妮妮', '大熊', '柚子', '阿宅', '球球', '小葵', '土豆', '飛飛',
  '嘟嘟', '阿倫', '莉莉', '肉圓', '喵喵', '大頭', '安琪', '阿丁', '波波', '小樹',
  '糖糖', '阿信', '樂樂', '小豬', '阿德', '琳琳', '毛毛', '阿翔', '圓圓', '小K'];
const EXTRA_USERS = EXTRA_NICKS.map((nick, i) =>
  [`wretch${String(i + 1).padStart(2, '0')}`, nick, pick(['路過的站友。', '這裡是我的小天地。', ''], i), 0]);

const uid = {};
for (const [name, nick, intro, admin] of [...USERS, ...EXTRA_USERS]) {
  const ex = await one('SELECT id FROM users WHERE name=?', name);
  if (ex) { uid[name] = ex.id; continue; }
  const s = salt();
  const r = await run(`INSERT INTO users(name,pass,salt,nick,intro,admin,visits,today_hits,hits_date,
      motto,city,sex,blood,zodiac,job,school,hobby)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    name, hash('demo1234', s), s, nick, intro, admin,
    Math.floor(Math.random() * 90000) + 1000, Math.floor(Math.random() * 400),
    new Date().toLocaleDateString('sv-SE'),
    pick(['活著就是為了吃', '青春不留白', '有夢最美', '認真的女人最美麗'], nick.length),
    pick(['台北市', '台中市', '高雄市', '台南市'], nick.length),
    pick(['男', '女'], nick.length), pick(['A', 'B', 'O', 'AB'], nick.length),
    pick(['牡羊座', '金牛座', '雙子座', '巨蟹座'], nick.length),
    pick(['學生', '工程師', '設計師', '服務業'], nick.length),
    pick(['台大', '成大', '政大', '中山'], nick.length),
    pick(['攝影、旅行', '看電影、聽音樂', '打球、睡覺'], nick.length));
  uid[name] = Number(r.lastInsertRowid);
}
console.log(`站友 ${Object.keys(uid).length} 位（密碼一律 demo1234）`);
console.log(`照片儲存位置：${hasR2 ? 'Cloudflare R2' : '本機 DATA_DIR/uploads'}`);

// ---- 照片 ----
// 用 loremflickr 抓「跟相簿主題對得上」的真實 Flickr 照片（CC 授權），
// 純色方塊看起來太假，版面比例也試不出來。抓過的存本機快取，重跑不會再抓一次。
// 沒網路時退回純色，種子資料不會因此跑不完。
const CACHE = path.resolve('.seedcache');
fs.mkdirSync(CACHE, { recursive: true });

const THROTTLE_MS = +(process.env.SEED_THROTTLE_MS || 350);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let made = 0, fetched = 0, cached = 0, failed = 0;

// 先把圖弄到手（回傳 Buffer），快取在 .seedcache/ 避免重跑重抓
// 快取檔名用「關鍵字＋這個關鍵字的第幾張」，**不要用全域計數器**：
// 用全域計數器的話，只要相簿清單改一筆，後面每一張的檔名就整批位移，
// 快取全部失效、又要重抓好幾百張。照關鍵字編號就只有真的新增的那些要抓。
const perKeyword = new Map();
async function fetchPhotoBuffer(keyword, tint) {
  const key = keyword.replace(/\W/g, '');
  const seq = (perKeyword.get(key) || 0) + 1;
  perKeyword.set(key, seq);
  made++;
  const name = `seed_${key}_${seq}.jpg`;
  const cache = path.join(CACHE, name);

  if (fs.existsSync(cache)) { cached++; return fs.readFileSync(cache); }

  // 對方會限流，所以節流 + 退避重試。抓到的都進快取，重跑只補缺的那些。
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(THROTTLE_MS);
      // lock=<n> 讓同一個位置每次都拿到同一張，重跑畫面才穩定、可比對
      // lock=<n> 讓同一個位置每次都拿到同一張。用 keyword+seq 當種子，
      // 這樣同一本相簿的第 n 張永遠是同一張圖，畫面可比對。
      const r = await fetch(`https://loremflickr.com/640/480/${encodeURIComponent(keyword)}?lock=${seq}`,
        { redirect: 'follow', signal: AbortSignal.timeout(25_000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // 重新編碼一次：確保是正常 JPEG，順便統一品質
      await sharp(Buffer.from(await r.arrayBuffer())).jpeg({ quality: 82 }).toFile(cache);
      fetched++;
      return fs.readFileSync(cache);
    } catch {
      if (attempt < 3) await sleep(1200 * attempt);
    }
  }
  // 抓不到就從已經抓到的真實照片裡循環取一張。純色方塊看起來太假，
  // 也試不出真實照片的明暗與比例。真的一張都沒有（完全離線）才退回純色。
  failed++;
  const pool = fs.readdirSync(CACHE).filter(f => f.endsWith('.jpg'));
  if (pool.length) return fs.readFileSync(path.join(CACHE, pool[made % pool.length]));
  const [r2, g2, b2] = [1, 3, 5].map(i => parseInt(tint.slice(i, i + 2), 16));
  return sharp({ create: { width: 640, height: 480, channels: 3, background: { r: r2, g: g2, b: b2 } } })
    .jpeg({ quality: 80 }).toBuffer();
}

// 存一張照片。**一律走 src/storage.js 的 save()**，不要自己寫檔：
// save() 有設 R2 就傳 R2、沒設才落本機磁碟，而且會順便產 90x90 縮圖、
// 把大圖壓到 1024。種子資料自己寫 UPLOAD_DIR 的話，灌到正式站就會
// 把圖塞進 Volume 而不是 R2。
async function photo(keyword, tint) {
  const buffer = await fetchPhotoBuffer(keyword, tint);
  return save({ buffer, mimetype: 'image/jpeg', size: buffer.length });
}

const TINTS = ['#E48A41', '#447AC4', '#A1D344', '#CB3939', '#8AB9F4', '#FFD196', '#72A316', '#C94F7C'];
// 每本相簿配一組搜尋關鍵字。關鍵字全部指向**台灣的真實地點與題材**，
// 這樣抓回來的照片才會跟相簿標題、跟「無名小站」這個情境對得上——
// 隨機風景照放在「羅東夜市」底下一眼就看得出是假的。
// **24 類每一類至少一本**（src/taxonomy.js 的 ALBUM_TOPICS 是逐字照抄原站的分類表）。
// 只做 8 本的時候，/albums 的分類頁有 19 類點進去是空的，站看起來就是死的。
const ALBUMS = [
  ['宜蘭兩天一夜',   '跟朋友衝一波，民宿超讚',     '國內旅遊', '台灣',       'yilan,taiwan'],
  ['九份老街',       '假日人有夠多但還是要去',     '國內旅遊', '台灣',       'jiufen,taiwan'],
  ['太魯閣',         '走到腳快斷掉',               '國內旅遊', '台灣',       'taroko,taiwan'],
  ['京都的秋天',     '楓葉季人擠人但值得',         '國外旅遊', '世界各地',   'kyoto,autumn'],
  ['首爾自由行',     '明洞每天都在下雨',           '國外旅遊', '世界各地',   'seoul,korea'],
  ['香港三天兩夜',   '茶餐廳一天吃三次',           '國外旅遊', '香港與澳門', 'hongkong,street'],
  ['羅東夜市吃透透', '一週吃了五次',               '美食記錄', '台灣',       'taiwan,nightmarket'],
  ['台南小吃巡禮',   '牛肉湯配肉燥飯',             '美食記錄', '台灣',       'tainan,food'],
  ['這季的新衣',     '存了很久才買的',             '流行時尚', '台灣',       'fashion,clothes'],
  ['隨手塗鴉',       '練習中，不要笑',             '圖像創作', '台灣',       'drawing,sketch'],
  ['字型與排版練習', '看久了會上癮',               '美學設計', '台灣',       'typography,design'],
  ['台北街頭隨手拍', '手機拍的',                   '專業攝影', '台灣',       'taipei,street'],
  ['底片機重出江湖', '沖出來才知道拍壞了',         '專業攝影', '台灣',       'film,camera'],
  ['我的公仔櫃',     '又要沒地方放了',             '蒐集收藏', '台灣',       'figure,toy'],
  ['新桌機開箱',     '裝到半夜三點',               '電腦通訊', '台灣',       'computer,desk'],
  ['動漫展戰利品',   '荷包再見',                   '電玩動漫', '台灣',       'anime,cosplay'],
  ['鐵道紀行',       '追火車追了一整天',           '交通工具', '台灣',       'train,taiwan'],
  ['我家的貓',       '牠又把衛生紙咬爛了',         '心肝寵物', '台灣',       'cat,taiwan'],
  ['浪浪的日常',     '巷口那隻又來討飯',           '心肝寵物', '台灣',       'dog,street'],
  ['美術館看展',     '看完腦袋很滿',               '展覽活動', '台灣',       'museum,exhibition'],
  ['陽明山的花',     '週末上山透透氣',             '自然觀察', '台灣',       'yangmingshan,flower'],
  ['週末打球',       '隔天全身痠痛',               '運動體育', '台灣',       'basketball,court'],
  ['演唱會之夜',     '喊到隔天說不出話',           '影視娛樂', '台灣',       'concert,stage'],
  ['二手挖寶',       '跳蚤市場真的有寶',           '拍賣市集', '台灣',       'fleamarket,vintage'],
  ['過年圍爐',       '又被問什麼時候結婚',         '特定節日', '台灣',       'lunarnewyear,taiwan'],
  ['畢業紀念',       '再也回不去了',               '學園生活', '台灣',       'taiwan,campus'],
  ['社團出遊',       '一年一次的大合照',           '朋友團體', '台灣',       'friends,group'],
  ['回外婆家',       '每年都要拍一張',             '家庭親情', '台灣',       'family,home'],
  ['交往一週年',     '偷偷放上來',                 '情侶合照', '台灣',       'couple,park'],
  ['自拍練習',       '角度真的很重要',             '女生個人', '台灣',       'portrait,girl'],
  ['隨手一張',       '朋友幫我拍的',               '男生個人', '台灣',       'portrait,man'],
  ['墾丁的海',       '曬到脫皮還是想再去',         '國內旅遊', '台灣',       'kenting,beach'],
  ['阿里山日出',     '四點起床值得',               '國內旅遊', '台灣',       'alishan,sunrise'],
  ['大阪吃到飽',     '章魚燒一天三份',             '國外旅遊', '世界各地',   'osaka,food'],
  ['澳門走走',       '老城區比賭場好玩',           '國外旅遊', '香港與澳門', 'macau,street'],
  ['上海外灘',       '晚上的燈真的很誇張',         '國外旅遊', '中國',       'shanghai,bund'],
  ['早餐店日常',     '蛋餅加辣是基本',             '美食記錄', '台灣',       'breakfast,taiwan'],
  ['手沖咖啡練習',   '豆子比機器重要',             '美食記錄', '台灣',       'coffee,pourover'],
  ['喜歡的鞋',       '一雙穿三年',                 '流行時尚', '台灣',       'sneakers,shoes'],
  ['水彩小練習',     '暈開的地方最難控制',         '圖像創作', '台灣',       'watercolor,painting'],
  ['海報設計稿',     '改了十二版',                 '美學設計', '台灣',       'poster,graphicdesign'],
  ['夜景練習',       '腳架終於買對了',             '專業攝影', '台灣',       'cityscape,night'],
  ['黑膠收藏',       '一張一張慢慢找',             '蒐集收藏', '台灣',       'vinyl,records'],
  ['鍵盤換軸心得',   '打字聲音好療癒',             '電腦通訊', '台灣',       'keyboard,mechanical'],
  ['遊戲主機開箱',   '排隊排了兩小時',             '電玩動漫', '台灣',       'videogame,console'],
  ['捷運的一天',     '通勤也可以拍照',             '交通工具', '台灣',       'metro,subway'],
  ['兔子日常',       '牠只認得飼料袋的聲音',       '心肝寵物', '台灣',       'rabbit,pet'],
  ['書展戰利品',     '又搬了一箱回家',             '展覽活動', '台灣',       'bookfair,books'],
  ['溪邊的午後',     '水好冰但很舒服',             '自然觀察', '台灣',       'creek,forest'],
  ['晨跑路線',       '沿著河濱一路到底',           '運動體育', '台灣',       'running,riverside'],
  ['電影院的爆米花', '看午夜場的儀式感',           '影視娛樂', '台灣',       'cinema,popcorn'],
  ['市場採買',       '婆婆媽媽都很會殺價',         '拍賣市集', '台灣',       'market,vegetables'],
  ['中秋烤肉',       '煙燻到眼睛睜不開',           '特定節日', '台灣',       'barbecue,grill'],
  ['宿舍的角落',     '四年就這麼過了',             '學園生活', '台灣',       'dormitory,student'],
  ['球隊聚餐',       '輸球還是要吃',               '朋友團體', '台灣',       'dinner,friends'],
  ['爸媽的老照片',   '翻到相簿最後一頁',           '家庭親情', '台灣',       'oldphoto,family'],
  ['一起去看海',     '什麼都不做也很好',           '情侶合照', '台灣',       'couple,beach'],
  ['今天的穿搭',     '外套是二手買的',             '女生個人', '台灣',       'outfit,woman'],
  ['理了個平頭',     '涼快但有點後悔',             '男生個人', '台灣',       'portrait,boy'],
];

// 主要示範帳號每人 4 本，補充站友每人 1 本——這樣 24 類每一類都有東西，
// /albums 的分類頁跟排行榜才不會點進去是空的。
// 起始位置用 index 錯開，不然每個人都拿到同幾本。
// 用**連號**發樣板，不要用 (ui*3+i*7) 這種散列：散列會讓同一個標題在
// 相簿總站的同一頁上出現好幾次（實測一頁 20 本裡有 5 組重複），看起來就很假。
// 連號可以保證每個樣板都用過一輪，才開始第二輪。
const TOTAL_ALBUMS = USERS.length * 4 + EXTRA_USERS.length;
let albumSeq = 0;
for (const [name] of [...USERS, ...EXTRA_USERS]) {
  const isMain = USERS.some(u => u[0] === name);
  const n = isMain ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const [title, descr, topic, place, keyword] = ALBUMS[albumSeq++ % ALBUMS.length];
    if (await one('SELECT 1 FROM albums WHERE user_id=? AND title=?', uid[name], title)) continue;
    // 這本相簿是幾天前建的。照片再往前後散幾天，同一本裡的日期才不會一模一樣。
    const albDays = spread(TOTAL_ALBUMS - albumSeq, TOTAL_ALBUMS);
    // 上鎖與好友限定：原站這兩種狀態很常見，站上一本都沒有的話那兩條路徑
    // （密碼頁、403）永遠看不到。每 11 本上鎖一本、每 13 本設好友限定一本。
    const albPass = albumSeq % 11 === 4 ? '1234' : '';
    const albFriendsOnly = albumSeq % 13 === 6 ? 1 : 0;
    const a = await run(`INSERT INTO albums(user_id,title,descr,topic,place,views,featured,pass,friends_only,created)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, uid[name], title, descr, topic, place,
      Math.floor(Math.random() * 5000), i === 0 && name === 'meimei' ? 1 : 0,
      albPass, albFriendsOnly, stamp(albDays, albumSeq));
    const aid = Number(a.lastInsertRowid);
    let cover = '';
    for (let k = 0; k < (isMain ? 5 + (i % 4) : 3); k++) {
      const p = await photo(keyword, pick(TINTS, uid[name] + k));
      // save() 已經把尺寸與 EXIF 算好回傳，不接住的話 #exif 面板永遠是空的
      // （照片頁的「圖片資訊」就沒東西可印）。
      await run(`INSERT INTO photos(album_id,url,thumb,caption,bytes,views,width,height,taken,camera,created)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        aid, p.url, p.thumb, pick(['這天天氣超好', '好吃！', '牠在生氣', '順便自拍一張', ''], k),
        p.bytes, Math.floor(Math.random() * 300), p.width, p.height, p.taken, p.camera,
        stamp(albDays - k * 0.12, albumSeq * 7 + k));
      if (!cover) cover = p.thumb;
    }
    await run('UPDATE albums SET cover=? WHERE id=?', cover, aid);
  }
}
// 大頭貼：從已抓到的真實照片裁 90x90（無名的大頭貼就是 90x90）。
// 預設那張卡通圖示放在「名家專欄」「投稿精選」這種以人為主的模組裡特別假。
{
  const pool = fs.readdirSync(CACHE).filter(f => f.endsWith('.jpg'));
  // 沒有 .seedcache（例如換機器、只跑追加模式）時退回站上既有照片的縮圖。
  // 好友頁一次列 25 張大頭貼，整頁都是預設卡通圖示會看不出版面對不對。
  const thumbs = pool.length ? [] : (await all("SELECT thumb FROM photos WHERE thumb!='' ORDER BY id")).map(r => r.thumb);
  let n = 0;
  for (const [name] of [...USERS, ...EXTRA_USERS]) {
    if (!pool.length && !thumbs.length) break;
    // 已經有大頭貼就跳過：save() 每呼叫一次就產生一組新檔案（有 R2 時還會上傳），
    // 不擋的話每重跑一次就多一批孤兒檔
    const cur = (await one('SELECT avatar FROM users WHERE id=?', uid[name]))?.avatar || '';
    if (cur && cur !== '/img/avatar.png') continue;
    if (!pool.length) {   // 退路：直接指向既有縮圖，不再產生新檔案
      await run('UPDATE users SET avatar=? WHERE id=?', pick(thumbs, uid[name] * 7), uid[name]);
      n++; continue;
    }
    const src = path.join(CACHE, pool[(uid[name] * 7) % pool.length]);
    const buf = await sharp(src).resize(90, 90, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 }).toBuffer();
    // 一樣走 save()：有 R2 就上 R2。save() 的 thumb 本來就是 90x90，直接拿來當大頭貼。
    const a = await save({ buffer: buf, mimetype: 'image/jpeg', size: buf.length });
    await run('UPDATE users SET avatar=? WHERE id=?', a.thumb, uid[name]);
    n++;
  }
  console.log(`大頭貼 ${n} 張（90x90，裁自真實照片）`);
}

console.log(`相簿 ${(await one('SELECT count(*) c FROM albums')).c} 本 / 照片 ${(await one('SELECT count(*) c FROM photos')).c} 張`
  + `（真實照片：新抓 ${fetched} 快取 ${cached}${failed ? ` / ${failed} 張抓不到，改用已抓到的真照片循環` : ''}）`);

// ---- 網誌 ----
const POSTS = [
  ['今天去了那間很有名的牛肉麵', '排了快一個小時，說真的還好而已 XD\n不過湯頭是真的濃，麵條偏軟，喜歡的人應該會愛。\n下次還是回去吃巷口那間好了。', '生活', '美食'],
  ['關於最近很紅的那首歌', '一開始覺得普普，聽了三天之後現在戒不掉。\n副歌那段真的很洗腦，已經單曲循環一整個禮拜。', '娛樂', '流行'],
  ['宜蘭兩天一夜流水帳', '禮拜六早上七點出發，中午就到了。\n民宿老闆超熱情，還送我們一堆水果。\n晚上去逛羅東夜市，蔥油餅排隊排到懷疑人生。', '旅遊', '旅遊'],
  ['期末快把我搞死了', '三份報告一個專題，還有兩科要考。\n已經連續三天睡不到五小時，撐過這禮拜就解脫。', '心情', '學習'],
  ['新相機開箱', '存了半年終於買了，先拍幾張測試。\n對焦超快，弱光表現也比舊的好太多。', '生活', '科技'],
  ['一個人的台北', '搬來第三年，還是會在捷運上突然覺得很孤單。\n但也習慣了，一個人有一個人的好。', '心情', '心情'],
  // 網誌列表頁的「(繼續閱讀)」（.extended）是內文超過 300 字才會出現
  // （views/blog.ejs 的 cut 判斷）。上面六篇都太短，量還原度時那一格永遠是空的，
  // 所以刻意放一篇長文把那個結構種出來。
  ['花蓮四天三夜完整攻略（超長慎入）',
    '這篇是上個月去花蓮玩四天三夜的完整流水帳，寫給以後的自己看，也給想去的人參考。\n\n' +
    '第一天：早上七點四十在台北車站搭太魯閣號，兩個小時就到花蓮了。出站先去租機車，一天三百五還算合理。' +
    '中午在市區吃了公正包子跟液香扁食，包子皮薄餡多，一顆才八塊；扁食湯頭很清爽，配著吃剛剛好。' +
    '下午騎去七星潭，那天風很大，浪拍在鵝卵石上的聲音一直傳過來，坐在那邊發呆了快兩個小時。' +
    '傍晚回市區逛東大門夜市，烤肉香整條街都聞得到。\n\n' +
    '第二天：主打太魯閣。九點出發，先到砂卡礑步道，水是那種不太真實的藍綠色，走到三間屋折返大概兩個半小時。' +
    '中午在天祥吃便當，下午去燕子口跟九曲洞，記得戴安全帽，園區入口就有免費借。' +
    '晚上回市區去了一間很有名的燒烤，等了四十分鐘才有位子，但海鮮真的新鮮。\n\n' +
    '第三天：往南騎到雲山水，落羽松跟水池的倒影很好拍，人也不多。' +
    '中午吃了鳳林的韭菜臭豆腐，第一次吃到炸得那麼酥的。下午去林田山，日式老宿舍保存得很完整，像走進另一個年代。' +
    '晚上回台北前先去買了一堆麻糬跟奶油酥條當伴手禮。\n\n' +
    '第四天：早上退房後去松園別館看海，最後在市區買了曾記麻糬就搭車回台北了。\n\n' +
    '四天花下來大概八千塊，含來回車票、住宿、租車跟吃的。花蓮真的很適合放空，' +
    '下次想試試看住在山上的民宿，早上起來就能看到雲海。',
    '旅遊', '旅遊'],

  // 以下補到 src/taxonomy.js 的 BLOG_TOPICS 12 類每一類都有文章。
  // 只做 6 類的時候，/blogs 的分類頁與首頁「名家專欄」的分頁點進去一半是空的。
  ['寫了三年終於完稿', '短篇小說寫了三年，昨天終於打上最後一句。\n改了七版，前面六版現在看都想燒掉。\n下一篇想試試看第一人稱。', '創作', '創作'],
  ['手帳這樣寫比較不會斷', '買了新手帳又想從頭開始的人舉手。\n我的心得是格子不要太細，一天留三行就好，寫得完才會想繼續寫。\n貼紙可以買但不要買太多，會變成收集不是紀錄。', '創作', '創作'],
  ['第一次跑十公里', '從完全不會跑到跑完十公里花了四個月。\n訣竅真的就是慢，慢到覺得自己在散步就對了。\n下個目標是半馬。', '運動', '運動'],
  ['在家也能練的核心', '沒時間上健身房的日子，就靠棒式跟深蹲撐著。\n一天十五分鐘，三個月下來腰真的比較不酸了。', '運動', '運動'],
  ['最近在追的那部劇', '一集四十分鐘，我一個晚上看了六集。\n編劇很敢寫，第八集那個轉折我到現在還在想。', '娛樂', '娛樂'],
  ['演唱會搶票心得', '三個裝置一起開，最後是用平板搶到的。\n搶完手在抖。位置雖然遠但整場都站著跳完。', '娛樂', '娛樂'],
  ['今年的球鞋', '穿了半年才來寫心得。\n鞋底比想像中軟，走一整天不太累，就是白色真的很難照顧。', '流行', '流行'],
  ['換季衣櫃整理法', '丟不掉的原因通常是「說不定以後會穿」。\n我的規則是一年沒穿就送人，這樣衣櫃才有空間放新的。', '流行', '流行'],
  ['新手機用了一個月', '拍照真的進步很多，尤其晚上。\n電池從早上八點用到晚上十一點還有兩成。', '科技', '科技'],
  ['把舊筆電裝成備份機', '五年前的筆電拆開清了灰、換了固態硬碟，開機從一分半變十五秒。\n現在拿來當家裡的備份機剛剛好。', '科技', '科技'],
  ['準備考試的那三個月', '每天六點起床唸到九點，中午睡半小時。\n最有用的不是唸多久，是每天固定同一個時段。', '學習', '學習'],
  ['背單字終於找到方法', '以前抄十遍隔天就忘。\n改成每天看五十個、連續看七天，記得的比抄十遍還多。', '學習', '學習'],
  ['開始記帳的第一年', '記了一年才發現最花錢的是外食跟飲料。\n只是把飲料減半，一年就多存了兩萬。', '財經', '財經'],
  ['第一次報稅', '看不懂就直接打電話問國稅局，比在網路上亂查快很多。\n人很好，講得很清楚。', '財經', '財經'],
  ['捷運上讓座那件事', '今天看到一個高中生讓座給老人家，被念說擋到路。\n那個表情我到現在還記得。\n做好事有時候真的需要勇氣。', '社會', '社會'],
  ['社區的資源回收', '我們這棟大樓開始分得很細之後，垃圾量真的少了三分之一。\n一開始大家都在抱怨，現在習慣了。', '社會', '社會'],
  ['一個人住的第三年', '學會了修水龍頭、換燈泡、跟自己吃飯。\n最難的還是生病的時候。', '生活', '生活'],
  ['搬家血淚史', '低估了自己的東西有多少。\n下次一定提早兩週開始整理，還有紙箱要買大的不要買小的。', '生活', '生活'],
  ['社團的最後一次聚會', '從大一到現在，這個社團給我的比我給它的多太多。\n昨天最後一次聚會，大家都說好要每年見一次。', '團體', '團體'],
  ['讀書會辦了兩年', '兩年下來讀了二十三本書。\n最大的收穫不是讀了多少，是每個月都有一天一定會跟這群人見面。', '團體', '團體'],
  ['把陽台種滿了', '從一盆薄荷開始，現在整個陽台都是。\n最好養的是黃金葛，最難養的是玫瑰，我已經陣亡三株了。', '生活', '生活'],
  ['關於早起這件事', '試過六點起床一個月。\n前兩週像酷刑，第三週開始覺得早上的時間特別安靜。\n關鍵是前一晚十一點就要躺平。', '生活', '生活'],
  ['第一次自己換機油', '看了三支影片就下去做了。\n最難的不是換，是把螺絲鎖回去的力道。\n省下的錢剛好買一頓晚餐。', '生活', '生活'],
  ['花東縱谷騎車', '兩天騎了一百八十公里，屁股完全不是自己的。\n但轉過某個彎突然看到整片稻田那瞬間，什麼都值得了。', '旅遊', '旅遊'],
  ['澎湖跳島', '三天跳了四個島，曬到脫兩層皮。\n吉貝的沙灘真的像明信片，但記得帶防曬。', '旅遊', '旅遊'],
  ['一個人的東京', '第一次自己出國，緊張到前一晚沒睡。\n結果最快樂的是在便利商店挑飯糰那種小事。', '旅遊', '旅遊'],
  ['寫程式的第一年', '從看不懂錯誤訊息，到現在會先看最後一行。\n進步最多的不是語法，是知道怎麼問問題。', '科技', '科技'],
  ['把家裡網路換成 mesh', '老公寓牆太厚，一台分享器怎麼放都有死角。\n換成三顆之後，廁所終於也有訊號了。', '科技', '科技'],
  ['備份這件事', '硬碟掛掉那天我才知道什麼叫欲哭無淚。\n現在是三份：電腦、外接、雲端。', '科技', '科技'],
  ['重看一次經典老片', '小時候看只覺得熱鬧，現在看懂了裡面的無奈。\n好的作品會跟著你一起長大。', '娛樂', '娛樂'],
  ['第一次進劇場', '沒有麥克風，聲音卻整場都聽得很清楚。\n中場休息時大家都在小聲討論，那個氣氛很迷人。', '娛樂', '娛樂'],
  ['打了三年的那款遊戲', '昨天官方宣布要收了。\n公會裡的人約好最後一天一起上線。\n遊戲會關，但那幾年是真的。', '娛樂', '娛樂'],
  ['開始游泳的第二個月', '從換氣就嗆水，到現在可以游完二十趟。\n教練說放鬆最重要，我到第六週才懂那是什麼意思。', '運動', '運動'],
  ['爬了第一座百岳', '半夜三點起登，看到日出那刻整個人都醒了。\n下山比上山還累，膝蓋隔天完全不能彎。', '運動', '運動'],
  ['球鞋穿到底該不該洗', '我的結論是：洗，但不要用洗衣機。\n刷子加中性清潔劑，陰乾兩天，可以多穿半年。', '流行', '流行'],
  ['極簡衣櫃實驗', '只留三十件，穿了半年。\n最大的發現是我根本不需要那麼多選擇，早上快很多。', '流行', '流行'],
  ['做手工皂', '第一批全部失敗，鹼度沒算好。\n第三批終於成功，送給朋友大家都說好用。', '創作', '創作'],
  ['學了三個月的吉他', '手指按到起繭，終於可以完整彈完一首。\n晚上不敢練，怕鄰居抗議。', '創作', '創作'],
  ['我的第一本手作書', '從裁紙到裝訂全部自己來。\n歪歪的，但翻開的時候心情完全不一樣。', '創作', '創作'],
  ['考照的那個夏天', '路考考了三次才過。\n第三次教練說：你不是不會，是太緊張。他說對了。', '學習', '學習'],
  ['線上課程的坑', '買了八門課，看完的只有兩門。\n後來改成一次只買一門，看完才准買下一門。', '學習', '學習'],
  ['存下第一桶金', '不是靠投資，是靠三年不買不需要的東西。\n最有效的一招是把薪水一入帳就先轉走三成。', '財經', '財經'],
  ['第一次繳勞健保', '看到金額的時候愣了一下。\n但真的生病去看醫生時，就覺得還好有繳。', '財經', '財經'],
  ['巷口那間店收了', '開了二十三年。\n最後一天老闆娘還是笑笑的，只說謝謝大家這麼多年。\n以後早餐不知道要吃什麼了。', '社會', '社會'],
  ['颱風天的便利商店', '半夜兩點還亮著燈。\n店員說有人需要就得開。\n買了一杯熱咖啡，覺得城市真的靠很多人撐著。', '社會', '社會'],
  ['同學會十年', '有人變了很多，有人一開口還是那個樣子。\n散場時大家在停車場又聊了一個小時捨不得走。', '團體', '團體'],
  ['志工隊的第一次出隊', '本來以為是去幫忙，結果被照顧最多的是我們。\n回程車上沒人講話，都在想事情。', '團體', '團體'],
  ['養成寫日記的習慣', '一天三行，寫了兩年。\n回頭翻的時候才發現，那些以為過不去的事，其實都過去了。', '心情', '心情'],
  ['關於長大這件事', '以前覺得長大是變厲害，現在覺得是學會接受自己不厲害。', '心情', '心情'],
  ['深夜的公車', '最後一班，車上只有三個人。\n司機開得很慢，好像知道大家都累了。', '心情', '心情'],
];

// 主要帳號每人 4 篇、補充站友每人 1 篇，起始位置照 index 錯開，
// 這樣 12 類每一類都有文章，/blogs 的分類頁與首頁名家專欄才不會有空分頁。
// 同樣用連號，理由見上面相簿那段。
// 迴響的人名與內容。原本只有 4 個名字 4 句話，整站翻下來每篇都是同樣那幾句，
// 一眼就看得出是灌的。
const COMMENT_NAMES = ['小明', '阿華', '路人甲', 'Tina', '小魚', '阿凱', '妮妮', '大熊',
  '柚子', '球球', '路過的', '無名氏', '老朋友', '第一次來', 'Kevin', '小葵'];
const COMMENT_BODIES = [
  '搶頭香！', '坐沙發～', '推推推', '我也想去！', '寫得真好，收藏了。',
  '請問那間在哪裡呀？', '看完好想出門喔', '這篇我看了三次', '同感 +1',
  '照片拍得好美', '謝謝分享！', '哈哈哈這太真實了', '路過留個言，加油',
  '剛好最近也在煩惱這個', '已分享給朋友看', '期待下一篇',
];

const TOTAL_POSTS = USERS.length * 4 + EXTRA_USERS.length;
let postSeq = 0;
for (const [name] of [...USERS, ...EXTRA_USERS]) {
  const n = USERS.some(u => u[0] === name) ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const [title, body, category, topic] = POSTS[postSeq++ % POSTS.length];
    if (await one('SELECT 1 FROM posts WHERE user_id=? AND title=?', uid[name], title)) continue;
    // 文章日曆與月份彙整要看得出「這個站活了兩年」，日期就不能全部是今天。
    const postDays = spread(TOTAL_POSTS - postSeq, TOTAL_POSTS);
    // 上鎖文章：原站的「私密文章」很常見，站上一篇都沒有的話那條路徑看不到。
    const postPass = postSeq % 17 === 8 ? '5678' : '';
    const r = await run(`INSERT INTO posts(user_id,title,body,category,topic,mood,weather,views,likes,featured,pass,created)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, uid[name], title, body, category, topic,
      pick(['開心', '普通', '難過', '興奮'], i), pick(['晴天', '陰天', '雨天'], i),
      Math.floor(Math.random() * 20000), Math.floor(Math.random() * 300),
      i === 0 && name === 'jaychou' ? 1 : 0, postPass, stamp(postDays, postSeq));
    const pid = Number(r.lastInsertRowid);
    // 迴響：原本是 (i % 4)，四篇裡有一篇是 0 則，站上超過一半的文章都沒有迴響。
    // 改成每篇至少 1 則。時間一定要在文章**之後**，不然「最新迴響」會排在文章前面。
    for (let c = 0; c < 1 + ((postSeq + i) % 4); c++)
      await run('INSERT INTO comments(post_id,author,body,email,homepage,reply,created) VALUES(?,?,?,?,?,?,?)', pid,
        pick(COMMENT_NAMES, postSeq + c),
        pick(COMMENT_BODIES, postSeq * 3 + c),
        '', '',
        c === 0 && postSeq % 3 === 0 ? '謝謝你的留言 :)' : '',
        stamp(Math.max(0, postDays - 1 - c * 0.7), postSeq * 5 + c));
  }
}
// 上面那圈是「每人挑幾篇」，長文不一定會落在示範帳號身上。
// 「(繼續閱讀)」（.extended，views/blog.ejs 的 cut 判斷：內文超過 300 字）
// 這個結構要靠它，所以明確補一篇給 meimei。
{
  // 挑**最長**那一篇，不要用 POSTS[POSTS.length-1]——在陣列後面補文章的時候
  // 最後一筆就不是長文了，「(繼續閱讀)」那個結構會無聲無息地消失。
  const [title, body, category, topic] = POSTS.reduce((a, b) => b[1].length > a[1].length ? b : a);
  if (!await one('SELECT 1 FROM posts WHERE user_id=? AND title=?', uid.meimei, title)) {
    const r = await run(`INSERT INTO posts(user_id,title,body,category,topic,mood,weather,views,likes,created)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, uid.meimei, title, body, category, topic, '開心', '晴',
      Math.floor(Math.random() * 20000), Math.floor(Math.random() * 300), stamp(9, 3));
    // 這篇是額外補的，上面那圈的迴響／引用都不會落到它身上。
    // 不補的話它是站上最顯眼的一篇（首頁、月份彙整都指過來），點進去卻整片空白。
    const pid = Number(r.lastInsertRowid);
    for (let c = 0; c < 4; c++)
      await run('INSERT INTO comments(post_id,author,body,reply,created) VALUES(?,?,?,?,?)',
        pid, pick(COMMENT_NAMES, c + 3), pick(COMMENT_BODIES, c * 4), c === 0 ? '謝謝！有空真的要去一趟。' : '',
        stamp(8 - c * 0.5, c));
    const other = await all('SELECT id FROM posts WHERE user_id!=? ORDER BY id LIMIT 2', uid.meimei);
    for (const o of other)
      await run('INSERT INTO trackbacks(post_id,from_post) VALUES(?,?)', pid, o.id);
  }
}
// ---- 引用（轉貼）----
// 網誌分享列上那顆「發文」鈕會帶一個數字泡泡（.bubble / .bubble-gradient），
// 印的是這篇被轉貼幾次。trackbacks 空的話那個結構永遠量不到，
// 而原版列表頁與文章頁每一篇都有這顆泡泡。
// 轉貼是「別人的文章引用了我這篇」，所以 from_post 要挑別人的文章。
for (const p of await all('SELECT id,user_id FROM posts ORDER BY id')) {
  const from = await all('SELECT id FROM posts WHERE user_id!=? ORDER BY id LIMIT 3', p.user_id);
  for (let i = 0; i < p.id % 3; i++)
    if (from[i] && !await one('SELECT 1 FROM trackbacks WHERE post_id=? AND from_post=?', p.id, from[i].id))
      await run('INSERT INTO trackbacks(post_id,from_post) VALUES(?,?)', p.id, from[i].id);
}

console.log(`網誌 ${(await one('SELECT count(*) c FROM posts')).c} 篇 / 迴響 ${(await one('SELECT count(*) c FROM comments')).c} 則`
  + ` / 引用 ${(await one('SELECT count(*) c FROM trackbacks')).c} 則`);

// ---- 留言板 / 好友 / 訪客 / 公告 ----
for (const [name] of USERS) {
  for (let i = 0; i < 4; i++)
    if (!await one('SELECT 1 FROM guestbook WHERE user_id=? AND author=?', uid[name], pick(USERS, i + 1)[1]))
      await run('INSERT INTO guestbook(user_id,author,subject,body,secret,reply) VALUES(?,?,?,?,?,?)',
        uid[name], pick(USERS, i + 1)[1], pick(['路過', '', '安安', '交換連結'], i),
        pick(['安安你好，可以交換連結嗎？', '照片拍得好好看！', '好久沒更新了～', '生日快樂！'], i),
        i === 3 ? 1 : 0, i === 0 ? '好啊！已經加你了～' : '');
  for (const [other] of USERS)
    if (other !== name && Math.random() < 0.45)
      await run('INSERT OR IGNORE INTO friends(user_id,friend_id,grp) VALUES(?,?,?)',
        uid[name], uid[other], pick(['好友', '同學', '同事', '網友'], other.length));
  // 「誰來我家」一頁 20 筆，只灌 5 筆而且都是同幾個人的話那一頁看起來像壞掉的。
  const ALL = [...USERS, ...EXTRA_USERS];
  for (let i = 0; i < 24; i++)
    await run('INSERT INTO visitors(user_id,who,created) VALUES(?,?,?)',
      uid[name], pick(ALL, i * 5 + name.length)[0], stamp(spread(24 - i, 24, 45), i * 3 + name.length));
  // 好友動態（acts）改在後面統一種，這裡不再單獨插一筆（會重複）。
}

// ---- 留言板：補到看得見分頁列 ----
// 一頁 10 則，所以 4 則連第二頁都沒有，#page_control_top / #page_link_2 / #next
// 這些結構在量測時永遠是缺的。示範帳號補到 64 則（7 頁），其餘每人 12 則（2 頁）。
// 用「現在有幾則」當起點，重跑不會愈灌愈多。
const GB_SUBJECTS = ['路過', '', '安安', '交換連結', '來看你了', '推一個', '生日快樂', '好久不見'];
const GB_BODIES = [
  '安安你好，可以交換連結嗎？', '照片拍得好好看！', '好久沒更新了～', '生日快樂！',
  '這篇我看了三次，寫得真好。', '請問那間店在哪裡呀？', '路過留個言，加油！',
  '你的相簿我每張都看完了 XD', '下次揪團一起去玩啦', '版面換得好漂亮～',
  '推推推，期待下一篇。', '剛剛在排行榜看到你就進來了',
];
const ALL_NICKS = [...USERS, ...EXTRA_USERS].map(u => u[1]);
const ALL_ACCOUNTS = [...USERS, ...EXTRA_USERS].map(u => [u[0], u[1]]);
for (const [name] of [...USERS, ...EXTRA_USERS]) {
  const want = name === 'meimei' ? 64 : (USERS.some(u => u[0] === name) ? 12 : 3);
  let have = (await one('SELECT count(*) c FROM guestbook WHERE user_id=?', uid[name])).c;
  for (let i = have; i < want; i++) {
    // 留言者要是真的站友：原版每一則留言的暱稱與大頭貼都連回那個人的小站，
    // 認證章也掛在那裡。只存暱稱文字的話那三樣都做不出來。
    const gbFrom = pick(ALL_ACCOUNTS, i * 3 + 1);
    await run('INSERT INTO guestbook(user_id,author,author_id,subject,body,created,secret,reply) VALUES(?,?,?,?,?,?,?,?)',
      uid[name], gbFrom[1], uid[gbFrom[0]], pick(GB_SUBJECTS, i), pick(GB_BODIES, i),
      stamp(spread(want - i, want, 400), i * 5 + name.length),
      // 悄悄話與板主回覆的間隔要互質且不同步：兩個都命中同一則的話，
      // 那則對訪客是隱藏的，.reply_content / .reply_word 就量不到
      // （17 與 9 會在 i=56 撞在一起，剛好落在第 1 頁）。
      i % 17 === 5 ? 1 : 0, (i % 4 === 1 && i % 17 !== 5) ? '謝謝你的留言 :)' : '');
  }
}

// ---- 好友：補到看得見分頁列 ----
// 一頁 25 人。示範帳號跟全部的補充站友當好友（30+ 人＝2 頁），
// 其中一半回加，這樣好友頁四種關係（我加的／加我的／互相／好友的好友）都有東西。
for (let i = 0; i < EXTRA_USERS.length; i++) {
  const other = EXTRA_USERS[i][0];
  await run('INSERT OR IGNORE INTO friends(user_id,friend_id,grp) VALUES(?,?,?)',
    uid.meimei, uid[other], pick(['好友', '同學', '同事', '網友', '家人'], i));
  if (i % 2 === 0)
    await run('INSERT OR IGNORE INTO friends(user_id,friend_id,grp) VALUES(?,?,?)',
      uid[other], uid.meimei, '好友');
  // 補充站友彼此也串幾條，「好友的好友」（#current_tag3）才不會是空的
  await run('INSERT OR IGNORE INTO friends(user_id,friend_id,grp) VALUES(?,?,?)',
    uid[other], uid[EXTRA_USERS[(i + 3) % EXTRA_USERS.length][0]], '網友');
}

// ---- 影音 ----
// 我們沒有轉檔與串流，影音就是內嵌 YouTube（見 src/server.js 的 ytId）。
// 這裡放的是真的、而且存在很久的影片 id，種子資料才不會是一排壞掉的播放器。
const VIDEOS = [
  ['YouTube 上的第一支影片', 'jNQXAC9IVRw', '網路考古，18 秒而已'],
  ['江南 Style，那年大家都在跳', '9bZkp7q19f0', '副歌一下全場都會動'],
  ['Despacito 洗腦一整年', 'kJQP7kiw5Fk', '節奏真的很讚'],
  ['Bohemian Rhapsody 現場版', 'fJ9rUzIMcZQ', '經典就是經典'],
  ['Counting Stars', 'hT_nvWreIhg', '跑步的時候都聽這首'],
  ['Never Gonna Give You Up', 'dQw4w9WgXcQ', '別問，點下去就對了'],
];
for (const [ui, [name]] of [...USERS, ...EXTRA_USERS].entries()) {
  const want = name === 'meimei' ? VIDEOS.length : (USERS.some(u => u[0] === name) ? 3 : 1);
  for (let i = 0; i < want; i++) {
    const [title, vid, descr] = VIDEOS[(ui * 3 + i) % VIDEOS.length];
    if (await one('SELECT 1 FROM videos WHERE user_id=? AND vid=?', uid[name], vid)) continue;
    await run('INSERT INTO videos(user_id,title,vid,url,descr,views,created) VALUES(?,?,?,?,?,?,?)',
      uid[name], title, vid, 'https://www.youtube.com/watch?v=' + vid, descr,
      Math.floor(Math.random() * 3000), stamp(spread(want - i, want, 300), ui * 4 + i));
  }
}

// ---- 嘀咕 ----
// 留言板側欄的名片小卡（.myDigu / .digu / .digu_date）印的是最新一則，
// 所以每個示範帳號都要至少有一則。
const DIGUS = [
  '今天天氣好好，想翹班去海邊', '便當店的雞腿又漲價了 QQ', '剛剛在捷運上看到超像我國中同學的人',
  '終於把報告寫完了！！！', '這禮拜第三次吃滷肉飯', '晚上要去看電影，期待',
  '新相機到貨，開心到睡不著', '公司樓下開了一間新的咖啡廳', '下雨天不想出門',
  '把版面換成粉紅色了，好看嗎', '剛跑完五公里，腿要斷了', '朋友揪去墾丁，還在考慮',
  '想吃鹹酥雞但已經半夜了', '今天人氣破一千了，謝謝大家', '睡前來聽一下音樂盒',
];
for (const [ui, [name]] of [...USERS, ...EXTRA_USERS].entries()) {
  const want = name === 'meimei' ? DIGUS.length : (USERS.some(u => u[0] === name) ? 5 : 2);
  let have = (await one('SELECT count(*) c FROM digu WHERE user_id=?', uid[name])).c;
  for (let i = have; i < want; i++)
    await run('INSERT INTO digu(user_id,body,created) VALUES(?,?,?)',
      uid[name], DIGUS[(ui * 4 + i) % DIGUS.length], stamp(spread(want - i, want, 90), ui * 6 + i));
}

// ---- 照片迴響 ----
// 照片頁的「迴響」區之前完全沒有種，每張照片點進去都寫「還沒有人留下迴響」。
// 原站的相簿是社交場，熱門照片下面一定有一串。挑一部分照片放，不要每張都有——
// 每張都有反而假。
{
  const PHOTO_SAYS = ['這張構圖好棒！', '好想去這裡', '拍得好美～', '這是哪裡呀？',
    '光線抓得真好', '推一個', '好可愛喔', '記得那天也太好玩', '借分享！', '這張我最喜歡'];
  const photos = await all('SELECT id, created FROM photos ORDER BY id');
  let n = 0;
  for (const [i, ph] of photos.entries()) {
    if (i % 3 === 2) continue;                 // 三張裡放兩張（每張都有反而假）
    for (let c = 0; c < 1 + (i % 3); c++) {
      // 時間直接跟著那張照片自己的建立時間往後推，不要另外算——
      // 另外算的話迴響會比照片本身還早，畫面上看起來很怪。
      const base = new Date(ph.created.replace(' ', 'T')).getTime();
      const at = new Date(Math.min(NOW_MS, base + (1 + c) * 6 * 3600000))
        .toLocaleString('sv-SE').slice(0, 19);
      await run('INSERT INTO photo_comments(photo_id,author,body,created) VALUES(?,?,?,?)',
        ph.id, pick(COMMENT_NAMES, i + c), pick(PHOTO_SAYS, i * 2 + c), at);
      n++;
    }
  }
  console.log(`照片迴響 ${n} 則`);
}

// ---- 系統訊息 ----
// 留言板的「系統訊息」頁籤（只有本人看得到）。之前是空的，站主點進去像壞掉。
// 原站這裡放的是「有人在你的板留言」「你的相簿被推薦」這類站方通知。
{
  const SYS = [
    ['有人在你的留言板留言', '你有新的留言，快去看看吧。'],
    ['你的相簿被推薦到首頁', '恭喜！你的相簿被站長選進首頁的熱門相簿。'],
    ['有人把你加為好友', '有站友把你加入好友名單了。'],
    ['你的文章被引用', '有人在自己的網誌引用了你的文章。'],
    ['空間使用量提醒', '你的相簿空間已使用超過一半，記得整理一下。'],
  ];
  let n = 0;
  for (const [ui, [name]] of [...USERS, ...EXTRA_USERS].entries()) {
    const want = USERS.some(u => u[0] === name) ? 4 : 1;
    for (let i = 0; i < want; i++) {
      const [title, body] = SYS[(ui * 2 + i) % SYS.length];
      await run('INSERT INTO sysmsg(user_id,title,body,seen,created) VALUES(?,?,?,?,?)',
        uid[name], title, body, i === 0 ? 0 : 1, stamp(spread(want - i, want, 120), ui * 3 + i));
      n++;
    }
  }
  console.log(`系統訊息 ${n} 則`);
}

// ---- 檢舉 ----
// 後台 /admin 的檢舉佇列。之前是空的，那一頁看起來像沒做完。
// 放幾筆已處理與未處理的，站長進去才看得出這個流程長什麼樣。
{
  const REASONS = ['內容不妥', '疑似廣告', '照片非本人所有', '留言騷擾', '重複張貼'];
  const posts = await all('SELECT id FROM posts ORDER BY id LIMIT 40');
  let n = 0;
  for (let i = 0; i < 6 && i < posts.length; i++) {
    await run('INSERT INTO reports(kind,target_id,url,reason,reporter,done,created) VALUES(?,?,?,?,?,?,?)',
      'post', posts[i * 5].id, '/blogs', pick(REASONS, i), pick(COMMENT_NAMES, i),
      i % 3 === 0 ? 1 : 0, stamp(spread(6 - i, 6, 60), i * 11));
    n++;
  }
  console.log(`檢舉 ${n} 筆`);
}

// ---- 好友動態 ----
// 「好友動態」（/:user/feed）撈的是 acts。之前每人只有 1 筆，
// 而且只有主要帳號有，登入後那一頁幾乎是空的。
{
  let n = 0;
  for (const [name] of [...USERS, ...EXTRA_USERS]) {
    const ps = await all('SELECT id,title,created FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 3', uid[name]);
    for (const [i, po] of ps.entries()) {
      await run('INSERT INTO acts(user_id,kind,title,url,created) VALUES(?,?,?,?,?)',
        uid[name], 'blog', po.title, `/${name}/blog/${po.id}`, po.created);
      n++;
    }
    const as = await all('SELECT id,title,created FROM albums WHERE user_id=? ORDER BY id DESC LIMIT 2', uid[name]);
    for (const al of as) {
      await run('INSERT INTO acts(user_id,kind,title,url,created) VALUES(?,?,?,?,?)',
        uid[name], 'album', al.title, `/${name}/album/${al.id}`, al.created);
      n++;
    }
  }
  console.log(`好友動態 ${n} 筆`);
}

// ---- 音樂盒 ----
// 無名的個人站側欄有音樂盒（users.music，一行一個網址）。之前沒人設，
// 那一格在每個人的站上都是空的，首頁的背景音樂開關也就沒有意義。
// 用 archive.org 的公眾領域錄音（Internet Archive 的 Open Audio，可自由使用）。
{
  const TRACKS = [
    'https://archive.org/download/78_the-blue-danube-waltz_johann-strauss/The%20Blue%20Danube%20Waltz.mp3',
    'https://archive.org/download/CanonInDMajor/Canon%20in%20D%20Major.mp3',
    'https://archive.org/download/MoonlightSonata_755/MoonlightSonata.mp3',
  ];
  let n = 0;
  for (const [ui, [name]] of [...USERS, ...EXTRA_USERS].entries()) {
    if (ui % 3) continue;                       // 三個人裡一個有音樂盒
    await run('UPDATE users SET music=? WHERE id=?',
      TRACKS.slice(0, 1 + (ui % TRACKS.length)).join('\n'), uid[name]);
    n++;
  }
  console.log(`音樂盒 ${n} 人`);
}

// ---- 名片欄位補齊 ----
// 名片頁有生日、真實姓名、MSN、個人網頁四欄一直是空的，那一頁看起來只填一半。
{
  const YEARS = [1985, 1988, 1990, 1992, 1995, 1998, 2000];
  let n = 0;
  for (const [ui, [name, nick]] of [...USERS, ...EXTRA_USERS].entries()) {
    const y = YEARS[ui % YEARS.length];
    const m = String(1 + (ui * 5) % 12).padStart(2, '0');
    const d = String(1 + (ui * 7) % 28).padStart(2, '0');
    await run('UPDATE users SET realname=?, birthday=?, msn=? WHERE id=?',
      nick, `${y}-${m}-${d}`, `${name}@example.com`, uid[name]);
    n++;
  }
  console.log(`名片欄位補齊 ${n} 人`);
}

// ---- 使用者自訂 CSS ----
// 「使用者自訂 CSS」是無名的靈魂功能（WRETCH_2012.md §4-5），站上一個人都沒用
// 的話等於這個功能沒被展示出來。給幾個人放一小段安全的樣式
// （會過 src/format.js 的 safeCss()，角括號一律被拿掉）。
{
  const CSS = [
    '/* 換個標題顏色 */\n#header h1 a { color: #c8508c; }',
    '/* 加寬一點 */\n#content { line-height: 1.8; }',
    '/* 淡一點的分隔線 */\nhr { border-color: #e8e8e8; }',
  ];
  let n = 0;
  for (const [ui, [name]] of USERS.entries()) {
    if (ui % 2) continue;
    await run('UPDATE users SET css=? WHERE id=?', CSS[ui % CSS.length], uid[name]);
    n++;
  }
  console.log(`自訂 CSS ${n} 人`);
}

// ---- 收藏 ----
// 「我的收藏」頁與首頁的「投稿精選」都靠 favs。之前完全沒種，
// 每個人點進去都是空的。每人收藏幾篇別人的文章。
{
  const posts = await all('SELECT id,user_id FROM posts ORDER BY id');
  for (const [ui, [name]] of [...USERS, ...EXTRA_USERS].entries()) {
    let n = 0;
    for (const po of posts) {
      if (po.user_id === uid[name]) continue;
      if ((po.id + ui) % 7) continue;            // 稀疏地挑，不要每個人都收藏同幾篇
      await run('INSERT OR IGNORE INTO favs(user_id,post_id) VALUES(?,?)', uid[name], po.id);
      if (++n >= 6) break;
    }
  }
  console.log(`收藏 ${(await one('SELECT count(*) c FROM favs')).c} 筆`);
}

// ---- 站長精選 ----
// 首頁的「站長精選」與熱門相簿的獎牌靠 featured。分散一點，不要集中在一個人身上。
for (const r of await all('SELECT id FROM posts ORDER BY views DESC LIMIT 6'))
  await run('UPDATE posts SET featured=1 WHERE id=?', r.id);
for (const r of await all('SELECT id FROM albums ORDER BY views DESC LIMIT 6'))
  await run('UPDATE albums SET featured=1 WHERE id=?', r.id);

// ---- 認證徽章 ----
// 原站是付費 VIP，本站沒有金流，就當成站長掛給老站友的認證標記。
// 0 無／1 銀／2 金／3 白金（見 src/db.js 的 ADD_COLUMNS 與 /admin/user/:id/vip）
for (const [name, level] of [['vibeai', 3], ['meimei', 2], ['linda', 1], ['jaychou', 2]])
  await run('UPDATE users SET vip=? WHERE name=?', level, name);

// 公告一則一則比對再插：留言板的站方公告頁籤一頁 10 則，
// 舊資料庫已經有前三則，用「整張表空的才灌」會永遠停在 3 則、生不出第二頁。
{
  for (const b of ['小站開張囉！完全免費，歡迎申請帳號～',
    '[公告] 相簿空間每人 500MB，請大家珍惜使用。',
    '[活動] 第一屆站慶攝影比賽開始徵件！',
    '[公告] 系統將於本週日凌晨兩點到四點進行例行維護。',
    '[活動] 揪團去看流星雨，有興趣的站友請到留言板報名。',
    '[公告] 近期發現有帳號盜用他人照片，請大家尊重原作者。',
    '[活動] 相簿版型票選開跑，票數最高的那套下個月上線。',
    '[公告] 留言板新增悄悄話功能，只有板主看得到。',
    '[公告] 本站不放廣告、也沒有 VIP，所有功能一律免費。',
    '[活動] 站慶第二彈：網誌寫作比賽，主題「我的 2012」。',
    '[公告] 手機版版面調整完成，歡迎回報問題。',
    '[公告] 感謝大家這一年的支持，明年見。'])
    if (!await one('SELECT 1 FROM notices WHERE body=?', b))
      await run('INSERT INTO notices(body) VALUES(?)', b);
}

console.log(`留言 ${(await one('SELECT count(*) c FROM guestbook')).c} 則 / 好友 ${(await one('SELECT count(*) c FROM friends')).c} 組`
  + ` / 影音 ${(await one('SELECT count(*) c FROM videos')).c} 支 / 嘀咕 ${(await one('SELECT count(*) c FROM digu')).c} 則`
  + ` / 公告 ${(await one('SELECT count(*) c FROM notices')).c} 則`);
console.log('\n完成。本機啟動：pnpm dev → http://localhost:3000　（任一帳號密碼 demo1234，站長帳號 vibeai）');
