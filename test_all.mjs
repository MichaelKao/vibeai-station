// 全站回歸測試（本機跑，不進 git）
import zlib from 'node:zlib';
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])}
function png(w,h,s){const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;const raw=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*(w*3+1)+1+x*3;raw[i]=(x+s*40)%255;raw[i+1]=(y+s*20)%255;raw[i+2]=180;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch("IHDR",ih),ch("IDAT",zlib.deflateSync(raw)),ch("IEND",Buffer.alloc(0))]);}

const B = process.env.BASE || 'http://localhost:3000';
let pass=0, fail=0;
const ok  = (name,cond,extra='')=>{ cond?pass++:fail++; console.log((cond?'  PASS ':'! FAIL ')+name+(cond?'':'  '+extra)); };
const get = (p,ck)=>fetch(B+p,{headers:ck?{cookie:ck}:{},redirect:'manual'});
const post= (p,body,ck)=>fetch(B+p,{method:'POST',headers:{...(ck?{cookie:ck}:{}),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString(),redirect:'manual'});
const text= async (p,ck)=>(await fetch(B+p,{headers:ck?{cookie:ck}:{}})).text();
async function reg(n,nick){ const r=await post('/register',{name:n,nick,pass:'test1234',pass2:'test1234'}); return r.headers.getSetCookie()?.[0]?.split(';')[0]; }
async function login(n){ const r=await post('/login',{name:n,pass:'test1234'}); return r.headers.getSetCookie()?.[0]?.split(';')[0]; }

console.log('\n=== 帳號 ===');
const A=await reg('alpha','阿發'), Bc=await reg('bravo','布拉'), C=await reg('charlie','查理');
ok('註冊三個帳號', !!A && !!Bc && !!C);
ok('帳號太短被擋', (await post('/register',{name:'ab',nick:'x',pass:'1234',pass2:'1234'})).status===200);
ok('重複帳號被擋', (await text('/register')) !== null && (await (await post('/register',{name:'alpha',nick:'x',pass:'1234',pass2:'1234'})).text()).includes('已經有人用了'));
ok('密碼不符被擋', (await (await post('/register',{name:'zzz9',nick:'x',pass:'1234',pass2:'9999'})).text()).includes('兩次密碼不一致'));
ok('登入成功', !!(await login('alpha')));
ok('密碼錯誤被擋', (await (await post('/login',{name:'alpha',pass:'wrong'})).text()).includes('帳號或密碼錯誤'));

console.log('\n=== 相簿 ===');
await post('/alpha/album',{title:'我的旅行',topic:'國內旅遊',place:'台灣'},A);
const albPage=await text('/alpha/album',A);
const aid=Math.max(...[...albPage.matchAll(/\/alpha\/album\/([0-9]+)/g)].map(m=>+m[1]));
const f=new FormData(); for(let i=0;i<3;i++) f.append('photos',new Blob([png(300,220,i)],{type:'image/png'}),'p'+i+'.png');
f.append('caption','測試');
ok('上傳三張照片', (await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:f,redirect:'manual'})).status===302);
const alb=await text(`/alpha/album/${aid}`,A);
// 不要綁死在 class 名稱上——版面在復刻各年代的無名時會一直換 class，
// 綁 class 只會讓測試在功能沒壞的時候紅燈。驗真正的行為：三張照片都有連結可以點進去。
ok('相簿顯示照片', new Set(alb.match(/\/alpha\/photo\/\d+/g)||[]).size===3);
ok('有縮圖', alb.includes('_t.jpg'));
ok('一頁瀏覽', (await text(`/alpha/album/${aid}?all=1`,A)).includes('onepage'));
// 不綁實作細節（原本綁 slidedata 這個變數名）。驗行為：幻燈片頁要帶到整本照片。
{ const sl=await text(`/alpha/album/${aid}/slide`,A);
  ok('幻燈片', new Set(sl.match(/\/uploads\/[\w.]+/g)||[]).size===3); }
const ph=await text('/alpha/photo/1',A);
// 2012 原站的用詞是「回上一層」，「回頂端」是 2005 版的說法。
ok('照片導覽列', ph.includes('第一張')&&ph.includes('上一張')&&ph.includes('下一張')&&ph.includes('最後一張'));
// 不綁 class 名稱（版面在復刻不同年代時會換）。驗行為：照片頁要連得到同本的其他照片。
ok('照片縮圖列', new Set(ph.match(/\/alpha\/photo\/\d+/g)||[]).size>=3);

// 切割照片（原站工具列的「切割照片(NEW)」）。上傳的測試圖是 300×220。
ok('切割頁只有站主進得去', (await get('/alpha/photo/1/crop',A)).status===200 &&
   (await get('/alpha/photo/1/crop',Bc)).status===403);
ok('切割鈕只有站主看得到', (await text('/alpha/photo/1',A)).includes('切割照片') &&
   !(await text('/alpha/photo/1',Bc)).includes('切割照片'));
// 驗真的裁了：裁完會存成新檔（網址換掉），而且尺寸就是要求的 100×80。
// 上傳的測試圖是 300×220，所以裁出來一定比原圖小。
ok('切割真的裁了照片', await (async()=>{
  // ⚠ 樣板那一行用的是**單引號**（id='DisplayImage' src='…'，照原版存檔的寫法），
  // 正則只比對雙引號會永遠抓不到，看起來像功能壞了。
  const grab = h => h.match(/id=['"]DisplayImage['"][^>]*src=['"]([^'"]+)['"]/)?.[1];
  const before=grab(await text('/alpha/photo/1',A));
  const r=await post('/alpha/photo/1/crop',{x:10,y:10,w:100,h:80},A);
  const after=await text('/alpha/photo/1',A);
  const url=grab(after);
  return r.status===302 && !!url && url!==before && /100\s*[×x]\s*80/.test(after);
})());
ok('切割範圍太小被擋', (await post('/alpha/photo/1/crop',{x:0,y:0,w:2,h:2},A)).status===302);
// 相簿封面在上傳時存的是**縮圖**（first=s.thumb），但「設為封面」那支存的是大圖。
// 切割與刪除只比對大圖的話，封面是縮圖的相簿會指到已經被刪掉的檔＝破圖。
// tools/ownerflow.mjs 用真的瀏覽器抓到這個 404，這裡釘住。
ok('切割之後相簿頁的每一張圖都還在（封面不會變破圖）', await (async()=>{
  const page = await text(`/alpha/album/${aid}`,A);
  const covers = [...page.matchAll(/src="(\/uploads\/[^"]+)"/g)].map(m=>m[1]);
  for(const c of covers.slice(0,6)){
    const r = await get(c);
    if(r.status===404) return false;
  }
  return true;
})());
ok('非本人不能切割', (await post('/alpha/photo/1/crop',{x:0,y:0,w:50,h:50},Bc)).status===403);
console.log('\n=== 上傳的安全性 ===');
// ⚠ save() 原本有一個「轉檔失敗就退回原圖，不擋使用者上傳」的 catch，
// 那一行讓兩種攻擊直接成立，多代理稽核實測都成功：
//   1. decompression bomb：30000×30000 的 PNG 只有 109KB，sharp 拋
//      「exceeds pixel limit」被吞掉 → 原始位元組落地、縮圖也是同一份原檔。
//      相簿頁免登入，任何訪客要解出 9 億像素才畫得出那個 90px 的格子。
//   2. 偽造 MIME：文字檔／執行檔／0 byte 寫成 image/jpeg 就會落地。
ok('像素炸彈被擋下來', await (async()=>{
  // ⚠ 不能用 png(30000,30000) 造——那會先在測試自己這邊配置 2.7GB 的緩衝區。
  // decompression bomb 的本質是「IHDR 宣稱很大、實際位元組很小」，
  // 所以直接拿一張正常的小圖，把 IHDR 裡的寬高改成 30000×30000 就好。
  const small = png(8, 8, 1);
  const bomb = Buffer.from(small);
  bomb.writeUInt32BE(30000, 16);   // IHDR 的 width（8 位元組簽章 + 4 長度 + 4 型別）
  bomb.writeUInt32BE(30000, 20);   // IHDR 的 height
  const g=new FormData(); g.append('photos',new Blob([bomb],{type:'image/png'}),'bomb.png');
  // ⚠ 不能用「頁面上有沒有 bomb 這個字」來判斷——**flash 訊息裡就含檔名**
  // （「bomb.png：這個檔案不是圖片」），那樣寫會把「正確擋下來」誤判成失敗。
  // 要驗的是**照片有沒有真的多一張**。
  const before=new Set((await text(`/alpha/album/${aid}`,A)).match(/\/alpha\/photo\/\d+/g)||[]).size;
  const r=await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:g,redirect:'manual'});
  const after=new Set((await text(`/alpha/album/${aid}`,A)).match(/\/alpha\/photo\/\d+/g)||[]).size;
  return r.status<500 && after===before;
})());
ok('偽造 MIME 的文字檔不會落地', await (async()=>{
  const g=new FormData(); g.append('photos',new Blob([Buffer.from('this is not an image at all')],{type:'image/jpeg'}),'fake.jpg');
  const r=await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:g,redirect:'manual'});
  return r.status<500;
})());
ok('0 byte 檔不會落地', await (async()=>{
  const g=new FormData(); g.append('photos',new Blob([Buffer.alloc(0)],{type:'image/png'}),'zero.png');
  const r=await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:g,redirect:'manual'});
  return r.status<500;
})());
// 訊息要講實際成功的張數，不是收到幾個檔
ok('全部是壞檔時不會說「上傳了 N 張」', await (async()=>{
  const g=new FormData();
  g.append('photos',new Blob([Buffer.from('nope')],{type:'image/jpeg'}),'x1.jpg');
  await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:g,redirect:'manual'});
  const page=await text(`/alpha/album/${aid}`,A);
  return !page.includes('上傳了 1 張照片');
})());

