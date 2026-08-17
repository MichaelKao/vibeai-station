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
ok('相簿顯示照片', (alb.match(/class="thumb"/g)||[]).length===3);
ok('有縮圖', alb.includes('_t.jpg'));
ok('一頁瀏覽', (await text(`/alpha/album/${aid}?all=1`,A)).includes('onepage'));
ok('幻燈片', (await text(`/alpha/album/${aid}/slide`,A)).includes('slidedata'));
const ph=await text('/alpha/photo/1',A);
ok('照片導覽列', ph.includes('第一張')&&ph.includes('最後一張')&&ph.includes('回頂端'));
ok('照片縮圖列', ph.includes('strip'));
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

console.log('\n=== 分類總站 ===');
ok('相簿總站 24 類', (await text('/albums')).match(/\?topic=/g).length>=24);
ok('網誌總站 12 類', (await text('/blogs')).match(/\?topic=/g).length>=12);
ok('相簿分類篩選', (await text('/albums?topic='+encodeURIComponent('國內旅遊'))).includes('國內旅遊'));

console.log('\n=== 無名風格網址 ===');
for(const [u,exp] of [['/album/alpha','/alpha/album'],['/blog/alpha','/alpha/blog'],['/guestbook/alpha','/alpha/guestbook'],['/friend/alpha','/alpha/friends'],['/mypage/alpha','/alpha'],['/user/alpha','/alpha/card']]){
  const r=await get(u); ok('301 '+u, r.status===301 && r.headers.get('location')===exp, r.headers.get('location'));
}

console.log('\n=== 樣式 / 設定 ===');
const sf=new FormData(); sf.append('nick','阿發'); sf.append('theme','pink');
await fetch(B+'/alpha/settings',{method:'POST',headers:{cookie:A},body:sf,redirect:'manual'});
ok('版面樣式套用', (await text('/alpha')).includes('t-x-pink'));
const sf2=new FormData(); sf2.append('nick','阿發'); sf2.append('theme','<script>');
await fetch(B+'/alpha/settings',{method:'POST',headers:{cookie:A},body:sf2,redirect:'manual'});
ok('惡意樣式被擋', !(await text('/alpha')).includes('t-x-<script>'));

console.log('\n=== 權限 ===');
ok('非本人不能改設定', (await get('/alpha/settings',Bc)).status===403);
ok('非本人不能發文', (await get('/alpha/blog/new',Bc)).status===403);
ok('非站長不能進後台', (await get('/admin',Bc)).status===403);   // alpha 是第一個註冊者＝站長，改用 bravo 驗
ok('非本人不能刪相簿', (await post(`/alpha/album/${aid}/del`,{},Bc)).status===403);

console.log('\n=== 全站頁面 ===');
for(const p of ['/','/albums','/blogs','/rank','/search?q=a','/help','/login','/register','/alpha','/alpha/album','/alpha/blog','/alpha/guestbook','/alpha/card','/alpha/friends','/alpha/favs']){
  ok('200 '+p, (await get(p)).status===200);
}
ok('404 不存在使用者', (await get('/nobodyhere')).status===404);
ok('404 不存在文章', (await get('/alpha/blog/9999')).status===404);

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
