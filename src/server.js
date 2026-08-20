import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'node:path';
import { one, all, run, migrate, driver } from './db.js';
import { sessionStore, startVisitFlusher, bumpVisit, hasRedis } from './cache.js';
import { hash, salt, check, requireLogin, requireOwner } from './auth.js';
import { save, remove, hasR2, diskFree, readImage } from './storage.js';
import { UPLOAD_DIR } from './paths.js';
import { render, EMOTES, safeCss } from './format.js';
import { fetchFeed, subUrlOk } from './feed.js';
import { SITE_NAME, SITE_DESC, SITE_LOGO, CDN } from './config.js';
import { ALBUM_TOPICS, BLOG_TOPICS, PLACES, MOODS, WEATHERS, ZODIACS, BLOODS, SEXES, CITIES, isAlbumTopic, isBlogTopic, isPlace } from './taxonomy.js';
import { SKINS, isSkin, skinCss } from './skins.js';

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
app.use(express.urlencoded({extended:false}));
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
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:20},fileFilter:(r,f,cb)=>cb(null,/^image\/(jpeg|png|gif|webp)$/.test(f.mimetype))});

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
  res.locals.me = req.session.uid ? await one('SELECT id,name,nick,avatar,admin,vip FROM users WHERE id=?',req.session.uid) : null;
  res.locals.u = null; res.locals.nav=''; res.locals.flash = req.session.flash; delete req.session.flash;
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
  posts: await all(`SELECT p.*,u.name uname,u.nick FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.views DESC LIMIT 30`)}));
app.get('/search',async (req,res)=>{
  const k=(req.query.q||'').trim(), like=`%${k}%`;
  res.render('search',{k,
    users:k?await all('SELECT name,nick,avatar FROM users WHERE name LIKE ? OR nick LIKE ? LIMIT 30',like,like):[],
    albums:k?await all(`SELECT a.*,u.name uname FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0 AND a.title LIKE ? LIMIT 30`,like):[],
    // 上鎖文章不讓內文被搜出來，只比對標題
    posts:k?await all(`SELECT p.*,u.name uname FROM posts p JOIN users u ON u.id=p.user_id WHERE p.title LIKE ? OR (p.pass='' AND p.body LIKE ?) LIMIT 30`,like,like):[]});
});
app.get('/help',(req,res)=>res.render('help'));

// 背景音樂開關（首頁 #wfp-bgm）。原站是純前端＋cookie mf，
// 本站沒有 cookie-parser，走 session；不靠 JS 也能切換，所以做成 GET + 轉回原頁。
app.get('/bgm',(req,res)=>{
  req.session.bgm = req.query.on==='1' ? 'on' : 'off';
  res.redirect(safePath(req.query.back) || '/');
});

// 檢舉（無名各處都有「檢舉」連結，送到站長後台處理）
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
  const page=Math.max(1,+req.query.p||1), per=20;      // 無名一頁 20 本（5×4）
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
  const page=Math.max(1,+req.query.p||1), per=20;
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
app.post('/register',async (req,res)=>{
  const {name='',nick='',pass='',pass2=''}=req.body;
  const err = !/^[a-z0-9_]{3,20}$/i.test(name)?'帳號限 3~20 位英數字或底線':!nick.trim()?'請填暱稱':pass.length<4?'密碼至少 4 碼':pass!==pass2?'兩次密碼不一致':await one('SELECT 1 FROM users WHERE name=?',name)?'這個帳號已經有人用了':null;
  if(err) return res.render('register',{err,form:req.body});
  const s=salt(), low=name.toLowerCase();
  const first=!await one('SELECT 1 FROM users');
  const r=await run('INSERT INTO users(name,pass,salt,nick,admin) VALUES(?,?,?,?,?)',low,hash(pass,s),s,nick.trim().slice(0,20),(first||ADMIN_USERS.has(low))?1:0);
  await run('INSERT INTO albums(user_id,title) VALUES(?,?)',r.lastInsertRowid,'我的相簿');
  req.session.uid=Number(r.lastInsertRowid); flash(req,'歡迎加入 vibeai 小站！'); res.redirect('/'+name.toLowerCase());
});
app.get('/login',(req,res)=>res.render('login',{err:null,next:req.query.next||''}));
app.post('/login',async (req,res)=>{
  const u=await one('SELECT * FROM users WHERE name=?',req.body.name||'');
  if(!check(u,req.body.pass||'')) return res.render('login',{err:'帳號或密碼錯誤',next:req.body.next||''});
  if(ADMIN_USERS.has(u.name) && !u.admin) await run('UPDATE users SET admin=1 WHERE id=?',u.id); // ADMIN_USERS 名單登入即補站長權限
  req.session.uid=u.id; res.redirect(safePath(req.body.next) || '/'+u.name);
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
  if(title && body) for(const u of await all('SELECT id FROM users'))
    await run('INSERT INTO sysmsg(user_id,title,body) VALUES(?,?,?)',u.id,title,body);
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
  if(id!==res.locals.me.id){
    for(const p of await all('SELECT p.url,p.thumb FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=?',id)){ await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); }
    const av=await one('SELECT avatar FROM users WHERE id=?',id); if(av?.avatar?.startsWith('/uploads/')||av?.avatar?.startsWith('http')) await remove(av.avatar);
    await run('DELETE FROM users WHERE id=?',id);
  }
  res.redirect('/admin'); });

