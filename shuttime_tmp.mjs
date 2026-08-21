// 量「收到 SIGTERM 之後，行程實際上多久才結束」。
// 重點在 keep-alive：瀏覽器與 Railway 的邊界都會保持連線，
// server.close() 預設會等那些閒置連線自己斷開才回呼。
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import http from 'node:http';
const DIR = path.join(os.tmpdir(),'vibeai-st-'+process.pid);
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
const PORT=3492;
const srv = spawn(process.execPath,['tools/shutdown-wrap.mjs'],
  {env:{...process.env,DATA_DIR:DIR,PORT:String(PORT)},stdio:['ignore','pipe','pipe','ipc']});
let log=''; srv.stdout.on('data',d=>log+=d); srv.stderr.on('data',d=>log+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/`)).ok)break;}catch{}await sleep(400);}

// 開三條 keep-alive 連線，像真的瀏覽器／邊界那樣掛著
const agent = new http.Agent({ keepAlive: true, maxSockets: 5 });
for (let i=0;i<3;i++) await new Promise(res=>{
  http.get({host:'127.0.0.1',port:PORT,path:'/',agent},r=>{r.resume();r.on('end',res);});
});
console.log('已建立 3 條 keep-alive 連線（保持開著）');

const t0=Date.now();
srv.send('term');
const code = await new Promise(res=>srv.on('exit',(c,s)=>res({c,s})));
const ms = Date.now()-t0;
console.log(`SIGTERM → 行程結束：${ms}ms，離開代碼 ${JSON.stringify(code)}`);
console.log(ms > 5000 ? '⚠ 超過 5 秒——平台的寬限期若比這短就會被 SIGKILL，算成 crash'
                      : '✓ 夠快');
console.log(log.split('\n').filter(l=>l.includes('[shutdown]')).join('\n'));
agent.destroy();
try{fs.rmSync(DIR,{recursive:true,force:true});}catch{}
