import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'node:path';
import { one, all, run, migrate, driver, close as closeDb } from './db.js';
import { sessionStore, startVisitFlusher, bumpVisit, hasRedis, closeRedis, redisState } from './cache.js';
import { hash, salt, check, requireLogin, requireOwner } from './auth.js';
import { save, remove, hasR2, diskFree, readImage } from './storage.js';
import { UPLOAD_DIR } from './paths.js';
import { render, EMOTES, safeCss, cut } from './format.js';
import { fetchFeed, subUrlOk } from './feed.js';
import { SITE_NAME, SITE_DESC, SITE_LOGO, CDN } from './config.js';
import { ALBUM_TOPICS, BLOG_TOPICS, PLACES, MOODS, WEATHERS, ZODIACS, BLOODS, SEXES, CITIES, isAlbumTopic, isBlogTopic, isPlace } from './taxonomy.js';
import { SKINS, isSkin, skinCss } from './skins.js';

// 整個行程用台北時間。資料庫裡的 created 是台北時間的裸字串（src/db.js 的說明），
// 站上到處在做 created.slice(0,10)、substr(created,1,7) 這種字串切法，
// 行程時區不同就會在跨日前後對不起來——**正式站的容器預設是 UTC**。
// 個別容易出錯的地方（rssDate、today、歷史上的今天）已經各自寫死台北，
// 這一行是保險，讓還沒被想到的地方也對。
process.env.TZ ||= 'Asia/Taipei';

const app = express();

// ===== async handler 的錯誤處理 =====
// 資料層改成非同步之後，所有 handler 都是 async。
// **Express 4 不會接住 async handler 回傳的 rejected promise**
// （那是 Express 5 才有的行為）：任何資料庫錯誤都會變成 unhandled rejection，
// 請求就這樣掛著永遠不回應，也不會進到最下面的錯誤處理中介層。
// 所以在註冊路由時就把每個 handler 包起來，把 rejection 轉交給 next()。
const wrapAsync = fn => fn.length >= 4
  ? function (err, req, res, next) { return Promise.resolve(fn(err, req, res, next)).catch(next); }
  : function (req, res, next) { return Promise.resolve(fn(req, res, next)).catch(next); };

function autoAsync(target) {
  for (const m of ['use', 'get', 'post', 'put', 'delete', 'patch', 'all']) {
    const orig = target[m].bind(target);
    target[m] = (...args) => {
      // app.get('view engine') 是讀設定，不是註冊路由，要原樣放行
      if (m === 'get' && args.length === 1 && typeof args[0] === 'string') return orig(...args);
      return orig(...args.map(a => (typeof a === 'function' ? wrapAsync(a) : a)));
    };
  }
  return target;
}
autoAsync(app);

app.set('view engine','ejs'); app.set('views', path.resolve('views'));
app.set('trust proxy',1);
app.use(express.static(path.resolve('public')));
app.use('/uploads', express.static(UPLOAD_DIR));
// 站台識別放 app.locals 而不是 res.locals：
// **錯誤頁也要用得到**。res.locals 是在下面那個中介層設的，而 body-parser
// 在它**之前**——body 過大時 PayloadTooLargeError 在那之前就拋出來，
// 錯誤頁 render msg.ejs 少了 SITE_NAME 會二次拋錯，最後掉到 Express 的預設
// 錯誤頁，把伺服器絕對路徑、EJS 原始碼與 node_modules 堆疊全部印給使用者看。
// app.locals 不受中介層順序影響，任何 render 都拿得到。
app.locals.SITE_NAME=SITE_NAME; app.locals.SITE_DESC=SITE_DESC;
app.locals.SITE_LOGO=SITE_LOGO; app.locals.CDN=CDN;

// 上限 1MB。文章內文允許五萬字（server.js 的 body.slice(0,50000)），
// 中文 urlencode 之後一個字 9 bytes，五萬字約 450KB——
// 預設的 100KB 只夠一萬一千個中文字，超過就 500 而且整篇消失。
app.use(express.urlencoded({extended:false, limit:'1mb'}));
// session：有 Redis 就存 Redis。預設的 MemoryStore 會漏記憶體，
// 而且每次部署所有人都被登出——這是換 Redis 最直接的理由。
app.use(session({
  store: await sessionStore(),          // 沒有 REDIS_URL 時回傳 undefined＝用預設 MemoryStore
  secret: process.env.SESSION_SECRET || 'vibeai-dev-secret',
  resave: false, saveUninitialized: false,
  // secure:'auto' ＝ 連線是 https 就標 Secure、是 http 就不標。
  // 寫死 true 的話本機 http 會拿不到 cookie（登入完馬上又變登出，很難查）；
  // 完全不寫的話正式站的 session cookie 會允許在 http 下送出。
  // 'auto' 要靠上面那行 `app.set('trust proxy', 1)` 才判斷得出來——
  // Railway 是反向代理，協定寫在 X-Forwarded-Proto 裡。
  cookie: { maxAge: 30*864e5, httpOnly: true, sameSite: 'lax', secure: 'auto' },
}));
// 跨站請求偽造（CSRF）：擋在所有會改變狀態的請求前面。
//
// ⚠ 稽核指出全站沒有任何 CSRF 防護。session cookie 已經是 SameSite=Lax，
// 現代瀏覽器不會把 cookie 帶進跨站的 POST，所以實務上擋掉了絕大部分；
// 但那是「靠瀏覽器的預設值」，同網域底下的其他子網域、舊瀏覽器、
// 以及未來哪天把 sameSite 調鬆都會破功。這裡再加一道自己驗的。
//
// 用 Origin／Referer 比對而不是發 token，理由是：token 要在**每一支表單**
// 都塞一個 hidden input，全站上百個表單漏掉一個就是一個壞掉的按鈕，
// 而且使用者自訂 CSS／版型改版時很容易被弄丟。Origin 這一層不碰版型，
// 涵蓋每一支現有與未來的表單。
//
// 判斷規則：**有帶就一定要對**。
// 現代瀏覽器送 POST 一定會帶 Origin，所以真正的跨站攻擊一定會被抓到。
// 兩個都沒帶的才放行——那是非瀏覽器的客戶端（curl、RSS 閱讀器、測試），
// 它們身上本來就沒有受害者的 cookie，不是 CSRF 的攻擊面。
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const here = req.get('host');
  const src = req.get('origin') || req.get('referer');
  if (!src || !here) return next();
  let host;
  try { host = new URL(src).host; } catch { return next(); }   // 壞掉的標頭當作沒帶
  if (host === here) return next();
  res.status(403).type('text/plain; charset=utf-8')
     .send('這個請求看起來是從別的網站送過來的，為了安全起見擋下來了。');
});


// 可以收的圖片格式。
//
// ⚠ 原本只放行 jpeg|png|gif|webp——**iPhone 拍的照片預設是 HEIC**，
// 相機的原始檔常常是 TIFF，新一點的 Android 會出 AVIF。這些檔案被 multer
// 的 fileFilter 用 cb(null,false) 靜靜丟掉：使用者選了 20 張照片、按下上傳、
// 頁面回來說「上傳了 0 張照片」，一個字都沒解釋為什麼。換大頭貼更糟——
// req.file 是 undefined，程式判斷成「這次沒有要換頭貼」，畫面顯示
// 「設定已儲存」，使用者以為換好了。
//
// sharp 讀得懂 heif／tiff／avif（實測 sharp.format 有 heif、tiff），
// save() 又一律轉成 JPEG 才存，所以收下來完全沒問題。
// 上傳檔名的編碼。
//
// ⚠ multer（busboy）依照 RFC 7578 把 multipart 的檔名當成 latin1 解碼，
// 但瀏覽器實際送的是 UTF-8。所以中文檔名拿到的是亂碼：
// 「報告.pdf」會變成「å ±å.pdf」。我們只把檔名用在錯誤訊息上，
// 但那正是使用者要靠它認出「是哪一張沒傳成功」的時候——印成亂碼等於沒印。
const fname = f => {
  try { return Buffer.from(f.originalname || '', 'latin1').toString('utf8'); }
  catch { return f.originalname || '(沒有檔名)'; }
};


const OK_IMAGE = /^image\/(jpeg|png|gif|webp|heic|heif|avif|tiff?)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
  fileFilter: (req, f, cb) => {
    if (OK_IMAGE.test(f.mimetype)) return cb(null, true);
    // ⚠ 一定要記下來。cb(null,false) 只是把檔案丟掉，handler 完全不知道
    // 有這件事，於是使用者收到的訊息是「上傳了 0 張照片」而沒有原因。
    (req.droppedFiles ||= []).push(`${fname(f)}：不支援這個格式（${f.mimetype || '未知'}）`);
    cb(null, false);
  },
});

// 站方公告：kukubar 的 <p class="announcement"> 與各頁的公告區都接這裡。
// 每個請求都查一次太浪費（全站每一頁都要），用 30 秒的行程內快取——
// 公告是站長偶爾才發一次的東西，晚 30 秒出現沒有人會發現。
let noticeCache = { at: 0, rows: [] };
async function siteNotices(){
  if (Date.now() - noticeCache.at > 30_000)
    noticeCache = { at: Date.now(), rows: await all('SELECT * FROM notices ORDER BY id DESC LIMIT 5') };
  return noticeCache.rows;
}

// locals
app.use(async (req,res,next)=>{
  // session 綁著當時的 salt。改密碼會換一組 salt，於是**其他裝置**上那些
  // 還帶著舊 salt 的 session 下一個請求就自動失效。
  //
  // ⚠ 原本改完密碼只有「新密碼從此生效」，已經登入的 session 一個都不會斷。
  // 帳號被盜的人改了密碼，以為安全了，其實小偷那邊還開著。
  // express-session 沒有「列出某個使用者的所有 session」的能力（store 是
  // 用 session id 當鍵的），所以改成在每個請求驗一次，不必掃 store。
  res.locals.me = null;
  if (req.session.uid){
    const me = await one('SELECT id,name,nick,avatar,admin,vip,salt FROM users WHERE id=?', req.session.uid);
    if (me && (!req.session.sv || req.session.sv === me.salt.slice(0, 12))){
      req.session.sv = me.salt.slice(0, 12);
      delete me.salt;
      res.locals.me = me;
    } else {
      delete req.session.uid; delete req.session.sv;   // 密碼已被更換，這份 session 作廢
    }
  }
  res.locals.u = null; res.locals.nav=''; res.locals.flash = req.session.flash; delete req.session.flash;
  // 目前的查詢字串。分頁列要用它保留其他參數（例如同一頁上迴響用 ?page=、
  // 引用用 ?tpage=，換其中一個的時候另一個不能被洗掉）。
  res.locals.query = req.query;
  // 站台自己的絕對網址。分享列與「引用網址」原本只印站內相對路徑，
  // 靠頁尾那段 JS 補 location.origin——**沒有 JS 就複製到一段沒用的路徑**
  // （貼到 Plurk 上是 /jaychou/blog/20，誰都打不開）。RSS 那邊早就用
  // req.protocol + host 組絕對網址了，這裡把同一個值攤成 view 的 local，
  // 讓伺服器端就印對，JS 只是錦上添花。
  // ⚠ req.protocol 要對，得靠 trust proxy——Railway 在前面擋一層 TLS，
  // 沒設的話這裡會印出 http:// 而使用者實際上走的是 https。
  res.locals.origin = `${req.protocol}://${req.get('host')}`;
  res.locals.notices = await siteNotices();      // 站方公告（.announcement）
  // 背景音樂偏好（首頁 #wfp-bgm 的 .bgm-on）。原站寫 cookie mf，
  // 本專案沒有 cookie-parser，記在 session 就好。預設開，對齊原版初始態。
  res.locals.bgmOn = req.session.bgm !== 'off';
  res.locals.guest = req.session.guest || null;   // 訪客「記住我的資料」
  res.locals.render = render;   // 文章內文的安全格式化
  res.locals.safeCss = safeCss; // 使用者自訂 CSS 的過濾（見 format.js）
  // 站台識別與無名素材位置（views 全域可用，見 WRETCH_DOM.md）
  res.locals.SITE_NAME=SITE_NAME; res.locals.SITE_DESC=SITE_DESC; res.locals.SITE_LOGO=SITE_LOGO;
  res.locals.CDN=CDN;
  next();
});
const flash=(req,m)=>{req.session.flash=m};

// ===== 儲存空間保護 =====
// 沒接 R2 時照片與 SQLite 共用同一顆 Volume，塞爆會連資料庫都寫不進去，
// 所以（1）每人配額 (2)磁碟保留水位，兩道都擋在寫入之前。
const USER_QUOTA = (+process.env.USER_QUOTA_MB || 500) * 1024 * 1024;
const DISK_RESERVE = (+process.env.DISK_RESERVE_MB || 1024) * 1024 * 1024;
const MB = n => (n/1024/1024).toFixed(1);
const usedBytes = async uid => (await one('SELECT COALESCE(SUM(bytes),0) b FROM photos WHERE album_id IN (SELECT id FROM albums WHERE user_id=?)',uid)).b;
async function quotaError(uid, incoming){
  const used = await usedBytes(uid);
  if (used + incoming > USER_QUOTA)
    return `你的相簿空間已用 ${MB(used)} MB / ${MB(USER_QUOTA)} MB，這次上傳 ${MB(incoming)} MB 會超過上限。請先刪掉一些照片，或請站長調高配額。`;
  if (diskFree() - incoming < DISK_RESERVE)
    return '伺服器儲存空間不足，暫時無法上傳。已通知站長，請稍後再試。';
  return null;
}
// 搜尋字串裡的 LIKE 萬用字元要逸出，不然使用者打 % 會變成「比對全部」、
// 打 _ 會變成「任一個字」，搜「100%」會撈回整個資料庫。反斜線自己也要逸出。
// ⚠ 兩個資料庫的 LIKE 預設都**沒有逸出字元**，所以每一句 LIKE 都要跟著寫
// ESCAPE，不然這裡加的反斜線會被當成普通字元，使用者搜「50%」反而變成
// 搜「50\%」而搜不到——比不逸出更糟。逸出與 ESCAPE 是一組的，不能只做一半。
const likeArg = v => '%' + String(v).replace(/[\\%_]/g, c => '\\' + c) + '%';
// 只允許站內相對路徑（擋 javascript:、//evil.com、/\evil.com）
const safePath = v => { const x=String(v||'').trim();
  return (x.startsWith('/') && !x.startsWith('//') && !x.startsWith('/\\')) ? x.slice(0,300) : ''; };
const isFriend=async (a,b)=>!!await one('SELECT 1 FROM friends WHERE user_id=? AND friend_id=?',a,b);

// 動態：記一筆使用者活動，供「好友動態」讀取
const act=async (uid,kind,title,url)=>await run('INSERT INTO acts(user_id,kind,title,url) VALUES(?,?,?,?)',uid,kind,String(title).slice(0,100),url);

// 音樂盒網址：一行一個，只收 http(s)，避免 javascript: 之類的東西被存進來
const cleanMusic = s => (s||'').split('\n').map(x=>x.trim())
  .filter(x=>{ try { return ['http:','https:'].includes(new URL(x).protocol); } catch { return false; } })
  .slice(0,30).join('\n').slice(0,2000);