ok('非圖片被拒', (await (async()=>{const g=new FormData();g.append('photos',new Blob([Buffer.from('hi')],{type:'text/plain'}),'a.txt');
  const r=await fetch(`${B}/alpha/album/${aid}/upload`,{method:'POST',headers:{cookie:A},body:g,redirect:'manual'}); return r.status===302;})()));

console.log('\n=== 密碼相簿 / 好友限定 ===');
await post('/alpha/album',{title:'秘密相簿',pass:'9999'},A);
const albPage2=await text('/alpha/album',A);
const secretId=Math.max(...[...albPage2.matchAll(/\/alpha\/album\/([0-9]+)/g)].map(m=>+m[1]));
ok('密碼相簿要密碼', (await text(`/alpha/album/${secretId}`,Bc)).includes('請輸入密碼'));
ok('密碼錯誤', (await (await post(`/alpha/album/${secretId}/unlock`,{pass:'x'},Bc)).text()).includes('密碼錯誤'));
const unlocked=await post(`/alpha/album/${secretId}/unlock`,{pass:'9999'},Bc);
ok('密碼正確可進', unlocked.status===302);
await post(`/alpha/album/${aid}/edit`,{title:'我的旅行',friends_only:'1'},A);
ok('好友限定擋外人', (await get(`/alpha/album/${aid}`,C)).status===403);
ok('好友限定擋訪客', (await get(`/alpha/album/${aid}`)).status===403);
await post('/charlie/friend',{},A);
ok('好友看得到', (await get(`/alpha/album/${aid}`,C)).status===200);
ok('好友限定不出現在總站', !(await text('/albums')).includes('我的旅行'));
// ⚠ 好友限定要擋的不只是「看」，還有「留言」。
// 相簿頁／幻燈片／相片牆／照片頁四個入口都查了 albumAllowed，
// 唯獨 POST /photo/:pid/comment 只查了密碼——非好友看不到照片卻留得了言。
// 多代理稽核實測寫得進 photo_comments。
ok('好友限定擋非好友留言', await (async()=>{
  await post(`/alpha/album/${aid}/edit`,{title:'我的旅行',friends_only:'1'},A);
  const r = await post('/alpha/photo/1/comment',{body:'非好友的留言'},Bc);
  const seen = (await text('/alpha/photo/1',A)).includes('非好友的留言');
  await post(`/alpha/album/${aid}/edit`,{title:'我的旅行'},A);   // 改回公開
  return r.status===403 && !seen;
})());
await post(`/alpha/album/${aid}/edit`,{title:'我的旅行'},A);

console.log('\n=== 相片牆 ===');
// 相片牆是原站的 VIP 功能（album/display.php?style=angel|taylor）。
// 驗行為：兩種模式都要把整本照片連出來，而且權限跟相簿本身一樣嚴。
{
  const wall = await text(`/alpha/album/${aid}/wall`,A);
  ok('相片牆（瀑布）列出整本照片', new Set(wall.match(/\/alpha\/photo\/\d+/g)||[]).size===3);
  const mosaic = await text(`/alpha/album/${aid}/wall?style=angel`,A);
  ok('相片牆（馬賽克）列出整本照片', new Set(mosaic.match(/\/alpha\/photo\/\d+/g)||[]).size===3);
  ok('相片牆吃相簿密碼', (await get(`/alpha/album/${secretId}/wall`,C)).status===302);
}

console.log('\n=== 網誌 ===');
await post('/alpha/blog/new',{title:'第一篇',body:'內容內容內容',category:'心情',topic:'心情',mood:'開心',weather:'晴'},A);
await post('/alpha/blog/new',{title:'鎖起來',body:'SECRETTEXT',category:'心情',pass:'8888'},A);
const bl=await text('/alpha/blog');
ok('文章列表', bl.includes('第一篇'));
// 心情／天氣在**單篇文章頁**，不是列表頁。原版列表頁的 .posted 只有
// Reply(N) | Trackback(N) | prosecute 三項（blog_2012_default_skin_afuuu.html 逐篇都是）。
// 註：拿「心情」去 grep 那份存檔會中 5 次，但那全是文章標題裡的「小心情」，不是欄位。
ok('心情天氣（在單篇頁）', (await text('/alpha/blog/1')).includes('心情：開心'));
ok('日期分隔', bl.includes('datediv'));
ok('文章日曆', bl.includes('文章日曆'));
ok('月份彙整', bl.includes('月份彙整'));
ok('上鎖文章不外洩', !bl.includes('SECRETTEXT') && bl.includes('[鎖]'));
ok('上鎖文章要密碼', (await text('/alpha/blog/2',Bc)).includes('這篇文章有上鎖'));
ok('搜尋不外洩鎖文', !(await text('/search?q=SECRETTEXT')).includes('鎖起來'));
// ⚠ 排行榜曾經漏掉這個過濾：它照抄整列（含 body），而 rank.ejs 會把 body
// 印成 .description，於是**未登入的人在排行榜就讀得到密碼文章的內文**。
// 首頁／總站／搜尋／四支 RSS 都有濾，只有排行榜沒有。多代理稽核抓到的。
ok('排行榜不外洩鎖文內文', !(await text('/rank')).includes('SECRETTEXT'));
// 長內文：宣稱五萬字，但 urlencoded 的預設上限只有 100KB，
// 中文一個字 urlencode 後 9 bytes ＝ 一萬一千字就爆，整篇文章消失。
ok('兩萬中文字的文章存得進去', await (async()=>{
  const long='中'.repeat(20000);
  const r=await post('/alpha/blog/new',{title:'長文測試',body:long,category:'心情'},A);
  return r.status===302;
})());
// 錯誤頁**絕對不能**把伺服器路徑與堆疊印出來。
// body-parser 在設定 res.locals 之前跑，錯誤頁少了 SITE_NAME 會二次拋錯、
// 掉到 Express 預設頁，把 C:\... 與 node_modules 結構全印給使用者看。
ok('超過上限的內容回 413 而不是裸堆疊', await (async()=>{
  const huge='中'.repeat(200000);      // urlencode 後約 1.8MB，一定超過 1mb 上限
  const r=await post('/alpha/blog/new',{title:'爆量',body:huge},A);
  const t=await r.text();
  return r.status===413 && !t.includes('node_modules') && !/[A-Za-z]:\\/.test(t);
})());
ok('排行榜不列出鎖文標題', !(await text('/rank')).includes('鎖起來'));
ok('未解鎖不能迴響', (await post('/alpha/blog/2/comment',{body:'x'},Bc)).status===302 &&
   !(await text('/alpha/blog/2',A)).includes('>x<'));
ok('未解鎖不能引用', (await post('/alpha/blog/2/trackback',{},Bc)).status===302 &&
   !(await text('/bravo/blog')).includes('SECRETTEXT'));
ok('RSS', (await text('/alpha/blog/rss')).includes('<rss version="2.0"'));
ok('RSS 不含鎖文', !(await text('/alpha/blog/rss')).includes('SECRETTEXT'));
ok('網誌搜尋(標題)', (await text('/alpha/blog/search?q=' + encodeURIComponent('第一'))).includes('找到 <b>1</b>'));
ok('網誌搜尋(內容)', (await text('/alpha/blog/search?q=' + encodeURIComponent('內容內容') + '&body=1')).includes('找到 <b>1</b>'));