// ===== 無名小站風格網址 =====
// 當年的格式是 /album/帳號、/blog/帳號、/guestbook/帳號、/friend/帳號、/mypage/帳號。
// 這裡把它們轉到本站的 /帳號/... 結構，兩種網址都能用。
const SECTION={album:'album',blog:'blog',guestbook:'guestbook',friend:'friends',mypage:'',user:'card',
  video:'video',digu:'digu'};   // 影音與嘀咕的原站網址同樣是 /video/<帳號>、/digu/<帳號>
for(const [seg,dest] of Object.entries(SECTION)){
  app.get(`/${seg}/:name`,async (req,res,next)=>{
    if(!await one('SELECT 1 FROM users WHERE name=?',req.params.name)) return next();
    const qs=req.originalUrl.includes('?')?'?'+req.originalUrl.split('?')[1]:'';
    res.redirect(301,`/${req.params.name}${dest?'/'+dest:''}${qs}`);
  });
  app.get(`/${seg}/:name/*`,async (req,res,next)=>{
    if(!await one('SELECT 1 FROM users WHERE name=?',req.params.name)) return next();
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
  const page=Math.max(1,+req.query.p||1), per=20;
  const total=(await one('SELECT count(*) c FROM videos')).c;
  res.render('videos',{ page, pages:Math.ceil(total/per), total,
    videos:await all(`SELECT v.*,u.name uname,u.nick FROM videos v JOIN users u ON u.id=v.user_id
      ORDER BY v.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per),
    hot:await all(`SELECT v.id,v.title,v.views,u.name uname FROM videos v JOIN users u ON u.id=v.user_id
      ORDER BY v.views DESC LIMIT 10`) });
});

app.get('/digu',async (req,res)=>{
  const page=Math.max(1,+req.query.p||1), per=30;
  const total=(await one('SELECT count(*) c FROM digu')).c;
  res.render('digus',{ page, pages:Math.ceil(total/per), total,
    digus:await all(`SELECT d.*,u.name uname,u.nick,u.avatar FROM digu d JOIN users u ON u.id=d.user_id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per) });
});

app.get('/join',async (req,res)=>{
  const page=Math.max(1,+req.query.p||1), per=20;
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
  const page=Math.max(1,+req.query.p||1), per=24;
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
    const hit=await one("SELECT id FROM hala_topics WHERE official=1 AND (title LIKE ? OR cat LIKE ?) ORDER BY id LIMIT 1",
      '%'+req.query.q+'%','%'+req.query.q+'%');
    if(hit) return res.redirect('/hala/'+hit.id);
  }
  const page=Math.max(1,+req.query.p||1), per=20;
  const total=(await one('SELECT count(*) c FROM hala_topics')).c;
  res.render('hala',{ page, pages:Math.ceil(total/per), total,
    topics:await all(`SELECT t.*,u.name uname,u.nick,
        (SELECT count(*) FROM hala_posts WHERE topic_id=t.id) n
      FROM hala_topics t LEFT JOIN users u ON u.id=t.user_id
      ORDER BY t.official DESC, t.id DESC LIMIT ? OFFSET ?`,per,(page-1)*per) });
});
const halaTopic=async (req,res,id)=>{
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
const RESERVED=new Set(['login','register','logout','rank','search','help','admin','uploads','img','style.css','favicon.ico',
  'join','hala','svcs',
  ...Object.keys(SECTION)]);
const site=express.Router({mergeParams:true});
autoAsync(site);   // 個人小站的路由同樣需要 async 錯誤轉交（理由見檔頭 wrapAsync）

// 數字型路由參數的守門員。
//
// 為什麼要有這個：`/album/rss`、`/blog/new` 這種具名路由如果註冊在 `/album/:id`
// 後面，就會被參數路由先接走，把 'rss' 當成編號送進 SQL。
//   SQLite   靜靜回一列都沒有 → 看起來像 404，本機完全測不出來
//   Postgres 直接拋 invalid input syntax for integer → **正式站 500**
// 同樣的道理，任何人手打 /meimei/photo/abc 也會讓正式站噴 500 而不是 404。
// 在 router 層一次擋掉：不是純數字就 next('route')，讓它落到 404 那一支。
// 新增數字參數時記得把名字加進這個清單。
for (const p of ['id', 'pid', 'cid', 'aid']) {
  const guard = (req, res, next, val) => /^[0-9]+$/.test(String(val)) ? next() : next('route');
  site.param(p, guard);
  app.param(p, guard);
}
app.use('/:name',async (req,res,next)=>{
  if(RESERVED.has(req.params.name)) return next();
  const u=await one('SELECT * FROM users WHERE name=?',req.params.name); if(!u) return next();
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
    "SELECT u2.name,u2.nick,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f "
    + "JOIN users u2 ON u2.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u2.name LIMIT 300", u.id);
  site(req,res,next);
});
const U=res=>res.locals.u;

