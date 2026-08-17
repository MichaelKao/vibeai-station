import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'node:path';
import { one, all, run } from './db.js';
import { hash, salt, check, requireLogin, requireOwner } from './auth.js';
import { save, remove, hasR2, diskFree } from './storage.js';

const app = express();
app.set('view engine','ejs'); app.set('views', path.resolve('views'));
app.set('trust proxy',1);
app.use(express.static(path.resolve('public')));
app.use('/uploads', express.static(path.resolve('data/uploads')));
app.use(express.urlencoded({extended:false}));
app.use(session({secret:process.env.SESSION_SECRET||'vibeai-dev-secret',resave:false,saveUninitialized:false,cookie:{maxAge:30*864e5,httpOnly:true}}));
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:20},fileFilter:(r,f,cb)=>cb(null,/^image\/(jpeg|png|gif|webp)$/.test(f.mimetype))});

// locals
app.use((req,res,next)=>{
  res.locals.me = req.session.uid ? one('SELECT id,name,nick,avatar,admin FROM users WHERE id=?',req.session.uid) : null;
  res.locals.u = null; res.locals.nav=''; res.locals.flash = req.session.flash; delete req.session.flash;
  next();
});
const flash=(req,m)=>{req.session.flash=m};

// ===== 儲存空間保護 =====
// 沒接 R2 時照片與 SQLite 共用同一顆 Volume，塞爆會連資料庫都寫不進去，
// 所以（1）每人配額 (2)磁碟保留水位，兩道都擋在寫入之前。
const USER_QUOTA = (+process.env.USER_QUOTA_MB || 500) * 1024 * 1024;
const DISK_RESERVE = (+process.env.DISK_RESERVE_MB || 1024) * 1024 * 1024;
const MB = n => (n/1024/1024).toFixed(1);
const usedBytes = uid => one('SELECT COALESCE(SUM(bytes),0) b FROM photos WHERE album_id IN (SELECT id FROM albums WHERE user_id=?)',uid).b;
function quotaError(uid, incoming){
  const used = usedBytes(uid);
  if (used + incoming > USER_QUOTA)
    return `你的相簿空間已用 ${MB(used)} MB / ${MB(USER_QUOTA)} MB，這次上傳 ${MB(incoming)} MB 會超過上限。請先刪掉一些照片，或請站長調高配額。`;
  if (diskFree() - incoming < DISK_RESERVE)
    return '伺服器儲存空間不足，暫時無法上傳。已通知站長，請稍後再試。';
  return null;
}
const isFriend=(a,b)=>!!one('SELECT 1 FROM friends WHERE user_id=? AND friend_id=?',a,b);

