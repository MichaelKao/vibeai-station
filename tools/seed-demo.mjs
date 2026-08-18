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
    'posts', 'guestbook', 'visitors', 'friends', 'acts', 'sysmsg', 'reports', 'notices', 'users'])
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

const uid = {};
for (const [name, nick, intro, admin] of USERS) {
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
      await run('INSERT INTO photos(album_id,url,thumb,caption,bytes,views) VALUES(?,?,?,?,?,?)',
        aid, p.url, p.thumb, pick(['這天天氣超好', '好吃！', '牠在生氣', '順便自拍一張', ''], k),
        p.bytes, Math.floor(Math.random() * 300));
      if (!cover) cover = p.thumb;
    }
    await run('UPDATE albums SET cover=? WHERE id=?', cover, aid);
  }
}
// 大頭貼：從已抓到的真實照片裁 90x90（無名的大頭貼就是 90x90）。
// 預設那張卡通圖示放在「名家專欄」「投稿精選」這種以人為主的模組裡特別假。
{
  const pool = fs.readdirSync(CACHE).filter(f => f.endsWith('.jpg'));
  let n = 0;
  for (const [name] of USERS) {
    if (!pool.length) break;
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
console.log(`網誌 ${(await one('SELECT count(*) c FROM posts')).c} 篇 / 迴響 ${(await one('SELECT count(*) c FROM comments')).c} 則`);

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

if (!await one('SELECT 1 FROM notices'))
  for (const b of ['小站開張囉！完全免費，歡迎申請帳號～',
    '[公告] 相簿空間每人 500MB，請大家珍惜使用。',
    '[活動] 第一屆站慶攝影比賽開始徵件！'])
    await run('INSERT INTO notices(body) VALUES(?)', b);

console.log(`留言 ${(await one('SELECT count(*) c FROM guestbook')).c} 則 / 好友 ${(await one('SELECT count(*) c FROM friends')).c} 組`);
console.log('\n完成。本機啟動：pnpm dev → http://localhost:3000　（任一帳號密碼 demo1234，站長帳號 vibeai）');