// ===== 全站 =====
app.get('/', async (req,res)=>{
  // 左側那個日期小工具（#wfp-archive）的日期連結指向 /?date=YYYY-MM-DD——
  // 原站點下去會看到那一天的首頁。我們照抄了整組 DOM 卻**從來沒處理過這個參數**，
  // 所以 11 個日期連結點下去畫面完全一樣，使用者會覺得「這東西是壞的」。
  // 帶了合法日期就只看那天（含）以前的內容，跟原站「回到那一天的首頁」語意一致。
  const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date||'') ? req.query.date : null;
  const dayWhere = day ? " AND substr(a.created,1,10)<=?" : "";
  const dayWhereP = day ? " AND substr(p.created,1,10)<=?" : "";
  const dayArgs = day ? [day] : [];
  res.render('index',{
    day,
    hotAlbums: await all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0 AND a.cover!=''${dayWhere} ORDER BY a.views DESC LIMIT 8`,...dayArgs),
    newPhotos: await all(`SELECT p.*,a.title atitle,a.id aid,u.name uname FROM photos p JOIN albums a ON a.id=p.album_id JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0${dayWhereP} ORDER BY p.id DESC LIMIT 8`,...dayArgs),
    // 熱門網誌：左縮圖右文字，取作者最新一張照片當縮圖（同 2005 首頁）
    hotPosts: await all(`SELECT p.*,u.name uname,u.nick,
        (SELECT ph.thumb FROM photos ph JOIN albums al ON al.id=ph.album_id
         WHERE al.user_id=p.user_id AND al.pass='' AND al.friends_only=0 ORDER BY ph.id DESC LIMIT 1) pthumb
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.pass='' ORDER BY p.views DESC LIMIT 6`),
    featAlbums: await all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id
      WHERE a.featured=1 AND a.pass='' AND a.friends_only=0 AND a.cover!='' ORDER BY a.id DESC LIMIT 4`),
    // 站長精選也要縮圖：跟 hotPosts 同一招（作者最新一張公開照片），
    // 再帶出 u.avatar 當第二層退路。都沒有才會落到 user_cover.gif 那張卡通圖，
    // 那張圖擺在「投稿精選」這種以人為主的模組裡特別假。
    featPosts: await all(`SELECT p.*,u.name uname,u.nick,u.avatar,
        (SELECT ph.thumb FROM photos ph JOIN albums al ON al.id=ph.album_id
         WHERE al.user_id=p.user_id AND al.pass='' AND al.friends_only=0 ORDER BY ph.id DESC LIMIT 1) pthumb
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.featured=1 AND p.pass='' ORDER BY p.id DESC LIMIT 5`),
    newUsers: await all(`SELECT name,nick,avatar FROM users ORDER BY id DESC LIMIT 8`),
    // 帶出 avatar：名家專欄／投稿精選那幾格會用它當代表圖。
    // 之前只 SELECT name/nick，view 只好去 hotAlbums 裡找那個人的照片，
    // 找不到就印卡通預設圖——排行榜上的人不一定在那幾個清單裡，所以常常找不到。
    rank: await all(`SELECT name,nick,visits,avatar FROM users ORDER BY visits DESC LIMIT 10`),
    notices: await all(`SELECT * FROM notices ORDER BY id DESC LIMIT 5`),
    stats:{users:(await one('SELECT count(*) c FROM users')).c,photos:(await one('SELECT count(*) c FROM photos')).c,posts:(await one('SELECT count(*) c FROM posts')).c}});
});
app.get('/rank',async (req,res)=>res.render('rank',{
  users: await all('SELECT name,nick,visits,avatar FROM users ORDER BY visits DESC LIMIT 50'),
  albums: await all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0 ORDER BY a.views DESC LIMIT 30`),
  // ⚠ 上鎖的文章不能出現在這裡。排行榜的 views 是照抄整列（含 body），
  // 而 views/rank.ejs 會把 body 印成 .description ——
  // 少了 `p.pass=''` 這個條件，**未登入的人在排行榜就讀得到密碼文章的內文**，
  // 文章密碼等於形同虛設。首頁、/blogs、/search、四支 RSS 都有這個過濾，
  // 只有這一支漏掉（多代理稽核抓到的）。相簿那一行本來就有濾，照它寫。
  posts: await all(`SELECT p.*,u.name uname,u.nick FROM posts p JOIN users u ON u.id=p.user_id WHERE p.pass='' ORDER BY p.views DESC LIMIT 30`)}));
app.get('/search',async (req,res)=>{
  const k=qs1(req.query.q).trim(), like=likeArg(k);
  // 搜尋範圍 type：原站頁首那四顆 radio（相簿／網誌／影音／網頁，name=type）。
  //
  // ⚠ 這四顆原本是**擺著好看的**——views/albums.ejs 印了 radio，但這支路由
  // 根本沒讀 type，點哪一顆送出來的結果都一樣。使用者的感受就是「不能點」。
  // 現在真的分範圍，而且順便省掉不需要的查詢（原本每次都跑四組 count）。
  //
  // 「網頁」原站送去 Yahoo 網頁搜尋，本站不連外，當成「全部」。
  // 值同時來自兩處表單，兩邊的命名不一樣，都要接住：
  //   views/albums.ejs 頁首那四顆      photo / site / video / web
  //   head2012_site.ejs 個人頁的搜尋列   article / photo / video
  const SCOPES = { photo:['albums'], site:['posts'], article:['posts'],
                   video:['videos'],
                   web:['users','albums','posts','videos'] };
  const type = SCOPES[qs1(req.query.type)] ? qs1(req.query.type) : '';
  const want = new Set(SCOPES[type] || ['users','albums','posts','videos']);
  // 各區的 WHERE 條件抽出來共用，count 與清單才不會分歧。
  // ⚠ 分歧的後果不只是數字不準：posts 那條的 `pass=''` 少寫一次，
  // 數字就會把上鎖文章算進去，變成另一種外洩。
  const W = {
    users:  { from:'FROM users', where:"name LIKE ? ESCAPE '\\' OR nick LIKE ? ESCAPE '\\'", args:[like,like] },
    albums: { from:'FROM albums a JOIN users u ON u.id=a.user_id',
              where:"a.pass='' AND a.friends_only=0 AND a.title LIKE ? ESCAPE '\\'", args:[like] },
    // 上鎖文章不讓內文被搜出來，只比對標題
    posts:  { from:'FROM posts p JOIN users u ON u.id=p.user_id',
              where:"p.title LIKE ? ESCAPE '\\' OR (p.pass='' AND p.body LIKE ? ESCAPE '\\')", args:[like,like] },
    videos: { from:'FROM videos v JOIN users u ON u.id=v.user_id',
              where:"v.title LIKE ? ESCAPE '\\' OR v.descr LIKE ? ESCAPE '\\'", args:[like,like] },
  };
  const cnt = async (key,s) => k && want.has(key) ? (await one(`SELECT count(*) c ${s.from} WHERE ${s.where}`,...s.args)).c : 0;
  const list = async (key,cols,order,s) => k && want.has(key)
    ? await all(`SELECT ${cols} ${s.from} WHERE ${s.where} ORDER BY ${order} DESC LIMIT 30`,...s.args) : [];
  res.render('search',{k,type,
    // ⚠ 一定要 ORDER BY。原本三條都沒有排序又只取 30 筆，
    // 結果永遠是 rowid 最小（**最舊**）的 30 筆——新內容一律搜不到。
    users:  await list('users','name,nick,avatar','id',W.users),
    albums: await list('albums','a.*,u.name uname','a.id',W.albums),
    posts:  await list('posts','p.*,u.name uname','p.id',W.posts),
    videos: await list('videos','v.*,u.name uname','v.id',W.videos),
    // 標題的數字要是**真的命中數**，不是這一頁的筆數。
    // 原本 view 直接印 users.length，那永遠是 min(命中數, 30)——
    // 搜到 2000 個帳號也只會顯示「站友（30）」。
    counts:{ users:await cnt('users',W.users), albums:await cnt('albums',W.albums),
             posts:await cnt('posts',W.posts), videos:await cnt('videos',W.videos) }});
});
// 健康檢查。給 Railway 的 healthcheck 用，也給人一眼確認三個外部服務都接上了。
//
// ⚠ 為什麼需要：正式站是 Postgres ＋ Redis ＋ R2 三個外掛服務，
// 而**每一個都有安靜的退路**——REDIS_URL 沒設就回到 MemoryStore、
// R2_BUCKET 沒設就寫本機磁碟、DB_DRIVER 不對就開 SQLite。
// 站看起來完全正常，直到某天重啟之後大家一起被登出（session 在記憶體裡）、
// 或是照片全部不見（寫在容器的暫存磁碟上，重新部署就沒了）。
// 這一支把「現在到底接到什麼」講清楚。
//
// 不印任何密鑰或連線字串，只印「有沒有」與 ping 得通不通，可以公開。
app.get('/healthz', async (req, res) => {
  // ⚠ redis 這一欄要回報**實際狀態**，不是「有沒有設定 REDIS_URL」。
  // 原本寫 hasRedis（＝!!URL），於是 Redis 連不上而降級成 MemoryStore 時，
  // /healthz 照樣回報 redis——那是假訊號，比不回報更糟。
  const out = { ok: true, db: driver, redis: redisState(), storage: hasR2 ? 'r2' : 'disk' };
  try {
    const t = Date.now();
    await one('SELECT 1 c');
    out.dbMs = Date.now() - t;
  } catch (e) { out.ok = false; out.dbError = e.message.slice(0, 120); }
  // Redis 沒接也不算失敗——本機開發就是這樣跑的。但正式站看到 memory
  // 就是設定掉了，值印出來讓人自己判斷。
  res.status(out.ok ? 200 : 503).type('application/json').send(JSON.stringify(out, null, 2));
});

app.get('/help',(req,res)=>res.render('help'));

// 背景音樂開關（首頁 #wfp-bgm）。原站是純前端＋cookie mf，
// 本站沒有 cookie-parser，走 session；不靠 JS 也能切換，所以做成 GET + 轉回原頁。
app.get('/bgm',(req,res)=>{
  req.session.bgm = req.query.on==='1' ? 'on' : 'off';
  res.redirect(safePath(req.query.back) || '/');
});

// 檢舉（無名各處都有「檢舉」連結，送到站長後台處理）
// 檢舉的獨立頁面。
// ⚠ 站上四個檢舉入口（文章／回應／留言／照片）都是 `<a href="#">` 加一個
// display:none 的表單，kind 與 target 靠 JS 填——**沒有 JS 就完全不能檢舉**，
// 點下去只是網址多一個 #。原站的檢舉是跳到 cc.wretch.cc/help/prosecute.php
// 另一頁（album_show_zh_jssophia.html:317 那條連結就是），本來就不靠 JS。
// 所以補一個 GET 頁：連結直接帶參數過來，有沒有 JS 都能用。
app.get('/report',(req,res)=>res.render('report',{
  kind: qs1(req.query.kind).slice(0,20),
  target: +qs1(req.query.target) || 0,
  url: safePath(qs1(req.query.url)),
}));
app.post('/report',async (req,res)=>{
  const {kind,target,url,reason}=req.body;
  // 只收站內相對路徑；擋掉 javascript: 與 //host（否則會變成後台的 XSS／開放轉址）
  const safeUrl = safePath(url);
  if(reason?.trim())
    await run('INSERT INTO reports(kind,target_id,url,reason,reporter) VALUES(?,?,?,?,?)',
      String(kind||'').slice(0,20), +target||0, safeUrl,
      reason.trim().slice(0,500), res.locals.me?.name||'訪客');
  res.render('msg',{title:'已送出檢舉',msg:'謝謝你的回報，站長會盡快處理。',back:safeUrl||'/'});
});

// ===== 相簿總站：依站內分類瀏覽（無名的 /album/） =====
app.get('/albums',async (req,res)=>{
  const topic=isAlbumTopic(req.query.topic)?req.query.topic:null;
  const place=isPlace(req.query.place)?req.query.place:null;
  const page=pageNo(req.query.p), per=20;      // 無名一頁 20 本（5×4）
  let where="a.pass='' AND a.friends_only=0 AND a.cover!=''"; const args=[];
  if(topic){ where+=' AND a.topic=?'; args.push(topic); }
  if(place){ where+=' AND a.place=?'; args.push(place); }
  const total=(await one(`SELECT count(*) c FROM albums a WHERE ${where}`,...args)).c;
  res.render('albums',{ topic, place, page, pages:Math.ceil(total/per), total,
    topics:ALBUM_TOPICS, places:PLACES,
    counts:Object.fromEntries((await all("SELECT topic,count(*) n FROM albums WHERE pass='' AND friends_only=0 AND cover!='' AND topic!='' GROUP BY topic")).map(r=>[r.topic,r.n])),
    albums:await all(`SELECT a.*,u.name uname,u.nick,(SELECT count(*) FROM photos WHERE album_id=a.id) n
      FROM albums a JOIN users u ON u.id=a.user_id WHERE ${where} ORDER BY a.views DESC, a.id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per) });
});