// 今日人氣／累積人氣：跨日自動歸零今日計數（無名兩個數字都顯示）
const today=()=>new Date().toLocaleDateString('sv-SE');
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
    albums:await all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC LIMIT 6`,u.id),
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
  const page=Math.max(1,+req.query.p||1), per=50;
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
  let avatar=u.avatar; if(req.file){ const s=await save(req.file); avatar=s.thumb; await remove(u.avatar); }
  await run('UPDATE users SET nick=?,intro=?,music=?,css=?,css_blog=?,avatar=?,theme=? WHERE id=?',(nick||u.nick).trim().slice(0,20),(intro||'').slice(0,500),cleanMusic(music),(css||'').slice(0,20000),(css_blog||'').slice(0,20000),avatar,isSkin(req.body.theme)?(req.body.theme||''):'',u.id);
  if(pass){ if(pass!==pass2) {flash(req,'兩次密碼不一致，其他設定已儲存');return res.redirect(`/${u.name}/settings`);} const s=salt(); await run('UPDATE users SET pass=?,salt=? WHERE id=?',hash(pass,s),s,u.id); }
  flash(req,'設定已儲存'); res.redirect(`/${u.name}/settings`);
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
// SSRF 防護與抓取全部在 src/feed.js（那支的檔頭寫了為什麼「檢查網址字串」不夠）。
// 側欄要用的時候才更新，而且 30 分鐘內不重抓。
// 放在 render 之前 await 會讓每一頁網誌都等外部網站——所以**不等**：
// 這一輪先把上次的結果印出去，順便在背景更新，下一次進來就是新的。
async function refreshSubs(uid){
  const rows = await all('SELECT * FROM subs WHERE user_id=?', uid);
  for(const s of rows){
    if(s.fetched && Date.now() - Date.parse(s.fetched) < 30*60*1000) continue;
    const got = await fetchFeed(s.url);
    if(got) await run('UPDATE subs SET last_title=?,last_url=?,last_date=?,fetched=? WHERE id=?',
      got.title, got.url, got.date, new Date().toISOString(), s.id);
    else await run('UPDATE subs SET fetched=? WHERE id=?', new Date().toISOString(), s.id);
  }
}
site.post('/subs',requireLogin,requireOwner,async (req,res)=>{
  const u=U(res), title=(req.body.title||'').trim().slice(0,30), url=subUrlOk((req.body.url||'').trim());
  if(title && url && (await one('SELECT count(*) c FROM subs WHERE user_id=?',u.id)).c < SUB_MAX){
    await run('INSERT INTO subs(user_id,title,url) VALUES(?,?,?)',u.id,title,url);
    refreshSubs(u.id).catch(()=>{});     // 不擋這一次的回應
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
  const u=U(res), title=(req.body.title||'').trim().slice(0,30), body=(req.body.body||'').slice(0,5000);
  if(title && (await one('SELECT count(*) c FROM folders WHERE user_id=?',u.id)).c < FOLDER_MAX){
    const seq=((await one('SELECT max(seq) m FROM folders WHERE user_id=?',u.id))?.m ?? 0)+1;
    await run('INSERT INTO folders(user_id,title,body,seq) VALUES(?,?,?,?)',u.id,title,body,seq);
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
// 刪除自己的帳號（需再次輸入密碼），連同照片一起清掉
site.post('/settings/delete',requireLogin,requireOwner,async(req,res)=>{
  const u=await one('SELECT * FROM users WHERE id=?',U(res).id);
  if(!check(u,req.body.pass||'')){ flash(req,'密碼錯誤，帳號未刪除'); return res.redirect(`/${u.name}/settings`); }
  for(const p of await all('SELECT p.url,p.thumb FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=?',u.id)){ await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); }
  if(u.avatar && u.avatar!=='/img/avatar.png') await remove(u.avatar);
  await run('DELETE FROM users WHERE id=?',u.id);
  req.session.destroy(()=>res.redirect('/'));
});
// 好友
site.post('/friend',requireLogin,async (req,res)=>{ const me=res.locals.me.id,u=U(res).id;
  if(me!==u){ if(await isFriend(me,u)) await run('DELETE FROM friends WHERE user_id=? AND friend_id=?',me,u);
              else await run("INSERT OR IGNORE INTO friends(user_id,friend_id,grp) VALUES(?,?,?)",me,u,(req.body.grp||'好友').trim().slice(0,10)||'好友'); }
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
  // 刪組不刪人：組裡的好友退回預設組（原站的 Default group）
  await run('UPDATE friends SET group_id=0 WHERE user_id=? AND group_id=?',uid,req.params.id);
  await run('DELETE FROM friend_groups WHERE id=? AND user_id=?',req.params.id,uid);
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
  friends:await all("SELECT u.name,u.nick,u.avatar,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u.name LIMIT 300",U(res).id)}));
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
// 分組名一律從 friend_groups 撈（group_id=0 就是原站的 Default group）。
// ⚠ 這個子查詢要放在 SELECT 裡，不能 JOIN friend_groups——
// rel=1/3 那兩種關係的 f 不是站主自己的那條邊，JOIN 會把筆數乘開。
const GRP_NAME = "COALESCE((SELECT name FROM friend_groups WHERE id=f.group_id),'好友')";
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
  if(cate!=='' && (rel===0||rel===2)){ where+=' AND COALESCE(f.group_id,0)=?'; args.push(+cate||0); }
  // #searchInput 原站只搜帳號（js_lang_searchTip = 'Search ID'），照做
  if(q){ where+=' AND u.name LIKE ?'; args.push('%'+q+'%'); }
  return {from,where,grp,args};
}
site.get('/friends',async (req,res)=>{
  const uid=U(res).id;
  const rel=[0,1,2,3].includes(+req.query.c)?+req.query.c:0;
  // cateSelect 是分組 id：'' 或 '-1' 都代表全部，'0' 是預設組（原站的 Default group）
  const cateRaw=(req.query.cateSelect||'').trim().slice(0,10);
  const cate=/^-?\d+$/.test(cateRaw)?cateRaw:'';
  const q=(req.query.search_id||'').trim().slice(0,20);
  const page=Math.max(1,+req.query.p||1);
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
  const page=Math.max(1,+req.query.p||1), per=20;    // 無名一頁 20 本（5x4）
  const total=(await one('SELECT count(*) c FROM albums WHERE user_id=?',U(res).id)).c;
  res.render('album',{nav:'album',topics:ALBUM_TOPICS,places:PLACES,
    page,pages:Math.ceil(total/per),total,
    quota:{used:await usedBytes(U(res).id),total:USER_QUOTA,mb:MB},
    albums:await all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?`,U(res).id,per,(page-1)*per)});
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
site.get('/album/:id',albumOf,async (req,res)=>{
  const a=res.locals.album;
  if(!await albumAllowed(req,res)) return res.status(403).render('msg',{title:'好友限定',msg:'這本相簿是好友限定，只有 '+U(res).nick+' 的好友才看得到。',back:'/'+U(res).name+'/album'});
  if(!albumUnlocked(req,res)) return res.render('album_lock',{nav:'album',album:a,err:null});
  if(!res.locals.isOwner) await run('UPDATE albums SET views=views+1 WHERE id=?',a.id);
  res.render('photos',{nav:'album',album:a,topics:ALBUM_TOPICS,places:PLACES,
    viewAll: req.query.all==='1',                    // 「一頁瀏覽」：整本大圖一次看完
    photos:await all('SELECT * FROM photos WHERE album_id=? ORDER BY id',a.id)});
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
site.post('/album/:id/unlock',albumOf,(req,res)=>{ const a=res.locals.album; if(req.body.pass===a.pass){ req.session.unlocked=[...(req.session.unlocked||[]),a.id]; return res.redirect(`/${U(res).name}/album/${a.id}`);} res.render('album_lock',{nav:'album',album:a,err:'密碼錯誤'}); });
site.post('/album/:id/edit',requireLogin,requireOwner,albumOf,async (req,res)=>{ await run('UPDATE albums SET title=?,descr=?,pass=?,topic=?,place=?,friends_only=? WHERE id=?',(req.body.title||res.locals.album.title).trim().slice(0,40),(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20),isAlbumTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'',req.body.friends_only?1:0,res.locals.album.id); res.redirect(`/${U(res).name}/album/${res.locals.album.id}`); });
site.post('/album/:id/del',requireLogin,requireOwner,albumOf,async(req,res)=>{ for(const p of await all('SELECT url,thumb FROM photos WHERE album_id=?',res.locals.album.id)){ await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); } await run('DELETE FROM albums WHERE id=?',res.locals.album.id); res.redirect(`/${U(res).name}/album`); });
site.post('/album/:id/upload',requireLogin,requireOwner,albumOf,upload.array('photos',20),async(req,res)=>{
  const a=res.locals.album; let first=null;
  const files=req.files||[];
  const incoming=files.reduce((n,f)=>n+f.size,0);
  const err=await quotaError(U(res).id,incoming);
  if(err) return res.status(413).render('msg',{title:'空間不足',msg:err,back:`/${U(res).name}/album/${a.id}`});
  // save() 回傳的尺寸與 EXIF 要一起寫進來，照片頁的 #exif 面板才有東西可印
  for(const f of files){ const s=await save(f); if(!first) first=s.thumb;
    await run('INSERT INTO photos(album_id,url,thumb,caption,bytes,width,height,taken,camera) VALUES(?,?,?,?,?,?,?,?,?)',
      a.id,s.url,s.thumb,(req.body.caption||'').slice(0,100),s.bytes,s.width||0,s.height||0,s.taken||'',s.camera||''); }
  if(first && !a.cover) await run('UPDATE albums SET cover=? WHERE id=?',first,a.id);
  if(first) await act(U(res).id,'album',a.title,`/${U(res).name}/album/${a.id}`);
  flash(req,`上傳了 ${req.files?.length||0} 張照片`); res.redirect(`/${U(res).name}/album/${a.id}`);
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
site.post('/photo/:pid/comment',async (req,res)=>{ const p=await one('SELECT p.id,p.album_id,a.pass FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(!p) return res.redirect('/'+U(res).name+'/album'); res.locals.album={id:p.album_id,pass:p.pass}; if(!albumUnlocked(req,res)) return res.status(403).render('msg',{title:'沒有權限',msg:'相簿已上鎖',back:'/'+U(res).name+'/album'}); if(req.body.body?.trim()) await run('INSERT INTO photo_comments(photo_id,author,body) VALUES(?,?,?)',p.id,(res.locals.me?.nick||req.body.author||'訪客').slice(0,20),req.body.body.trim().slice(0,300)); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
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
    // 這張如果剛好是相簿封面，封面也要跟著換，不然封面會指到已刪的檔
    await run('UPDATE albums SET cover=? WHERE id=? AND cover=?',saved.url,p.album_id,oldUrl);
    await remove(oldUrl); if(oldThumb&&oldThumb!==oldUrl) await remove(oldThumb);
    flash(req,'照片已切割');
  }catch(e){ console.error(e); flash(req,'切割失敗，照片沒有變動'); }
  res.redirect(back);
});
site.post('/photo/:pid/caption',requireLogin,requireOwner,async (req,res)=>{ await run('UPDATE photos SET caption=? WHERE id=? AND album_id IN (SELECT id FROM albums WHERE user_id=?)',(req.body.caption||'').slice(0,100),req.params.pid,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/cover',requireLogin,requireOwner,async (req,res)=>{ const p=await one('SELECT * FROM photos WHERE id=?',req.params.pid); if(p) await run('UPDATE albums SET cover=? WHERE id=? AND user_id=?',p.url,p.album_id,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/del',requireLogin,requireOwner,async(req,res)=>{ const p=await one('SELECT p.* FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(p){ await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); await run('DELETE FROM photos WHERE id=?',p.id); await run("UPDATE albums SET cover=COALESCE((SELECT url FROM photos WHERE album_id=? LIMIT 1),'') WHERE id=? AND cover=?",p.album_id,p.album_id,p.url); return res.redirect(`/${U(res).name}/album/${p.album_id}`);} res.redirect(`/${U(res).name}/album`); });

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
const blogSide=async res=>({
  cats:await all('SELECT category,count(*) n FROM posts WHERE user_id=? GROUP BY category',U(res).id),
  recent:await all('SELECT id,title FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  recentC:await all('SELECT c.author,c.post_id,p.title FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.user_id=? ORDER BY c.id DESC LIMIT 5',U(res).id),
  months:await all("SELECT substr(created,1,7) ym, count(*) n FROM posts WHERE user_id=? GROUP BY ym ORDER BY ym DESC LIMIT 24",U(res).id),
  cal:await calendar(U(res).id, res.calYm),
  // 側欄自訂欄位（原站的 #boxFolder，可以有很多個）
  folders:await all('SELECT * FROM folders WHERE user_id=? ORDER BY seq,id',U(res).id),
  // 我的訂閱（原站的 #boxRssList）。這裡只讀資料庫裡上一次抓到的結果，
  // **不等外部網站**——順手在背景更新，下一次進來就是新的。
  // 直接 await 的話每一頁網誌都會被別人家的 RSS 拖慢。
  subs:await (async () => {
    const rows = await all("SELECT * FROM subs WHERE user_id=? AND last_title!='' ORDER BY id",U(res).id);
    refreshSubs(U(res).id).catch(()=>{});
    return rows;
  })(),
  // 「歷史上的今天」：往年同月同日發過的文（blog.md 記為後期加上的側欄模組）。
  // created 是 'YYYY-MM-DD HH:MM:SS' 字串，substr(created,6,5) 就是 'MM-DD'——
  // 兩個驅動都有 substr，不用寫方言分支（其他側欄查詢也是這樣切月份的）。
  // 只排除「今年的今天」：那些就是今天剛發的，放進「歷史上」很怪。
  onThisDay:await all(
    "SELECT id,title,created FROM posts WHERE user_id=? AND substr(created,6,5)=? "
    + "AND substr(created,1,4)!=? ORDER BY created DESC LIMIT 5",
    U(res).id,
    new Date().toLocaleDateString('sv-SE').slice(5),
    new Date().toLocaleDateString('sv-SE').slice(0,4)),
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
site.get('/blog',async (req,res)=>{ const cat=req.query.cat, ym=/^\d{4}-\d{2}$/.test(req.query.ym||'')?req.query.ym:null, page=Math.max(1,+req.query.p||1), per=10;
  const day=/^\d{4}-\d{2}-\d{2}$/.test(req.query.d||'')?req.query.d:null;
  // 日曆顯示的月份：?cal= 優先，其次跟著目前篩選的月份／日期
  res.calYm=/^\d{4}-\d{2}$/.test(req.query.cal||'')?req.query.cal:(ym||(day?day.slice(0,7):null));
  let where='user_id=?'; const args=[U(res).id];
  if(cat){ where+=' AND category=?'; args.push(cat); }
  if(ym){ where+=' AND substr(created,1,7)=?'; args.push(ym); }
  if(day){ where+=' AND substr(created,1,10)=?'; args.push(day); }
  const total=(await one(`SELECT count(*) c FROM posts WHERE ${where}`,...args)).c;
  res.render('blog',{nav:'blog',cat,ym,day,page,pages:Math.ceil(total/per),...await blogSide(res),posts:await all(`SELECT p.*,(SELECT count(*) FROM comments WHERE post_id=p.id) nc,(SELECT count(*) FROM trackbacks WHERE post_id=p.id) tb FROM posts p WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per)}); });
// 搜尋這個網誌（側欄模組：☑標題 ☐內容）
site.get('/blog/search',async (req,res)=>{
  const k=(req.query.q||'').trim(), inBody=req.query.body==='1';
  const like=`%${k}%`;
  const rows = k ? await all(
    inBody ? "SELECT * FROM posts WHERE user_id=? AND pass='' AND (title LIKE ? OR body LIKE ?) ORDER BY id DESC LIMIT 50"
           : "SELECT * FROM posts WHERE user_id=? AND (title LIKE ?) ORDER BY id DESC LIMIT 50",
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
const rssDate = s => new Date(String(s).replace(' ', 'T')).toUTCString();
function rssFeed({ title, link, desc, items }) {
  const body = items.map(i =>
    `<item><title>${rssEsc(i.title)}</title><link>${i.link}</link>`
    + `<guid isPermaLink="true">${i.link}</guid>`
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
    items:rows.map(m=>({ title:`${m.author}：${m.subject||'無標題'}`,
      link:`${origin}/${u.name}/guestbook`, created:m.created, desc:m.body })) }));
});

// 迴響 RSS：整個網誌的最新迴響（原站的 commentsRss20）。上鎖文章的迴響不放。
site.get('/blog/comments.rss',async (req,res)=>{
  const u=U(res), origin=originOf(req);
  const rows=await all(`SELECT c.id,c.author,c.body,c.created,p.id pid,p.title
    FROM comments c JOIN posts p ON p.id=c.post_id
    WHERE p.user_id=? AND p.pass='' ORDER BY c.id DESC LIMIT 20`,u.id);
  res.type('application/rss+xml').send(rssFeed({
    title:`${u.nick}的網誌迴響`, link:`${origin}/${u.name}/blog`, desc:u.intro||'',
    items:rows.map(c=>({ title:`${c.author} 回應了「${c.title}」`,
      link:`${origin}/${u.name}/blog/${c.pid}#postComments`, created:c.created, desc:c.body })) }));
});

const myPhotos = async res => await all(`SELECT p.id,p.thumb,p.url FROM photos p JOIN albums a ON a.id=p.album_id
  WHERE a.user_id=? ORDER BY p.id DESC LIMIT 40`, U(res).id);
site.get('/blog/new',requireLogin,requireOwner,async (req,res)=>res.render('post_edit',{nav:'blog',post:null,photos:await myPhotos(res),emotes:EMOTES,...await blogSide(res)}));
site.post('/blog/new',requireLogin,requireOwner,async (req,res)=>{ const {title,body,category,mood,weather}=req.body;
  if(!title?.trim()||!body?.trim()) return res.redirect(`/${U(res).name}/blog/new`);
  const r=await run('INSERT INTO posts(user_id,title,body,category,mood,weather,pass,topic,place) VALUES(?,?,?,?,?,?,?,?,?)',U(res).id,title.trim().slice(0,100),body.slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',MOODS.includes(mood)?mood:'',WEATHERS.includes(weather)?weather:'',(req.body.pass||'').slice(0,20),isBlogTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'');
  await act(U(res).id,'blog',title.trim().slice(0,100),`/${U(res).name}/blog/${r.lastInsertRowid}`);
  res.redirect(`/${U(res).name}/blog/${r.lastInsertRowid}`); });
const postOf=async (req,res,next)=>{ const p=await one('SELECT * FROM posts WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!p) return next('route'); res.locals.post=p; next(); };
// 文章密碼（當年網誌可以上鎖，很多人拿來寫悄悄話）
const postUnlocked=(req,res)=>!res.locals.post.pass||res.locals.isOwner||(req.session.unlockedPosts||[]).includes(res.locals.post.id);
site.post('/blog/:id/unlock',postOf,async (req,res)=>{
  const p=res.locals.post;
  if(req.body.pass===p.pass){ req.session.unlockedPosts=[...(req.session.unlockedPosts||[]),p.id]; return res.redirect(`/${U(res).name}/blog/${p.id}`); }
  res.render('post_lock',{nav:'blog',post:p,...await blogSide(res),err:'密碼錯誤'});
});
site.get('/blog/:id',postOf,async (req,res)=>{ const p=res.locals.post;
  if(!postUnlocked(req,res)) return res.render('post_lock',{nav:'blog',post:p,...await blogSide(res),err:null});
  if(!res.locals.isOwner) await run('UPDATE posts SET views=views+1 WHERE id=?',p.id);
  res.render('post',{nav:'blog',post:p,...await blogSide(res),
    faved: res.locals.me?!!await one('SELECT 1 FROM favs WHERE user_id=? AND post_id=?',res.locals.me.id,p.id):false,
    favN: (await one('SELECT count(*) c FROM favs WHERE post_id=?',p.id)).c,
    // 「誰來收藏」：原站按下收藏數會展開收藏過這篇的人（blog.md 列為後期功能）。
    // 資料本來就在 favs 裡，只是之前沒有印出來。
    collectors:await all(`SELECT u.name,u.nick,u.avatar FROM favs f JOIN users u ON u.id=f.user_id
      WHERE f.post_id=? ORDER BY f.created DESC LIMIT 30`,p.id),
    comments:await all('SELECT * FROM comments WHERE post_id=? ORDER BY id',p.id),
    trackbacks:await all('SELECT t.*,p.title,p.id pid,u.name uname FROM trackbacks t JOIN posts p ON p.id=t.from_post JOIN users u ON u.id=p.user_id WHERE t.post_id=?',p.id),
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
    await run('INSERT INTO comments(post_id,author,body,email,homepage) VALUES(?,?,?,?,?)',
      res.locals.post.id,(res.locals.me?.nick||b.author||'訪客').trim().slice(0,20),
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
  const page=Math.max(1,+req.query.p||1), per=12;
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
  const page=Math.max(1,+req.query.p||1), per=20;
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
  const page=Math.max(1,+req.query.p||1),per=10;
  // 側欄那張名片小卡（#namecard）用得到：好友下拉 ＋ 最新一則嘀咕
  const side={
    gbFriends:await all("SELECT u.name,u.nick,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY grp, u.name LIMIT 300",U(res).id),
    bulletins:[], msgs:[], sys:[],
  };
  const unread = res.locals.isOwner ? (await one('SELECT count(*) c FROM sysmsg WHERE user_id=? AND seen=0',U(res).id)).c : 0;
  if(tab==='sys'){
    // 私人系統通知：語意上就是站主一個人的信箱，維持只有本人看得到。
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
    // 通知板主有新留言：只有登入者會觸發，且 10 分鐘內只發一則，避免被灌爆
    if(res.locals.me && res.locals.me.id!==U(res).id &&
       !await one("SELECT 1 FROM sysmsg WHERE user_id=? AND created>datetime('now','localtime','-10 minutes')",U(res).id))
      await run('INSERT INTO sysmsg(user_id,title,body) VALUES(?,?,?)',U(res).id,'你有新的留言',`${res.locals.me.nick} 在你的留言板留言了。`);
  }
  res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/reply',requireLogin,requireOwner,async (req,res)=>{ await run('UPDATE guestbook SET reply=? WHERE id=? AND user_id=?',(req.body.reply||'').trim().slice(0,500),req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/del',requireLogin,requireOwner,async (req,res)=>{ await run('DELETE FROM guestbook WHERE id=? AND user_id=?',req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });

app.use((req,res)=>res.status(404).render('msg',{title:'找不到頁面',msg:'找不到這個小站或頁面 (>_<)',back:'/'}));
app.use((err,req,res,next)=>{ console.error(err); res.status(500).render('msg',{title:'出錯了',msg:err.code==='LIMIT_FILE_SIZE'?'圖片太大了（上限 8MB）':'伺服器發生錯誤，請稍後再試',back:'/'}); });
// ===== 啟動 =====
await migrate();

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
startVisitFlusher(async (userId, n) => {
  await run('UPDATE users SET visits=visits+?, today_hits=today_hits+? WHERE id=?', n, n, userId);
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
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