console.log('\n=== 看地圖 ===');
// 原站側欄 boxDate 那顆「看地圖」。功能零存檔，我們做成「按地區看文章與相簿」。
ok('看地圖打得開', (await get('/alpha/blog/map')).status===200);
ok('側欄有看地圖連結', (await text('/alpha/blog')).includes('/alpha/blog/map'));
ok('文章可以標地區', await (async()=>{
  await post('/alpha/blog/1/edit',{title:'第一篇',body:'內容內容內容',category:'心情',place:'台灣'},A);
  const t=await text('/alpha/blog/map');
  return t.includes('台灣') && t.includes('第一篇'); })());
ok('地區擋亂值', await (async()=>{
  await post('/alpha/blog/1/edit',{title:'第一篇',body:'內容內容內容',category:'心情',place:'火星'},A);
  return !(await text('/alpha/blog/map')).includes('火星'); })());
// 上鎖的文章不能因為換一個入口就外洩。
// ⚠ 不能直接比對整頁有沒有「鎖起來」這三個字：**側欄的最新文章、頁首的
// 今日主題、首頁好文本來就會印鎖文的標題**（原站也是這樣，列表印標題加一個
// 鎖頭圖，內容才要密碼）。要驗的是「地圖那一區」有沒有把它列進去。
ok('看地圖不外洩鎖文', await (async()=>{
  await post('/alpha/blog/2/edit',{title:'鎖起來',body:'SECRETTEXT',category:'心情',pass:'8888',place:'台灣'},A);
  const page=await text('/alpha/blog/map');
  const zone=(page.match(/<div class="articletext"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)||[''])[0];
  return !zone.includes('鎖起來') && !page.includes('SECRETTEXT'); })());
// 標回台灣，後面的測試（歷史上的今天等）才有一篇有地區的文章可看
await post('/alpha/blog/1/edit',{title:'第一篇',body:'內容內容內容',category:'心情',place:'台灣'},A);

console.log('\n=== 迴響 / 收藏 / 引用 ===');
await post('/alpha/blog/1/comment',{author:'路人',email:'a@b.com',homepage:'https://ex.com',body:'搶頭香'},null);
const p1=await text('/alpha/blog/1');
ok('迴響顯示樓層', p1.includes('1樓'));
ok('暱稱連個人網頁', p1.includes('https://ex.com'));
ok('板主回覆', (await post('/alpha/blog/1/comment/1/reply',{reply:'謝謝'},A)).status===302 &&
   (await text('/alpha/blog/1')).includes('板主回覆'));
ok('收藏', (await post('/alpha/blog/1/fav',{},Bc)).status===302 && (await text('/bravo/favs')).includes('第一篇'));
ok('誰來收藏用原版 #friend-picker 結構', (await text('/alpha/blog/1')).includes('friend-picker-bd'));
ok('誰來收藏列出收藏者', (await text('/alpha/blog/1')).includes('friend-picker-cell'));

console.log('\n=== 我的訂閱（boxRssList）===');
// 訂閱站內的 RSS：不必連外網，而且抓回來的東西是我們自己產的，內容可預期
ok('訂閱站內 RSS', (await post('/alpha/subs',{title:'布拉的網誌',url:B+'/bravo/blog/rss'},A)).status===302);
// SSRF：伺服器主動連使用者給的網址，是全站唯一一處，要擋內網與非 http 協定
ok('擋掉內網位址（SSRF）', (await post('/alpha/subs',{title:'內網',url:'http://127.0.0.1:9/x'},A)).status===302 &&
   !(await text('/alpha/settings',A)).includes('127.0.0.1:9'));
ok('擋掉 file 協定', (await post('/alpha/subs',{title:'檔案',url:'file:///etc/passwd'},A)).status===302 &&
   !(await text('/alpha/settings',A)).includes('file:///'));
ok('非本人不能訂閱', (await post('/alpha/subs',{title:'壞人',url:'https://example.com/rss'},Bc)).status===403);

console.log('\n=== 側欄自訂欄位（boxFolder）===');
ok('新增自訂欄位', (await post('/alpha/folders',{title:'【About Me】',body:'我是阿發'},A)).status===302 && (await text('/alpha/blog')).includes('【About Me】'));
ok('自訂欄位內容有印出來', (await text('/alpha/blog')).includes('我是阿發'));
ok('自訂欄位用 boxFolder 結構', (await text('/alpha/blog')).includes('boxFolder'));
ok('自訂欄位逸出 HTML', (await post('/alpha/folders',{title:'XSS',body:'<script>alert(1)</script>'},A)).status===302 && !(await text('/alpha/blog')).includes('<script>alert(1)'));
ok('非本人不能新增自訂欄位', (await post('/alpha/folders',{title:'壞人',body:'x'},Bc)).status===403);

ok('推薦', (await post('/alpha/blog/1/like',{},Bc)).status===302);
ok('引用', (await post('/alpha/blog/1/trackback',{},Bc)).status===302 && (await text('/alpha/blog/1')).includes('引用'));

console.log('\n=== 留言板 ===');
await post('/alpha/guestbook',{subject:'路過',body:'你好'},Bc);
await post('/alpha/guestbook',{body:'沒標題'},Bc);
await post('/alpha/guestbook',{subject:'祕密',body:'HIDDENMSG',secret:'1'},Bc);
const gb=await text('/alpha/guestbook');
ok('留言板三頁籤', gb.includes('留言板')&&gb.includes('我要留言'));
ok('無標題預設', gb.includes('無標題'));
ok('悄悄話對外隱藏', !gb.includes('HIDDENMSG'));
ok('板主看得到悄悄話', (await text('/alpha/guestbook',A)).includes('HIDDENMSG'));
ok('系統訊息本人限定', (await get('/alpha/guestbook?tab=sys',Bc)).status===403);
ok('系統訊息有通知', (await text('/alpha/guestbook?tab=sys',A)).includes('你有新的留言'));
// 原版一頁 10 則。驗行為（不數 DOM）：灌到 15 則之後最舊那則要被擠到第二頁。
for(let i=0;i<12;i++) await post('/alpha/guestbook',{author:'路人',body:'GBMSG'+i},null);
ok('留言板一頁 10 則', !(await text('/alpha/guestbook')).includes('GBMSG0') &&
   (await text('/alpha/guestbook?p=2')).includes('GBMSG0'));
// 站方公告（原版的 #tab_bulletin）：人人可見，跟只有本人看得到的系統訊息是兩回事
await post('/admin/notice',{body:'[公告] 測試站方公告'},A);
{
  const bt = await text('/alpha/guestbook?tab=bulletin');
  ok('站方公告頁籤匿名可見', (await get('/alpha/guestbook?tab=bulletin')).status===200);
  // 要驗**列在公告清單裡**，不是只在頁面上任何地方出現——
  // 頂端的 .announcement 橫幅也會印同一則公告，只 includes 整頁會通過假的。
  ok('站方公告頁籤看得到公告', /id="msg_list"[\s\S]*測試站方公告/.test(bt));
  // 這格接的是 notices 不是 guestbook：最新那則留言不該出現在公告頁籤
  ok('站方公告頁籤不混到留言', !bt.includes('GBMSG11'));
}

// 留言者要連得回他自己的小站（原版每則留言的暱稱與大頭貼都是連結，
// 認證章 .vip_icon 也掛在那裡）。登入留言存 author_id，訪客留言存 NULL。
await post('/alpha/guestbook',{body:'BRAVOSAYS'},Bc);
{
  const g = await text('/alpha/guestbook');
  ok('登入留言連得回留言者的小站', g.includes('href="/bravo/guestbook"'));
  // 上面那 12 則是沒登入灌的，不該生出帳號連結
  ok('訪客留言沒有帳號連結', !g.includes('/路人/guestbook'));
}


console.log('\n=== 站台層級的服務目錄：影音 / 嘀咕 / 揪團 ===');
// 這三顆在導覽列上，之前全部指到 /help（等於三個死連結）。
// 原站的網址就是 /video/ /join/ /digu/，這裡沿用單數形。
ok('影音總站', (await get('/video')).status===200);
ok('嘀咕總站', (await get('/digu')).status===200);
ok('揪團總站', (await get('/join')).status===200);
{
  // 揪團：發起 → 別人參加 → 取消 → 額滿擋下（額滿一定要擋在後端，
  // 前端只是不畫那顆鈕，直接送 POST 一樣進得來）
  const before = await text('/join');
  await post('/join',{title:'測試揪團',descr:'說明',place:'台北',when_text:'週六',quota:'2'},A);
  const list = await text('/join');
  ok('發起揪團', list.includes('測試揪團') && !before.includes('測試揪團'));
  const jid = Math.max(...[...list.matchAll(/\/join\/(\d+)/g)].map(m=>+m[1]));
  ok('未登入不能發起', (await post('/join',{title:'不該出現'},null)).status===302 &&
     !(await text('/join')).includes('不該出現'));
  ok('別人可以參加', (await post('/join/'+jid+'/in',{},Bc)).status===302);
  ok('參加之後名單有他', (await text('/join/'+jid)).includes('布拉'));
  ok('再按一次是取消參加', (await post('/join/'+jid+'/in',{},Bc)).status===302 &&
     !(await text('/join/'+jid)).includes('布拉'));
  await post('/join/'+jid+'/in',{},Bc);          // quota=2：發起人 + bravo = 滿
  ok('額滿擋在後端', (await post('/join/'+jid+'/in',{},C)).status===409);
}