// ===== 網誌總站：依站內分類瀏覽 =====
app.get('/blogs',async (req,res)=>{
  const topic=isBlogTopic(req.query.topic)?req.query.topic:null;
  const page=pageNo(req.query.p), per=20;
  let where="p.pass=''"; const args=[];
  if(topic){ where+=' AND p.topic=?'; args.push(topic); }
  const total=(await one(`SELECT count(*) c FROM posts p WHERE ${where}`,...args)).c;
  res.render('blogs',{ topic, page, pages:Math.ceil(total/per), total, topics:BLOG_TOPICS,
    counts:Object.fromEntries((await all("SELECT topic,count(*) n FROM posts WHERE pass='' AND topic!='' GROUP BY topic")).map(r=>[r.topic,r.n])),
    // 帶出作者頭像：原版網誌總站每一則前面就是作者的封面圖
    // （blog_2012_service_index.html 的 l.yimg.com/e/cover/<帳號>_90.jpg），
    // 不是文章縮圖。之前一律印同一張 user_cover.gif，整頁看起來像沒載入。
    posts:await all(`SELECT p.*,u.name uname,u.nick,u.avatar,(SELECT count(*) FROM comments WHERE post_id=p.id) nc
      FROM posts p JOIN users u ON u.id=p.user_id WHERE ${where} ORDER BY p.views DESC, p.id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per) });
});

// ===== 帳號 =====
// ADMIN_USERS=vibeai,someone 名單內的帳號註冊或登入時自動取得站長權限，
// 避免「第一個註冊的人就是站長」被誤佔（例如測試帳號）。
const ADMIN_USERS = new Set((process.env.ADMIN_USERS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
app.get('/register',(req,res)=>res.render('register',{err:null,form:{}}));
// 猜密碼的速率限制。
//
// ⚠ 稽核指出登入、相簿解鎖、文章解鎖都可以無限次嘗試。相簿密碼上限 20 字，
// 但實際上大家設的是四位數字——一萬種組合，不限速的話幾秒就試完了。
//
// 做法：以「來源 IP ＋ 目標」為鍵，滑動視窗計數。單一行程的 Map 就夠——
// 這個服務綁著 /app/data 的 Volume，只會有一個執行個體（見 README 的部署說明）。
// 哪天要開多個複本，這裡要改成 Redis（session 已經在用 Redis 了）。
//
// 成功就把計數清掉，所以正常使用者永遠碰不到；連續失敗才會被擋。
const _tries = new Map();
const RATE = { max: 10, windowMs: 10 * 60 * 1000 };   // 10 分鐘內 10 次
function rateKey(req, what){
  // trust proxy 已經開著，req.ip 會是 X-Forwarded-For 的第一個位址
  return what + '|' + (req.ip || 'unknown');
}
function rateHit(req, what, max = RATE.max){
  const key = rateKey(req, what), now = Date.now();
  const hits = (_tries.get(key) || []).filter(t => now - t < RATE.windowMs);
  hits.push(now);
  _tries.set(key, hits);
  // 順手把過期的鍵清掉，不然這個 Map 會一直長大
  if (_tries.size > 5000)
    for (const [k, v] of _tries) if (!v.length || now - v[v.length - 1] > RATE.windowMs) _tries.delete(k);
  return hits.length > max;
}
// 登入是兩道鎖：
//   帳號那道（10 次）擋的是「盯著某個人猛猜」
//   IP 那道（60 次）擋的是「換帳號亂噴」
// 只鎖 IP 不行——公司、學校、電信業者的 NAT 後面成千上萬人共用一個位址，
// 一個人猜錯十次就把整棟樓鎖在外面。只鎖帳號也不行——那就變成可以慢慢
// 掃過全站的帳號。兩道一起才擋得住，又不會誤傷。
function loginBlocked(req, name){
  const perName = rateHit(req, 'login:' + String(name || '').toLowerCase());
  const perIp   = rateHit(req, 'login-ip', 60);
  return perName || perIp;
}
const rateClear = (req, what) => _tries.delete(rateKey(req, what));
const rateMsg = '嘗試太多次了，請等十分鐘再試。';


// 登入／註冊成功時換一組全新的 session id（session fixation）。
//
// ⚠ 沒有這一步的話：攻擊者先自己開一個 session，想辦法讓受害者的瀏覽器
// 帶著**同一個** session id（共用電腦、被塞 cookie 的子網域、網址參數…），
// 受害者登入之後那個 id 就升級成已登入狀態，攻擊者手上那份也跟著生效。
// regenerate() 會丟掉舊 id 另發一組，舊的那份永遠停在未登入。
//
// flash 訊息存在 session 裡，regenerate 會一起清掉，所以要先撈起來再放回去。
function signIn(req, uid){
  return new Promise((resolve, reject) => {
    const keep = req.session.flash;
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.uid = uid;
      if (keep) req.session.flash = keep;
      resolve();
    });
  });
}

// 帳號名是不是站台保留字。
//
// ⚠ 寫成函式而不是直接用 RESERVED，是因為 const RESERVED 宣告在這一行**後面**
// （它要等 SECTION 先建好），直接引用會踩到 TDZ：整個行程在載入 server.js 時
// 就丟 ReferenceError: Cannot access 'SECTION' before initialization，站根本起不來。
// function 宣告會提升，而它真正被呼叫的時候（有請求進來）兩個都早就初始化好了。
function isReserved(name){ return RESERVED.has(String(name || '').toLowerCase()); }


app.post('/register',async (req,res)=>{
  const {name='',nick='',pass='',pass2=''}=req.body;
  // ⚠ RESERVED 原本**只用在路由上**（/:name 這一層遇到保留字就 next()），
  // 註冊完全沒有比對。於是任何人都可以註冊 admin／login／rank／albums…，
  // 註冊得到之後小站首頁 /<帳號> 永遠打不開——Express 先配到站台那條路由。
  // 使用者只會覺得「我註冊完就再也進不去自己的小站」，而且沒有任何提示。
  const low0 = String(name || '').toLowerCase();
  const err = !/^[a-z0-9_]{3,20}$/i.test(name)?'帳號限 3~20 位英數字或底線'
    :isReserved(low0)?'這個帳號是站台保留字，請換一個'
    :!nick.trim()?'請填暱稱':pass.length<4?'密碼至少 4 碼':pass!==pass2?'兩次密碼不一致'
    :await one('SELECT 1 FROM users WHERE name=?',low0)?'這個帳號已經有人用了':null;
  if(err) return res.render('register',{err,form:req.body});
  const s=salt(), low=name.toLowerCase();
  const first=!await one('SELECT 1 FROM users');
  // ⚠ 上面那個「這個帳號有人用了嗎」是先查再插，兩個請求同時進來就會都查到「沒人用」
  // （表單被雙擊就會發生）。Postgres 有 lower(name) 的唯一索引會擋下第二個，
  // 但那是一個 23505 例外 → 未攔就是 500。攔下來當成「已經有人用了」。
  let r;
  try {
    r=await run('INSERT INTO users(name,pass,salt,nick,admin) VALUES(?,?,?,?,?)',low,hash(pass,s),s,cut(nick.trim(),20),(first||ADMIN_USERS.has(low))?1:0);
  } catch (e) {
    if (/duplicate key|UNIQUE constraint/i.test(e.message))
      return res.render('register',{err:'這個帳號已經有人用了',form:req.body});
    throw e;
  }
  await run('INSERT INTO albums(user_id,title) VALUES(?,?)',r.lastInsertRowid,'我的相簿');
  await signIn(req, Number(r.lastInsertRowid)); flash(req,'歡迎加入 vibeai 小站！'); res.redirect('/'+name.toLowerCase());
});
app.get('/login',(req,res)=>res.render('login',{err:null,next:req.query.next||''}));
app.post('/login',async (req,res)=>{
  if (loginBlocked(req, req.body.name)) return res.status(429).render('login',{err:rateMsg,next:req.body.next||''});
  const u=await one('SELECT * FROM users WHERE name=?',String(req.body.name||'').toLowerCase());
  if(!check(u,req.body.pass||'')) return res.render('login',{err:'帳號或密碼錯誤',next:req.body.next||''});
  if(ADMIN_USERS.has(u.name) && !u.admin) await run('UPDATE users SET admin=1 WHERE id=?',u.id); // ADMIN_USERS 名單登入即補站長權限
  rateClear(req, 'login:' + String(req.body.name||'').toLowerCase()); rateClear(req, 'login-ip');
  await signIn(req, u.id); res.redirect(safePath(req.body.next) || '/'+u.name);
});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

// ===== 站長後台 =====
// 被擋下來的畫面也要套版。原本是 res.status(403).send('forbidden')，
// 使用者看到的是瀏覽器的白底純文字，跟整站的 2012 外框完全脫節。
// 未登入的情況導去登入頁並帶 next，登入完就會回到原本要去的地方；
// 已登入但不是站長才回 403 的訊息頁。
const requireAdmin=(req,res,next)=>{
  if(res.locals.me?.admin) return next();
  if(!res.locals.me) return res.redirect('/login?next='+encodeURIComponent(req.originalUrl));
  res.status(403).render('msg',{title:'沒有權限',msg:'這裡只有站長進得來。',back:'/'});
};
app.get('/admin',requireAdmin,async (req,res)=>res.render('admin',{
  // u.vip 一定要撈：後台的認證徽章下拉靠它回填目前等級，
  // 沒撈的話每一列都顯示「無」，站長根本看不出誰已經掛了徽章。
  users:await all(`SELECT u.id,u.name,u.nick,u.visits,u.admin,u.vip,u.created,
    (SELECT COALESCE(SUM(p.bytes),0) FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=u.id) bytes
    FROM users u ORDER BY u.id DESC`),
  notices:await all('SELECT * FROM notices ORDER BY id DESC'),
  reports:await all('SELECT * FROM reports ORDER BY done, id DESC LIMIT 50'),
  storage:{ total:(await one('SELECT COALESCE(SUM(bytes),0) b FROM photos')).b, free:diskFree(), r2:hasR2, quota:USER_QUOTA, mb:MB }}));
app.post('/admin/report/:id/done',requireAdmin,async (req,res)=>{ await run('UPDATE reports SET done=1 WHERE id=?',req.params.id); res.redirect('/admin'); });
app.post('/admin/report/:id/del',requireAdmin,async (req,res)=>{ await run('DELETE FROM reports WHERE id=?',req.params.id); res.redirect('/admin'); });
// 站長精選（首頁「無名精選」）
app.post('/admin/feature/:kind/:id',requireAdmin,async (req,res)=>{
  const t = req.params.kind==='album' ? 'albums' : (req.params.kind==='post' ? 'posts' : null);
  if(t) await run(`UPDATE ${t} SET featured=1-featured WHERE id=?`, req.params.id);
  res.redirect(safePath(req.body.back) || '/admin');
});
// 群發系統訊息（當年的「無名日報」）
app.post('/admin/broadcast',requireAdmin,async (req,res)=>{
  const title=(req.body.title||'').trim().slice(0,60), body=(req.body.body||'').trim().slice(0,1000);
  // ⚠ 原本是「把所有 user id 撈回來，一個一個 INSERT」。每一筆都是一次
  // 完整的往返（Postgres 上還要跨網路）。實測 5000 個站友：
  //     逐筆 INSERT      11287ms
  //     INSERT…SELECT        4ms
  // 差 2800 倍。那 11 秒整個站的事件迴圈被這一個請求佔住，所有人都連不進來，
  // 站長還會以為是自己按壞了。正式站是 Postgres，往返成本更高。
  //
  // 改成一句 INSERT ... SELECT，讓資料庫自己在內部展開，一次往返。
  if (title && body)
    await run('INSERT INTO sysmsg(user_id,title,body) SELECT id,?,? FROM users', title, body);
  flash(req,'已送出給所有站友'); res.redirect('/admin');
});
// 公告改完要順手作廢快取，否則站長剛發的公告要等 30 秒才看得到（看起來像沒存到）
app.post('/admin/notice',requireAdmin,async (req,res)=>{ if(req.body.body?.trim()) await run('INSERT INTO notices(body) VALUES(?)',req.body.body.trim().slice(0,200)); noticeCache.at=0; res.redirect('/admin'); });
app.post('/admin/notice/:id/del',requireAdmin,async (req,res)=>{ await run('DELETE FROM notices WHERE id=?',req.params.id); noticeCache.at=0; res.redirect('/admin'); });
app.post('/admin/user/:id/admin',requireAdmin,async (req,res)=>{ // 設為／取消站長（不能取消自己，避免把自己鎖在外面）
  const id=Number(req.params.id);
  if(id!==res.locals.me.id) await run('UPDATE users SET admin=1-admin WHERE id=?',id);
  res.redirect('/admin'); });
// 認證／VIP 徽章（.vip_icon）：0 無、1 銀、2 金、3 白金。
// 原站是付費制，本站沒有金流，改成站長手動掛給值得的帳號。
app.post('/admin/user/:id/vip',requireAdmin,async (req,res)=>{
  await run('UPDATE users SET vip=? WHERE id=?', Math.min(3,Math.max(0,+req.body.vip||0)), Number(req.params.id));
  res.redirect('/admin'); });
app.post('/admin/user/:id/del',requireAdmin,async(req,res)=>{
  const id=Number(req.params.id);
  // 站長刪別人與使用者自刪走**同一支** purgeUser()，不要各寫一份（會分岔）
  if(id!==res.locals.me.id) await purgeUser(id);
  res.redirect('/admin'); });

// ===== 無名小站風格網址 =====
// 當年的格式是 /album/帳號、/blog/帳號、/guestbook/帳號、/friend/帳號、/mypage/帳號。
// 這裡把它們轉到本站的 /帳號/... 結構，兩種網址都能用。
const SECTION={album:'album',blog:'blog',guestbook:'guestbook',friend:'friends',mypage:'',user:'card',
  video:'video',digu:'digu'};   // 影音與嘀咕的原站網址同樣是 /video/<帳號>、/digu/<帳號>
for(const [seg,dest] of Object.entries(SECTION)){
  app.get(`/${seg}/:name`,async (req,res,next)=>{
    if(!await one('SELECT 1 FROM users WHERE name=?',String(req.params.name||'').toLowerCase())) return next();
    const qs=req.originalUrl.includes('?')?'?'+req.originalUrl.split('?')[1]:'';
    res.redirect(301,`/${req.params.name}${dest?'/'+dest:''}${qs}`);
  });
  app.get(`/${seg}/:name/*`,async (req,res,next)=>{
    if(!await one('SELECT 1 FROM users WHERE name=?',String(req.params.name||'').toLowerCase())) return next();
    res.redirect(301,`/${req.params.name}${dest?'/'+dest:''}/${req.params[0]}`);
  });
}

// ===== 站台層級的服務目錄：影音 / 嘀咕 / 揪團 =====
// 原站導覽列的這三顆分別指向 /video/、/digu/、/join/（把 Yahoo 的轉址網址剝掉
// 就是這三個），但**三個服務首頁 archive.org 都沒有存檔**，所以是自製的，
// 照 WRETCH_2012.md §3-A 標明刻意偏離。之前這三顆都指到 /help，等於是死連結。
//
// 網址沿用原站的單數形（/video 不是 /videos）。`video` 與 `digu` 本來就在
// SECTION 裡（那是 /video/<帳號> 這種舊網址的轉址），所以已經是保留字；
// `join` 要另外加進 RESERVED，不然會有人註冊得到這個帳號名把整頁蓋掉。
app.get('/video',async (req,res)=>{
  const page=pageNo(req.query.p), per=20;
  const total=(await one('SELECT count(*) c FROM videos')).c;
  res.render('videos',{ page, pages:Math.ceil(total/per), total,
    videos:await all(`SELECT v.*,u.name uname,u.nick FROM videos v JOIN users u ON u.id=v.user_id
      ORDER BY v.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per),
    hot:await all(`SELECT v.id,v.title,v.views,u.name uname FROM videos v JOIN users u ON u.id=v.user_id
      ORDER BY v.views DESC LIMIT 10`) });
});

app.get('/digu',async (req,res)=>{
  const page=pageNo(req.query.p), per=30;
  const total=(await one('SELECT count(*) c FROM digu')).c;
  res.render('digus',{ page, pages:Math.ceil(total/per), total,
    digus:await all(`SELECT d.*,u.name uname,u.nick,u.avatar FROM digu d JOIN users u ON u.id=d.user_id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per) });
});

app.get('/join',async (req,res)=>{
  const page=pageNo(req.query.p), per=20;
  const total=(await one('SELECT count(*) c FROM joins')).c;
  res.render('joins',{ page, pages:Math.ceil(total/per), total,
    joins:await all(`SELECT j.*,u.name uname,u.nick,u.avatar,
        (SELECT count(*) FROM join_members WHERE join_id=j.id) n
      FROM joins j JOIN users u ON u.id=j.user_id ORDER BY j.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per) });
});
app.get('/join/:id',async (req,res,next)=>{
  const j=await one(`SELECT j.*,u.name uname,u.nick FROM joins j JOIN users u ON u.id=j.user_id WHERE j.id=?`,req.params.id);
  if(!j) return next();
  res.render('join',{ j,
    members:await all(`SELECT u.name,u.nick,u.avatar,u.intro FROM join_members m JOIN users u ON u.id=m.user_id
      WHERE m.join_id=? ORDER BY m.created`,j.id),
    joined:res.locals.me?!!await one('SELECT 1 FROM join_members WHERE join_id=? AND user_id=?',j.id,res.locals.me.id):false });
});
app.post('/join',requireLogin,async (req,res)=>{
  const t=(req.body.title||'').trim().slice(0,40);
  if(!t) return res.redirect('/join');
  const r=await run(`INSERT INTO joins(user_id,title,descr,place,when_text,quota) VALUES(?,?,?,?,?,?)`,
    res.locals.me.id, t, (req.body.descr||'').trim().slice(0,200),
    (req.body.place||'').trim().slice(0,20), (req.body.when_text||'').trim().slice(0,20),
    Math.max(0,Math.min(999,+req.body.quota||0)));
  // 發起人自動算一個參加者，不然剛開的團會顯示 0 人
  await run('INSERT OR IGNORE INTO join_members(join_id,user_id) VALUES(?,?)',Number(r.lastInsertRowid),res.locals.me.id);
  res.redirect('/join/'+Number(r.lastInsertRowid));
});
app.post('/join/:id/in',requireLogin,async (req,res)=>{
  const j=await one('SELECT * FROM joins WHERE id=?',req.params.id);
  if(!j) return res.redirect('/join');
  const mine=await one('SELECT 1 FROM join_members WHERE join_id=? AND user_id=?',j.id,res.locals.me.id);
  if(mine){
    await run('DELETE FROM join_members WHERE join_id=? AND user_id=?',j.id,res.locals.me.id);
  } else {
    // 額滿的判斷一定要在後端做：前端只是不畫那顆鈕，直接送 POST 一樣進得來。
    const n=(await one('SELECT count(*) c FROM join_members WHERE join_id=?',j.id)).c;
    if(j.quota && n>=j.quota)
      return res.status(409).render('msg',{title:'人數已滿',msg:'這個團已經額滿了。',back:'/join/'+j.id});
    await run('INSERT OR IGNORE INTO join_members(join_id,user_id) VALUES(?,?)',j.id,res.locals.me.id);
  }
  res.redirect('/join/'+j.id);
});

// ===== 無名愛正妹 /svcs/wretch_girl =====
// 原站網址在 WRETCH_SPEC.md §6 的表裡；首頁的「無名優質正妹」模組
// （index_20120610082113.html 的 featuredJSON.featured_beauty）就是它的精選，
// 那組 JSON 的 more_url 指向 /album/?func=hot&hid=0&class_id=9——
// 也就是「相簿總站的熱門榜、篩人物分類」。所以它不是獨立的相簿系統，
// 是**人物相簿的人氣榜**。這一頁照那個語意做：把人物分類的照片依人氣排，
// 登入之後可以推一票。版面沒有存檔，用站台既有的元件語言組（§3-A）。
//
// 原站這裡只有「正妹」，本站男女兩個分類都收——原站那個只收女生的設計
// 沒有必要照抄，功能是一樣的。
const GIRL_TOPICS = ['女生個人', '男生個人'];
app.get('/svcs/wretch_girl',async (req,res)=>{
  const page=pageNo(req.query.p), per=24;
  const topic=GIRL_TOPICS.includes(req.query.topic)?req.query.topic:null;
  const where=`a.pass='' AND a.friends_only=0 AND a.topic IN (${GIRL_TOPICS.map(()=>'?').join(',')})`
    + (topic?' AND a.topic=?':'');
  const args=[...GIRL_TOPICS, ...(topic?[topic]:[])];
  const total=(await one(`SELECT count(*) c FROM photos p JOIN albums a ON a.id=p.album_id WHERE ${where}`,...args)).c;
  res.render('wretchgirl',{ page, pages:Math.ceil(total/per), total, topic, topics:GIRL_TOPICS,
    photos:await all(`SELECT p.id,p.thumb,p.url,p.caption,p.views,a.title atitle,a.id aid,
        u.name uname,u.nick,a.topic,
        (SELECT count(*) FROM photo_votes WHERE photo_id=p.id) votes
      FROM photos p JOIN albums a ON a.id=p.album_id JOIN users u ON u.id=a.user_id
      WHERE ${where} ORDER BY votes DESC, p.views DESC, p.id DESC LIMIT ? OFFSET ?`,
      ...args,per,(page-1)*per) });
});
// 推一票。原站沒有這個（它只是排行榜），但「排行榜」要有人氣來源才活得起來，
// 用推票比單純看瀏覽數更像當年那個氛圍。一人一張照片只能推一次。
app.post('/svcs/wretch_girl/:pid/vote',requireLogin,async (req,res)=>{
  const p=await one(`SELECT p.id FROM photos p JOIN albums a ON a.id=p.album_id
    WHERE p.id=? AND a.pass='' AND a.friends_only=0`,req.params.pid);
  if(p) await run('INSERT OR IGNORE INTO photo_votes(photo_id,user_id) VALUES(?,?)',p.id,res.locals.me.id);
  res.redirect(req.get('referer')&&req.get('referer').includes('/svcs/wretch_girl')
    ? '/svcs/wretch_girl' : '/svcs/wretch_girl');
});

// ===== 哈啦論壇 =====
// 原站是 www.wretch.cc/hala/viewtopic.php?t=65131 這種 phpBB 式的討論區。
// 存檔裡它一律是被當成**官方說明文**連進去的：相簿頁的「RSS HOWTO」、
// 網誌迴響表單的「What if you cannot see the numbers?（看不到驗證碼）」。
// 版面本身沒有任何存檔，所以這幾頁是自製的（WRETCH_2012.md §3-A）。
//
// 網址保留原站的 /hala/viewtopic.php?t=<id>，這樣存檔裡那些連結原封不動就會通；
// 另外提供比較好讀的 /hala/<id>。
app.get('/hala',async (req,res)=>{
  // ?q=rss 這種捷徑：站上其他頁面（相簿的 RSS HOWTO）要連到「某一篇說明」，
  // 但種子重灌之後主題 id 會變，寫死 id 會指到別篇。改成用關鍵字找官方主題，
  // 找得到就直接導過去，找不到就退回論壇首頁——連結永遠不會落空。
  if(req.query.q){
    const hit=await one("SELECT id FROM hala_topics WHERE official=1 AND (title LIKE ? ESCAPE '\\' OR cat LIKE ? ESCAPE '\\') ORDER BY id LIMIT 1",
      likeArg(qs1(req.query.q)),likeArg(qs1(req.query.q)));
    if(hit) return res.redirect('/hala/'+hit.id);
  }
  const page=pageNo(req.query.p), per=20;
  const total=(await one('SELECT count(*) c FROM hala_topics')).c;
  res.render('hala',{ page, pages:Math.ceil(total/per), total,
    topics:await all(`SELECT t.*,u.name uname,u.nick,
        (SELECT count(*) FROM hala_posts WHERE topic_id=t.id) n
      FROM hala_topics t LEFT JOIN users u ON u.id=t.user_id
      ORDER BY t.official DESC, t.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per) });
});
const halaTopic=async (req,res,id)=>{
  // ⚠ id 可能是 undefined（/hala/viewtopic.php 沒帶 t）或陣列（?t[]=x）。
  // 直接綁進 SQL 的話，SQLite 會拋 datatype mismatch → 500。
  // 空字串會正常查不到 → 呼叫端回 404，那才是對的行為。
  id = qs1(id);
  if(!/^[0-9]+$/.test(id)) return null;
  const t=await one(`SELECT t.*,u.name uname,u.nick FROM hala_topics t
    LEFT JOIN users u ON u.id=t.user_id WHERE t.id=?`,id);
  if(!t) return null;
  await run('UPDATE hala_topics SET views=views+1 WHERE id=?',t.id);
  return { t, posts:await all(`SELECT p.*,u.name uname,u.nick,u.avatar FROM hala_posts p
    LEFT JOIN users u ON u.id=p.user_id WHERE p.topic_id=? ORDER BY p.id`,t.id) };
};
// 原站網址：/hala/viewtopic.php?t=<id>
app.get('/hala/viewtopic.php',async (req,res,next)=>{
  const d=await halaTopic(req,res,req.query.t); if(!d) return next();
  res.render('hala_topic',d);
});
app.get('/hala/:id',async (req,res,next)=>{
  const d=await halaTopic(req,res,req.params.id); if(!d) return next();
  res.render('hala_topic',d);
});
app.post('/hala',requireLogin,async (req,res)=>{
  const title=(req.body.title||'').trim().slice(0,60);
  const body=(req.body.body||'').trim().slice(0,3000);
  if(!title||!body) return res.redirect('/hala');
  const r=await run('INSERT INTO hala_topics(user_id,title,body,cat) VALUES(?,?,?,?)',
    res.locals.me.id,title,body,(req.body.cat||'').slice(0,10));
  res.redirect('/hala/'+Number(r.lastInsertRowid));
});
app.post('/hala/:id/reply',requireLogin,async (req,res)=>{
  const t=await one('SELECT id FROM hala_topics WHERE id=?',req.params.id);
  if(!t) return res.redirect('/hala');
  const body=(req.body.body||'').trim().slice(0,3000);
  if(body) await run('INSERT INTO hala_posts(topic_id,user_id,author,body) VALUES(?,?,?,?)',
    t.id,res.locals.me.id,res.locals.me.nick,body);
  res.redirect('/hala/'+t.id+'#last');
});

// ===== 個人小站 =====
// ── 查詢字串的兩個共用守門員 ────────────────────────────────────────────
//
// qs1：把查詢參數變成**單一字串**。
//   Express 的 extended:false 仍然會把 `?cat[]=x` 解析成陣列，
//   陣列綁進 SQL 會讓 SQLite 拋 datatype mismatch → 500。
//   多代理稽核實測 /alpha/blog?cat[]=x、?ym[]=、?d[]=、/search?q[]=x 都 500。
export const qs1 = v => Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
//
// pageNo：把 ?p= 變成一個**安全的正整數**。
//   `Math.max(1, +p || 1)` 擋不住 Infinity——`+'1e999'` 是 Infinity，
//   Math.max(1, Infinity) 還是 Infinity，綁進 SQL 的 LIMIT/OFFSET 就 500。
//   全站 14 處分頁都有這個問題。
export const pageNo = v => {
  const n = Math.floor(Number(qs1(v)));
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 1e6) : 1;
};

// 分組名一律從 friend_groups 撈（group_id=0 就是原站的 Default group）。
// ⚠ 這個子查詢要放在 SELECT 裡，不能 JOIN friend_groups——
// rel=1/3 那兩種關係的 f 不是站主自己的那條邊，JOIN 會把筆數乘開。
const GRP_NAME = "COALESCE((SELECT name FROM friend_groups WHERE id=f.group_id),'好友')";

const site=express.Router({mergeParams:true});
autoAsync(site);   // 個人小站的路由同樣需要 async 錯誤轉交（理由見檔頭 wrapAsync）

// 不能拿來當帳號的名字。
//
// ⚠ 這份名單漏了好幾個**已經存在的站台層級路由**：albums / blogs / video /
// digu / report / healthz / bgm。註冊得到這些名字的人，小站首頁 /<帳號>
// 永遠打不開——Express 會先配到站台那條路由。使用者只會覺得
// 「我註冊完就再也進不去自己的小站」，而且完全沒有提示。
//
// 名單要跟著路由一起長。新增任何 app.get('/xxx') 的站台頁面時，
// xxx 一定要加進來（或者放進 SECTION，那份會自動併入）。
const RESERVED=new Set(['login','register','logout','rank','search','help','admin','uploads','img','style.css','favicon.ico',
  'join','hala','svcs',
  // 站台層級的總站與工具頁
  'albums','blogs','video','digu','report','healthz','bgm','robots.txt','sitemap.xml',
  ...Object.keys(SECTION)]);

// 數字型路由參數的守門員。
//
// 為什麼要有這個：`/album/rss`、`/blog/new` 這種具名路由如果註冊在 `/album/:id`
// 後面，就會被參數路由先接走，把 'rss' 當成編號送進 SQL。
//   SQLite   靜靜回一列都沒有 → 看起來像 404，本機完全測不出來
//   Postgres 直接拋 invalid input syntax for integer → **正式站 500**
// 同樣的道理，任何人手打 /meimei/photo/abc 也會讓正式站噴 500 而不是 404。
// 在 router 層一次擋掉：不是純數字就 next('route')，讓它落到 404 那一支。
// 新增數字參數時記得把名字加進這個清單。
for (const p of ['id', 'pid', 'cid', 'aid', 'fid']) {
  const guard = (req, res, next, val) => /^[0-9]+$/.test(String(val)) ? next() : next('route');
  site.param(p, guard);
  app.param(p, guard);
}
app.use('/:name',async (req,res,next)=>{
  if(RESERVED.has(req.params.name)) return next();
  const u=await one('SELECT * FROM users WHERE name=?',String(req.params.name||'').toLowerCase()); if(!u) return next();
  res.locals.u=u; res.locals.isOwner=res.locals.me?.id===u.id;
  // 版型：無名的個人頁長相由站主選的版型決定（見 src/skins.js）。
  // view 用 skinCss('album'|'blog'|'guestbook'|'user'|'friend') 取自己那一支。
  res.locals.skinCss = service => skinCss(service, u.theme);
  res.locals.isFriend=res.locals.me?await isFriend(res.locals.me.id,u.id):false;
  // 側欄名片小卡（partials/side.ejs）印站主最新一則嘀咕（.myDigu / .digu / .digu_date）。
  // 這塊在個人站每一頁都會出現，所以放在這裡查一次就好；
  // 之前只有留言板那條路由查、而且變數名還不一樣（lastDigu vs digu），
  // 結果站上明明有嘀咕，每一頁都印「還沒有嘀咕」。
  res.locals.digu=await one('SELECT * FROM digu WHERE user_id=? ORDER BY id DESC LIMIT 1',u.id);
  // 側欄那格「留言：N」永遠要是留言板的則數。放在這裡而不是留言板那條 route，
  // 是因為側欄在個人站每一頁都會出現：只在留言板送的話，誰來我家會印足跡數、
  // 我的收藏會印 0，標籤卻都寫著「留言」。
  res.locals.gbCount=(await one('SELECT count(*) c FROM guestbook WHERE user_id=?',u.id)).c;
  // 「- Friends' Album -」「- Friends' Guestbook -」這種好友下拉，在相簿、照片、
  // 名片、留言板每一頁都會出現。之前只有名片與留言板那兩條 route 各自查，
  // 相簿與照片頁沒送，下拉就永遠只有佔位那一行。放這裡查一次，全部都有。
  res.locals.gbFriends=await all(
    `SELECT u2.name,u2.nick,${GRP_NAME} grp FROM friends f `
    + "JOIN users u2 ON u2.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u2.name LIMIT 300", u.id);
  site(req,res,next);
});
const U=res=>res.locals.u;

// 今日人氣／累積人氣：跨日自動歸零今日計數（無名兩個數字都顯示）
// 「今天」一律以台北時間為準，不要靠行程的 TZ（正式站容器是 UTC，會差一天）
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
async function bumpHits(u){
  const d=today();
  // 跨日先把今日計數歸零。這一筆一定要立刻寫，不能延後——
  // 否則 write-behind 把昨天累積的增量刷回來時會加到今天的計數上。
  if(u.hits_date!==d){
    await run('UPDATE users SET today_hits=0,hits_date=? WHERE id=?',d,u.id);
    u.today_hits=0; u.hits_date=d;
  }
  // 有 Redis 就只在 Redis 累加，每 30 秒批次寫回（見 src/cache.js 與檔尾的 startVisitFlusher）。
  // 這是全站最頻繁的寫入，批次之後 N 次磁碟寫入壓成 1 次。
  // bumpVisit() 回傳 true 代表沒有 Redis，要自己寫。
  if (await bumpVisit(u.id))
    await run('UPDATE users SET today_hits=today_hits+1,visits=visits+1 WHERE id=?',u.id);
  u.today_hits=(u.today_hits||0)+1;
}

site.get('/',async (req,res)=>{
  const u=U(res);
  if(!res.locals.isOwner){ await bumpHits(u); u.visits++;
    if(res.locals.me && !await one("SELECT 1 FROM visitors WHERE user_id=? AND who=? AND created>datetime('now','localtime','-1 hour')",u.id,res.locals.me.name)) await run('INSERT INTO visitors(user_id,who) VALUES(?,?)',u.id,res.locals.me.name); }
  res.render('home',{nav:'user',
    albums:await hideLockedCovers(req,res,await all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC LIMIT 6`,u.id)),
    posts:await all('SELECT * FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 5',u.id),
    // visitors 存的是「當時的帳號名」字串，不是外鍵：帳號被刪掉之後那一列還在，
    // 側欄照樣連過去就是一條 404 死連結。這裡只列帳號還在的（側欄本來就只放最近幾位）。
    // 完整的「誰來我家」那一頁不刪紀錄，改成不給連結，見 views/visitors.ejs。
    visitors:await all('SELECT v.* FROM visitors v JOIN users x ON x.name=v.who WHERE v.user_id=? ORDER BY v.id DESC LIMIT 8',u.id),
    friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',u.id),
    gb:await all("SELECT * FROM guestbook WHERE user_id=? AND secret=0 ORDER BY id DESC LIMIT 3",u.id),
    // 統計數字（MyPage 上的「相簿 N 本・照片 N 張・網誌 N 篇」）
    counts:{
      albums: (await one('SELECT count(*) c FROM albums WHERE user_id=?',u.id)).c,
      photos: (await one('SELECT count(*) c FROM photos WHERE album_id IN (SELECT id FROM albums WHERE user_id=?)',u.id)).c,
      posts:  (await one('SELECT count(*) c FROM posts WHERE user_id=?',u.id)).c,
      gb:     (await one('SELECT count(*) c FROM guestbook WHERE user_id=?',u.id)).c,
      friends:(await one('SELECT count(*) c FROM friends WHERE user_id=?',u.id)).c,
    }});
});
// 誰來我家（完整名單）
site.get('/visitors',async (req,res)=>{
  const page=pageNo(req.query.p), per=50;
  const total=(await one('SELECT count(*) c FROM visitors WHERE user_id=?',U(res).id)).c;
  res.render('visitors',{nav:'user',page,pages:Math.ceil(total/per),total,
    rows:await all('SELECT v.*,u.nick,u.avatar FROM visitors v LEFT JOIN users u ON u.name=v.who WHERE v.user_id=? ORDER BY v.id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per),
    visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
    friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)});
});
// 個人設定
site.get('/settings',requireLogin,requireOwner,async (req,res)=>res.render('settings',{nav:'user',themes:SKINS,
  folders:await all('SELECT * FROM folders WHERE user_id=? ORDER BY seq,id',U(res).id),
  subs:await all('SELECT * FROM subs WHERE user_id=? ORDER BY id',U(res).id)}));
site.post('/settings',requireLogin,requireOwner,upload.single('avatar'),async(req,res)=>{
  const {nick,intro,music,css,css_blog,pass,pass2}=req.body, u=U(res);
  let avatar=u.avatar, avatarErr='';
  // ⚠ fileFilter 擋掉的檔案 req.file 會是 undefined，跟「這次沒有要換頭貼」
  // 長得一模一樣，於是畫面顯示「設定已儲存」——使用者以為換好了，其實沒有。
  // droppedFiles 是 fileFilter 記下來的，有東西就代表**有選檔案但被擋掉**。
  if (req.droppedFiles?.length) avatarErr = req.droppedFiles[0];
  // 大頭貼走同一條 save()。它會出現在訪客記錄、好友清單、留言板、排行榜——
  // 也就是**別人的頁面**上，所以壞圖的擴散面比相簿照片更廣，一定要擋住。
  if(req.file){
    // ⚠ 大頭貼原本**完全不走配額**（usedBytes 只 SUM photos.bytes），
    // 任何登入者都能無上限地換頭貼把磁碟灌爆，而畫面上還顯示「0.0 MB / 500.0 MB」。
    // 換一張的大小很小，這裡只要擋住「已經爆了還繼續傳」就夠。
    const qerr = await quotaError(u.id, req.file.size || 0);
    if (qerr) {
      avatarErr = qerr;
    } else try {
      const s=await save(req.file);
      avatar=s.thumb;
      // ⚠ save() 會產出**大圖與縮圖兩個檔**，但大頭貼只採用縮圖。
      // 不刪掉那張 1024px 的大圖，每換一次頭貼就在磁碟上留一個沒人指向的孤兒檔。
      if (s.url && s.url !== s.thumb) await remove(s.url);
      await remove(u.avatar);
    }
    catch (e) { if(e && e.code==='BAD_IMAGE') avatarErr=e.message; else throw e; }
  }
  await run('UPDATE users SET nick=?,intro=?,music=?,css=?,css_blog=?,avatar=?,theme=? WHERE id=?',cut((nick||'').trim()||u.nick, 20),(intro||'').slice(0,500),cleanMusic(music),(css||'').slice(0,20000),(css_blog||'').slice(0,20000),avatar,isSkin(req.body.theme)?(req.body.theme||''):'',u.id);
  // 改密碼要先驗舊密碼。
  //
  // ⚠ 原本只要人在電腦前（借用、忘了登出、XSS 拿到一次請求的機會）就能
  // 直接把密碼換掉，帳號當場易主。多驗一次舊密碼，攻擊者光有 session 沒有用。
  if(pass){
    if(!check(await one('SELECT * FROM users WHERE id=?', u.id), req.body.oldpass || '')){
      flash(req,'舊密碼不對，密碼沒有更換，其他設定已儲存');
      return res.redirect(`/${u.name}/settings`);
    }
    if(pass!==pass2){ flash(req,'兩次密碼不一致，其他設定已儲存'); return res.redirect(`/${u.name}/settings`); }
    if(pass.length<4){ flash(req,'密碼至少 4 碼，密碼沒有更換，其他設定已儲存'); return res.redirect(`/${u.name}/settings`); }
    const s=salt(); await run('UPDATE users SET pass=?,salt=? WHERE id=?',hash(pass,s),s,u.id);
    // 換了 salt＝其他裝置的 session 全數失效（見上面 locals 那段）。
    // 自己這一份要跟著更新，不然下一個請求會把操作者本人登出。
    req.session.sv = s.slice(0, 12);
  }
  flash(req, avatarErr ? '設定已儲存，但大頭貼沒有換：'+avatarErr : '設定已儲存'); res.redirect(`/${u.name}/settings`);
});

// ── 我的訂閱（原站側欄的 #boxRssList）────────────────────────────────────
// 原站訂的是站方公告那類外部 RSS，側欄印「來源名（日期）＋ 最新一則標題」。
//
// ⚠ 這是全站唯一一處「伺服器主動去連使用者給的網址」，所以規矩要嚴：
//   1. 只收 http/https，擋掉 file: 與其他協定
//   2. 擋掉指向內網的位址（127.*、10.*、192.168.*、169.254.* 與 localhost）——
//      不擋的話任何人都能拿我們的伺服器去掃內網，這叫 SSRF
//   3. 逾時 6 秒、只讀前 256KB，避免對方餵一條無止盡的串流把行程卡死
//   4. 每個來源最多 30 分鐘抓一次，抓失敗就沿用上一次的結果，側欄不會忽然空掉
const SUB_MAX = 5;

// ===== 逐鍵互斥鎖 =====
// 為什麼需要：「檢查數量再新增」在併發下守不住上限。把兩件事合成一句
// INSERT ... SELECT ... WHERE (SELECT count(*) …) < N 在 SQLite 上有效
// （寫入本來就序列化），但在 **Postgres 上無效**——預設的 READ COMMITTED
// 隔離級別下，同時跑的多句都看不見彼此還沒提交的列，於是同時送 12 個
// 全部通過檢查、12 筆一起進去（實測數字就是 12 與 11）。
//
// 徹底的做法是 (user_id, seq) 唯一索引 + 撞鍵重試，但那要對正式站既有的
// 資料補 seq、而且既有列已經有重複值，加索引會直接失敗。這個站是綁 Volume
// 的單一實例（Railway 的 volume 不能跨區複製，錯誤訊息就是這麼說的），
// 所以同一個行程內序列化就足夠。⚠ 哪天真的要跑多副本，這道鎖就不夠了，
// 那時要改成資料庫層的約束或 advisory lock。
const _locks = new Map();
function withLock(key, fn){
  const prev = _locks.get(key) || Promise.resolve();
  // 不管 fn 成功或失敗都要往下傳，否則一次例外會把這個鍵永遠卡住
  const mine = prev.then(fn, fn);
  // 佇列見底就把鍵刪掉，不然 Map 會隨著使用者數量單向長大
  const done = mine.catch(() => {}).then(() => { if (_locks.get(key) === done) _locks.delete(key); });
  _locks.set(key, done);
  return mine;
}
// SSRF 防護與抓取全部在 src/feed.js（那支的檔頭寫了為什麼「檢查網址字串」不夠）。
// 側欄要用的時候才更新，而且 30 分鐘內不重抓。
// 放在 render 之前 await 會讓每一頁網誌都等外部網站——所以**不等**：
// 這一輪先把上次的結果印出去，順便在背景更新，下一次進來就是新的。
async function refreshSubs(uid){
  const rows = await all('SELECT * FROM subs WHERE user_id=?', uid);
  for(const s of rows){
    if(s.fetched && Date.now() - Date.parse(s.fetched) < 30*60*1000) continue;
    // ⚠ 節流的那一筆 fetched **一定要寫**，不管抓得到抓不到。
    // 原本只有「抓到」與「fetchFeed 回 null」兩條路有寫；只要 fetchFeed
    // 或解析中途拋例外（feed.js 那三個裸識別字就是這樣），整個迴圈就跳出去，
    // fetched 永遠是空的，於是每一次有人打開這個人的網誌頁都重抓一遍——
    // 一個熱門網誌的側欄等於對第三方網站做持續的請求放大，而且每次都白做。
    const now = new Date().toISOString();
    let got = null;
    try { got = await fetchFeed(s.url); }
    catch (e) {
      // 單一來源壞掉不能拖垮其他來源，也不能靜靜吞掉——這個 bug 就是
      // 因為兩個呼叫端都寫 .catch(()=>{}) 才在站上活了這麼久沒人發現。
      console.error('[subs] 抓不到', s.url, e.message);
    }
    if(got) await run('UPDATE subs SET last_title=?,last_url=?,last_date=?,fetched=? WHERE id=?',
      got.title, got.url, got.date, now, s.id);
    else await run('UPDATE subs SET fetched=? WHERE id=?', now, s.id);
  }
}
site.post('/subs',requireLogin,requireOwner,async (req,res)=>{
  const u=U(res), title=cut((req.body.title||'').trim(),30), url=subUrlOk((req.body.url||'').trim());
  // ⚠ 被拒的時候一定要講原因。原本三種失敗（沒填名稱、網址不合法、超過上限）
  // 都是靜靜地 302 回原頁，使用者只看到「什麼都沒發生」，
  // 完全不知道是自己打錯還是站壞了。
  if(!title) flash(req,'請填來源名稱');
  else if(!url) flash(req,'網址不能用：只收 http/https，而且不能指向內部位址');
  else {
    // ⚠ 上限要在**同一句 SQL 裡**檢查，不能先 SELECT count 再 INSERT。
    // 讀完到寫入之間有空隙，同時送兩個表單（或按兩下）就能一起通過檢查、
    // 一起寫進去，於是實際筆數超過上限。這是稽核在 /subs 與 /folders
    // 兩處都抓到的同一個型態。INSERT ... SELECT ... WHERE 兩個驅動都支援，
    // 靠回傳的 changes 知道有沒有被上限擋下來。⚠ 光是這一句在 Postgres 上
    // **還不夠**（見 withLock 的註解），所以外面再包一道逐使用者的互斥鎖。
    const r = await withLock('subs:'+u.id, () => run(
      'INSERT INTO subs(user_id,title,url) SELECT ?,?,? WHERE (SELECT count(*) FROM subs WHERE user_id=?) < ?',
      u.id, title, url, u.id, SUB_MAX));
    if (!r.changes) flash(req,`訂閱最多 ${SUB_MAX} 個，請先取消一個`);
    else {
      refreshSubs(u.id).catch(e=>console.error('[subs]',e.message));     // 不擋這一次的回應
      flash(req,'訂閱好了，下次進網誌頁就會去抓最新一則');
    }
  }
  res.redirect(`/${u.name}/settings#subs`);
});
site.post('/subs/:id/del',requireLogin,requireOwner,async (req,res)=>{
  await run('DELETE FROM subs WHERE id=? AND user_id=?',req.params.id,U(res).id);
  res.redirect(`/${U(res).name}/settings#subs`);
});

// 網誌側欄的自訂欄位（原站的 #boxFolder，可以有很多個）。
// 原站能塞任意 HTML；我們照契約 §4-4 一律逸出，內容走站上通用的 render()
// （[img] [b] 連結那套），所以貼得進去圖片與連結，貼不進去 <script>。
// 上限 8 個：原站沒有上限，但側欄只有 200px 寬，再多就變成一條沒有盡頭的長廊。
const FOLDER_MAX = 8;
site.post('/folders',requireLogin,requireOwner,async (req,res)=>{
  const u=U(res), title=cut((req.body.title||'').trim(),30), body=(req.body.body||'').slice(0,5000);
  // 被拒時要講原因，不要靜靜地把使用者送回原頁（同 /subs 的理由）
  if(!title) flash(req,'請填欄位標題');
  else {
    // 上限與 seq 都在同一句 SQL 裡算，外面再包一道 withLock（理由見上面）。
    // ⚠ 上限是硬的，seq 不是：Postgres 的預設隔離級別下，同時跑的兩句
    // 看不見彼此還沒提交的列，所以併發新增仍然可能拿到一樣的 seq
    // （實測 12 個併發 → 8 筆、只有 5 個不同的 seq）。這不影響正確性，
    // 因為兩處讀取都是 `ORDER BY seq,id`，id 是決勝條件、順序仍然固定。
    const r = await withLock('folders:'+u.id, () => run(
      `INSERT INTO folders(user_id,title,body,seq)
       SELECT ?,?,?,(SELECT COALESCE(max(seq),0)+1 FROM folders WHERE user_id=?)
       WHERE (SELECT count(*) FROM folders WHERE user_id=?) < ?`,
      u.id, title, body, u.id, u.id, FOLDER_MAX));
    if (!r.changes) flash(req,`自訂欄位最多 ${FOLDER_MAX} 塊，請先刪掉一塊`);
    else flash(req,'欄位新增好了，去網誌頁看看側欄');
  }
  res.redirect(`/${u.name}/settings#folders`);
});
site.post('/folders/:id/edit',requireLogin,requireOwner,async (req,res)=>{
  const u=U(res);
  await run('UPDATE folders SET title=?,body=? WHERE id=? AND user_id=?',
    (req.body.title||'').trim().slice(0,30)||'自訂欄位',(req.body.body||'').slice(0,5000),req.params.id,u.id);
  res.redirect(`/${u.name}/settings#folders`);
});
site.post('/folders/:id/del',requireLogin,requireOwner,async (req,res)=>{
  await run('DELETE FROM folders WHERE id=? AND user_id=?',req.params.id,U(res).id);
  res.redirect(`/${U(res).name}/settings#folders`);
});
// 徹底刪掉一個帳號。**兩條路徑共用這一支**（站長在後台刪、使用者自己刪）。
//
// ⚠ 分成兩份寫是這個功能出過的最大問題：後台那條補了清理、自刪那條沒補，
// 稽核報告直接把它列成「只修一半」。共用之後就不可能再分岔。
//
// 要清的不只是 users 那一列：
//   friends / visitors  **沒有外鍵**（user_id 只是 INTEGER），不清會留孤兒列，
//                       別人的頁面還寫「好友 N 人」、「誰來我家」連到 404 的帳號，
//                       而且啟動時的分組搬移會被它絆倒（正式站為此掛過兩次）。
//   guestbook / comments 的 author_id 指向這個人。**SQLite 會重用被刪掉的 id**，
//                       下一個註冊的人就繼承了這些留言——別人的留言板上
//                       會出現冒名的頭像與連結。所以要把參照打成 NULL。
async function purgeUser(id){
  for(const p of await all('SELECT p.url,p.thumb FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=?',id)){
    await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); }
  const u=await one('SELECT name,avatar FROM users WHERE id=?',id);
  if(u?.avatar && u.avatar!=='/img/avatar.png') await remove(u.avatar);
  await run('DELETE FROM friends WHERE user_id=? OR friend_id=?',id,id);
  if(u?.name) await run('DELETE FROM visitors WHERE who=?',u.name);
  await run('UPDATE guestbook SET author_id=NULL WHERE author_id=?',id);
  await run('UPDATE comments SET author_id=NULL WHERE author_id=?',id);
  await run('DELETE FROM users WHERE id=?',id);
}

// 刪除自己的帳號（需再次輸入密碼），連同照片一起清掉
site.post('/settings/delete',requireLogin,requireOwner,async(req,res)=>{
  const u=await one('SELECT * FROM users WHERE id=?',U(res).id);
  if(!check(u,req.body.pass||'')){ flash(req,'密碼錯誤，帳號未刪除'); return res.redirect(`/${u.name}/settings`); }
  await purgeUser(u.id);
  req.session.destroy(()=>res.redirect('/'));
});
// 好友
site.post('/friend',requireLogin,async (req,res)=>{ const me=res.locals.me.id,u=U(res).id;
  if(me!==u){ if(await isFriend(me,u)) await run('DELETE FROM friends WHERE user_id=? AND friend_id=?',me,u);
              // group_id=0 是預設組（原站的 Default group）。一定要一起寫進去——
              // 分組現在以 group_id 為準，只寫舊的 grp 字串的話，
              // 名片頁與好友頁看到的分組會對不起來。
              else await run("INSERT OR IGNORE INTO friends(user_id,friend_id,grp,group_id) VALUES(?,?,?,0)",me,u,(req.body.grp||'好友').trim().slice(0,10)||'好友'); }
  res.redirect('/'+U(res).name); });
// 好友分類（當年好友名單可以分組）
// 把某位好友換到某一組。req.body.group_id 是分組 id，0＝預設組。
// ⚠ 一定要驗那一組**是這個人自己的**——不驗的話，隨便填一個別人的分組 id
// 就能把自己的好友掛到別人的分組上，畫面上還看得到別人的分組名。
site.post('/friends/:fid/group',requireLogin,requireOwner,async (req,res)=>{
  const uid=U(res).id, gid=+req.body.group_id||0;
  const ok = gid===0 || !!await one('SELECT 1 FROM friend_groups WHERE id=? AND user_id=?',gid,uid);
  if(ok) await run('UPDATE friends SET group_id=? WHERE user_id=? AND friend_id=?',gid,uid,req.params.fid);
  res.redirect(`/${U(res).name}/friends`); });

// 分組本身的增／改名／刪。原站的分組是一等公民（#cateSelect 的 value 是 group id），
// 改名一次全組跟著改——這正是「把組名存在每一筆好友身上」做不到的事。
const FGROUP_MAX = 20;
site.post('/friendgroups',requireLogin,requireOwner,async (req,res)=>{
  const uid=U(res).id, name=(req.body.name||'').trim().slice(0,20);
  if(name && (await one('SELECT count(*) c FROM friend_groups WHERE user_id=?',uid)).c < FGROUP_MAX
      && !await one('SELECT 1 FROM friend_groups WHERE user_id=? AND name=?',uid,name))
    await run('INSERT INTO friend_groups(user_id,name,ord) VALUES(?,?,?)',uid,name,0);
  res.redirect(`/${U(res).name}/friends`); });
site.post('/friendgroups/:id/edit',requireLogin,requireOwner,async (req,res)=>{
  const name=(req.body.name||'').trim().slice(0,20);
  if(name) await run('UPDATE friend_groups SET name=? WHERE id=? AND user_id=?',name,req.params.id,U(res).id);
  res.redirect(`/${U(res).name}/friends`); });
site.post('/friendgroups/:id/del',requireLogin,requireOwner,async (req,res)=>{
  const uid=U(res).id;
  // 刪組不刪人：組裡的好友退回預設組（原站的 Default group）。
  // ⚠ 順序要**先刪組再掃孤兒**。反過來的話，在 UPDATE 與 DELETE 之間有人
  // 把好友換進這一組，那筆 group_id 就會指向一個已經不存在的分組——
  // 篩選條件比對的是 group_id，孤兒值既不等於 0 也不等於任何現存分組，
  // **那位好友會從所有分組頁消失**（稽核實測 5 次全中）。
  await run('DELETE FROM friend_groups WHERE id=? AND user_id=?',req.params.id,uid);
  // 掃掉指向已刪分組的孤兒值（不只這一組，順手把歷史殘留一起修好）
  await run('UPDATE friends SET group_id=0 WHERE user_id=? AND COALESCE(group_id,0)<>0'
    + ' AND NOT EXISTS (SELECT 1 FROM friend_groups g WHERE g.id=friends.group_id)',uid);
  res.redirect(`/${U(res).name}/friends`); });
site.get('/card',async (req,res)=>res.render('card',{nav:'card',
  // 收到的禮物顯示在名片頁（原站的送禮物就是掛在個人資料上）
  gifts:await all(`SELECT g.kind,g.msg,g.created,u2.name fname,u2.nick fnick
    FROM gifts g JOIN users u2 ON u2.id=g.from_id WHERE g.to_id=? ORDER BY g.id DESC LIMIT 12`,U(res).id),
  giftKinds:GIFTS,
  zodiacs:ZODIACS,bloods:BLOODS,sexes:SEXES,cities:CITIES,
  visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  // #friendlist 是分組下拉（optgroup label＝好友分類），所以一定要把 grp 帶出來；
  // 原站那顆 select 是「全部好友」不是前 12 位，這裡只留一個防爆上限。
  friends:await all(`SELECT u.name,u.nick,u.avatar,${GRP_NAME} grp FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u.name LIMIT 300`,U(res).id)}));
// ===== 送禮物 =====
// 原站在 bill.wretch.cc/gift.php?to=<帳號>（WRETCH_SPEC.md §6），那是**付費網域**。
// 我們沒有金流也不打算接，但「送一份禮物給某個人」這件事本身不需要收錢——
// 少做的理由只有金流，功能沒有理由跟著少。所以照做，禮物是站上自己的圖示，一律免費。
//
// 禮物會出現在對方的名片頁，並送一則系統訊息通知他。
const GIFTS = [
  ['flower', '花'], ['cake', '蛋糕'], ['coffee', '咖啡'],
  ['heart', '愛心'], ['star', '星星'], ['gift', '禮物盒'],
];
const isGift = k => GIFTS.some(g => g[0] === k);
site.post('/gift',requireLogin,async (req,res)=>{
  const u=U(res), me=res.locals.me;
  if(me.id===u.id)
    return res.status(400).render('msg',{title:'送不出去',msg:'不能送禮物給自己啦。',back:'/'+u.name+'/card'});
  const kind=isGift(req.body.kind)?req.body.kind:'flower';
  const msg=(req.body.msg||'').trim().slice(0,60);
  await run('INSERT INTO gifts(to_id,from_id,kind,msg) VALUES(?,?,?,?)',u.id,me.id,kind,msg);
  // 對方要知道有人送他東西，不然禮物躺在名片頁沒人發現
  const label=(GIFTS.find(g=>g[0]===kind)||GIFTS[0])[1];
  await run('INSERT INTO sysmsg(user_id,title,body) VALUES(?,?,?)',
    u.id,'有人送你一份禮物',`${me.nick} 送了你一個${label}${msg?'，並說：'+msg:'。'}`);
  flash(req,`送出了一個${label}`);
  res.redirect('/'+u.name+'/card');
});

site.post('/card',requireLogin,requireOwner,async (req,res)=>{
  const b=req.body, cut=(v,n)=>String(v||'').trim().slice(0,n);
  await run('UPDATE users SET realname=?,sex=?,birthday=?,zodiac=?,blood=?,city=?,job=?,school=?,hobby=?,motto=?,msn=?,homepage=? WHERE id=?',
    cut(b.realname,20), SEXES.includes(b.sex)?b.sex:'', /^\d{4}-\d{2}-\d{2}$/.test(b.birthday||'')?b.birthday:'',
    ZODIACS.includes(b.zodiac)?b.zodiac:'', BLOODS.includes(b.blood)?b.blood:'', CITIES.includes(b.city)?b.city:'',
    cut(b.job,20), cut(b.school,30), cut(b.hobby,100), cut(b.motto,100), cut(b.msn,50),
    (()=>{ try{ const x=String(b.homepage||'').trim(); if(!x) return ''; return ['http:','https:'].includes(new URL(x).protocol)?x.slice(0,200):''; }catch{ return ''; } })(),
    U(res).id);
  flash(req,'名片已儲存'); res.redirect(`/${U(res).name}/card`);
});
// ===== 好友 =====
// 原站 friend/<帳號> 用 &c=0..3 切四種關係（#condition 的 #current_tag0..3）：
//   0 我的好友        1 誰加我為好友     2 互相是好友      3 好友的好友
// friends 是雙向邊（user_id→friend_id），配上既有的 idx_friends_rev
// 這四種都算得出來，不需要多加欄位。
// 一頁 25 人：原始檔 gb_friend_a000001_20131226.html 的頁首 JS 寫死 paginator='25'。
const FRIEND_PER = 25;
const FRIEND_RELS = ['我的好友','誰加我為好友','互相是好友','好友的好友'];
function friendQuery(uid, rel, cate, q){
  const args=[]; let from, where, grp;
  if(rel===1){                       // 誰加我為好友：反向邊
    from='FROM friends f JOIN users u ON u.id=f.user_id';
    where='f.friend_id=?'; args.push(uid); grp="'好友'";
  } else if(rel===2){                // 互相：正向邊存在，且反向邊也存在
    from='FROM friends f JOIN users u ON u.id=f.friend_id '
       + 'JOIN friends b ON b.user_id=f.friend_id AND b.friend_id=f.user_id';
    where='f.user_id=?'; args.push(uid); grp=GRP_NAME;
  } else if(rel===3){                // 好友的好友：兩跳，扣掉自己與已經是好友的人
    from='FROM friends f JOIN friends g ON g.user_id=f.friend_id JOIN users u ON u.id=g.friend_id';
    where='f.user_id=? AND g.friend_id<>? AND g.friend_id NOT IN (SELECT friend_id FROM friends WHERE user_id=?)';
    args.push(uid,uid,uid); grp="'好友的好友'";
  } else {                           // 我的好友
    from='FROM friends f JOIN users u ON u.id=f.friend_id';
    where='f.user_id=?'; args.push(uid); grp=GRP_NAME;
  }
  // 分類只有「我加的」那兩種關係才有意義。
  // cate 是**分組 id**（原站 #cateSelect 的 option value 就是 group id，
  // 0＝Default group、-1＝全部），不是分組名。
  // ⚠ 「預設組」要把**孤兒值**也算進去：分組被刪掉之後，指向它的 group_id
  // 既不等於 0 也不等於任何現存分組，那位好友會從所有分組頁消失。
  // 寫入端已經會掃孤兒，這裡是讀取端的保險（也順便讓歷史殘留看得見）。
  if(cate!=='' && (rel===0||rel===2)){
    if((+cate||0)===0)
      where+=' AND (COALESCE(f.group_id,0)=0'
           + ' OR NOT EXISTS (SELECT 1 FROM friend_groups g2 WHERE g2.id=f.group_id))';
    else { where+=' AND COALESCE(f.group_id,0)=?'; args.push(+cate); }
  }
  // #searchInput 原站只搜帳號（js_lang_searchTip = 'Search ID'），照做
  if(q){ where+=" AND u.name LIKE ? ESCAPE '\\'"; args.push(likeArg(q)); }
  return {from,where,grp,args};
}
site.get('/friends',async (req,res)=>{
  const uid=U(res).id;
  const rel=[0,1,2,3].includes(+req.query.c)?+req.query.c:0;
  // cateSelect 是分組 id：'' 或 '-1' 都代表全部，'0' 是預設組（原站的 Default group）
  const cateRaw=(req.query.cateSelect||'').trim().slice(0,10);
  const cate=/^-?\d+$/.test(cateRaw)?cateRaw:'';
  const q=(req.query.search_id||'').trim().slice(0,20);
  const page=pageNo(req.query.p);
  const {from,where,grp,args}=friendQuery(uid,rel,cate==='-1'?'':cate,q);
  // 好友的好友會透過不同的共同好友重複撈到同一個人，一定要 DISTINCT；
  // 也因為 DISTINCT，排序只能用 SELECT 出來的欄位（PG 會擋 f.created）。
  const total=(await one(`SELECT count(*) c FROM (SELECT DISTINCT u.id ${from} WHERE ${where}) t`,...args)).c;
  const rows=await all(
    `SELECT DISTINCT u.id,u.name,u.nick,u.avatar,u.intro,u.vip,${grp} grp ${from} WHERE ${where}
     ORDER BY grp, u.name LIMIT ? OFFSET ?`, ...args, FRIEND_PER, (page-1)*FRIEND_PER);
  const count=async r=>{ const x=friendQuery(uid,r,'','');
    return (await one(`SELECT count(*) c FROM (SELECT DISTINCT u.id ${x.from} WHERE ${x.where}) t`,...x.args)).c; };
  res.render('friends',{nav:'user',
    rel, relName:FRIEND_RELS[rel], cate, q, page, per:FRIEND_PER, total,
    pages:Math.ceil(total/FRIEND_PER),
    rows,
    friends:rows,     // 舊名，view 換過來之前先留著
    // #cateSelect 的選項：本站沒有 group 表，option value 直接放分類名，-1＝全部
    // #cateSelect 的選項。原站 option value 是分組 id，0＝Default group、-1＝全部
    // （gb_friend_a000000000aa_20131225.html:187）。這裡照做。
    // 預設組要單獨算：它沒有 friend_groups 那一列，group_id 就是 0。
    groups:[
      ...await all(`SELECT g.id, g.name,
          (SELECT count(*) FROM friends f WHERE f.user_id=g.user_id AND f.group_id=g.id) n
        FROM friend_groups g WHERE g.user_id=? ORDER BY g.ord, g.id`,uid),
      { id:0, name:'預設分類',
        n:(await one('SELECT count(*) c FROM friends WHERE user_id=? AND COALESCE(group_id,0)=0',uid)).c },
    ],
    counts:{ mine:await count(0), fans:await count(1), mutual:await count(2), fof:await count(3) },
    // fans 是舊 view 那一整塊「誰加我為好友」。切了頁籤或下了篩選之後再印一份
    // 沒篩過的名單會自相矛盾（畫面上明明篩掉了，下面又整批列出來），所以只在
    // 預設、沒篩選的情況下才給。新 view 一律看 rows。
    fans:(rel===0 && !cate && !q)
      ? await all('SELECT u.name,u.nick,u.avatar FROM friends f JOIN users u ON u.id=f.user_id WHERE f.friend_id=? ORDER BY f.created DESC LIMIT 200',uid)
      : []});
});
// 原站的搜尋表單是 method="post" action="/friend/<帳號>"。
// 我們的清單是 GET（可加書籤、可分頁），所以 POST 進來就換成 query 再導回去。
site.post('/friends',(req,res)=>{
  const p=new URLSearchParams();
  if(req.body.c) p.set('c',req.body.c);
  if(req.body.cateSelect && req.body.cateSelect!=='-1') p.set('cateSelect',req.body.cateSelect);
  if(req.body.search_id) p.set('search_id',req.body.search_id);
  res.redirect(`/${U(res).name}/friends${p.toString()?'?'+p:''}`);
});

// 相簿
site.get('/album',async (req,res)=>{
  const page=pageNo(req.query.p), per=20;    // 無名一頁 20 本（5x4）
  const total=(await one('SELECT count(*) c FROM albums WHERE user_id=?',U(res).id)).c;
  res.render('album',{nav:'album',topics:ALBUM_TOPICS,places:PLACES,
    page,pages:Math.ceil(total/per),total,
    quota:{used:await usedBytes(U(res).id),total:USER_QUOTA,mb:MB},
    albums:await hideLockedCovers(req,res,await all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?`,U(res).id,per,(page-1)*per))});
});
site.post('/album',requireLogin,requireOwner,async (req,res)=>{ const t=(req.body.title||'').trim().slice(0,40); if(t) await run('INSERT INTO albums(user_id,title,descr,pass,topic,place,friends_only) VALUES(?,?,?,?,?,?,?)',U(res).id,t,(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20),isAlbumTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'',req.body.friends_only?1:0); res.redirect(`/${U(res).name}/album`); });
// ⚠ 先擋掉非數字的 :id 再查資料庫。
// `/album/rss` 這種**同一層的具名路由**如果註冊在 `/album/:id` 後面，就會先被
// 這一支接走、把 'rss' 當成相簿編號送進 SQL：SQLite 只是靜靜回空（看起來像 404），
// **Postgres 會直接拋 invalid input syntax for integer 變成 500**——本機測不出來，
// 只有正式站會爆。tools/linksweep.mjs 就是這樣抓到 /:name/album/rss 全站 500 的。
const albumOf=async (req,res,next)=>{ if(!/^[0-9]+$/.test(req.params.id)) return next('route'); const a=await one('SELECT * FROM albums WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!a) return next('route'); res.locals.album=a; next(); };
const albumUnlocked=(req,res)=>!res.locals.album.pass||res.locals.isOwner||(req.session.unlocked||[]).includes(res.locals.album.id);
// 好友限定（無名的「好友保護」）：只有站主本人與被站主加為好友的人看得到
const albumAllowed=async (req,res)=>{
  const a=res.locals.album;
  if(!a.friends_only || res.locals.isOwner) return true;
  return !!(res.locals.me && await isFriend(U(res).id, res.locals.me.id));
};

// ⚠ 相簿清單上的**封面**要跟著權限走。
// 相簿頁、幻燈片、相片牆、照片頁四個入口都擋對了，但站主的相簿清單
// （/:name/album）與小站首頁（/:name）是直接把 a.cover 印出來——
// 於是上鎖與好友限定相簿的封面縮圖對任何未登入的人都是公開的。
// 更糟的是縮圖與大圖的檔名只差一個 `_t`，而 /uploads 是 express.static
// 直出、不查權限，所以拿到縮圖網址就等於拿到 1024px 大圖（稽核實測 200）。
//
// 這裡不把相簿藏起來——原站鎖住的相簿仍然會列出名稱加一個鎖頭圖示，
// 藏起來反而不像原站。只是把封面換成通用的預設圖。
//
// 大圖可由縮圖網址推得這件事，是 /uploads 這條靜態路徑的結構問題，
// 要徹底解決得讓私密檔案走一支會查權限的路由；這一版先把網址不外流。
async function hideLockedCovers(req, res, rows){
  if (res.locals.isOwner) return rows;
  const locked = rows.filter(a => a.pass || a.friends_only);
  if (!locked.length) return rows;
  const friend = res.locals.me ? await isFriend(U(res).id, res.locals.me.id) : false;
  const unlocked = req.session.unlocked || [];
  for (const a of locked){
    const okFriend = !a.friends_only || friend;
    const okPass   = !a.pass || unlocked.includes(a.id);
    if (!(okFriend && okPass)) a.cover = '';
  }
  return rows;
}
site.get('/album/:id',albumOf,async (req,res)=>{
  const a=res.locals.album;
  if(!await albumAllowed(req,res)) return res.status(403).render('msg',{title:'好友限定',msg:'這本相簿是好友限定，只有 '+U(res).nick+' 的好友才看得到。',back:'/'+U(res).name+'/album'});
  if(!albumUnlocked(req,res)) return res.render('album_lock',{nav:'album',album:a,err:null});
  if(!res.locals.isOwner) await run('UPDATE albums SET views=views+1 WHERE id=?',a.id);
  // 單本相簿的照片要分頁。原站的縮圖列網址帶 `&page=1`
  // （assets_src2/html/album_show_zh_kellyla.html 的 urlPhotoList），
  // 我們原本一次把整本吐出來——照片多的相簿會變成一張長到看不完的頁。
  // 「一頁瀏覽」（?all=1）是原站本來就有的另一種模式，那一種才不分頁。
  const viewAll = req.query.all==='1';
  const per = 20, page = pageNo(req.query.p);
  const total = (await one('SELECT count(*) c FROM photos WHERE album_id=?',a.id)).c;
  res.render('photos',{nav:'album',album:a,topics:ALBUM_TOPICS,places:PLACES,
    viewAll,
    page, per, total, pages: Math.max(1, Math.ceil(total/per)),
    photos: viewAll
      ? await all('SELECT * FROM photos WHERE album_id=? ORDER BY id',a.id)
      : await all('SELECT * FROM photos WHERE album_id=? ORDER BY id LIMIT ? OFFSET ?',a.id,per,(page-1)*per)});
});
// 幻燈片（無名相簿的「幻燈片」）
site.get('/album/:id/slide',albumOf,async (req,res)=>{
  const a=res.locals.album;
  if(!await albumAllowed(req,res)||!albumUnlocked(req,res)) return res.redirect(`/${U(res).name}/album/${a.id}`);
  const photos=await all('SELECT id,url,thumb,caption FROM photos WHERE album_id=? ORDER BY id',a.id);
  if(!photos.length) return res.redirect(`/${U(res).name}/album/${a.id}`);
  res.render('slide',{nav:'album',album:a,photos,start:Math.max(1,Math.min(photos.length,+req.query.i||1))});
});
// 相片牆（原站 album/display.php?style=angel|taylor，單本相簿的 #photowall 兩顆連結）。
// 原站是 VIP 限定，我們沒有付費制度，所有人都能看；權限沿用相簿本身那三道
// （好友限定、密碼、站主），不另開後門。
site.get('/album/:id/wall',albumOf,async (req,res)=>{
  const a=res.locals.album;
  if(!await albumAllowed(req,res)||!albumUnlocked(req,res)) return res.redirect(`/${U(res).name}/album/${a.id}`);
  res.render('photowall',{nav:'album',album:a,
    style: req.query.style==='angel' ? 'angel' : 'taylor',   // angel＝馬賽克、taylor＝瀑布
    photos:await all('SELECT id,url,thumb,caption,width,height FROM photos WHERE album_id=? ORDER BY id',a.id)});
});
site.post('/album/:id/unlock',albumOf,(req,res)=>{
  const a=res.locals.album;
  if(rateHit(req,'album'+a.id)) return res.status(429).render('album_lock',{nav:'album',album:a,err:rateMsg});
  if(req.body.pass===a.pass){ rateClear(req,'album'+a.id); req.session.unlocked=[...(req.session.unlocked||[]),a.id]; return res.redirect(`/${U(res).name}/album/${a.id}`); }
  res.render('album_lock',{nav:'album',album:a,err:'密碼錯誤'});
});
site.post('/album/:id/edit',requireLogin,requireOwner,albumOf,async (req,res)=>{ await run('UPDATE albums SET title=?,descr=?,pass=?,topic=?,place=?,friends_only=? WHERE id=?',cut((req.body.title||'').trim()||res.locals.album.title, 40),(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20),isAlbumTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'',req.body.friends_only?1:0,res.locals.album.id); res.redirect(`/${U(res).name}/album/${res.locals.album.id}`); });
// ⚠ 順序是「先刪資料庫的列，再刪檔案」，不能反過來。
// 反過來寫的話，只要 DELETE 因為任何原因失敗（連線斷、鎖、外鍵），
// 列還在、檔案已經沒了 → 相簿裡整排破圖，而且救不回來。
// 現在這個順序最壞的情況是留下沒人參照的檔案：浪費磁碟，但畫面是對的，
// 而且掃一次就能清掉。兩害相權取其輕。
site.post('/album/:id/del',requireLogin,requireOwner,albumOf,async(req,res)=>{
  const id=res.locals.album.id;
  const files=await all('SELECT url,thumb FROM photos WHERE album_id=?',id);
  await run('DELETE FROM albums WHERE id=?',id);
  for(const p of files){
    // 單一檔案刪不掉不該讓整個請求變成 500——列已經刪了，畫面是對的。
    await remove(p.url).catch(()=>{});
    if(p.thumb&&p.thumb!==p.url) await remove(p.thumb).catch(()=>{});
  }
  res.redirect(`/${U(res).name}/album`);
});
site.post('/album/:id/upload',requireLogin,requireOwner,albumOf,upload.array('photos',20),async(req,res)=>{
  const a=res.locals.album; let first=null;
  const files=req.files||[];
  const incoming=files.reduce((n,f)=>n+f.size,0);
  const err=await quotaError(U(res).id,incoming);
  if(err) return res.status(413).render('msg',{title:'空間不足',msg:err,back:`/${U(res).name}/album/${a.id}`});
  // save() 回傳的尺寸與 EXIF 要一起寫進來，照片頁的 #exif 面板才有東西可印。
  // ⚠ 讀不懂的檔案（偽造 MIME 的文字檔、執行檔、像素炸彈）會拋 BadImage，
  // **一個位元組都不要落地、也不要寫進資料庫**。一批裡有壞的就只跳過那一張，
  // 其餘照收——不要因為一張壞圖讓整批上傳白費。
  let okN = 0; const rejected = [...(req.droppedFiles || [])];   // fileFilter 擋掉的也要講
  for(const f of files){
    let s;
    try { s = await save(f); }
    catch (e) {
      if (e && e.code === 'BAD_IMAGE') { rejected.push(`${fname(f)}：${e.message}`); continue; }
      throw e;
    }
    // ⚠ 檔案已經落地了，這時 INSERT 還是有可能失敗——最典型的是**相簿在
    // 上傳進行到一半時被刪掉**（自己開兩個分頁、或刪除與上傳同時送出）：
    // album_id 指向一個已經不存在的列，外鍵擋下來，整個請求變成 500，
    // 而剛寫進去的原圖與縮圖沒有人參照，就永遠留在磁碟上。
    // 接住它：把這一張的檔案清掉，當成「這張收不了」，其餘照收。
    try {
      await run('INSERT INTO photos(album_id,url,thumb,caption,bytes,width,height,taken,camera) VALUES(?,?,?,?,?,?,?,?,?)',
        a.id,s.url,s.thumb,cut(req.body.caption||'',100),s.bytes,s.width||0,s.height||0,s.taken||'',s.camera||'');
    } catch (e) {
      await remove(s.url).catch(()=>{});
      if (s.thumb && s.thumb !== s.url) await remove(s.thumb).catch(()=>{});
      rejected.push(`${fname(f)}：這本相簿已經不在了`);
      continue;
    }
    if(!first) first=s.thumb; okN++; }
  if(first && !a.cover) await run('UPDATE albums SET cover=? WHERE id=?',first,a.id);
  if(first) await act(U(res).id,'album',a.title,`/${U(res).name}/album/${a.id}`);
  // 訊息要講**實際成功的張數**，不是收到幾個檔。
  // 原本印 req.files.length，於是整批都是壞檔時照樣說「上傳了 3 張照片」，
  // 使用者回相簿頁看到空的還以為是站壞了。
  flash(req, rejected.length
    ? `上傳了 ${okN} 張照片；${rejected.length} 個檔案不能收（${rejected.slice(0,3).join('、')}）`
    : `上傳了 ${okN} 張照片`);
  res.redirect(`/${U(res).name}/album/${a.id}`);
});
site.get('/photo/:pid',async (req,res,next)=>{
  const p=await one('SELECT p.*,a.pass,a.friends_only,a.title atitle,a.id aid FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(!p) return next();
  res.locals.album={id:p.aid,pass:p.pass,friends_only:p.friends_only};
  if(!await albumAllowed(req,res)||!albumUnlocked(req,res)) return res.redirect(`/${U(res).name}/album/${p.aid}`);
  if(!res.locals.isOwner) await run('UPDATE photos SET views=views+1 WHERE id=?',p.id);
  const ids=(await all('SELECT id FROM photos WHERE album_id=? ORDER BY id',p.aid)).map(x=>x.id), i=ids.indexOf(p.id);
  res.render('photo',{nav:'album',p,
    first:ids[0],last:ids[ids.length-1],prev:ids[i-1],next:ids[i+1],idx:i+1,total:ids.length,
    strip:await all('SELECT id,thumb,url,caption FROM photos WHERE album_id=? ORDER BY id',p.aid),
    comments:await all('SELECT * FROM photo_comments WHERE photo_id=? ORDER BY id',p.id)});
});
// ⚠ 這一支要查**兩種**權限，只查密碼是不夠的。
// 相簿頁／幻燈片／相片牆／照片頁四個入口都同時查 albumUnlocked（密碼）
// 與 albumAllowed（好友限定），唯獨這裡只查了密碼——
// 於是非好友雖然看不到好友限定相簿的照片，**卻留得了言**（多代理稽核實測寫得進去）。
site.post('/photo/:pid/comment',async (req,res)=>{ const p=await one('SELECT p.id,p.album_id,a.pass,a.friends_only FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(!p) return res.redirect('/'+U(res).name+'/album'); res.locals.album={id:p.album_id,pass:p.pass,friends_only:p.friends_only}; if(!await albumAllowed(req,res)) return res.status(403).render('msg',{title:'好友限定',msg:'這本相簿是好友限定，只有 '+U(res).nick+' 的好友才留得了言。',back:'/'+U(res).name+'/album'}); if(!albumUnlocked(req,res)) return res.status(403).render('msg',{title:'沒有權限',msg:'相簿已上鎖',back:'/'+U(res).name+'/album'}); if(req.body.body?.trim()) await run('INSERT INTO photo_comments(photo_id,author,body) VALUES(?,?,?)',p.id,cut(res.locals.me?.nick||req.body.author||'訪客', 20),req.body.body.trim().slice(0,300)); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
// ── 切割照片（原站照片頁工具列那顆「切割照片(NEW)」）────────────────────
// 零存檔：assets_src2/spec/shot.md:493 的截圖逐字轉寫看得到這顆按鈕
// （2012 英文版工具列「搜尋更多 切割照片(NEW) Report this Picture」），
// 但整個切割介面連一份 HTML 都沒有存下來，所以下面的頁面是自製的，
// 只有工具列那顆按鈕與 .newVideoUpdate 紅 NEW 章照 2013 中文版存檔的寫法。
//
// 行為：裁切**覆蓋原圖**，跟原站一樣（原站沒有「另存新檔」的說法）。
// 舊檔案裁完就刪掉，不然每裁一次就多留一份沒人指向的檔案。
site.get('/photo/:pid/crop',requireLogin,requireOwner,async (req,res,next)=>{
  const p=await one(`SELECT p.*,a.title atitle,a.id aid FROM photos p JOIN albums a ON a.id=p.album_id
    WHERE p.id=? AND a.user_id=?`,req.params.pid,U(res).id);
  if(!p) return next();
  res.render('photo_crop',{nav:'album',p});
});
site.post('/photo/:pid/crop',requireLogin,requireOwner,async (req,res)=>{
  const u=U(res);
  const p=await one(`SELECT p.* FROM photos p JOIN albums a ON a.id=p.album_id
    WHERE p.id=? AND a.user_id=?`,req.params.pid,u.id);
  if(!p) return res.redirect(`/${u.name}/album`);
  const back=`/${u.name}/photo/${p.id}`;
  const n=v=>Math.max(0,Math.round(+v||0));
  const x=n(req.body.x), y=n(req.body.y), w=n(req.body.w), h=n(req.body.h);
  // 太小的框直接退回。裁到 1×1 沒有意義，而且很容易是誤觸。
  if(w<16||h<16){ flash(req,'切割範圍太小了'); return res.redirect(back); }
  try{
    const sharp=(await import('sharp')).default;
    const src=await readImage(p.url);
    const meta=await sharp(src).metadata();
    // 夾在原圖範圍內：前端傳來的數字不可信，超出邊界 sharp 會直接拋錯
    const cw=Math.min(w, (meta.width||0)-x), chh=Math.min(h, (meta.height||0)-y);
    if(cw<16||chh<16){ flash(req,'切割範圍超出照片了'); return res.redirect(back); }
    const buf=await sharp(src).extract({left:x,top:y,width:cw,height:chh}).jpeg({quality:88}).toBuffer();
    const saved=await save({buffer:buf,mimetype:'image/jpeg'});
    const oldUrl=p.url, oldThumb=p.thumb;
    await run('UPDATE photos SET url=?,thumb=?,width=?,height=?,bytes=? WHERE id=?',
      saved.url,saved.thumb,saved.width,saved.height,saved.bytes,p.id);
    // 這張如果剛好是相簿封面，封面也要跟著換，不然封面會指到已刪的檔。
    // ⚠ 封面可能是**大圖也可能是縮圖**：上傳時存的是縮圖（`first=s.thumb`），
    // 但「設為封面」那支存的是大圖（`cover=p.url`）。兩種都要比對，
    // 只比大圖的話，封面是縮圖的相簿在切割之後就變成破圖
    // ——tools/ownerflow.mjs 用真的瀏覽器抓到這個 404。
    await run('UPDATE albums SET cover=? WHERE id=? AND (cover=? OR cover=?)',
      saved.thumb,p.album_id,oldUrl,oldThumb);
    await remove(oldUrl); if(oldThumb&&oldThumb!==oldUrl) await remove(oldThumb);
    flash(req,'照片已切割');
  }catch(e){ console.error(e); flash(req,'切割失敗，照片沒有變動'); }
  res.redirect(back);
});
site.post('/photo/:pid/caption',requireLogin,requireOwner,async (req,res)=>{ await run('UPDATE photos SET caption=? WHERE id=? AND album_id IN (SELECT id FROM albums WHERE user_id=?)',(req.body.caption||'').slice(0,100),req.params.pid,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/cover',requireLogin,requireOwner,async (req,res)=>{ const p=await one('SELECT * FROM photos WHERE id=?',req.params.pid); if(p) await run('UPDATE albums SET cover=? WHERE id=? AND user_id=?',p.url,p.album_id,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/del',requireLogin,requireOwner,async(req,res)=>{ const p=await one('SELECT p.* FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(p){ await run('DELETE FROM photos WHERE id=?',p.id);
  // 先刪列再刪檔（理由見 /album/:id/del 上面那段）。刪不掉檔案只是留下孤兒，
  // 反過來則是列還在、圖沒了＝破圖。
  await remove(p.url).catch(()=>{}); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb).catch(()=>{});
  // 封面可能是大圖也可能是縮圖（上傳存縮圖、「設為封面」存大圖），兩種都要比對，
  // 不然刪掉當封面的那張之後，相簿封面會指到已經刪掉的檔＝破圖。
  // 換上去的也用縮圖，跟上傳時的慣例一致。
  // ⚠ 條件不要寫成「封面等於剛刪掉的那張」——兩個人同時刪不同照片時，
  // A 把封面換成 photo2，B 同時把 photo2 刪了，封面就指向一個不存在的檔（稽核 6 次全中）。
  // 改成**自我修復**：只要封面指向的照片已經不在了，就換成現存的第一張。
  // 這個寫法可以重複跑、也會順手把歷史上留下來的破圖封面一起修好。
  await run("UPDATE albums SET cover=COALESCE((SELECT thumb FROM photos WHERE album_id=? ORDER BY id LIMIT 1),'')"
    + " WHERE id=? AND cover<>'' AND NOT EXISTS (SELECT 1 FROM photos WHERE album_id=? AND (thumb=albums.cover OR url=albums.cover))",
    p.album_id,p.album_id,p.album_id); return res.redirect(`/${U(res).name}/album/${p.album_id}`);} res.redirect(`/${U(res).name}/album`); });

// 網誌
// 文章日曆：回傳該月的格子，有發文的日期給連結（無名側欄的「文章日曆」）
async function calendar(uid, ym){
  const now=new Date();
  const y = ym ? +ym.slice(0,4) : now.getFullYear();
  const m = ym ? +ym.slice(5,7) : now.getMonth()+1;
  const first=new Date(y, m-1, 1), days=new Date(y, m, 0).getDate();
  const key=`${y}-${String(m).padStart(2,'0')}`;
  const posted=new Set((await all("SELECT substr(created,9,2) d FROM posts WHERE user_id=? AND substr(created,1,7)=?",uid,key)).map(r=>+r.d));
  const cells=[]; for(let i=0;i<first.getDay();i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push({d, has:posted.has(d)});
  const prev=new Date(y, m-2, 1), next=new Date(y, m, 1);
  return { y, m, key, cells,
    prevYm:`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`,
    nextYm:`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`,
    isFuture: next > now };
}

// 當年網誌側欄常見模組：分類、最新文章、最新迴響、月份彙整
const blogSide=async (res, forPost=null)=>({
  cats:await all('SELECT category,count(*) n FROM posts WHERE user_id=? GROUP BY category',U(res).id),
  recent:await all('SELECT id,title FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  recentC:await all('SELECT c.author,c.post_id,p.title FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.user_id=? ORDER BY c.id DESC LIMIT 5',U(res).id),
  months:await all("SELECT substr(created,1,7) ym, count(*) n FROM posts WHERE user_id=? GROUP BY ym ORDER BY ym DESC",U(res).id),
  cal:await calendar(U(res).id, res.calYm),
  // 側欄自訂欄位（原站的 #boxFolder，可以有很多個）
  folders:await all('SELECT * FROM folders WHERE user_id=? ORDER BY seq,id',U(res).id),
  // 我的訂閱（原站的 #boxRssList）。這裡只讀資料庫裡上一次抓到的結果，
  // **不等外部網站**——順手在背景更新，下一次進來就是新的。
  // 直接 await 的話每一頁網誌都會被別人家的 RSS 拖慢。
  subs:await (async () => {
    const rows = await all("SELECT * FROM subs WHERE user_id=? AND last_title!='' ORDER BY id",U(res).id);
    refreshSubs(U(res).id).catch(e=>console.error('[subs]',e.message));
    return rows;
  })(),
  // 「歷史上的今天」：**跟這一篇同月同日**、但不同年發過的文。
  //
  // ⚠ 錨點是「這一篇文章的日期」，不是「伺服器的今天」。
  // 原本寫成 new Date()，結果每一篇文章印出來的內容**完全一樣**、跟那篇的日期無關
  // （多代理稽核抓到：2026-03-05 的文章印的是「去年的今天」）。
  // 列表頁沒有「這一篇」，那裡才用今天。
  //
  // created 是 'YYYY-MM-DD HH:MM:SS' 字串，substr(created,6,5) 就是 'MM-DD'——
  // 兩個驅動都有 substr，不用寫方言分支。
  // 時區用台北，不要靠行程的 TZ：正式站的容器是 UTC，差 8 小時會在跨日前後抓錯天。
  onThisDay:await (async () => {
    const anchor = forPost && forPost.created
      ? String(forPost.created)
      : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    return all(
      "SELECT id,title,created FROM posts WHERE user_id=? AND substr(created,6,5)=? "
      + "AND substr(created,1,4)!=? AND id!=? ORDER BY created DESC LIMIT 5",
      U(res).id, anchor.slice(5, 10), anchor.slice(0, 4), forPost ? forPost.id : 0);
  })(),
  // 側欄「最新引用」：blogside.ejs 讀 locals.trackbacks，但一直沒人給它，
  // 所以站上明明有引用，那一格永遠印「尚無引用」。
  // 側欄「最新引用」＝**別人引用了我哪一篇**，所以要 join t.from_post
  // 取「引用者那一篇」的作者。之前 join 的是 t.post_id（＝被引用的、我自己那篇），
  // 撈出來的 uname 永遠是站主本人，側欄整排印「, by 我自己」。
  //
  // key 叫 sideTbs 不叫 trackbacks：單篇文章頁（site.get('/blog/:id')）自己也傳一個
  // trackbacks（那一篇的引用清單），而它是接在 ...blogSide(res) 後面展開的，
  // 同名會把側欄這份蓋掉——文章頁的側欄就只看得到這一篇的引用，通常是「尚無引用」。
  sideTbs:await all(`SELECT fp.id pid,fp.title,fu.name uname,t.created
    FROM trackbacks t
    JOIN posts mine ON mine.id=t.post_id
    JOIN posts fp   ON fp.id=t.from_post
    JOIN users fu   ON fu.id=fp.user_id
    WHERE mine.user_id=? ORDER BY t.id DESC LIMIT 5`,U(res).id),
  // #blogCategory 是「這個網誌屬於哪個站內分類」，原版是站方給整個網誌貼的標籤
  // （blog_2012_default_skin_afuuu.html:1690），不是單篇文章的 category。
  // users 表沒有這個欄位，先從站主自己文章最常用的 topic 推導出來——
  // 沒有任何文章設過 topic 就回空字串，整塊不印，跟原版一樣
  // （blog_2013_index_treehouse16.html 那位沒設分類，該存檔就沒有這個節點）。
  blogTopic:(await one("SELECT topic FROM posts WHERE user_id=? AND topic!='' GROUP BY topic ORDER BY count(*) DESC LIMIT 1",U(res).id))?.topic||'',
  moods:MOODS, weathers:WEATHERS, blogTopics:BLOG_TOPICS, places:PLACES});
site.get('/blog',async (req,res)=>{ const cat=qs1(req.query.cat)||null, ym=/^\d{4}-\d{2}$/.test(qs1(req.query.ym))?qs1(req.query.ym):null, page=pageNo(req.query.p), per=10;
  const day=/^\d{4}-\d{2}-\d{2}$/.test(qs1(req.query.d))?qs1(req.query.d):null;
  // 日曆顯示的月份：?cal= 優先，其次跟著目前篩選的月份／日期
  res.calYm=/^\d{4}-\d{2}$/.test(qs1(req.query.cal))?qs1(req.query.cal):(ym||(day?day.slice(0,7):null));
  let where='user_id=?'; const args=[U(res).id];
  if(cat){ where+=' AND category=?'; args.push(cat); }
  if(ym){ where+=' AND substr(created,1,7)=?'; args.push(ym); }
  if(day){ where+=' AND substr(created,1,10)=?'; args.push(day); }
  const total=(await one(`SELECT count(*) c FROM posts WHERE ${where}`,...args)).c;
  res.render('blog',{nav:'blog',cat,ym,day,page,pages:Math.ceil(total/per),...await blogSide(res),posts:await all(`SELECT p.*,(SELECT count(*) FROM comments WHERE post_id=p.id) nc,(SELECT count(*) FROM trackbacks WHERE post_id=p.id) tb FROM posts p WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per)}); });
// 搜尋這個網誌（側欄模組：☑標題 ☐內容）
site.get('/blog/search',async (req,res)=>{
  const k=qs1(req.query.q).trim(), inBody=req.query.body==='1';
  const like=likeArg(k);
  const rows = k ? await all(
    inBody ? "SELECT * FROM posts WHERE user_id=? AND pass='' AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 50"
           : "SELECT * FROM posts WHERE user_id=? AND (title LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 50",
    ...(inBody ? [U(res).id,like,like] : [U(res).id,like])) : [];
  res.render('blog_search',{nav:'blog',k,inBody,rows,...await blogSide(res)});
});
// RSS
// ── 看地圖 ───────────────────────────────────────────────────────────────
// 原站網誌側欄的 boxDate 裡有一顆「看地圖」（WRETCH_SPEC.md:278、:382），
// 但**整個功能零存檔**：assets_src2 與 assets_src 的 HTML/CSS 搜不到
// 「看地圖」「map」「maps.google」任何一個，兩份完整的 #boxDate 逐字看過，
// 裡面只有月份下拉。所以這一頁是自製的，不是照抄。
//
// ⚠ 而且不做「假地圖」：albums.place 與新加的 posts.place 是四選一的**地區分類**
// （台灣／香港與澳門／中國／世界各地，src/taxonomy.js），**不是經緯度**。
// 手上沒有座標，畫一張圖釘標記只會是編造。
// 所以「看地圖」＝按地區把這個人的文章與相簿攤開來看。
//
// 路由順序：這一支在 /blog/:id 之前，但就算不小心排到後面也不會出事——
// router 層的數字參數守門員會把 'map' 擋下來交給下一條（見檔案上方那段）。
site.get('/blog/map',async (req,res)=>{
  const uid=U(res).id, isOwner=res.locals.isOwner;
  const groups=[];
  for(const place of PLACES){
    const posts=await all(
      `SELECT id,title,created,place FROM posts WHERE user_id=? AND place=?`
      + (isOwner?'':" AND pass=''") + ' ORDER BY id DESC LIMIT 20', uid, place);
    // 相簿也一起攤出來：地區這個欄位相簿本來就有，只看文章會少一半
    const albums=await all(
      `SELECT id,title,cover,place,(SELECT count(*) FROM photos WHERE album_id=albums.id) n
       FROM albums WHERE user_id=? AND place=?`
      + (isOwner?'':" AND pass='' AND friends_only=0") + ' ORDER BY id DESC LIMIT 12', uid, place);
    if(posts.length||albums.length) groups.push({place,posts,albums});
  }
  const none=(await one('SELECT count(*) c FROM posts WHERE user_id=? AND place=?',uid,'')).c;
  res.render('blog_map',{nav:'blog',groups,none,...await blogSide(res)});
});
site.get('/blog/rss',async (req,res)=>{
  const u=U(res), origin=`${req.protocol}://${req.get('host')}`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const items=(await all("SELECT * FROM posts WHERE user_id=? AND pass='' ORDER BY id DESC LIMIT 20",u.id)).map(p=>
    `<item><title>${esc(p.title)}</title><link>${origin}/${u.name}/blog/${p.id}</link>`+
    `<guid isPermaLink="true">${origin}/${u.name}/blog/${p.id}</guid>`+
    `<pubDate>${new Date(p.created.replace(' ','T')).toUTCString()}</pubDate>`+
    `<description>${esc(p.body.slice(0,300))}</description></item>`).join('');
  res.type('application/rss+xml').send(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>`+
    `<title>${esc(u.nick)}的網誌</title><link>${origin}/${u.name}/blog</link>`+
    `<description>${esc(u.intro||'')}</description><language>zh-TW</language>${items}</channel></rss>`);
});
// ===== 另外三個 RSS：相簿 / 留言板 / 迴響 =====
// 原站這三個都有（WRETCH_SPEC.md §6 的網址表，逐條實測過的）：
//   /album/album_rss.php?id=帳號        相簿
//   /guestbook/帳號&rss20=1             留言板
//   /blog/帳號&commentsRss20=1          迴響
// 之前只做了網誌那一支，其餘三支是 404 或把參數當成沒看到。
//
// 共用的組裝函式放這裡，四支 RSS 的欄位與逸出方式才會一致
// （原本網誌那支自己內嵌了一份 esc，很容易改一邊漏一邊）。
const rssEsc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
// created 是**台北時間**的裸字串（src/db.js 刻意存成 TEXT）。
// 直接丟給 new Date() 會用「行程的時區」去解讀——本機 TZ=Asia/Taipei 剛好對，
// 但正式站的容器是 UTC，同一筆資料的 pubDate 就會差 8 小時。
// 明確補上 +08:00，跟資料本身的時區對齊。
const rssDate = s => new Date(String(s).replace(' ', 'T') + '+08:00').toUTCString();
function rssFeed({ title, link, desc, items }) {
  const body = items.map(i =>
    `<item><title>${rssEsc(i.title)}</title><link>${i.link}</link>`
    // guid 是「這一則」的唯一識別，閱讀器靠它判斷讀過沒有。
    // ⚠ 留言板與迴響的 link 全部指向同一頁（留言板沒有單則頁面），
    // 直接拿 link 當 guid 的話 20 則會共用同一個 guid，
    // 閱讀器只會顯示一則、其餘當成重複丟掉。
    // 有自己的 guid 就用自己的，而且要標 isPermaLink="false"（它不是網址）。
    + (i.guid
        ? `<guid isPermaLink="false">${rssEsc(i.guid)}</guid>`
        : `<guid isPermaLink="true">${i.link}</guid>`)
    + `<pubDate>${rssDate(i.created)}</pubDate>`
    + `<description>${rssEsc(i.desc)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>`
    + `<title>${rssEsc(title)}</title><link>${link}</link>`
    + `<description>${rssEsc(desc)}</description><language>zh-TW</language>${body}</channel></rss>`;
}
const originOf = req => `${req.protocol}://${req.get('host')}`;

// 相簿 RSS：原站是「這個人最新的照片」，不是相簿本身
site.get('/album/rss',async (req,res)=>{
  const u=U(res), origin=originOf(req);
  // 上鎖與好友限定的相簿不能出現在公開的 feed 裡
  const rows=await all(`SELECT p.id,p.caption,p.created,a.title atitle
    FROM photos p JOIN albums a ON a.id=p.album_id
    WHERE a.user_id=? AND a.pass='' AND a.friends_only=0 ORDER BY p.id DESC LIMIT 20`,u.id);
  res.type('application/rss+xml').send(rssFeed({
    title:`${u.nick}的相簿`, link:`${origin}/${u.name}/album`, desc:u.intro||'',
    items:rows.map(p=>({ title:p.caption||p.atitle, link:`${origin}/${u.name}/photo/${p.id}`,
      created:p.created, desc:p.atitle })) }));
});

// 留言板 RSS：悄悄話不能外流
site.get('/guestbook/rss',async (req,res)=>{
  const u=U(res), origin=originOf(req);
  const rows=await all(`SELECT id,author,subject,body,created FROM guestbook
    WHERE user_id=? AND secret=0 ORDER BY id DESC LIMIT 20`,u.id);
  res.type('application/rss+xml').send(rssFeed({
    title:`${u.nick}的留言板`, link:`${origin}/${u.name}/guestbook`, desc:u.intro||'',
    // 留言板沒有「單則留言」的頁面，每一則的 link 都指向同一頁。
    // 所以 guid 要自己給，不然 20 則共用一個 guid，閱讀器只會顯示一則。
    items:rows.map(m=>({ title:`${m.author}：${m.subject||'無標題'}`,
      link:`${origin}/${u.name}/guestbook`,
      guid:`${origin}/${u.name}/guestbook#g${m.id}`,
      created:m.created, desc:m.body })) }));
});

// 迴響 RSS：整個網誌的最新迴響（原站的 commentsRss20）。上鎖文章的迴響不放。
site.get('/blog/comments.rss',async (req,res)=>{
  const u=U(res), origin=originOf(req);
  const rows=await all(`SELECT c.id,c.author,c.body,c.created,p.id pid,p.title
    FROM comments c JOIN posts p ON p.id=c.post_id
    WHERE p.user_id=? AND p.pass='' ORDER BY c.id DESC LIMIT 20`,u.id);
  res.type('application/rss+xml').send(rssFeed({
    title:`${u.nick}的網誌迴響`, link:`${origin}/${u.name}/blog`, desc:u.intro||'',
    // 同一篇文章的多則迴響 link 相同（都指向那篇的迴響區），guid 要各自唯一
    items:rows.map(c=>({ title:`${c.author} 回應了「${c.title}」`,
      link:`${origin}/${u.name}/blog/${c.pid}#postComments`,
      guid:`${origin}/${u.name}/blog/${c.pid}#c${c.id}`,
      created:c.created, desc:c.body })) }));
});

const myPhotos = async res => await all(`SELECT p.id,p.thumb,p.url FROM photos p JOIN albums a ON a.id=p.album_id
  WHERE a.user_id=? ORDER BY p.id DESC LIMIT 40`, U(res).id);
site.get('/blog/new',requireLogin,requireOwner,async (req,res)=>res.render('post_edit',{nav:'blog',post:null,photos:await myPhotos(res),emotes:EMOTES,...await blogSide(res)}));
site.post('/blog/new',requireLogin,requireOwner,async (req,res)=>{ const {title,body,category,mood,weather}=req.body;
  // ⚠ 原本是「標題或內容是空的就 302 回 /blog/new」——那一跳把使用者
  // **剛打完的整篇文章丟掉**，而且一個字都不解釋。有人打了半小時的文章，
  // 標題不小心只按到空白鍵，按下發表，回到一張全空的表單。
  // 現在把填過的內容原樣送回表單，並且講清楚缺什麼。
  if(!title?.trim()||!body?.trim()){
    return res.render('post_edit',{nav:'blog',post:null,photos:await myPhotos(res),emotes:EMOTES,
      ...await blogSide(res),
      formErr: !title?.trim() ? '標題不能是空白' : '內容不能是空白',
      form: req.body});
  }
  const r=await run('INSERT INTO posts(user_id,title,body,category,mood,weather,pass,topic,place) VALUES(?,?,?,?,?,?,?,?,?)',U(res).id,cut(title.trim(), 100),body.slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',MOODS.includes(mood)?mood:'',WEATHERS.includes(weather)?weather:'',(req.body.pass||'').slice(0,20),isBlogTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'');
  await act(U(res).id,'blog',cut(title.trim(), 100),`/${U(res).name}/blog/${r.lastInsertRowid}`);
  res.redirect(`/${U(res).name}/blog/${r.lastInsertRowid}`); });
const postOf=async (req,res,next)=>{ const p=await one('SELECT * FROM posts WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!p) return next('route'); res.locals.post=p; next(); };
// 文章密碼（當年網誌可以上鎖，很多人拿來寫悄悄話）
const postUnlocked=(req,res)=>!res.locals.post.pass||res.locals.isOwner||(req.session.unlockedPosts||[]).includes(res.locals.post.id);
site.post('/blog/:id/unlock',postOf,async (req,res)=>{
  const p=res.locals.post;
  if(rateHit(req,'post'+p.id)) return res.status(429).render('post_lock',{nav:'blog',post:p,...await blogSide(res),err:rateMsg});
  if(req.body.pass===p.pass){ rateClear(req,'post'+p.id); req.session.unlockedPosts=[...(req.session.unlockedPosts||[]),p.id]; return res.redirect(`/${U(res).name}/blog/${p.id}`); }
  res.render('post_lock',{nav:'blog',post:p,...await blogSide(res),err:'密碼錯誤'});
});
site.get('/blog/:id',postOf,async (req,res)=>{ const p=res.locals.post;
  if(!postUnlocked(req,res)) return res.render('post_lock',{nav:'blog',post:p,...await blogSide(res),err:null});
  if(!res.locals.isOwner) await run('UPDATE posts SET views=views+1 WHERE id=?',p.id);
  // 迴響與引用要分頁。
  //
  // ⚠ 原本兩支查詢都沒有 LIMIT：一篇文章有一萬則迴響，就一次撈一萬列、
  // 一次算一萬次 render()（每一則都要跑 BBCode）、一次送出去。
  // 那不只是慢——那是一個不用登入、任何人都可以重複觸發的資源消耗點。
  //
  // 原站本來就有分頁，存檔看得到參數與頁數：
  //   blog_2013_article_comments_page2.html   Reply(124) 分 7 頁 → 20 則／頁
  //   blog_2013_article_trackback_page2.html  Trackback(128) 分 5 頁 → 30 筆／頁
  //   網址是 …/blog/<帳號>/<文章>&page=2#postComments 與 &tpage=2#trackbacks
  const cPer = 20, tPer = 30;
  const cN = (await one('SELECT count(*) c FROM comments WHERE post_id=?',p.id)).c;
  const tN = (await one('SELECT count(*) c FROM trackbacks WHERE post_id=?',p.id)).c;
  const cPage = Math.min(pageNo(req.query.page), Math.max(1, Math.ceil(cN/cPer)));
  const tPage = Math.min(pageNo(req.query.tpage), Math.max(1, Math.ceil(tN/tPer)));
  res.render('post',{nav:'blog',post:p,...await blogSide(res, p),
    faved: res.locals.me?!!await one('SELECT 1 FROM favs WHERE user_id=? AND post_id=?',res.locals.me.id,p.id):false,
    favN: (await one('SELECT count(*) c FROM favs WHERE post_id=?',p.id)).c,
    // 「誰來收藏」：原站按下收藏數會展開收藏過這篇的人（blog.md 列為後期功能）。
    // 資料本來就在 favs 裡，只是之前沒有印出來。
    collectors:await all(`SELECT u.name,u.nick,u.avatar FROM favs f JOIN users u ON u.id=f.user_id
      WHERE f.post_id=? ORDER BY f.created DESC LIMIT 30`,p.id),
    comments:await all(`SELECT c.*,cu.name cname,cu.avatar cavatar FROM comments c
      LEFT JOIN users cu ON cu.id=c.author_id WHERE c.post_id=? ORDER BY c.id LIMIT ? OFFSET ?`,
      p.id, cPer, (cPage-1)*cPer),
    commentN: cN, commentPage: cPage, commentPages: Math.ceil(cN/cPer),
    trackbacks:await all(`SELECT t.*,p.title,p.id pid,u.name uname FROM trackbacks t
      JOIN posts p ON p.id=t.from_post JOIN users u ON u.id=p.user_id
      WHERE t.post_id=? ORDER BY t.id LIMIT ? OFFSET ?`, p.id, tPer, (tPage-1)*tPer),
    trackbackN: tN, trackbackPage: tPage, trackbackPages: Math.ceil(tN/tPer),
    prev:await one('SELECT id,title FROM posts WHERE user_id=? AND id<? ORDER BY id DESC',U(res).id,p.id),next:await one('SELECT id,title FROM posts WHERE user_id=? AND id>? ORDER BY id',U(res).id,p.id)}); });
site.get('/blog/:id/edit',requireLogin,requireOwner,postOf,async (req,res)=>res.render('post_edit',{nav:'blog',post:res.locals.post,photos:await myPhotos(res),emotes:EMOTES,...await blogSide(res)}));
site.post('/blog/:id/edit',requireLogin,requireOwner,postOf,async (req,res)=>{ const {title,body,category,mood,weather}=req.body;
  await run('UPDATE posts SET title=?,body=?,category=?,mood=?,weather=?,pass=?,topic=?,place=? WHERE id=?',(title||res.locals.post.title).trim().slice(0,100),(body||'').slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',MOODS.includes(mood)?mood:'',WEATHERS.includes(weather)?weather:'',(req.body.pass||'').slice(0,20),isBlogTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'',res.locals.post.id);
  res.redirect(`/${U(res).name}/blog/${res.locals.post.id}`); });
site.post('/blog/:id/del',requireLogin,requireOwner,postOf,async (req,res)=>{ await run('DELETE FROM posts WHERE id=?',res.locals.post.id); res.redirect(`/${U(res).name}/blog`); });
// 上鎖文章：沒解鎖就不能回應、推薦、引用（引用會複製內文，等於繞過密碼）
const needUnlocked=(req,res,next)=>postUnlocked(req,res)?next():res.redirect(`/${U(res).name}/blog/${res.locals.post.id}`);
// 迴響（無名的表單欄位：暱稱／E-mail／個人網頁／記住我的資料／內容最多1000字）
site.post('/blog/:id/comment',postOf,needUnlocked,async (req,res)=>{
  const b=req.body;
  if(b.body?.trim()){
    const site1=(()=>{ try{ const x=String(b.homepage||'').trim(); if(!x) return '';
      return ['http:','https:'].includes(new URL(x).protocol)?x.slice(0,200):''; }catch{ return ''; } })();
    const email=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((b.email||'').trim())?b.email.trim().slice(0,60):'';
    // author_id：登入者才有。原版每一則迴響的暱稱與大頭貼都連到那個人的小站，
    // 只存 author 文字的話連不回帳號（見 src/db.js 的 ADD_COLUMNS 說明）。
    await run('INSERT INTO comments(post_id,author,author_id,body,email,homepage) VALUES(?,?,?,?,?,?)',
      res.locals.post.id,cut((res.locals.me?.nick||b.author||'訪客').trim(),20),
      res.locals.me?.id ?? null,
      b.body.trim().slice(0,1000), email, site1);
    if(b.remember) req.session.guest={author:(b.author||'').slice(0,20),email,homepage:site1};   // 記住我的資料
    else delete req.session.guest;
  }
  res.redirect(`/${U(res).name}/blog/${res.locals.post.id}#comments`); });
// 板主回覆迴響
site.post('/blog/:id/comment/:cid/reply',requireLogin,requireOwner,postOf,async (req,res)=>{
  await run('UPDATE comments SET reply=? WHERE id=? AND post_id=?',(req.body.reply||'').trim().slice(0,500),req.params.cid,res.locals.post.id);
  res.redirect(`/${U(res).name}/blog/${res.locals.post.id}#comments`); });
site.post('/blog/:id/comment/:cid/del',requireLogin,requireOwner,postOf,async (req,res)=>{ await run('DELETE FROM comments WHERE id=? AND post_id=?',req.params.cid,res.locals.post.id); res.redirect(`/${U(res).name}/blog/${res.locals.post.id}#comments`); });
site.post('/blog/:id/like',postOf,needUnlocked,async (req,res)=>{ req.session.liked??=[]; if(!req.session.liked.includes(res.locals.post.id)){ req.session.liked.push(res.locals.post.id); await run('UPDATE posts SET likes=likes+1 WHERE id=?',res.locals.post.id);} res.redirect(`/${U(res).name}/blog/${res.locals.post.id}`); });
// 收藏（無名文章下方的「收藏」）
site.post('/blog/:id/fav',requireLogin,postOf,needUnlocked,async (req,res)=>{
  const me=res.locals.me.id, pid=res.locals.post.id;
  if(await one('SELECT 1 FROM favs WHERE user_id=? AND post_id=?',me,pid)) await run('DELETE FROM favs WHERE user_id=? AND post_id=?',me,pid);
  else await run('INSERT OR IGNORE INTO favs(user_id,post_id) VALUES(?,?)',me,pid);
  res.redirect(`/${U(res).name}/blog/${pid}`); });
// 我的收藏
site.get('/favs',async (req,res)=>res.render('favs',{nav:'user',
  favs:await all('SELECT p.id,p.title,p.created,u.name uname,u.nick FROM favs f JOIN posts p ON p.id=f.post_id JOIN users u ON u.id=p.user_id WHERE f.user_id=? ORDER BY f.created DESC LIMIT 100',U(res).id),
  visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)}));
// 好友動態
site.get('/feed',requireLogin,requireOwner,async (req,res)=>res.render('feed',{nav:'user',
  acts:await all('SELECT a.*,u.name uname,u.nick,u.avatar FROM acts a JOIN users u ON u.id=a.user_id WHERE a.user_id IN (SELECT friend_id FROM friends WHERE user_id=?) ORDER BY a.id DESC LIMIT 50',U(res).id),
  visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)}));
// 引用：在自己的網誌建立一篇引用文，並在原文登記
site.post('/blog/:id/trackback',requireLogin,postOf,needUnlocked,async (req,res)=>{
  const p=res.locals.post, me=res.locals.me; if(me.id===U(res).id) return res.redirect(`/${U(res).name}/blog/${p.id}`);
  const r=await run('INSERT INTO posts(user_id,title,body,category) VALUES(?,?,?,?)',me.id,'引用：'+p.title,`引用自 ${U(res).nick} 的文章《${p.title}》\n\n`+p.body.slice(0,300)+'…\n\n（原文：/'+U(res).name+'/blog/'+p.id+'）','引用');
  await run('INSERT INTO trackbacks(post_id,from_post) VALUES(?,?)',p.id,r.lastInsertRowid); res.redirect(`/${me.name}/blog/${r.lastInsertRowid}/edit`); });

// ===== 影音 =====
// 原站 www.wretch.cc/video/<帳號>（服務導覽第七顆 #linkVideo）。
// 無名當年是自建的影音服務，我們沒有轉檔與串流，做「最小可用」：
// 站主貼 YouTube 網址，站上用 <iframe> 內嵌。
//
// 只收得出 11 碼影片 id 的網址。理由是安全：id 會被拼進 iframe 的 src，
// 放行任意字串等於讓使用者決定要內嵌哪一個網站。
const ytId = s => {
  const x=String(s||'').trim();
  if(/^[\w-]{11}$/.test(x)) return x;
  try{
    const u=new URL(x);
    if(!['http:','https:'].includes(u.protocol)) return '';
    if(/(^|\.)youtu\.be$/i.test(u.hostname)) return (/^\/([\w-]{11})/.exec(u.pathname)||[])[1]||'';
    if(/(^|\.)youtube(-nocookie)?\.com$/i.test(u.hostname)){
      const v=u.searchParams.get('v'); if(v&&/^[\w-]{11}$/.test(v)) return v;
      return (/^\/(?:embed|v|shorts)\/([\w-]{11})/.exec(u.pathname)||[])[1]||'';
    }
  }catch{}
  return '';
};
site.get('/video',async (req,res)=>{
  const page=pageNo(req.query.p), per=12;
  const total=(await one('SELECT count(*) c FROM videos WHERE user_id=?',U(res).id)).c;
  res.render('video',{nav:'video',page,pages:Math.ceil(total/per),total,
    videos:await all('SELECT * FROM videos WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per),
    visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
    friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)});
});
site.post('/video',requireLogin,requireOwner,async (req,res)=>{
  const vid=ytId(req.body.url), title=(req.body.title||'').trim().slice(0,60)||'未命名影片';
  if(vid){
    await run('INSERT INTO videos(user_id,title,vid,url,descr) VALUES(?,?,?,?,?)',
      U(res).id,title,vid,'https://www.youtube.com/watch?v='+vid,(req.body.descr||'').trim().slice(0,200));
    await act(U(res).id,'video',title,`/${U(res).name}/video`);
  } else flash(req,'請貼上 YouTube 影片網址（例如 https://www.youtube.com/watch?v=…）');
  res.redirect(`/${U(res).name}/video`);
});
site.post('/video/:id/del',requireLogin,requireOwner,async (req,res)=>{
  await run('DELETE FROM videos WHERE id=? AND user_id=?',req.params.id,U(res).id);
  res.redirect(`/${U(res).name}/video`); });

// ===== 嘀咕 =====
// 原站 www.wretch.cc/digu/<帳號>：噗浪式的一句話短訊息。
// 留言板側欄的名片小卡（.myDigu .digu .digu_date）印的就是最新那一則。
site.get('/digu',async (req,res)=>{
  const page=pageNo(req.query.p), per=20;
  const total=(await one('SELECT count(*) c FROM digu WHERE user_id=?',U(res).id)).c;
  res.render('digu',{nav:'digu',page,pages:Math.ceil(total/per),total,
    digus:await all('SELECT * FROM digu WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per),
    visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
    friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)});
});
site.post('/digu',requireLogin,requireOwner,async (req,res)=>{
  const body=(req.body.body||'').trim().slice(0,140);   // 一句話，長度比照當年的微網誌
  if(body){
    await run('INSERT INTO digu(user_id,body) VALUES(?,?)',U(res).id,body);
    await act(U(res).id,'digu',body,`/${U(res).name}/digu`);
  }
  res.redirect(`/${U(res).name}/digu`);
});
site.post('/digu/:id/del',requireLogin,requireOwner,async (req,res)=>{
  await run('DELETE FROM digu WHERE id=? AND user_id=?',req.params.id,U(res).id);
  res.redirect(`/${U(res).name}/digu`); });

// 留言板
// 留言板：頁籤 留言板 / 系統訊息 / 我要留言（同無名）
// 站方公告在留言板 #tab_bulletin 頁籤裡是「一則一則」印的，DOM 有主題也有內容，
// 但 notices 表只有 body 一欄。慣例上公告會寫成「[公告] …」，就拿方括號當主題；
// 沒有前綴的就統一掛「站方公告」，不要讓主題那格空著。
const bulletinRow = n => {
  const m=/^\s*[[【]([^\]】]{1,20})[\]】]\s*([\s\S]*)$/.exec(n.body||'');
  return { ...n, author:'無名小站', title: m?m[1]:'站方公告', body: m?m[2]:(n.body||'') };
};
site.get('/guestbook',async (req,res)=>{
  const tab = ['sys','new','bulletin'].includes(req.query.tab) ? req.query.tab : 'list';
  // 原版留言板一頁 10 則（gb_guestbook_a000000010_20131226.html 數得出來），
  // 我們原本寫 15，分頁列的頁數就跟原版對不起來。
  const page=pageNo(req.query.p),per=10;
  // 側欄那張名片小卡（#namecard）用得到：好友下拉 ＋ 最新一則嘀咕
  const side={
    gbFriends:await all(`SELECT u.name,u.nick,${GRP_NAME} grp FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u.name LIMIT 300`,U(res).id),
    bulletins:[], msgs:[], sys:[],
  };
  const unread = res.locals.isOwner ? (await one('SELECT count(*) c FROM sysmsg WHERE user_id=? AND seen=0',U(res).id)).c : 0;
  if(tab==='sys'){
    // 私人系統通知：語意上就是站主一個人的信箱，維持只有本人看得到。
    // 沒登入的人要導去登入頁（帶 next 回來），不要直接 403。
    // 站上其他站主專用的頁（設定、發文、好友動態）都是這個行為，
    // 只有這裡回 403，訪客會以為「我沒有權限」而不是「我要先登入」。
    if(!res.locals.me) return res.redirect('/login?next='+encodeURIComponent(req.originalUrl));
    if(!res.locals.isOwner) return res.status(403).render('msg',{title:'沒有權限',msg:'系統訊息只有本人看得到',back:`/${U(res).name}/guestbook`});
    const total=(await one('SELECT count(*) c FROM sysmsg WHERE user_id=?',U(res).id)).c;
    await run('UPDATE sysmsg SET seen=1 WHERE user_id=?',U(res).id);
    return res.render('guestbook',{nav:'gb',tab,page,pages:Math.ceil(total/per),total,...side,
      sys:await all('SELECT * FROM sysmsg WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per),unread:0});
  }
  if(tab==='bulletin'){
    // 原版的 #tab_bulletin 是**站方公告**（發文者一律 wretchoffice），人人可見、會分頁。
    // 跟上面那個私人信箱是兩回事，所以是兩個頁籤而不是把 sys 改掉。
    const total=(await one('SELECT count(*) c FROM notices')).c;
    return res.render('guestbook',{nav:'gb',tab,page,pages:Math.ceil(total/per),total,...side,unread,
      bulletins:(await all('SELECT * FROM notices ORDER BY id DESC LIMIT ? OFFSET ?',per,(page-1)*per)).map(bulletinRow)});
  }
  const total=(await one('SELECT count(*) c FROM guestbook WHERE user_id=?',U(res).id)).c;
  res.render('guestbook',{nav:'gb',tab,page,pages:Math.ceil(total/per),total,...side,unread,
    // 帶出留言者的帳號／暱稱／大頭貼／認證狀態——原版那三樣都在留言的表頭
    // （msg_img 的大頭貼、msg_man 的連結、.vip_icon）。LEFT JOIN：訪客留言沒有帳號。
    msgs:await all(`SELECT g.*,au.name a_name,au.nick a_nick,au.avatar a_avatar,au.vip a_vip
      FROM guestbook g LEFT JOIN users au ON au.id=g.author_id
      WHERE g.user_id=? ORDER BY g.id DESC LIMIT ? OFFSET ?`,U(res).id,per,(page-1)*per)}); });
site.post('/guestbook',async (req,res)=>{ const {author,subject,body,secret}=req.body; const who=res.locals.me?.nick||author;
  if(who?.trim()&&body?.trim()){
    // author_id 只有登入才有值：原版每一則留言的暱稱與大頭貼都連回留言者的小站，
    // 認證章也掛在那裡。訪客留言留 NULL，view 就退回純文字。
    await run('INSERT INTO guestbook(user_id,author,author_id,subject,body,secret) VALUES(?,?,?,?,?,?)',U(res).id,who.trim().slice(0,20),res.locals.me?.id||null,(subject||'').trim().slice(0,40),body.trim().slice(0,500),secret?1:0);
    // 通知板主有新留言：只有登入者會觸發，且 10 分鐘內只發一則，避免被灌爆。
    // ⚠ 節流條件要限定在**這一種**通知上（title）。
    // 原本只看「10 分鐘內有沒有任何 sysmsg」，於是站長一發群發公告，
    // 全站每個人的信箱裡都有一則新訊息 → **所有人接下來 10 分鐘都收不到留言通知**。
    if(res.locals.me && res.locals.me.id!==U(res).id &&
       !await one("SELECT 1 FROM sysmsg WHERE user_id=? AND title='你有新的留言' AND created>datetime('now','localtime','-10 minutes')",U(res).id))
      await run('INSERT INTO sysmsg(user_id,title,body) VALUES(?,?,?)',U(res).id,'你有新的留言',`${res.locals.me.nick} 在你的留言板留言了。`);
  }
  res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/reply',requireLogin,requireOwner,async (req,res)=>{ await run('UPDATE guestbook SET reply=? WHERE id=? AND user_id=?',(req.body.reply||'').trim().slice(0,500),req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/del',requireLogin,requireOwner,async (req,res)=>{ await run('DELETE FROM guestbook WHERE id=? AND user_id=?',req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });

app.use((req,res)=>res.status(404).render('msg',{title:'找不到頁面',msg:'找不到這個小站或頁面 (>_<)',back:'/'}));
app.use((err,req,res,next)=>{
  // ⚠ 使用者按停止、關分頁、或在上傳中途離開，都會走到這裡（ECONNABORTED /
  // ECONNRESET / EPIPE / request aborted）。那**不是錯誤**，是每天都會發生
  // 幾千次的正常現象。原本一律 console.error(err) 印整串堆疊，實測 94 秒
  // 就寫了 12MB 的 log——真正的錯誤被埋在裡面找不到，Railway 的 log 也爆掉。
  const aborted = req.aborted || err.type === 'request.aborted' ||
    ['ECONNABORTED','ECONNRESET','EPIPE'].includes(err.code);
  if (aborted) {
    console.warn('[連線中斷]', req.method, req.originalUrl);
    // 對方已經走了，回什麼都送不出去，只要把連線收乾淨。
    return res.destroy();
  }
  console.error(err);
  // 依錯誤種類給對的狀態碼與看得懂的訊息
  const tooBig = err.code==='LIMIT_FILE_SIZE';
  // ⚠ 送一段壞掉的 multipart（boundary 對不上、標頭截斷）原本會 500。
  // 那是**送出的東西有問題**，不是伺服器壞了：回 500 會讓監控誤報，
  // 也讓對方以為重試就會好。multer 這幾個錯誤碼一律歸類成 400。
  const badReq = err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_PART_COUNT' ||
    err.code === 'LIMIT_FIELD_COUNT' || err.code === 'LIMIT_FIELD_KEY' ||
    err.code === 'LIMIT_FIELD_VALUE' || /Multipart|Unexpected end of form|Malformed part/i.test(err.message || '');
  const bodyBig = err.type==='entity.too.large' || err.status===413;
  const code = tooBig || bodyBig ? 413 : badReq ? 400 : 500;
  const msg = tooBig ? '圖片太大了（上限 8MB）'
    : bodyBig ? '送出的內容太長了，請縮短之後再試一次。'
    : badReq ? '送出的資料格式不對，請重新整理頁面再試一次。'
    : '伺服器發生錯誤，請稍後再試';
  // ⚠ render 也可能失敗（樣板本身出錯、或缺 locals）。第二個參數收 callback，
  // 失敗時退回純文字——**絕對不能讓 Express 的預設錯誤頁把堆疊印給使用者看**
  // （那會洩漏伺服器絕對路徑與 node_modules 結構）。
  res.status(code).render('msg',{title:'出錯了',msg,back:'/'},(e,html)=>{
    if(e){ console.error('[錯誤頁本身也壞了]',e.message); return res.type('text/plain').send(msg); }
    res.send(html);
  });
});
// ===== 啟動 =====
// ⚠ migrate() 是頂層 await：這裡拋出去就是**行程死在 listen 之前**，
// 邊緣找不到健康的容器 → 502，而且日誌上只有一段堆疊、看起來像「建置失敗」。
// 今天已經因為這個掛過兩次（一次是孤兒列違反外鍵，一次是多實例併發建表）。
// 建表／補欄位失敗時，站台**照樣要起得來**——舊 schema 的頁面大多還能看，
// 總比整站 502 好。真正的問題會留在日誌裡，而且下一次部署會再試一次。
try {
  await migrate();
} catch (e) {
  console.error('[migrate] 失敗，但站台照常啟動（schema 可能不完整）：', e.message);
  console.error(e.stack);
}

// 一次性把 SQLite 的資料搬到 Postgres（見 src/migrate-pg.js 的用法說明）。
// 只有明確設 MIGRATE_SQLITE_TO_PG=1 才會跑，而且目標表非空就自動跳過。
// 搬移失敗不讓站台起不來——先把站撐住，再看日誌處理。
if (process.env.MIGRATE_SQLITE_TO_PG === '1' && process.env.DATABASE_URL) {
  try {
    const { migrateSqliteToPg } = await import('./migrate-pg.js');
    const { DB_PATH } = await import('./paths.js');
    await migrateSqliteToPg({ sqlitePath: DB_PATH, pgUrl: process.env.DATABASE_URL });
  } catch (e) {
    console.error('[migrate] 搬移過程出錯，站台照常啟動：', e.message);
  }
}

// 人氣計數 write-behind：bumpHits() 只在 Redis 累加，這裡每 30 秒把增量寫回資料庫。
// 原本每次瀏覽都 UPDATE 一次，是全站最頻繁的寫入；批次之後 N 次寫入壓成 1 次。
// 沒有 Redis 時 bumpHits() 會回傳 true，由它自己直接寫，這個排程等於空轉。
const visitFlusher = startVisitFlusher(async (userId, n) => {
  await run('UPDATE users SET visits=visits+?, today_hits=today_hits+? WHERE id=?', n, n, userId);
});

const PORT=process.env.PORT||3000;
// ===== 讓 crash 看得見 =====
//
// ⚠ 這支程式原本**完全沒有** unhandledRejection / uncaughtException 的處理。
// Node 從 15 起，任何一個沒接住的 promise rejection 都會直接把行程殺掉，
// 而預設印出來的東西常常只有一行 message，看不出是哪一條路徑。
// 在 Railway 上的樣子就是「Deploy Crashed」信一封接一封、站自己重啟，
// 而沒有人知道為什麼——實際發生過，連續二十小時每隔十幾分鐘一封。
//
// 兩種情況分開處理，理由不一樣：
//
//   unhandledRejection：**記下來，不要結束行程**。
//     這幾乎都是某一條請求路徑上漏接的 await（例如某個第三方 RSS 逾時）。
//     為了那一個請求把所有正在用站的人一起踢掉，代價完全不成比例。
//     記完之後行程繼續服務，log 裡有完整堆疊可以回頭修。
//
//   uncaughtException：**記下來，然後收工重啟**。
//     這代表同步程式碼炸了，行程的狀態可能已經不一致（連線、交易、暫存），
//     繼續跑下去會用壞掉的狀態回應使用者。走正常的關機流程讓平台重啟。
process.on('unhandledRejection', (reason, promise) => {
  const e = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[未接住的 rejection] 行程繼續服務，但這條路徑要修：');
  console.error(e.stack || e.message);
  void promise;
});
process.on('uncaughtException', err => {
  console.error('[未接住的例外] 狀態可能已經不一致，收工讓平台重啟：');
  console.error(err?.stack || String(err));
  // shutdown() 是下面宣告的 function，會提升；真的被呼叫時早就定義好了。
  try { shutdown('uncaughtException'); } catch { process.exit(1); }
  // 關機流程萬一自己卡住，10 秒後硬退，不要讓行程掛在那裡不生不死。
  setTimeout(() => process.exit(1), 10_000).unref?.();
});


const server = app.listen(PORT,()=>{
  console.log(`vibeai 小站 → http://localhost:${PORT}　資料庫 ${driver}　session ${hasRedis?'redis':'memory'}`);
  // 灌示範資料（見 src/seed-demo.js 的用法與安全說明）。
  // 一定要在 listen 之後才做：抓 ~300 張照片要十幾分鐘，
  // 放在啟動流程裡會讓平台的健康檢查一直失敗，最後被判定部署失敗。
  // users 表非空就會自己跳過，所以留著這段不會有副作用。
  // SEED_DEMO=1     站上沒有內容才灌
  // SEED_DEMO=force 站上已經有一點內容也照樣把示範資料疊加上去（不刪任何東西）
  const seedMode = process.env.SEED_DEMO;
  if (seedMode === '1' || seedMode === 'force') {
    import('./seed-demo.js')
      .then(m => m.seedDemoIfEmpty({ force: seedMode === 'force' }))
      .catch(e => console.error('[seed] 出錯，站台照常運作：', e.message));
  }
});

// ===== 收工：把還在跑的請求做完再走 =====
//
// Railway 重新部署／重啟／擴縮容都是先送 SIGTERM，寬限期之後才 SIGKILL。
// 原本唯一的 SIGTERM 處理在 cache.js，把人氣刷回去就 process.exit(0)——
// 正在跑的請求被攔腰砍斷（實測：一個要跑 1.2 秒的 handler，SIGTERM 之後
// 「寫入完成」永遠不會印出來，行程直接 exit 0）。
//
// 正確順序：
//   1. server.close()  停止收新連線，但讓已經在跑的請求跑完
//   2. 等它們跑完（設硬上限，不能無限等——平台的寬限期通常只有 30 秒，
//      逾時被 SIGKILL 反而更慘）
//   3. 把人氣增量刷回資料庫
//   4. 關掉資料庫與 Redis 連線
//   5. exit
let shuttingDown = false;
async function shutdown(sig){
  if (shuttingDown) return;          // 訊號可能連來兩次
  shuttingDown = true;
  console.log(`[shutdown] 收到 ${sig}，停止收新連線`);

  const closed = new Promise(res => server.close(() => res('drained')));
  // 15 秒硬上限。Railway 的寬限期是 30 秒，留一半給後面的收尾動作。
  const timeout = new Promise(res => setTimeout(() => res('timeout'), 15_000).unref?.());
  const how = await Promise.race([closed, timeout]);
  console.log(how === 'drained' ? '[shutdown] 現有請求都跑完了' : '[shutdown] 等太久，不等了');

  try { const n = await visitFlusher.flush(); if (n) console.log(`[shutdown] 人氣增量寫回 ${n} 筆`); }
  catch (e) { console.error('[shutdown] 人氣寫回失敗', e.message); }

  try { await closeDb(); } catch (e) { console.error('[shutdown] 關資料庫失敗', e.message); }
  try { await closeRedis(); } catch (e) { console.error('[shutdown] 關 Redis 失敗', e.message); }

  console.log('[shutdown] 收工');
  process.exit(0);
}
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => shutdown(sig));

