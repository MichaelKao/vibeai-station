import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'node:path';
import { one, all, run, migrate, driver } from './db.js';
import { sessionStore, startVisitFlusher, bumpVisit, hasRedis } from './cache.js';
import { hash, salt, check, requireLogin, requireOwner } from './auth.js';
import { save, remove, hasR2, diskFree } from './storage.js';
import { UPLOAD_DIR } from './paths.js';
import { render, EMOTES, safeCss } from './format.js';
import { SITE_NAME, SITE_DESC, SITE_LOGO, CDN, CDN_VARS, THEME_FOR } from './config.js';
import { ALBUM_TOPICS, BLOG_TOPICS, PLACES, MOODS, WEATHERS, ZODIACS, BLOODS, SEXES, CITIES, THEMES, isAlbumTopic, isBlogTopic, isPlace, isTheme } from './taxonomy.js';

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
  cookie: { maxAge: 30*864e5, httpOnly: true, sameSite: 'lax' },
}));
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:20},fileFilter:(r,f,cb)=>cb(null,/^image\/(jpeg|png|gif|webp)$/.test(f.mimetype))});

// locals
app.use(async (req,res,next)=>{
  res.locals.me = req.session.uid ? await one('SELECT id,name,nick,avatar,admin FROM users WHERE id=?',req.session.uid) : null;
  res.locals.u = null; res.locals.nav=''; res.locals.flash = req.session.flash; delete req.session.flash;
  res.locals.guest = req.session.guest || null;   // 訪客「記住我的資料」
  res.locals.render = render;   // 文章內文的安全格式化
  res.locals.safeCss = safeCss; // 使用者自訂 CSS 的過濾（見 format.js）
  // 站台識別與無名素材位置（views 全域可用，見 WRETCH_DOM.md）
  res.locals.SITE_NAME=SITE_NAME; res.locals.SITE_DESC=SITE_DESC; res.locals.SITE_LOGO=SITE_LOGO;
  res.locals.CDN=CDN; res.locals.CDN_VARS=CDN_VARS; res.locals.THEME_FOR=THEME_FOR;
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
  res.render('index',{
    hotAlbums: await all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0 AND a.cover!='' ORDER BY a.views DESC LIMIT 8`),
    newPhotos: await all(`SELECT p.*,a.title atitle,a.id aid,u.name uname FROM photos p JOIN albums a ON a.id=p.album_id JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.friends_only=0 ORDER BY p.id DESC LIMIT 8`),
    // 熱門網誌：左縮圖右文字，取作者最新一張照片當縮圖（同 2005 首頁）
    hotPosts: await all(`SELECT p.*,u.name uname,u.nick,
        (SELECT ph.thumb FROM photos ph JOIN albums al ON al.id=ph.album_id
         WHERE al.user_id=p.user_id AND al.pass='' AND al.friends_only=0 ORDER BY ph.id DESC LIMIT 1) pthumb
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.pass='' ORDER BY p.views DESC LIMIT 6`),
    featAlbums: await all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id
      WHERE a.featured=1 AND a.pass='' AND a.friends_only=0 AND a.cover!='' ORDER BY a.id DESC LIMIT 4`),
    featPosts: await all(`SELECT p.*,u.name uname,u.nick FROM posts p JOIN users u ON u.id=p.user_id
      WHERE p.featured=1 AND p.pass='' ORDER BY p.id DESC LIMIT 5`),
    newUsers: await all(`SELECT name,nick FROM users ORDER BY id DESC LIMIT 8`),
    rank: await all(`SELECT name,nick,visits FROM users ORDER BY visits DESC LIMIT 10`),
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
    posts:await all(`SELECT p.*,u.name uname,u.nick,(SELECT count(*) FROM comments WHERE post_id=p.id) nc
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
const requireAdmin=(req,res,next)=>res.locals.me?.admin?next():res.status(403).send('forbidden');
app.get('/admin',requireAdmin,async (req,res)=>res.render('admin',{
  users:await all(`SELECT u.id,u.name,u.nick,u.visits,u.admin,u.created,
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
app.post('/admin/notice',requireAdmin,async (req,res)=>{ if(req.body.body?.trim()) await run('INSERT INTO notices(body) VALUES(?)',req.body.body.trim().slice(0,200)); res.redirect('/admin'); });
app.post('/admin/notice/:id/del',requireAdmin,async (req,res)=>{ await run('DELETE FROM notices WHERE id=?',req.params.id); res.redirect('/admin'); });
app.post('/admin/user/:id/admin',requireAdmin,async (req,res)=>{ // 設為／取消站長（不能取消自己，避免把自己鎖在外面）
  const id=Number(req.params.id);
  if(id!==res.locals.me.id) await run('UPDATE users SET admin=1-admin WHERE id=?',id);
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
const SECTION={album:'album',blog:'blog',guestbook:'guestbook',friend:'friends',mypage:'',user:'card'};
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

// ===== 個人小站 =====
const RESERVED=new Set(['login','register','logout','rank','search','help','admin','uploads','img','style.css','favicon.ico',
  ...Object.keys(SECTION)]);
const site=express.Router({mergeParams:true});
autoAsync(site);   // 個人小站的路由同樣需要 async 錯誤轉交（理由見檔頭 wrapAsync）
app.use('/:name',async (req,res,next)=>{
  if(RESERVED.has(req.params.name)) return next();
  const u=await one('SELECT * FROM users WHERE name=?',req.params.name); if(!u) return next();
  res.locals.u=u; res.locals.isOwner=res.locals.me?.id===u.id;
  res.locals.isFriend=res.locals.me?await isFriend(res.locals.me.id,u.id):false;
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
    visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',u.id),
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
site.get('/settings',requireLogin,requireOwner,(req,res)=>res.render('settings',{nav:'user',themes:THEMES}));
site.post('/settings',requireLogin,requireOwner,upload.single('avatar'),async(req,res)=>{
  const {nick,intro,music,css,pass,pass2}=req.body, u=U(res);
  let avatar=u.avatar; if(req.file){ const s=await save(req.file); avatar=s.thumb; await remove(u.avatar); }
  await run('UPDATE users SET nick=?,intro=?,music=?,css=?,avatar=?,theme=? WHERE id=?',(nick||u.nick).trim().slice(0,20),(intro||'').slice(0,500),cleanMusic(music),(css||'').slice(0,20000),avatar,isTheme(req.body.theme)?req.body.theme:'',u.id);
  if(pass){ if(pass!==pass2) {flash(req,'兩次密碼不一致，其他設定已儲存');return res.redirect(`/${u.name}/settings`);} const s=salt(); await run('UPDATE users SET pass=?,salt=? WHERE id=?',hash(pass,s),s,u.id); }
  flash(req,'設定已儲存'); res.redirect(`/${u.name}/settings`);
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
site.post('/friends/:fid/group',requireLogin,requireOwner,async (req,res)=>{
  await run('UPDATE friends SET grp=? WHERE user_id=? AND friend_id=?',(req.body.grp||'好友').trim().slice(0,10)||'好友',U(res).id,req.params.fid);
  res.redirect(`/${U(res).name}/friends`); });
site.get('/card',async (req,res)=>res.render('card',{nav:'card',
  zodiacs:ZODIACS,bloods:BLOODS,sexes:SEXES,cities:CITIES,
  visitors:await all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),
  friends:await all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',U(res).id)}));
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
site.get('/friends',async (req,res)=>res.render('friends',{nav:'user',
  friends:await all("SELECT u.id,u.name,u.nick,u.avatar,u.intro,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY grp, f.created DESC",U(res).id),
  fans:await all('SELECT u.name,u.nick,u.avatar FROM friends f JOIN users u ON u.id=f.user_id WHERE f.friend_id=? ORDER BY f.created DESC',U(res).id)}));

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
const albumOf=async (req,res,next)=>{ const a=await one('SELECT * FROM albums WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!a) return next('route'); res.locals.album=a; next(); };
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
site.post('/album/:id/unlock',albumOf,(req,res)=>{ const a=res.locals.album; if(req.body.pass===a.pass){ req.session.unlocked=[...(req.session.unlocked||[]),a.id]; return res.redirect(`/${U(res).name}/album/${a.id}`);} res.render('album_lock',{nav:'album',album:a,err:'密碼錯誤'}); });
site.post('/album/:id/edit',requireLogin,requireOwner,albumOf,async (req,res)=>{ await run('UPDATE albums SET title=?,descr=?,pass=?,topic=?,place=?,friends_only=? WHERE id=?',(req.body.title||res.locals.album.title).trim().slice(0,40),(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20),isAlbumTopic(req.body.topic)?req.body.topic:'',isPlace(req.body.place)?req.body.place:'',req.body.friends_only?1:0,res.locals.album.id); res.redirect(`/${U(res).name}/album/${res.locals.album.id}`); });
site.post('/album/:id/del',requireLogin,requireOwner,albumOf,async(req,res)=>{ for(const p of await all('SELECT url,thumb FROM photos WHERE album_id=?',res.locals.album.id)){ await remove(p.url); if(p.thumb&&p.thumb!==p.url) await remove(p.thumb); } await run('DELETE FROM albums WHERE id=?',res.locals.album.id); res.redirect(`/${U(res).name}/album`); });
site.post('/album/:id/upload',requireLogin,requireOwner,albumOf,upload.array('photos',20),async(req,res)=>{
  const a=res.locals.album; let first=null;
  const files=req.files||[];
  const incoming=files.reduce((n,f)=>n+f.size,0);
  const err=await quotaError(U(res).id,incoming);
  if(err) return res.status(413).render('msg',{title:'空間不足',msg:err,back:`/${U(res).name}/album/${a.id}`});
  for(const f of files){ const s=await save(f); if(!first) first=s.thumb; await run('INSERT INTO photos(album_id,url,thumb,caption,bytes) VALUES(?,?,?,?,?)',a.id,s.url,s.thumb,(req.body.caption||'').slice(0,100),s.bytes); }
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
  moods:MOODS, weathers:WEATHERS, blogTopics:BLOG_TOPICS});
site.get('/blog',async (req,res)=>{ const cat=req.query.cat, ym=/^\d{4}-\d{2}$/.test(req.query.ym||'')?req.query.ym:null, page=Math.max(1,+req.query.p||1), per=10;
  const day=/^\d{4}-\d{2}-\d{2}$/.test(req.query.d||'')?req.query.d:null;
  // 日曆顯示的月份：?cal= 優先，其次跟著目前篩選的月份／日期
  res.calYm=/^\d{4}-\d{2}$/.test(req.query.cal||'')?req.query.cal:(ym||(day?day.slice(0,7):null));
  let where='user_id=?'; const args=[U(res).id];
  if(cat){ where+=' AND category=?'; args.push(cat); }
  if(ym){ where+=' AND substr(created,1,7)=?'; args.push(ym); }
  if(day){ where+=' AND substr(created,1,10)=?'; args.push(day); }
  const total=(await one(`SELECT count(*) c FROM posts WHERE ${where}`,...args)).c;
  res.render('blog',{nav:'blog',cat,ym,day,page,pages:Math.ceil(total/per),...await blogSide(res),posts:await all(`SELECT p.*,(SELECT count(*) FROM comments WHERE post_id=p.id) nc FROM posts p WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per)}); });
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
const myPhotos = async res => await all(`SELECT p.id,p.thumb,p.url FROM photos p JOIN albums a ON a.id=p.album_id
  WHERE a.user_id=? ORDER BY p.id DESC LIMIT 40`, U(res).id);
site.get('/blog/new',requireLogin,requireOwner,async (req,res)=>res.render('post_edit',{nav:'blog',post:null,photos:await myPhotos(res),emotes:EMOTES,...await blogSide(res)}));
site.post('/blog/new',requireLogin,requireOwner,async (req,res)=>{ const {title,body,category,mood,weather}=req.body;
  if(!title?.trim()||!body?.trim()) return res.redirect(`/${U(res).name}/blog/new`);
  const r=await run('INSERT INTO posts(user_id,title,body,category,mood,weather,pass,topic) VALUES(?,?,?,?,?,?,?,?)',U(res).id,title.trim().slice(0,100),body.slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',MOODS.includes(mood)?mood:'',WEATHERS.includes(weather)?weather:'',(req.body.pass||'').slice(0,20),isBlogTopic(req.body.topic)?req.body.topic:'');
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
    comments:await all('SELECT * FROM comments WHERE post_id=? ORDER BY id',p.id),
    trackbacks:await all('SELECT t.*,p.title,p.id pid,u.name uname FROM trackbacks t JOIN posts p ON p.id=t.from_post JOIN users u ON u.id=p.user_id WHERE t.post_id=?',p.id),
    prev:await one('SELECT id,title FROM posts WHERE user_id=? AND id<? ORDER BY id DESC',U(res).id,p.id),next:await one('SELECT id,title FROM posts WHERE user_id=? AND id>? ORDER BY id',U(res).id,p.id)}); });
site.get('/blog/:id/edit',requireLogin,requireOwner,postOf,async (req,res)=>res.render('post_edit',{nav:'blog',post:res.locals.post,photos:await myPhotos(res),emotes:EMOTES,...await blogSide(res)}));
site.post('/blog/:id/edit',requireLogin,requireOwner,postOf,async (req,res)=>{ const {title,body,category,mood,weather}=req.body;
  await run('UPDATE posts SET title=?,body=?,category=?,mood=?,weather=?,pass=?,topic=? WHERE id=?',(title||res.locals.post.title).trim().slice(0,100),(body||'').slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',MOODS.includes(mood)?mood:'',WEATHERS.includes(weather)?weather:'',(req.body.pass||'').slice(0,20),isBlogTopic(req.body.topic)?req.body.topic:'',res.locals.post.id);
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

// 留言板
// 留言板：頁籤 留言板 / 系統訊息 / 我要留言（同無名）
site.get('/guestbook',async (req,res)=>{
  const tab = req.query.tab==='sys' ? 'sys' : (req.query.tab==='new' ? 'new' : 'list');
  const page=Math.max(1,+req.query.p||1),per=15;
  if(tab==='sys'){
    if(!res.locals.isOwner) return res.status(403).render('msg',{title:'沒有權限',msg:'系統訊息只有本人看得到',back:`/${U(res).name}/guestbook`});
    const total=(await one('SELECT count(*) c FROM sysmsg WHERE user_id=?',U(res).id)).c;
    await run('UPDATE sysmsg SET seen=1 WHERE user_id=?',U(res).id);
    return res.render('guestbook',{nav:'gb',tab,page,pages:Math.ceil(total/per),total,msgs:[],
      sys:await all('SELECT * FROM sysmsg WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per),unread:0});
  }
  const total=(await one('SELECT count(*) c FROM guestbook WHERE user_id=?',U(res).id)).c;
  res.render('guestbook',{nav:'gb',tab,page,pages:Math.ceil(total/per),total,sys:[],
    unread: res.locals.isOwner ? (await one('SELECT count(*) c FROM sysmsg WHERE user_id=? AND seen=0',U(res).id)).c : 0,
    msgs:await all('SELECT * FROM guestbook WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per)}); });
site.post('/guestbook',async (req,res)=>{ const {author,subject,body,secret}=req.body; const who=res.locals.me?.nick||author;
  if(who?.trim()&&body?.trim()){
    await run('INSERT INTO guestbook(user_id,author,subject,body,secret) VALUES(?,?,?,?,?)',U(res).id,who.trim().slice(0,20),(subject||'').trim().slice(0,40),body.trim().slice(0,500),secret?1:0);
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

// 人氣計數 write-behind：bumpHits() 只在 Redis 累加，這裡每 30 秒把增量寫回資料庫。
// 原本每次瀏覽都 UPDATE 一次，是全站最頻繁的寫入；批次之後 N 次寫入壓成 1 次。
// 沒有 Redis 時 bumpHits() 會回傳 true，由它自己直接寫，這個排程等於空轉。
startVisitFlusher(async (userId, n) => {
  await run('UPDATE users SET visits=visits+?, today_hits=today_hits+? WHERE id=?', n, n, userId);
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(
  `vibeai 小站 → http://localhost:${PORT}　資料庫 ${driver}　session ${hasRedis?'redis':'memory'}`));