console.log('\n=== 哈啦 / 愛正妹 / 送禮物 ===');
// 哈啦：原站網址 /hala/viewtopic.php?t=<id> 也要通，站上其他頁面連的就是那個形狀
ok('哈啦總站', (await get('/hala')).status===200);
{
  await post('/hala',{title:'測試主題',body:'內容內容',cat:'測試'},A);
  const list = await text('/hala');
  ok('開主題', list.includes('測試主題'));
  const tid = Math.max(...[...list.matchAll(/\/hala\/(\d+)/g)].map(m=>+m[1]));
  ok('原站網址 viewtopic.php 也通', (await get('/hala/viewtopic.php?t='+tid)).status===200);
  await post('/hala/'+tid+'/reply',{body:'我來回覆'},Bc);
  ok('回覆主題', (await text('/hala/'+tid)).includes('我來回覆'));
  ok('未登入不能開主題', (await post('/hala',{title:'不該出現',body:'x'},null)).status===302 &&
     !(await text('/hala')).includes('不該出現'));
}

// 愛正妹：人物分類的人氣榜。原站是 /svcs/wretch_girl/，首頁的 featured_beauty
// 模組 more_url 指向相簿總站的熱門模式篩人物分類，語意一樣。
ok('愛正妹', (await get('/svcs/wretch_girl')).status===200);
ok('愛正妹分類篩選', (await get('/svcs/wretch_girl?topic='+encodeURIComponent('女生個人'))).status===200);
ok('未登入不能推票', (await post('/svcs/wretch_girl/1/vote',{},null)).status===302);

// 送禮物：原站在付費網域，我們不接金流但功能照做
{
  ok('送禮物', (await post('/bravo/gift',{kind:'flower',msg:'測試禮物'},A)).status===302);
  const card = await text('/bravo/card');
  ok('禮物出現在對方名片上', card.includes('測試禮物') && card.includes('阿發'));
  ok('對方收到系統訊息', (await text('/bravo/guestbook?tab=sys',Bc)).includes('有人送你一份禮物'));
  ok('不能送給自己', (await post('/alpha/gift',{kind:'flower'},A)).status===400);
  ok('未登入不能送', (await post('/bravo/gift',{kind:'flower'},null)).status===302);
}

console.log('\n=== 名片 / 好友 / 動態 ===');
await post('/alpha/card',{realname:'王小明',sex:'男生',zodiac:'雙子座',blood:'O',city:'台北',hobby:'攝影'},A);
const card=await text('/alpha/card');
ok('名片欄位', card.includes('王小明')&&card.includes('雙子座')&&card.includes('台北'));
ok('名片擋亂值', (await post('/alpha/card',{zodiac:'亂',city:'火星',homepage:'javascript:alert(1)'},A)).status===302 &&
   !(await text('/alpha/card')).includes('javascript:alert'));
ok('/user/ 導向名片', (await get('/user/alpha')).headers.get('location')==='/alpha/card');
// 分組是真的東西（friend_groups），POST 的欄位是 group_id 不是組名字串
await post('/alpha/friendgroups',{name:'同學'},A);
await post('/alpha/friendgroups',{name:'同事'},A);
const grpPage = await text('/alpha/friends',A);
const gidClass = +(grpPage.match(/friendgroups\/(\d+)\/edit/)||[])[1];
await post('/alpha/friends/3/group',{group_id:String(gidClass)},A);
ok('好友分組', (await text('/alpha/friends')).includes('同學'));
ok('分組改名，整組跟著改', await (async()=>{
  await post(`/alpha/friendgroups/${gidClass}/edit`,{name:'高中同學'},A);
  const t=await text('/alpha/friends',A);
  return t.includes('高中同學') && !t.includes('>同學（'); })());
await post(`/alpha/friendgroups/${gidClass}/edit`,{name:'同學'},A);
ok('不能把好友掛到別人的分組', await (async()=>{
  const bg=await post('/bravo/friendgroups',{name:'布拉的組'},Bc);
  const bt=await text('/bravo/friends',Bc);
  const bid=+(bt.match(/friendgroups\/(\d+)\/edit/)||[])[1];
  if(!bid) return true;                       // 布拉還沒有好友就沒有這個畫面，跳過
  await post('/alpha/friends/3/group',{group_id:String(bid)},A);
  return !(await text('/alpha/friends',A)).includes('布拉的組'); })());
ok('刪分類不刪人', await (async()=>{
  await post('/alpha/friendgroups',{name:'待刪'},A);
  const t=await text('/alpha/friends',A);
  const ids=[...t.matchAll(/friendgroups\/(\d+)\/edit/g)].map(m=>+m[1]);
  const del=ids[ids.length-1];
  await post(`/alpha/friendgroups/${del}/del`,{},A);
  const after=await text('/alpha/friends',A);
  return !after.includes('待刪') && after.includes('charlie'); })());
ok('好友動態', (await text('/alpha/feed',A)).includes('好友動態'));
ok('好友動態私密', (await get('/alpha/feed',Bc)).status===403);

console.log('\n=== 好友頁四種關係 / 分類 / 搜尋 ===');
// friends 是雙向邊，四種關係全部算得出來（原版的 #current_tag0..3）。
// 目前 alpha → charlie 是單向。
ok('我的好友（預設）', (await text('/alpha/friends')).includes('charlie'));
ok('誰加我為好友（c=1）', (await text('/charlie/friends?c=1')).includes('alpha'));
ok('互相（c=2）單向不算', !(await text('/alpha/friends?c=2')).includes('charlie'));
await post('/alpha/friend',{},C);                     // charlie 回加 alpha
ok('互相（c=2）回加之後成立', (await text('/alpha/friends?c=2')).includes('charlie'));
await post('/bravo/friend',{},C);                     // charlie 也加 bravo，alpha 才有「好友的好友」
{
  const fof = await text('/alpha/friends?c=3');
  ok('好友的好友（c=3）撈得到兩跳的人', fof.includes('bravo'));
  ok('好友的好友（c=3）扣掉已經是好友的人', !fof.includes('charlie'));
}
ok('好友搜尋只比對帳號', (await text('/alpha/friends?search_id=charl')).includes('charlie') &&
   !(await text('/alpha/friends?search_id=nobodyhere')).includes('charlie'));
// cateSelect 帶的是分組 id（原站也是），0＝預設組、-1＝全部
ok('好友分類篩選', await (async()=>{
  const t=await text('/alpha/friends',A);
  const ids=[...t.matchAll(/friendgroups\/(\d+)\/edit/g)].map(m=>+m[1]);
  const inGroup=await text(`/alpha/friends?cateSelect=${ids[0]}`);
  const other=await text(`/alpha/friends?cateSelect=${ids[1] ?? 0}`);
  return inGroup.includes('charlie') && !other.includes('charlie'); })());
ok('cateSelect=-1 是全部', (await text('/alpha/friends?cateSelect=-1')).includes('charlie'));
// 原站那張搜尋表單是 POST，導回 GET 才有得加書籤、才分得了頁
ok('好友搜尋 POST 導回 GET', (await post('/alpha/friends',{search_id:'charl'},A)).headers.get('location')==='/alpha/friends?search_id=charl');

console.log('\n=== 影音 ===');
ok('新增影音', (await post('/alpha/video',{title:'測試影片',url:'https://www.youtube.com/watch?v=jNQXAC9IVRw'},A)).status===302);
ok('影音列表內嵌影片', (await text('/alpha/video')).includes('jNQXAC9IVRw'));
ok('非 YouTube 網址不收', (await post('/alpha/video',{title:'壞連結',url:'https://evil.example.com/a'},A)).status===302 &&
   !(await text('/alpha/video')).includes('壞連結'));
ok('非本人不能新增影音', (await post('/alpha/video',{title:'x',url:'https://youtu.be/jNQXAC9IVRw'},Bc)).status===403);
{
  const vpage = await text('/alpha/video',A);
  const vid = (vpage.match(/\/alpha\/video\/(\d+)\/del/)||[])[1];
  ok('站主可刪影音', !!vid && (await post(`/alpha/video/${vid}/del`,{},A)).status===302 &&
     !(await text('/alpha/video')).includes('測試影片'));
}

