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
import { save, hasR2 } from '../src/storage.js';
import sharp from 'sharp';

const reset = process.argv.includes('--reset');
if (reset) {
  for (const t of ['photo_comments', 'photos', 'albums', 'comments', 'trackbacks', 'favs',
    'posts', 'guestbook', 'visitors', 'friends', 'acts', 'sysmsg', 'reports', 'notices',
    'videos', 'digu', 'users'])
    await run(`DELETE FROM ${t}`);
  console.log('已清空');
}

const pick = (a, i) => a[i % a.length];

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
async function fetchPhotoBuffer(keyword, tint) {
  const name = `seed_${keyword.replace(/\W/g, '')}_${made++}.jpg`;
  const cache = path.join(CACHE, name);

  if (fs.existsSync(cache)) { cached++; return fs.readFileSync(cache); }

  // 對方會限流，所以節流 + 退避重試。抓到的都進快取，重跑只補缺的那些。
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(THROTTLE_MS);
      // lock=<n> 讓同一個位置每次都拿到同一張，重跑畫面才穩定、可比對
      const r = await fetch(`https://loremflickr.com/640/480/${encodeURIComponent(keyword)}?lock=${made}`,
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
const ALBUMS = [
  ['宜蘭兩天一夜', '跟朋友衝一波，民宿超讚', '國內旅遊', '台灣', 'yilan,taiwan'],
  ['九份老街', '假日人有夠多但還是要去', '國內旅遊', '台灣', 'jiufen,taiwan'],
  ['我家的貓', '牠又把衛生紙咬爛了', '心肝寵物', '台灣', 'cat,taiwan'],
  ['羅東夜市吃透透', '一週吃了五次', '美食記錄', '台灣', 'taiwan,nightmarket'],
  ['台南小吃巡禮', '牛肉湯配肉燥飯', '美食記錄', '台灣', 'tainan,food'],
  ['台北街頭隨手拍', '手機拍的', '專業攝影', '台灣', 'taipei,street'],
  ['太魯閣', '走到腳快斷掉', '國內旅遊', '台灣', 'taroko,taiwan'],
  ['畢業紀念', '再也回不去了', '學園生活', '台灣', 'taiwan,campus'],
];

for (const [name] of USERS) {
  const n = 2 + (name.length % 3);
  for (let i = 0; i < n; i++) {
    const [title, descr, topic, place, keyword] = pick(ALBUMS, name.length + i);
    if (await one('SELECT 1 FROM albums WHERE user_id=? AND title=?', uid[name], title)) continue;
    const a = await run(`INSERT INTO albums(user_id,title,descr,topic,place,views,featured)
      VALUES(?,?,?,?,?,?,?)`, uid[name], title, descr, topic, place,
      Math.floor(Math.random() * 5000), i === 0 && name === 'meimei' ? 1 : 0);
    const aid = Number(a.lastInsertRowid);
    let cover = '';
    for (let k = 0; k < 5 + (i % 4); k++) {
      const p = await photo(keyword, pick(TINTS, uid[name] + k));
      // save() 已經把尺寸與 EXIF 算好回傳，不接住的話 #exif 面板永遠是空的
      // （照片頁的「圖片資訊」就沒東西可印）。
      await run(`INSERT INTO photos(album_id,url,thumb,caption,bytes,views,width,height,taken,camera)
        VALUES(?,?,?,?,?,?,?,?,?,?)`,
        aid, p.url, p.thumb, pick(['這天天氣超好', '好吃！', '牠在生氣', '順便自拍一張', ''], k),
        p.bytes, Math.floor(Math.random() * 300), p.width, p.height, p.taken, p.camera);
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
];

for (const [name] of USERS) {
  const n = 2 + (name.length % 4);
  for (let i = 0; i < n; i++) {
    const [title, body, category, topic] = pick(POSTS, name.length * 2 + i);
    if (await one('SELECT 1 FROM posts WHERE user_id=? AND title=?', uid[name], title)) continue;
    const r = await run(`INSERT INTO posts(user_id,title,body,category,topic,mood,weather,views,likes,featured)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, uid[name], title, body, category, topic,
      pick(['開心', '普通', '難過', '興奮'], i), pick(['晴天', '陰天', '雨天'], i),
      Math.floor(Math.random() * 20000), Math.floor(Math.random() * 300),
      i === 0 && name === 'jaychou' ? 1 : 0);
    const pid = Number(r.lastInsertRowid);
    for (let c = 0; c < (i % 4); c++)
      await run('INSERT INTO comments(post_id,author,body,reply) VALUES(?,?,?,?)', pid,
        pick(['小明', '阿華', '路人甲', 'Tina'], c),
        pick(['搶頭香！', '坐沙發～', '推推推', '我也想去！'], c),
        c === 0 ? '謝謝你的留言 :)' : '');
  }
}
// 上面那圈是「每人挑幾篇」，長文不一定會落在示範帳號身上。
// 「(繼續閱讀)」這個結構要靠它，所以明確補一篇給 meimei。
{
  const [title, body, category, topic] = POSTS[POSTS.length - 1];
  if (!await one('SELECT 1 FROM posts WHERE user_id=? AND title=?', uid.meimei, title))
    await run(`INSERT INTO posts(user_id,title,body,category,topic,mood,weather,views,likes)
      VALUES(?,?,?,?,?,?,?,?,?)`, uid.meimei, title, body, category, topic, '開心', '晴',
      Math.floor(Math.random() * 20000), Math.floor(Math.random() * 300));
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
  for (let i = 0; i < 5; i++)
    await run('INSERT INTO visitors(user_id,who) VALUES(?,?)', uid[name], pick(USERS, i + 2)[0]);
  const p = await one('SELECT id,title FROM posts WHERE user_id=? ORDER BY id DESC', uid[name]);
  if (p) await run('INSERT INTO acts(user_id,kind,title,url) VALUES(?,?,?,?)',
    uid[name], 'blog', p.title, `/${name}/blog/${p.id}`);
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
    await run('INSERT INTO guestbook(user_id,author,author_id,subject,body,secret,reply) VALUES(?,?,?,?,?,?,?)',
      uid[name], gbFrom[1], uid[gbFrom[0]], pick(GB_SUBJECTS, i), pick(GB_BODIES, i),
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
for (const [name] of USERS) {
  const want = name === 'meimei' ? VIDEOS.length : 2;
  for (let i = 0; i < want; i++) {
    const [title, vid, descr] = pick(VIDEOS, name.length + i);
    if (await one('SELECT 1 FROM videos WHERE user_id=? AND vid=?', uid[name], vid)) continue;
    await run('INSERT INTO videos(user_id,title,vid,url,descr,views) VALUES(?,?,?,?,?,?)',
      uid[name], title, vid, 'https://www.youtube.com/watch?v=' + vid, descr,
      Math.floor(Math.random() * 3000));
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
for (const [name] of USERS) {
  const want = name === 'meimei' ? DIGUS.length : 3;
  let have = (await one('SELECT count(*) c FROM digu WHERE user_id=?', uid[name])).c;
  for (let i = have; i < want; i++)
    await run('INSERT INTO digu(user_id,body) VALUES(?,?)', uid[name], pick(DIGUS, i + name.length));
}

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
