import ejs from 'ejs';
import path from 'node:path';
import fs from 'node:fs';

const VIEWS = path.resolve('views');
const base = {
  SITE_NAME:'無名小站', SITE_DESC:'相簿、網誌、留言板', SITE_LOGO:'/img/logo.png',
  CDN:'', CDN_VARS:'', THEME_FOR:()=> 't-index',
  render:s=>s, safeCss:s=>s,
  me:{id:1,name:'me',nick:'我',avatar:'',admin:1},
  u:{id:2,name:'kellyla',nick:'凱莉',avatar:'',intro:'哈囉',css:'body{}',visits:142,today_hits:3,hits_date:new Date().toLocaleDateString('sv-SE')},
  isOwner:true, isFriend:false, flash:'測試訊息', guest:null, nav:'album',
};
const topics=['國內旅遊','國外旅遊','美食記錄','流行時尚'];
const places=['台灣','香港與澳門','中國','世界各地'];
const alb=(i)=>({id:i,title:'相簿'+i,descr:'說明<b>'+i,cover:'/uploads/a.jpg',pass:i===2?'x':'',topic:'國內旅遊',place:'台灣',friends_only:i===3?1:0,views:12,created:new Date().toISOString().slice(0,19).replace('T',' '),n:5,uname:'kellyla',nick:'凱莉',featured:0});
const pho=(i)=>({id:i,url:'/uploads/p'+i+'.jpg',thumb:'/uploads/t'+i+'.jpg',caption:'照片'+i,views:3,aid:1,atitle:'相簿1',pass:'',friends_only:0});

const cases = {
  'album.ejs': {...base, topics, places, page:1, pages:2, total:7,
     quota:{used:1234567,total:104857600,mb:b=>(b/1048576).toFixed(1)},
     albums:[1,2,3,4,5,6,7].map(alb)},
  'photos.ejs': {...base, album:alb(1), topics, places, viewAll:false, photos:[1,2,3,4,5,6,7].map(pho)},
  'photos.ejs#all': {...base, album:alb(1), topics, places, viewAll:true, photos:[1,2,3].map(pho), __file:'photos.ejs'},
  'photo.ejs': {...base, p:pho(3), first:1,last:7,prev:2,next:4,idx:3,total:7,
     strip:[1,2,3,4,5,6,7].map(pho), comments:[{id:1,author:'路人',body:'讚',created:'2012-12-26 01:46:50'}]},
  'photo.ejs#first': {...base, p:pho(1), first:1,last:7,prev:undefined,next:2,idx:1,total:7,
     strip:[1,2,3].map(pho), comments:[], __file:'photo.ejs'},
  'photo.ejs#only': {...base, p:pho(1), first:1,last:1,prev:undefined,next:undefined,idx:1,total:1,
     strip:[pho(1)], comments:[], __file:'photo.ejs'},
  'album_lock.ejs': {...base, album:alb(2), err:'密碼錯誤'},
  'slide.ejs': {...base, album:alb(1), photos:[1,2,3].map(pho), start:2},
  'albums.ejs': {...base, u:null, isOwner:false, topic:'國內旅遊', place:null, page:1, pages:3, total:42,
     topics, places, counts:{'國內旅遊':10,'美食記錄':5}, albums:[1,2,3,4].map(alb)},
  'albums.ejs#empty': {...base, u:null, isOwner:false, topic:null, place:null, page:1, pages:1, total:0,
     topics, places, counts:{}, albums:[], __file:'albums.ejs'},
  'album.ejs#guest': {...base, me:null, isOwner:false, topics, places, page:2, pages:2, total:7,
     quota:{used:0,total:104857600,mb:b=>(b/1048576).toFixed(1)}, albums:[], __file:'album.ejs'},
};
let bad=0;
for (const [name, data] of Object.entries(cases)) {
  const file = data.__file || name;
  try {
    const out = await ejs.renderFile(path.join(VIEWS,file), data, {});
    const opens=(out.match(/<table/g)||[]).length, closes=(out.match(/<\/table>/g)||[]).length;
    console.log(`OK   ${name.padEnd(20)} ${String(out.length).padStart(7)} bytes  table ${opens}/${closes}`);
    fs.writeFileSync(path.join(process.env.OUT||'.', name.replace('#','_')+'.html'), out);
  } catch (e) { bad++; console.log(`FAIL ${name}: ${e.message.split('\n').slice(0,6).join(' | ')}`); }
}
process.exit(bad?1:0);