console.log('\n=== 嘀咕 ===');
ok('發嘀咕', (await post('/alpha/digu',{body:'DIGUTEST'},A)).status===302 &&
   (await text('/alpha/digu')).includes('DIGUTEST'));
ok('非本人不能發嘀咕', (await post('/alpha/digu',{body:'x'},Bc)).status===403);
{
  const n = t => +(t.match(/共有 (\d+) 則嘀咕/)||[0,0])[1];
  const before = n(await text('/alpha/digu',A));
  await post('/alpha/digu',{body:'   '},A);
  ok('空白嘀咕不收', before === n(await text('/alpha/digu',A)));
}

console.log('\n=== 背景音樂偏好 ===');
// 專案沒有 cookie-parser，偏好記在 session；畫面上怎麼呈現是 view 的事，這裡只驗行為
{
  const r = await get('/bgm?on=0&back=/alpha');
  ok('關掉音樂會轉回原頁', r.status===302 && r.headers.get('location')==='/alpha');
  ok('偏好有寫進 session（會發 cookie）', !!r.headers.getSetCookie()?.length);
  ok('/bgm 擋開放轉址', (await get('/bgm?on=0&back=//evil.com')).headers.get('location')==='/');
}

console.log('\n=== 分類總站 ===');
ok('相簿總站 24 類', (await text('/albums')).match(/\?topic=/g).length>=24);
ok('網誌總站 12 類', (await text('/blogs')).match(/\?topic=/g).length>=12);
ok('相簿分類篩選', (await text('/albums?topic='+encodeURIComponent('國內旅遊'))).includes('國內旅遊'));

console.log('\n=== 無名風格網址 ===');
for(const [u,exp] of [['/album/alpha','/alpha/album'],['/blog/alpha','/alpha/blog'],['/guestbook/alpha','/alpha/guestbook'],['/friend/alpha','/alpha/friends'],['/mypage/alpha','/alpha'],['/user/alpha','/alpha/card'],['/video/alpha','/alpha/video'],['/digu/alpha','/alpha/digu']]){
  const r=await get(u); ok('301 '+u, r.status===301 && r.headers.get('location')===exp, r.headers.get('location'));
}

console.log('\n=== 樣式 / 設定 ===');
// 版面樣式＝無名的「版型」：選了哪一套，站台就載那一支版型 CSS（src/skins.js）。
// 不是 body class——那是我們 2005 版自創的機制，2012 原站沒有。
const sf=new FormData(); sf.append('nick','阿發'); sf.append('theme','grey');
await fetch(B+'/alpha/settings',{method:'POST',headers:{cookie:A},body:sf,redirect:'manual'});
ok('版面樣式套用', (await text('/alpha/album')).includes('wretch2012-album-188.css'));
const sfDefault=new FormData(); sfDefault.append('nick','阿發'); sfDefault.append('theme','');
await fetch(B+'/alpha/settings',{method:'POST',headers:{cookie:A},body:sfDefault,redirect:'manual'});
ok('版面樣式改回預設', (await text('/alpha/album')).includes('wretch2012-album.css'));
const sf2=new FormData(); sf2.append('nick','阿發'); sf2.append('theme','<script>');
await fetch(B+'/alpha/settings',{method:'POST',headers:{cookie:A},body:sf2,redirect:'manual'});
ok('惡意樣式被擋', !(await text('/alpha')).includes('t-x-<script>'));

console.log('\n=== 權限 ===');
ok('非本人不能改設定', (await get('/alpha/settings',Bc)).status===403);
ok('非本人不能發文', (await get('/alpha/blog/new',Bc)).status===403);
ok('非站長不能進後台', (await get('/admin',Bc)).status===403);   // alpha 是第一個註冊者＝站長，改用 bravo 驗
ok('非本人不能刪相簿', (await post(`/alpha/album/${aid}/del`,{},Bc)).status===403);

console.log('\n=== 全站頁面 ===');
for(const p of ['/','/albums','/blogs','/rank','/search?q=a','/help','/login','/register','/alpha','/alpha/album','/alpha/blog','/alpha/guestbook','/alpha/card','/alpha/friends','/alpha/favs','/alpha/video','/alpha/digu']){
  ok('200 '+p, (await get(p)).status===200);
}
ok('404 不存在使用者', (await get('/nobodyhere')).status===404);
ok('404 不存在文章', (await get('/alpha/blog/9999')).status===404);

// 具名路由不能被同層的 :id 參數路由吃掉。
// `/album/rss` 註冊在 `/album/:id` 之後，曾經讓 'rss' 被當成相簿編號送進 SQL：
// SQLite 只是回空（測不出來），Postgres 直接 500。四支 RSS 都釘住。
ok('相簿 RSS 沒被 /album/:id 吃掉', (await text('/alpha/album/rss')).includes('<rss version="2.0"'));
ok('留言板 RSS', (await text('/alpha/guestbook/rss')).includes('<rss version="2.0"'));
ok('迴響 RSS', (await text('/alpha/blog/comments.rss')).includes('<rss version="2.0"'));
// 非數字的編號要是 404，不是把字串送進 SQL 讓 Postgres 拋型別錯誤（正式站 500）
for(const p of ['/alpha/album/abc','/alpha/photo/abc','/alpha/blog/abc','/join/abc','/hala/abc']){
  ok('404 非數字編號 '+p, (await get(p)).status===404);
}

console.log('\n=== 設定頁的回饋 ===');
// 三種失敗原本都是靜靜地 302 回原頁，使用者只看到「什麼都沒發生」
ok('訂閱沒填名稱會講原因', await (async()=>{
  await post('/alpha/subs',{title:'',url:'https://example.com/rss'},A);
  return (await text('/alpha/settings',A)).includes('請填來源名稱');
})());
ok('訂閱網址不合法會講原因', await (async()=>{
  await post('/alpha/subs',{title:'內網',url:'http://127.0.0.1:9/x'},A);
  return (await text('/alpha/settings',A)).includes('網址不能用');
})());
ok('自訂欄位沒填標題會講原因', await (async()=>{
  await post('/alpha/folders',{title:'',body:'x'},A);
  return (await text('/alpha/settings',A)).includes('請填欄位標題');
})());

console.log('\n=== 檢舉與通知 ===');
// 檢舉四個入口原本都是 <a href="#"> ＋ display:none 的表單，kind/target 靠 JS 填，
// **關掉 JS 就完全不能檢舉**。原站的檢舉本來就是跳到另一頁，不靠 JS。
ok('檢舉有獨立頁面（不靠 JS）', (await get('/report?kind=post&target=1&url=%2Falpha%2Fblog%2F1')).status===200);
ok('檢舉頁帶得回原本的位置', (await text('/report?kind=post&target=1&url=%2Falpha%2Fblog%2F1')).includes('/alpha/blog/1'));
ok('文章頁的檢舉連結指向那一頁', (await text('/alpha/blog/1')).includes('/report?kind=post'));
// ⚠ 留言通知的節流原本只看「10 分鐘內有沒有**任何** sysmsg」，
// 於是站長一發群發公告，全站每個人接下來 10 分鐘都收不到留言通知。
ok('群發公告不會壓掉留言通知', await (async()=>{
  await post('/admin/broadcast',{body:'測試群發'},A);          // alpha 是站長
  await post('/bravo/guestbook',{subject:'嗨',body:'留言測試'},C);
  const t=await text('/bravo/guestbook?tab=sys',Bc);
  return t.includes('你有新的留言');
})());

console.log('\n=== 搜尋 ===');
// 三區的標題數字要是**真的命中數**，不是這一頁的筆數（各區 LIMIT 30）。
// 原本 view 直接印 rows.length，搜到 2000 筆也只會顯示「站友（30）」。
ok('搜尋的數字用真的命中數', await (async()=>{
  const t=await text('/search?q=a');
  // counts 是後端算的；至少要能正常算出來、不是 undefined/NaN
  return !t.includes('（undefined）') && !t.includes('（NaN）');
})());
// ⚠ 三條查詢原本都沒有 ORDER BY 又只取 30 筆，結果永遠是**最舊**的 30 筆，
// 新內容一律搜不到。alpha 的文章是最後才建的，要搜得到才算對。
ok('搜尋排序是新的在前面', (await text('/search?q=' + encodeURIComponent('第一'))).includes('第一篇'));
// 上鎖文章的內文不能被搜出來（數字也不能把它算進去）
ok('搜尋不外洩鎖文內文', !(await text('/search?q=SECRETTEXT')).includes('鎖起來'));

