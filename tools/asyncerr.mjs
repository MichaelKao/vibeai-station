// 「async route 丟例外的時候會怎樣」。
//
// ⚠⚠ Express 4 的 router 只認同步丟出來的例外。handler 寫成
// `async (req,res)=>{ … }` 時，裡面丟出來的東西變成一個沒有人接的 promise
// rejection——Express 不知道、錯誤中介層不會跑、使用者那條連線掛著等逾時，
// 而 Node 從 15 起會直接把整個行程殺掉。
//
// 這支程式有一百多個 async handler，任何一個踩到邊界情況就等於整站重啟。
// 在 Railway 上的樣子是「Deploy Crashed」信一封接一封、站又自己活過來。
//
// 這一支在真的站台上掛一條會丟例外的測試路由，驗三件事：
//   1. 使用者收到的是錯誤頁（500），不是連線掛著等逾時
//   2. 行程沒有死
//   3. log 裡有堆疊可以追
//
//   node tools/asyncerr.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

let pass=0, fail=0;
const ok=(n,c,e='')=>{c?pass++:fail++;console.log((c?'  PASS ':'! FAIL ')+n+(c?'':'  '+e));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const PORT=3497, DIR=path.join(os.tmpdir(),'vibeai-asyncerr-'+process.pid);
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});

// 測試路由靠環境變數 ASYNC_ERR_ROUTE=1 掛上去（見 src/server.js），
// 正式站沒有這個變數，所以那條路由不存在。
const srv = spawn(process.execPath,['src/server.js'],
  {env:{...process.env,DATA_DIR:DIR,PORT:String(PORT),ASYNC_ERR_ROUTE:'1'},stdio:['ignore','pipe','pipe']});
let log=''; srv.stdout.on('data',d=>log+=d); srv.stderr.on('data',d=>log+=d);
for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/`)).ok)break;}catch{}await sleep(400);}

let status=null, timedOut=false;
try {
  const r = await fetch(`http://127.0.0.1:${PORT}/__asyncerr`,{signal:AbortSignal.timeout(8000)});
  status = r.status;
} catch { timedOut = true; }
ok('會丟例外的 async route 有回應（不是掛著等逾時）', !timedOut);
ok('回的是 500 錯誤頁', status===500, '收到 '+status);

await sleep(500);
let alive=false; try{ alive=(await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok; }catch{}
ok('行程沒有死', alive);
ok('log 裡留得下堆疊', /__asyncerr 測試用例外/.test(log),
   log.split('\n').filter(l=>l.includes('Error')).slice(0,1).join(''));

srv.kill('SIGKILL'); await sleep(400);
try{fs.rmSync(DIR,{recursive:true,force:true});}catch{}
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
