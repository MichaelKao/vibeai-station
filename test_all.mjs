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
ok('心情天氣', bl.includes('心情：開心')&&bl.includes('天氣：晴'));
ok('日期分隔', bl.includes('datediv'));
ok('文章日曆', bl.includes('文章日曆'));
ok('月份彙整', bl.includes('月份彙整'));
ok('上鎖文章不外洩', !bl.includes('SECRETTEXT') && bl.includes('[鎖]'));
ok('上鎖文章要密碼', (await text('/alpha/blog/2',Bc)).includes('這篇文章有上鎖'));
ok('搜尋不外洩鎖文', !(await text('/search?q=SECRETTEXT')).includes('鎖起來'));
ok('未解鎖不能迴響', (await post('/alpha/blog/2/comment',{body:'x'},Bc)).status===302 &&
   !(await text('/alpha/blog/2',A)).includes('>x<'));
ok('未解鎖不能引用', (await post('/alpha/blog/2/trackback',{},Bc)).status===302 &&
   !(await text('/bravo/blog')).includes('SECRETTEXT'));
ok('RSS', (await text('/alpha/blog/rss')).includes('<rss version="2.0"'));
ok('RSS 不含鎖文', !(await text('/alpha/blog/rss')).includes('SECRETTEXT'));
ok('網誌搜尋(標題)', (await text('/alpha/blog/search?q=' + encodeURIComponent('第一'))).includes('找到 <b>1</b>'));
ok('網誌搜尋(內容)', (await text('/alpha/blog/search?q=' + encodeURIComponent('內容內容') + '&body=1')).includes('找到 <b>1</b>'));

console.log('\n=== 迴響 / 收藏 / 引用 ===');
await post('/alpha/blog/1/comment',{author:'路人',email:'a@b.com',homepage:'https://ex.com',body:'搶頭香'},null);
const p1=await text('/alpha/blog/1');
ok('迴響顯示樓層', p1.includes('1樓'));
ok('暱稱連個人網頁', p1.includes('https://ex.com'));
ok('板主回覆', (await post('/alpha/blog/1/comment/1/reply',{reply:'謝謝'},A)).status===302 &&
   (await text('/alpha/blog/1')).includes('板主回覆'));
ok('收藏', (await post('/alpha/blog/1/fav',{},Bc)).status===302 && (await text('/bravo/favs')).includes('第一篇'));
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


console.log('\n=== 名片 / 好友 / 動態 ===');
await post('/alpha/card',{realname:'王小明',sex:'男生',zodiac:'雙子座',blood:'O',city:'台北',hobby:'攝影'},A);
const card=await text('/alpha/card');
ok('名片欄位', card.includes('王小明')&&card.includes('雙子座')&&card.includes('台北'));
ok('名片擋亂值', (await post('/alpha/card',{zodiac:'亂',city:'火星',homepage:'javascript:alert(1)'},A)).status===302 &&
   !(await text('/alpha/card')).includes('javascript:alert'));
ok('/user/ 導向名片', (await get('/user/alpha')).headers.get('location')==='/alpha/card');
await post('/alpha/friends/3/group',{grp:'同學'},A);
ok('好友分組', (await text('/alpha/friends')).includes('同學'));
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
ok('好友分類篩選', (await text('/alpha/friends?cateSelect='+encodeURIComponent('同學'))).includes('charlie') &&
   !(await text('/alpha/friends?cateSelect='+encodeURIComponent('同事'))).includes('charlie'));
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

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