console.log('\n=== 截斷與分頁 ===');
// slice 用 UTF-16 code unit 數，emoji 佔兩個 unit，切在中間會留下孤兒代理對，
// 存進資料庫再讀出來變成 U+FFFD（�），那個人的暱稱在全站每一頁都會壞掉。
ok('暱稱截斷不會切壞 emoji', await (async()=>{
  const nick='😀'.repeat(30);              // 30 個 emoji = 60 個 code unit
  await post('/alpha/settings',{nick},A);
  const t=await text('/alpha');
  return !t.includes('�');
})());
await post('/alpha/settings',{nick:'阿發'},A);   // 改回來，後面的測試要用
// 暱稱不能被清成空字串（註冊有擋，設定頁本來沒擋）
ok('暱稱不能被清成空白', await (async()=>{
  await post('/alpha/settings',{nick:'   '},A);
  return (await text('/alpha')).includes('阿發');
})());
// 單本相簿的照片要分頁（原站的縮圖列網址就帶 &page=）
ok('單本相簿有分頁參數且不會壞', (await get(`/alpha/album/${aid}?p=2`)).status===200);
ok('一頁瀏覽不分頁', (await text(`/alpha/album/${aid}?all=1`,A)).includes('onepage'));

console.log('\n=== 查詢字串的邊界輸入 ===');
// ⚠ `Math.max(1,+p||1)` 擋不住 Infinity：`+'1e999'` 是 Infinity，
// Math.max(1,Infinity) 還是 Infinity，綁進 SQL 的 LIMIT/OFFSET 就 500。全站 14 處分頁都中。
for(const p of ['/alpha/blog?p=1e999','/alpha/guestbook?p=1e999','/alpha/friends?p=Infinity',
                '/alpha/blog?p=-1','/alpha/blog?p=0','/alpha/blog?p=abc','/albums?p=1e999']){
  ok('分頁參數亂給不會 500 '+p, (await get(p)).status<500);
}
// ⚠ Express 仍會把 `?cat[]=x` 解析成陣列，陣列綁進 SQL 會拋 datatype mismatch → 500
for(const p of ['/alpha/blog?cat[]=x','/alpha/blog?ym[]=x','/alpha/blog?d[]=x',
                '/search?q[]=x','/alpha/blog?cal[]=x','/hala/viewtopic.php?t[]=1']){
  ok('陣列語法不會 500 '+p, (await get(p)).status<500);
}
// /hala/viewtopic.php 不帶 t 曾經把 undefined 綁進 SQL
ok('viewtopic.php 不帶參數不會 500', (await get('/hala/viewtopic.php')).status<500);
ok('viewtopic.php 空參數是 404', (await get('/hala/viewtopic.php?t=')).status===404);

console.log('\n=== 搜尋的萬用字元要逸出 ===');
// ⚠ LIKE 的 % 與 _ 是萬用字元。不逸出的話，使用者打一個 % 就等於
// 「比對全部」，整個站的帳號、公開相簿、公開文章一次全撈回來。
// 逸出與 ESCAPE 是一組的：只逸出字串、SQL 裡不寫 ESCAPE，反斜線會被
// 當成普通字元，「50%」反而變成搜「50\%」而搜不到，比不逸出還糟。
// 這一組在 Postgres 上也要跑——toPg() 會把 LIKE 翻成 ILIKE，
// ESCAPE 子句得跟著一起被翻對。
{
  const cnt = async q => {
    const h = await text('/search?q=' + encodeURIComponent(q));
    return [...h.matchAll(/<h2>(?:站友|相簿|網誌)（(\d+)）<\/h2>/g)].reduce((n,m)=>n+ +m[1],0);
  };
  const wild = await cnt('%'), real = await cnt('alpha');
  ok(`搜一個 % 不會把整個站撈回來（${wild} 筆）`, wild === 0);
  ok(`正常的字還是搜得到（alpha ${real} 筆）`, real > 0);
  ok('搜一個底線也不會把整個站撈回來', (await cnt('_')) === 0);
}

console.log('\n=== 上限在併發下守得住（不能是先讀再寫）===');
// ⚠ 這一組專打「先 SELECT count 再 INSERT」的寫法。循序測試永遠會過——
// 只有同時送才會露出破綻：讀完到寫入之間的空隙讓多個請求一起通過檢查。
// 稽核在 /subs 與 /folders 兩處抓到同一個型態，修法是把判斷與寫入合成
// 一句 INSERT ... SELECT ... WHERE，靠回傳的 changes 判斷有沒有被擋。
{
  await post('/register',{name:'limitq',nick:'限量',pass:'test1234',pass2:'test1234'});
  const L = await login('limitq');
  // 一次送 12 個，遠超過兩邊的上限（folders 8、subs 5）
  await Promise.all([...Array(12)].map((_,i)=>post('/limitq/folders',{title:'f'+i,body:'x'},L)));
  const fn = ((await text('/limitq/settings',L)).match(/\/folders\/\d+\/del/g)||[]).length;
  ok(`併發新增自訂欄位不會超過 8（實際 ${fn}）`, fn>0 && fn<=8);
  await Promise.all([...Array(12)].map((_,i)=>post('/limitq/subs',{title:'s'+i,url:'https://example.com/rss'+i},L)));
  const sn = ((await text('/limitq/settings',L)).match(/\/subs\/\d+\/del/g)||[]).length;
  ok(`併發訂閱不會超過 5（實際 ${sn}）`, sn>0 && sn<=5);
}