// ===== 全站 =====
app.get('/', (req,res)=>{
  res.render('index',{
    hotAlbums: all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.cover!='' ORDER BY a.views DESC LIMIT 8`),
    newPhotos: all(`SELECT p.*,a.title atitle,a.id aid,u.name uname FROM photos p JOIN albums a ON a.id=p.album_id JOIN users u ON u.id=a.user_id WHERE a.pass='' ORDER BY p.id DESC LIMIT 8`),
    hotPosts: all(`SELECT p.*,u.name uname,u.nick FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.views DESC LIMIT 10`),
    newUsers: all(`SELECT name,nick FROM users ORDER BY id DESC LIMIT 8`),
    rank: all(`SELECT name,nick,visits FROM users ORDER BY visits DESC LIMIT 10`),
    notices: all(`SELECT * FROM notices ORDER BY id DESC LIMIT 5`),
    stats:{users:one('SELECT count(*) c FROM users').c,photos:one('SELECT count(*) c FROM photos').c,posts:one('SELECT count(*) c FROM posts').c}});
});
app.get('/rank',(req,res)=>res.render('rank',{
  users: all('SELECT name,nick,visits,avatar FROM users ORDER BY visits DESC LIMIT 50'),
  albums: all(`SELECT a.*,u.name uname,u.nick FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' ORDER BY a.views DESC LIMIT 30`),
  posts: all(`SELECT p.*,u.name uname,u.nick FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.views DESC LIMIT 30`)}));
app.get('/search',(req,res)=>{
  const k=(req.query.q||'').trim(), like=`%${k}%`;
  res.render('search',{k,
    users:k?all('SELECT name,nick,avatar FROM users WHERE name LIKE ? OR nick LIKE ? LIMIT 30',like,like):[],
    albums:k?all(`SELECT a.*,u.name uname FROM albums a JOIN users u ON u.id=a.user_id WHERE a.pass='' AND a.title LIKE ? LIMIT 30`,like):[],
    posts:k?all(`SELECT p.*,u.name uname FROM posts p JOIN users u ON u.id=p.user_id WHERE p.title LIKE ? OR p.body LIKE ? LIMIT 30`,like,like):[]});
});
app.get('/help',(req,res)=>res.render('help'));

// ===== 帳號 =====
// ADMIN_USERS=vibeai,someone 名單內的帳號註冊或登入時自動取得站長權限，
// 避免「第一個註冊的人就是站長」被誤佔（例如測試帳號）。
const ADMIN_USERS = new Set((process.env.ADMIN_USERS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
app.get('/register',(req,res)=>res.render('register',{err:null,form:{}}));
app.post('/register',(req,res)=>{
  const {name='',nick='',pass='',pass2=''}=req.body;
  const err = !/^[a-z0-9_]{3,20}$/i.test(name)?'帳號限 3~20 位英數字或底線':!nick.trim()?'請填暱稱':pass.length<4?'密碼至少 4 碼':pass!==pass2?'兩次密碼不一致':one('SELECT 1 FROM users WHERE name=?',name)?'這個帳號已經有人用了':null;
  if(err) return res.render('register',{err,form:req.body});
  const s=salt(), low=name.toLowerCase();
  const first=!one('SELECT 1 FROM users');
  const r=run('INSERT INTO users(name,pass,salt,nick,admin) VALUES(?,?,?,?,?)',low,hash(pass,s),s,nick.trim().slice(0,20),(first||ADMIN_USERS.has(low))?1:0);
  run('INSERT INTO albums(user_id,title) VALUES(?,?)',r.lastInsertRowid,'我的相簿');
  req.session.uid=Number(r.lastInsertRowid); flash(req,'歡迎加入 vibeai 小站！'); res.redirect('/'+name.toLowerCase());
});
app.get('/login',(req,res)=>res.render('login',{err:null,next:req.query.next||''}));
app.post('/login',(req,res)=>{
  const u=one('SELECT * FROM users WHERE name=?',req.body.name||'');
  if(!check(u,req.body.pass||'')) return res.render('login',{err:'帳號或密碼錯誤',next:req.body.next||''});
  if(ADMIN_USERS.has(u.name) && !u.admin) run('UPDATE users SET admin=1 WHERE id=?',u.id); // ADMIN_USERS 名單登入即補站長權限
  const nxt=req.body.next; const safe=typeof nxt==='string'&&nxt.startsWith('/')&&!nxt.startsWith('//')&&!nxt.startsWith('/\\'); req.session.uid=u.id; res.redirect(safe?nxt:'/'+u.name);
});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

// ===== 站長後台 =====
const requireAdmin=(req,res,next)=>res.locals.me?.admin?next():res.status(403).send('forbidden');
app.get('/admin',requireAdmin,(req,res)=>res.render('admin',{
  users:all(`SELECT u.id,u.name,u.nick,u.visits,u.admin,u.created,
    (SELECT COALESCE(SUM(p.bytes),0) FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=u.id) bytes
    FROM users u ORDER BY u.id DESC`),
  notices:all('SELECT * FROM notices ORDER BY id DESC'),
  storage:{ total:one('SELECT COALESCE(SUM(bytes),0) b FROM photos').b, free:diskFree(), r2:hasR2, quota:USER_QUOTA, mb:MB }}));
app.post('/admin/notice',requireAdmin,(req,res)=>{ if(req.body.body?.trim()) run('INSERT INTO notices(body) VALUES(?)',req.body.body.trim().slice(0,200)); res.redirect('/admin'); });
app.post('/admin/notice/:id/del',requireAdmin,(req,res)=>{ run('DELETE FROM notices WHERE id=?',req.params.id); res.redirect('/admin'); });
app.post('/admin/user/:id/admin',requireAdmin,(req,res)=>{ // 設為／取消站長（不能取消自己，避免把自己鎖在外面）
  const id=Number(req.params.id);
  if(id!==res.locals.me.id) run('UPDATE users SET admin=1-admin WHERE id=?',id);
  res.redirect('/admin'); });
app.post('/admin/user/:id/del',requireAdmin,async(req,res)=>{
  const id=Number(req.params.id);
  if(id!==res.locals.me.id){
    for(const p of all('SELECT p.url FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.user_id=?',id)) await remove(p.url);
    const av=one('SELECT avatar FROM users WHERE id=?',id); if(av?.avatar?.startsWith('/uploads/')||av?.avatar?.startsWith('http')) await remove(av.avatar);
    run('DELETE FROM users WHERE id=?',id);
  }
  res.redirect('/admin'); });

// ===== 個人小站 =====
const RESERVED=new Set(['login','register','logout','rank','search','help','admin','uploads','img','style.css','favicon.ico']);
const site=express.Router({mergeParams:true});
app.use('/:name',(req,res,next)=>{
  if(RESERVED.has(req.params.name)) return next();
  const u=one('SELECT * FROM users WHERE name=?',req.params.name); if(!u) return next();
  res.locals.u=u; res.locals.isOwner=res.locals.me?.id===u.id;
  res.locals.isFriend=res.locals.me?isFriend(res.locals.me.id,u.id):false;
  site(req,res,next);
});
const U=res=>res.locals.u;

site.get('/',(req,res)=>{
  const u=U(res);
  if(!res.locals.isOwner){ run('UPDATE users SET visits=visits+1 WHERE id=?',u.id);
    if(res.locals.me && !one("SELECT 1 FROM visitors WHERE user_id=? AND who=? AND created>datetime('now','localtime','-1 hour')",u.id,res.locals.me.name)) run('INSERT INTO visitors(user_id,who) VALUES(?,?)',u.id,res.locals.me.name); }
  res.render('home',{nav:'user',
    albums:all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC LIMIT 6`,u.id),
    posts:all('SELECT * FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 5',u.id),
    visitors:all('SELECT * FROM visitors WHERE user_id=? ORDER BY id DESC LIMIT 8',u.id),
    friends:all('SELECT u.name,u.nick FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? LIMIT 12',u.id),
    gb:all("SELECT * FROM guestbook WHERE user_id=? AND secret=0 ORDER BY id DESC LIMIT 3",u.id)});
});
// 個人設定
site.get('/settings',requireLogin,requireOwner,(req,res)=>res.render('settings',{nav:'user'}));
site.post('/settings',requireLogin,requireOwner,upload.single('avatar'),async(req,res)=>{
  const {nick,intro,music,css,pass,pass2}=req.body, u=U(res);
  let avatar=u.avatar; if(req.file){ avatar=await save(req.file); await remove(u.avatar); }
  run('UPDATE users SET nick=?,intro=?,music=?,css=?,avatar=? WHERE id=?',(nick||u.nick).trim().slice(0,20),(intro||'').slice(0,500),(music||'').slice(0,300),(css||'').slice(0,20000),avatar,u.id);
  if(pass){ if(pass!==pass2) {flash(req,'兩次密碼不一致，其他設定已儲存');return res.redirect(`/${u.name}/settings`);} const s=salt(); run('UPDATE users SET pass=?,salt=? WHERE id=?',hash(pass,s),s,u.id); }
  flash(req,'設定已儲存'); res.redirect(`/${u.name}/settings`);
});
// 好友
site.post('/friend',requireLogin,(req,res)=>{ const me=res.locals.me.id,u=U(res).id; if(me!==u){ if(isFriend(me,u)) run('DELETE FROM friends WHERE user_id=? AND friend_id=?',me,u); else run("INSERT OR IGNORE INTO friends(user_id,friend_id) VALUES(?,?)",me,u);} res.redirect('/'+U(res).name); });
site.get('/friends',(req,res)=>res.render('friends',{nav:'user',friends:all('SELECT u.name,u.nick,u.avatar,u.intro FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY f.created DESC',U(res).id),fans:all('SELECT u.name,u.nick,u.avatar FROM friends f JOIN users u ON u.id=f.user_id WHERE f.friend_id=? ORDER BY f.created DESC',U(res).id)}));

// 相簿
site.get('/album',(req,res)=>res.render('album',{nav:'album',
  quota:{used:usedBytes(U(res).id),total:USER_QUOTA,mb:MB},
  albums:all(`SELECT a.*,(SELECT count(*) FROM photos WHERE album_id=a.id) n FROM albums a WHERE user_id=? ORDER BY id DESC`,U(res).id)}));
site.post('/album',requireLogin,requireOwner,(req,res)=>{ const t=(req.body.title||'').trim().slice(0,40); if(t) run('INSERT INTO albums(user_id,title,descr,pass) VALUES(?,?,?,?)',U(res).id,t,(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20)); res.redirect(`/${U(res).name}/album`); });
const albumOf=(req,res,next)=>{ const a=one('SELECT * FROM albums WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!a) return next('route'); res.locals.album=a; next(); };
const albumUnlocked=(req,res)=>!res.locals.album.pass||res.locals.isOwner||(req.session.unlocked||[]).includes(res.locals.album.id);
site.get('/album/:id',albumOf,(req,res)=>{
  const a=res.locals.album; if(!albumUnlocked(req,res)) return res.render('album_lock',{nav:'album',album:a,err:null});
  if(!res.locals.isOwner) run('UPDATE albums SET views=views+1 WHERE id=?',a.id);
  res.render('photos',{nav:'album',album:a,photos:all('SELECT * FROM photos WHERE album_id=? ORDER BY id',a.id)});
});
site.post('/album/:id/unlock',albumOf,(req,res)=>{ const a=res.locals.album; if(req.body.pass===a.pass){ req.session.unlocked=[...(req.session.unlocked||[]),a.id]; return res.redirect(`/${U(res).name}/album/${a.id}`);} res.render('album_lock',{nav:'album',album:a,err:'密碼錯誤'}); });
site.post('/album/:id/edit',requireLogin,requireOwner,albumOf,(req,res)=>{ run('UPDATE albums SET title=?,descr=?,pass=? WHERE id=?',(req.body.title||res.locals.album.title).trim().slice(0,40),(req.body.descr||'').slice(0,200),(req.body.pass||'').slice(0,20),res.locals.album.id); res.redirect(`/${U(res).name}/album/${res.locals.album.id}`); });
site.post('/album/:id/del',requireLogin,requireOwner,albumOf,async(req,res)=>{ for(const p of all('SELECT url FROM photos WHERE album_id=?',res.locals.album.id)) await remove(p.url); run('DELETE FROM albums WHERE id=?',res.locals.album.id); res.redirect(`/${U(res).name}/album`); });
site.post('/album/:id/upload',requireLogin,requireOwner,albumOf,upload.array('photos',20),async(req,res)=>{
  const a=res.locals.album; let first=null;
  const files=req.files||[];
  const incoming=files.reduce((n,f)=>n+f.size,0);
  const err=quotaError(U(res).id,incoming);
  if(err) return res.status(413).render('msg',{title:'空間不足',msg:err,back:`/${U(res).name}/album/${a.id}`});
  for(const f of files){ const url=await save(f); if(!first) first=url; run('INSERT INTO photos(album_id,url,caption,bytes) VALUES(?,?,?,?)',a.id,url,(req.body.caption||'').slice(0,100),f.size); }
  if(first && !a.cover) run('UPDATE albums SET cover=? WHERE id=?',first,a.id);
  flash(req,`上傳了 ${req.files?.length||0} 張照片`); res.redirect(`/${U(res).name}/album/${a.id}`);
});
site.get('/photo/:pid',(req,res,next)=>{
  const p=one('SELECT p.*,a.pass,a.title atitle,a.id aid FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(!p) return next();
  res.locals.album={id:p.aid,pass:p.pass}; if(!albumUnlocked(req,res)) return res.redirect(`/${U(res).name}/album/${p.aid}`);
  if(!res.locals.isOwner) run('UPDATE photos SET views=views+1 WHERE id=?',p.id);
  const ids=all('SELECT id FROM photos WHERE album_id=? ORDER BY id',p.aid).map(x=>x.id), i=ids.indexOf(p.id);
  res.render('photo',{nav:'album',p,prev:ids[i-1],next:ids[i+1],idx:i+1,total:ids.length,comments:all('SELECT * FROM photo_comments WHERE photo_id=? ORDER BY id',p.id)});
});
site.post('/photo/:pid/comment',(req,res)=>{ const p=one('SELECT p.id,p.album_id,a.pass FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(!p) return res.redirect('/'+U(res).name+'/album'); res.locals.album={id:p.album_id,pass:p.pass}; if(!albumUnlocked(req,res)) return res.status(403).render('msg',{title:'沒有權限',msg:'相簿已上鎖',back:'/'+U(res).name+'/album'}); if(req.body.body?.trim()) run('INSERT INTO photo_comments(photo_id,author,body) VALUES(?,?,?)',p.id,(res.locals.me?.nick||req.body.author||'訪客').slice(0,20),req.body.body.trim().slice(0,300)); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/caption',requireLogin,requireOwner,(req,res)=>{ run('UPDATE photos SET caption=? WHERE id=? AND album_id IN (SELECT id FROM albums WHERE user_id=?)',(req.body.caption||'').slice(0,100),req.params.pid,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/cover',requireLogin,requireOwner,(req,res)=>{ const p=one('SELECT * FROM photos WHERE id=?',req.params.pid); if(p) run('UPDATE albums SET cover=? WHERE id=? AND user_id=?',p.url,p.album_id,U(res).id); res.redirect(`/${U(res).name}/photo/${req.params.pid}`); });
site.post('/photo/:pid/del',requireLogin,requireOwner,async(req,res)=>{ const p=one('SELECT p.* FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=? AND a.user_id=?',req.params.pid,U(res).id); if(p){ await remove(p.url); run('DELETE FROM photos WHERE id=?',p.id); run("UPDATE albums SET cover=COALESCE((SELECT url FROM photos WHERE album_id=? LIMIT 1),'') WHERE id=? AND cover=?",p.album_id,p.album_id,p.url); return res.redirect(`/${U(res).name}/album/${p.album_id}`);} res.redirect(`/${U(res).name}/album`); });

// 網誌
const blogSide=res=>({cats:all('SELECT category,count(*) n FROM posts WHERE user_id=? GROUP BY category',U(res).id),recent:all('SELECT id,title FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 8',U(res).id),recentC:all('SELECT c.author,c.post_id,p.title FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.user_id=? ORDER BY c.id DESC LIMIT 5',U(res).id)});
site.get('/blog',(req,res)=>{ const cat=req.query.cat, page=Math.max(1,+req.query.p||1), per=10;
  const where='user_id=?'+(cat?' AND category=?':''), args=cat?[U(res).id,cat]:[U(res).id];
  const total=one(`SELECT count(*) c FROM posts WHERE ${where}`,...args).c;
  res.render('blog',{nav:'blog',cat,page,pages:Math.ceil(total/per),...blogSide(res),posts:all(`SELECT p.*,(SELECT count(*) FROM comments WHERE post_id=p.id) nc FROM posts p WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,...args,per,(page-1)*per)}); });
site.get('/blog/new',requireLogin,requireOwner,(req,res)=>res.render('post_edit',{nav:'blog',post:null,...blogSide(res)}));
site.post('/blog/new',requireLogin,requireOwner,(req,res)=>{ const {title,body,category}=req.body; if(!title?.trim()||!body?.trim()) return res.redirect(`/${U(res).name}/blog/new`); const r=run('INSERT INTO posts(user_id,title,body,category) VALUES(?,?,?,?)',U(res).id,title.trim().slice(0,100),body.slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類'); res.redirect(`/${U(res).name}/blog/${r.lastInsertRowid}`); });
const postOf=(req,res,next)=>{ const p=one('SELECT * FROM posts WHERE id=? AND user_id=?',req.params.id,U(res).id); if(!p) return next('route'); res.locals.post=p; next(); };
site.get('/blog/:id',postOf,(req,res)=>{ const p=res.locals.post; if(!res.locals.isOwner) run('UPDATE posts SET views=views+1 WHERE id=?',p.id);
  res.render('post',{nav:'blog',post:p,...blogSide(res),comments:all('SELECT * FROM comments WHERE post_id=? ORDER BY id',p.id),
    trackbacks:all('SELECT t.*,p.title,p.id pid,u.name uname FROM trackbacks t JOIN posts p ON p.id=t.from_post JOIN users u ON u.id=p.user_id WHERE t.post_id=?',p.id),
    prev:one('SELECT id,title FROM posts WHERE user_id=? AND id<? ORDER BY id DESC',U(res).id,p.id),next:one('SELECT id,title FROM posts WHERE user_id=? AND id>? ORDER BY id',U(res).id,p.id)}); });
site.get('/blog/:id/edit',requireLogin,requireOwner,postOf,(req,res)=>res.render('post_edit',{nav:'blog',post:res.locals.post,...blogSide(res)}));
site.post('/blog/:id/edit',requireLogin,requireOwner,postOf,(req,res)=>{ const {title,body,category}=req.body; run('UPDATE posts SET title=?,body=?,category=? WHERE id=?',(title||res.locals.post.title).trim().slice(0,100),(body||'').slice(0,50000),(category||'未分類').trim().slice(0,20)||'未分類',res.locals.post.id); res.redirect(`/${U(res).name}/blog/${res.locals.post.id}`); });
site.post('/blog/:id/del',requireLogin,requireOwner,postOf,(req,res)=>{ run('DELETE FROM posts WHERE id=?',res.locals.post.id); res.redirect(`/${U(res).name}/blog`); });
site.post('/blog/:id/comment',postOf,(req,res)=>{ if(req.body.body?.trim()) run('INSERT INTO comments(post_id,author,body) VALUES(?,?,?)',res.locals.post.id,(res.locals.me?.nick||req.body.author||'訪客').trim().slice(0,20),req.body.body.trim().slice(0,1000)); res.redirect(`/${U(res).name}/blog/${res.locals.post.id}#comments`); });
site.post('/blog/:id/comment/:cid/del',requireLogin,requireOwner,postOf,(req,res)=>{ run('DELETE FROM comments WHERE id=? AND post_id=?',req.params.cid,res.locals.post.id); res.redirect(`/${U(res).name}/blog/${res.locals.post.id}#comments`); });
site.post('/blog/:id/like',postOf,(req,res)=>{ req.session.liked??=[]; if(!req.session.liked.includes(res.locals.post.id)){ req.session.liked.push(res.locals.post.id); run('UPDATE posts SET likes=likes+1 WHERE id=?',res.locals.post.id);} res.redirect(`/${U(res).name}/blog/${res.locals.post.id}`); });
// 引用：在自己的網誌建立一篇引用文，並在原文登記
site.post('/blog/:id/trackback',requireLogin,postOf,(req,res)=>{
  const p=res.locals.post, me=res.locals.me; if(me.id===U(res).id) return res.redirect(`/${U(res).name}/blog/${p.id}`);
  const r=run('INSERT INTO posts(user_id,title,body,category) VALUES(?,?,?,?)',me.id,'引用：'+p.title,`引用自 ${U(res).nick} 的文章《${p.title}》\n\n`+p.body.slice(0,300)+'…\n\n（原文：/'+U(res).name+'/blog/'+p.id+'）','引用');
  run('INSERT INTO trackbacks(post_id,from_post) VALUES(?,?)',p.id,r.lastInsertRowid); res.redirect(`/${me.name}/blog/${r.lastInsertRowid}/edit`); });

// 留言板
site.get('/guestbook',(req,res)=>{ const page=Math.max(1,+req.query.p||1),per=15,total=one('SELECT count(*) c FROM guestbook WHERE user_id=?',U(res).id).c;
  res.render('guestbook',{nav:'gb',page,pages:Math.ceil(total/per),msgs:all('SELECT * FROM guestbook WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',U(res).id,per,(page-1)*per)}); });
site.post('/guestbook',(req,res)=>{ const {author,body,secret}=req.body; const who=res.locals.me?.nick||author; if(who?.trim()&&body?.trim()) run('INSERT INTO guestbook(user_id,author,body,secret) VALUES(?,?,?,?)',U(res).id,who.trim().slice(0,20),body.trim().slice(0,500),secret?1:0); res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/reply',requireLogin,requireOwner,(req,res)=>{ run('UPDATE guestbook SET reply=? WHERE id=? AND user_id=?',(req.body.reply||'').trim().slice(0,500),req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });
site.post('/guestbook/:id/del',requireLogin,requireOwner,(req,res)=>{ run('DELETE FROM guestbook WHERE id=? AND user_id=?',req.params.id,U(res).id); res.redirect(`/${U(res).name}/guestbook`); });

app.use((req,res)=>res.status(404).render('msg',{title:'找不到頁面',msg:'找不到這個小站或頁面 (>_<)',back:'/'}));
app.use((err,req,res,next)=>{ console.error(err); res.status(500).render('msg',{title:'出錯了',msg:err.code==='LIMIT_FILE_SIZE'?'圖片太大了（上限 8MB）':'伺服器發生錯誤，請稍後再試',back:'/'}); });
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('vibeai 小站 → http://localhost:'+PORT));