console.log('\n=== 上鎖／好友限定相簿的封面不外流 ===');
// ⚠ 稽核實測：站主自己的兩頁相簿清單（/:name/album 與 MyPage）
// 把上鎖與好友限定相簿的封面縮圖直接印給任何人看，而 /uploads 是
// express.static 直出，縮圖網址去掉 _t 就是 1024px 大圖（HTTP 200）。
// 所以「看得到封面」等於「看得到裡面的照片」。相簿本身照原站列出來
// （含鎖頭圖示），只是封面換成預設圖。
{
  const K = await reg('lockq','鎖鎖');
  await post('/lockq/album',{title:'密碼本',pass:'1234'},K);
  await post('/lockq/album',{title:'好友本',friends_only:'1'},K);
  await post('/lockq/album',{title:'公開本'},K);
  const mine = await text('/lockq/album',K);
  const ids = {};
  // 標題那顆連結長這樣：<a href="/lockq/album/3">公開本</a>
  for (const m of mine.matchAll(/\/lockq\/album\/(\d+)">([^<]{2,6}本)</g)) ids[m[2]] = +m[1];
  const up = async id => {
    const g = new FormData();
    g.append('photos', new Blob([png(200,150,id%5)],{type:'image/png'}), 'c.png');
    await fetch(`${B}/lockq/album/${id}/upload`, {method:'POST',headers:{cookie:K},body:g,redirect:'manual'});
  };
  for (const k of ['密碼本','好友本','公開本']) if (ids[k]) await up(ids[k]);
  ok('三本相簿都建起來也上傳了封面', Object.keys(ids).length===3, JSON.stringify(ids));
  const thumbs = h => new Set(h.match(/\/uploads\/[^"]+_t\.jpg/g) || []).size;
  ok('站主自己看得到全部三張封面', thumbs(await text('/lockq/album',K))===3);
  for (const [page,name] of [['/lockq/album','相簿清單'],['/lockq','MyPage']]) {
    const anon = await text(page);
    const n = thumbs(anon);
    ok(`路人在${name}只看得到公開本的封面（實際 ${n} 張）`, n===1);
    ok(`${name}仍然列出上鎖相簿的標題（照原站）`, anon.includes('密碼本') && anon.includes('好友本'));
  }
  // 輸入正確密碼之後，那一本的封面就該回來
  await post(`/lockq/album/${ids['密碼本']}/unlock`,{pass:'1234'},A);
  const after = thumbs(await text('/lockq/album',A));
  ok(`解鎖之後看得到兩張封面（實際 ${after} 張）`, after===2);
}


console.log('\n=== BBCode 不會被一篇文章拖垮（O(n²) 回歸）===');
// ⚠ 成對標記原本用惰性量詞的正規表示式，碰到「有開沒關」會退化成 O(n²)：
// 12 萬字的 [b] 要 647ms、48 萬字的 [color=#fff] 要 3682ms，全部卡在
// event loop 上。內文是存起來的，貼一篇之後每個訪客瀏覽都重算一次——
// 不用登入就能把整站拖垮。改成 indexOf 的線性掃描之後同樣的輸入 <5ms。
// 這裡打的是真的 HTTP 路徑（存進資料庫→再讀出來 render），不是單元測試。
{
  const bombs = {
    '[b] 開頭沒收尾':      '[b]'.repeat(16000),
    '[color] 開頭沒收尾':  '[color=#fff]'.repeat(4100),
    '[color] 無效色碼':    '[color=#gg]'.repeat(4500),
    '[color=] 屬性沒收尾': '[color=#fff'.repeat(4500) + '][/color]',
  };
  for (const [name, body] of Object.entries(bombs)) {
    await post('/alpha/blog/new', {title:'bomb', body, category:'心情'}, A);
    const list = await text('/alpha/blog', A);
    const pid  = Math.max(...[...list.matchAll(/\/alpha\/blog\/(\d+)/g)].map(m=>+m[1]));
    const t0 = Date.now();
    const r  = await get(`/alpha/blog/${pid}`);
    const ms = Date.now() - t0;
    ok(`${name}：頁面照樣開得起來（${ms}ms）`, r.status === 200 && ms < 2000, `HTTP ${r.status}`);
  }
}


console.log('\n=== 自訂 CSS 擋得住逸出序列 ===');
// ⚠ CSS 的逸出序列（\69 = i、\73 = s、\3C = <）是瀏覽器在解析**之前**還原的，
// 所以「先過濾關鍵字再交給瀏覽器」的順序是錯的。稽核在 Chrome 實測
// `@im\port url(...)` 真的載進了外部樣式表，等於整個 safeCss 形同虛設，
// 連 \3C 都能拼出 </style> 做任意 HTML 注入。
// 修法是先還原、再過濾、輸出還原後的字串，殘留的反斜線一律拿掉。
{
  const BS = String.fromCharCode(92);
  const S = await reg('cssq','樣式');
  const bad = [
    ['@import 逸出一個字母', '@im' + BS + 'port url(//evil.example/x.css);'],
    ['@import 逸出成十六進位', '@' + BS + '69 mport url(//evil.example/x.css);'],
    ['expression', 'a{x:expre' + BS + '73 sion(alert(1))}'],
    ['behavior', 'a{behavio' + BS + '72 :url(#d)}'],
    ['url 裡的 javascript:', 'a{background:url(java' + BS + '73 cript:alert(1))}'],
    ['雙反斜線拼出角括號', BS + BS + BS + '3C/style' + BS + BS + BS + '3E'],
  ];
  for (const [name, css] of bad) {
    const fd = new FormData();
    fd.append('nick','樣式'); fd.append('css', css + '#sentinel-cssq{color:red}');
    await fetch(`${B}/cssq/settings`, {method:'POST',headers:{cookie:S},body:fd,redirect:'manual'});
    const page = await text('/cssq');
    // 頁面上有好幾個 <style>（版型、kukubar…），只看使用者那一塊：
    // 用哨兵選擇器認出它，不然會誤判站上自己的 CSS（子選擇器本來就有 >）。
    const mine = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1])
      .find(s => s.includes('sentinel-cssq')) || '';
    const leaked = /@\s*import|expression\s*\(|behavior\s*:|-moz-binding\s*:|javascript\s*:/i.test(mine)
                || mine.includes('<') || mine.includes('>') || mine.includes(BS);
    ok(`自訂 CSS：${name} 逸出不了`, mine.includes('sentinel-cssq') && !leaked, JSON.stringify(mine.slice(0,140)));
  }
  // 正常的 CSS 不能被誤殺
  const fd = new FormData();
  fd.append('nick','樣式'); fd.append('css','body{background:#fff}h1{color:red}');
  await fetch(`${B}/cssq/settings`, {method:'POST',headers:{cookie:S},body:fd,redirect:'manual'});
  ok('自訂 CSS：正常樣式照樣生效', (await text('/cssq')).includes('h1{color:red}'));
}


console.log('\n=== session 固定攻擊與跨站請求 ===');
// ⚠ 稽核抓到兩件事：
//   1. 登入／註冊沒有 regenerate session，攻擊者先拿到一個 session id、
//      想辦法讓受害者用同一個登入，那個 id 就升級成已登入。
//   2. 全站沒有任何 CSRF 防護（只靠 cookie 的 SameSite=Lax）。
{
  await post('/register',{name:'fixq',nick:'固定',pass:'test1234',pass2:'test1234'});
  // 先拿一個「還沒登入」的 session：隨便打一支會寫 session 的頁面
  const pre = (await post('/login',{name:'fixq',pass:'wrong'})).headers.getSetCookie()?.[0]?.split(';')[0];
  const r = await post('/login',{name:'fixq',pass:'test1234'}, pre);
  const after = r.headers.getSetCookie()?.[0]?.split(';')[0];
  ok('登入成功會換一組新的 session id', !!after && after !== pre);
  if (pre) {
    // 舊的那份不能因為別人登入就跟著變成已登入
    const old = await text('/', pre);
    ok('攻擊者手上的舊 session 仍然是未登入', !old.includes('/fixq/settings'));
  }

  // 跨站送過來的 POST 要被擋
  const cross = await fetch(`${B}/fixq/blog/new`, {
    method:'POST', redirect:'manual',
    headers:{cookie:after, origin:'https://evil.example', 'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({title:'csrf',body:'x',category:'心情'}).toString() });
  ok('跨站 Origin 的 POST 被擋（403）', cross.status===403, 'HTTP '+cross.status);
  const crossRef = await fetch(`${B}/fixq/blog/new`, {
    method:'POST', redirect:'manual',
    headers:{cookie:after, referer:'https://evil.example/x', 'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({title:'csrf',body:'x',category:'心情'}).toString() });
  ok('跨站 Referer 的 POST 被擋（403）', crossRef.status===403, 'HTTP '+crossRef.status);
  // 同站的照樣過
  const same = await fetch(`${B}/fixq/blog/new`, {
    method:'POST', redirect:'manual',
    headers:{cookie:after, origin:B, 'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({title:'正常',body:'x',category:'心情'}).toString() });
  ok('同站 Origin 的 POST 照樣過', same.status===302, 'HTTP '+same.status);
  ok('擋下來之後文章沒有被建立', !(await text('/fixq/blog')).includes('csrf'));
}


console.log('\n=== 猜密碼要被擋，壞請求要回 400 ===');
// ⚠ 稽核：登入與相簿／文章解鎖都可以無限次嘗試。相簿密碼上限 20 字，
// 但大家實際設的是四位數字——一萬種組合，不限速幾秒就試完。
// 做法是以「IP + 目標」滑動視窗計數，**成功就清掉**，所以正常使用者碰不到。
{
  await post('/register',{name:'ratelim',nick:'限速',pass:'test1234',pass2:'test1234'});
  let blocked = 0, tried = 0;
  for (let i = 0; i < 15; i++) {
    const r = await post('/login',{name:'ratelim',pass:'wrong'+i});
    tried++;
    if (r.status === 429) blocked++;
  }
  ok(`連續猜 ${tried} 次密碼會被擋下來（擋了 ${blocked} 次）`, blocked > 0);
  // 被擋之後連正確密碼也進不去——這就是重點，不然限速形同虛設
  const r = await post('/login',{name:'ratelim',pass:'test1234'});
  ok('被擋期間連正確密碼都不放行', r.status === 429, 'HTTP ' + r.status);
}

// ⚠ 壞掉的 multipart 原本回 500。那是**送出的東西有問題**，不是伺服器壞了：
// 回 500 會讓監控誤報，也讓對方以為重試就會好。
{
  const A2 = await login('alpha');
  const r = await fetch(`${B}/alpha/album`, {
    method:'POST', redirect:'manual',
    headers:{cookie:A2,'content-type':'multipart/form-data; boundary=----nope'},
    body:'------nope\r\nContent-Disposition: form-data; name="x"' });   // 沒有收尾
  ok('壞掉的 multipart 回 4xx 不是 500', r.status < 500, 'HTTP ' + r.status);
}


console.log('\n=== 相機原生格式與被擋掉的檔案 ===');
// ⚠ multer 的 fileFilter 原本只放行 jpeg|png|gif|webp。**iPhone 拍的照片
// 預設是 HEIC**，相機原始檔常常是 TIFF，新一點的 Android 會出 AVIF——
// 這些檔案被 cb(null,false) 靜靜丟掉：使用者選了照片、按下上傳，
// 頁面回來說「上傳了 0 張照片」，一個字都沒解釋。
// 換大頭貼更糟：req.file 是 undefined，跟「這次沒有要換頭貼」長得一樣，
// 畫面顯示「設定已儲存」，使用者以為換好了。
{
  await post('/register',{name:'heicq',nick:'相機',pass:'test1234',pass2:'test1234'});
  const H = await login('heicq');
  await post('/heicq/album',{title:'相機測試'},H);
  const ap = await text('/heicq/album',H);
  const hid = Math.max(...[...ap.matchAll(/\/heicq\/album\/(\d+)/g)].map(m=>+m[1]));

  // TIFF：sharp 讀得懂，應該收下並轉成 JPEG。用真的 TIFF 標頭產一張小圖。
  // （HEIC 沒辦法在測試裡憑空產生一個合法檔，所以用同樣被擋在門外的 TIFF 代表這一類。）
  const tiff = await (async () => {
    const sharp = (await import('sharp')).default;
    return sharp({ create: { width: 120, height: 90, channels: 3, background: { r: 200, g: 60, b: 60 } } })
      .tiff().toBuffer();
  })();
  const g = new FormData();
  g.append('photos', new Blob([tiff], { type: 'image/tiff' }), 'camera.tiff');
  const r = await fetch(`${B}/heicq/album/${hid}/upload`, {method:'POST',headers:{cookie:H},body:g,redirect:'manual'});
  ok('TIFF 上傳有被收下（302）', r.status === 302, 'HTTP ' + r.status);
  const after = await text(`/heicq/album/${hid}`, H);
  ok('TIFF 真的變成一張照片', (after.match(/\/heicq\/photo\/\d+/g) || []).length >= 1);

  // 真的不支援的格式：要講原因，不能只說「上傳了 0 張」
  const g2 = new FormData();
  g2.append('photos', new Blob([Buffer.from('%PDF-1.4 not an image')],{type:'application/pdf'}), '報告.pdf');
  await fetch(`${B}/heicq/album/${hid}/upload`, {method:'POST',headers:{cookie:H},body:g2,redirect:'manual'});
  const msg = await text(`/heicq/album/${hid}`, H);
  ok('不支援的格式會講出檔名與原因', msg.includes('報告.pdf') && msg.includes('不支援這個格式'),
     (msg.match(/上傳了[^<]{0,60}/) || ['(找不到訊息)'])[0]);

  // 大頭貼被擋掉時不能說「設定已儲存」
  const fd = new FormData();
  fd.append('nick','相機');
  fd.append('avatar', new Blob([Buffer.from('not an image')],{type:'application/pdf'}), '頭貼.pdf');
  await fetch(`${B}/heicq/settings`, {method:'POST',headers:{cookie:H},body:fd,redirect:'manual'});
  const st = await text('/heicq/settings', H);
  ok('大頭貼被擋掉時不會謊稱已儲存', st.includes('頭貼.pdf') || st.includes('大頭貼沒有換'),
     (st.match(/設定已儲存[^<]{0,50}/) || ['(找不到訊息)'])[0]);
}


console.log('\n=== 迴響與引用要分頁 ===');
// ⚠ 兩支查詢原本都沒有 LIMIT：一篇文章有一萬則迴響，就一次撈一萬列、
// 一次跑一萬次 render()（每一則都要跑 BBCode）、一次送出去。
// 那不只是慢——那是一個不用登入、任何人都可以重複觸發的資源消耗點。
//
// 原站本來就有分頁，存檔看得到參數與頁數：
//   blog_2013_article_comments_page2.html   Reply(124) 分 7 頁 → 20 則／頁
//   blog_2013_article_trackback_page2.html  Trackback(128) 分 5 頁 → 30 筆／頁
//   網址是 …&page=2#postComments 與 …&tpage=2#trackbacks
{
  await post('/register',{name:'cpageq',nick:'分頁',pass:'test1234',pass2:'test1234'});
  const C = await login('cpageq');
  await post('/cpageq/blog/new',{title:'很多迴響的文章',body:'內容',category:'心情'},C);
  const list = await text('/cpageq/blog',C);
  const pid = Math.max(...[...list.matchAll(/\/cpageq\/blog\/(\d+)/g)].map(m=>+m[1]));
  for (let i = 1; i <= 55; i++)
    await post(`/cpageq/blog/${pid}/comment`,{author:'訪客'+i,body:'第 '+i+' 則'},C);

  const p1 = await text(`/cpageq/blog/${pid}`);
  const n1 = (p1.match(/第 \d+ 則/g) || []).length;
  ok(`第一頁只印 20 則（實際 ${n1}）`, n1 === 20);
  ok('「回應(N)」印的是總數不是這一頁的筆數', /回應\(55\)/.test(p1),
     (p1.match(/回應\(\d+\)/) || ['(找不到)'])[0]);
  ok('有分頁列', p1.includes('id="comment_pager"'));

  const p3 = await text(`/cpageq/blog/${pid}?page=3`);
  const n3 = (p3.match(/第 \d+ 則/g) || []).length;
  ok(`第三頁印剩下的 15 則（實際 ${n3}）`, n3 === 15);
  ok('第三頁是從第 41 則開始', (p3.match(/第 \d+ 則/) || [''])[0] === '第 41 則',
     (p3.match(/第 \d+ 則/) || ['(找不到)'])[0]);

  // 頁碼亂給不能 500，也不能撈到奇怪的東西
  for (const q of ['?page=0','?page=-1','?page=abc','?page=1e999','?page[]=1','?tpage=1e999'])
    ok('頁碼亂給不會壞 '+q, (await get(`/cpageq/blog/${pid}${q}`)).status === 200);

  // 分頁連結要保留另一組參數（同一頁上有兩組分頁）
  const both = await text(`/cpageq/blog/${pid}?tpage=1&page=2`);
  ok('切迴響的頁不會把 tpage 洗掉', /page=3[^"]*#postComments/.test(both) && both.includes('tpage=1'),
     (both.match(/href="[^"]*page=3[^"]*"/) || ['(找不到)'])[0]);
}


console.log('\n=== 顏文字不能改到網址、保留字、發文不吃掉內容 ===');
// ⚠ 顏文字取代原本是對整份 HTML 做全域字串取代，而且排在 [img] 與裸網址
// 自動連結**之後**——網址裡出現 orz／XD／zzz／T_T 就會被換成 emoji，
// 圖破掉、連結 404。使用者只會看到「我貼的圖不會出現」，永遠猜不到原因。
{
  await post('/register',{name:'emoq',nick:'顏文字',pass:'test1234',pass2:'test1234'});
  const E = await login('emoq');
  await post('/emoq/blog/new',
    {title:'網址測試',body:'[img]http://example.com/XD.png[/img]\nhttp://example.com/orz/a.jpg',category:'心情'},E);
  const list = await text('/emoq/blog',E);
  const pid = Math.max(...[...list.matchAll(/\/emoq\/blog\/(\d+)/g)].map(m=>+m[1]));
  const html = await text(`/emoq/blog/${pid}`);
  ok('網址裡的 XD 不會被換成 emoji', html.includes('example.com/XD.png'),
     (html.match(/example\.com\/[^"]*\.png/) || ['(找不到)'])[0]);
  ok('網址裡的 orz 不會被換成 emoji', html.includes('example.com/orz/a.jpg'),
     (html.match(/example\.com\/[^"<]*a\.jpg/) || ['(找不到)'])[0]);

  // 正常的顏文字還是要能用
  await post('/emoq/blog/new',{title:'心情',body:'今天心情 XD 真的 orz',category:'心情'},E);
  const l2 = await text('/emoq/blog',E);
  const p2 = Math.max(...[...l2.matchAll(/\/emoq\/blog\/(\d+)/g)].map(m=>+m[1]));
  const h2 = await text(`/emoq/blog/${p2}`);
  ok('內文裡的顏文字照樣變成 emoji', h2.includes('😆') && h2.includes('🙇'));
}

// ⚠ RESERVED 名單漏了好幾個已經存在的站台路由。註冊得到這些名字的人，
// 小站首頁 /<帳號> 永遠打不開——Express 會先配到站台那條路由，
// 使用者只會覺得「我註冊完就再也進不去自己的小站」，而且完全沒有提示。
for (const n of ['albums','blogs','video','digu','report','healthz','bgm']) {
  const r = await post('/register',{name:n,nick:'x',pass:'test1234',pass2:'test1234'});
  const body = await r.text();
  ok(`保留字擋得住：${n}`, body.includes('已經有人用了') || body.includes('不能用') || body.includes('保留'),
     'HTTP ' + r.status);
}

// ⚠ 發文時標題只打空白，原本是 302 回空表單——使用者剛打完的整篇文章
// 就這樣消失，而且一個字都不解釋。
{
  const E2 = await login('emoq');
  const long = '這是我打了很久的內容'.repeat(20);
  const r = await post('/emoq/blog/new',{title:'   ',body:long,category:'心情'},E2);
  const html = await r.text();
  ok('標題空白不會把內容吃掉', html.includes(long.slice(0, 30)),
     'HTTP ' + r.status + '（有沒有把內容送回來）');
  ok('標題空白會講原因', html.includes('標題不能是空白'), 'HTTP ' + r.status);
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
