// 「沒接住的錯誤會不會把整站弄死」。
//
// ⚠ 這支程式原本完全沒有 unhandledRejection / uncaughtException 的處理。
// Node 從 15 起，任何一個沒接住的 promise rejection 都會直接殺掉行程，
// 而預設印出來的常常只有一行 message，看不出是哪一條路徑。
// 在 Railway 上的樣子就是「Deploy Crashed」信一封接一封、站自己重啟，
// 沒有人知道為什麼——實際發生過，連續二十小時每隔十幾分鐘一封。
//
// 這一支驗兩件事：一個漏接的 await 不會把所有正在用站的人一起踢掉，
// 而且 log 裡留得下完整堆疊可以回頭修。
//
// ⚠ Windows 沒有真正的 POSIX 訊號，所以透過 tools/shutdown-wrap.mjs
// 用 IPC 叫子行程自己製造那個 rejection（走的是同一段 handler）。
//
//   node tools/crashcheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const DIR = path.join(os.tmpdir(), 'vibeai-crash-' + process.pid);
fs.rmSync(DIR, {recursive:true, force:true}); fs.mkdirSync(DIR, {recursive:true});
const PORT = 3495;
const srv = spawn(process.execPath, ['tools/shutdown-wrap.mjs'], {
  env: {...process.env, DATA_DIR: DIR, PORT: String(PORT)},
  stdio: ['ignore','pipe','pipe','ipc'],
});
let log=''; srv.stdout.on('data',d=>log+=d); srv.stderr.on('data',d=>log+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for (let i=0;i<60;i++){ try{ if((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; }catch{} await sleep(400); }
let pass=0, fail=0;
const ok=(n,c,e='')=>{c?pass++:fail++;console.log((c?'  PASS ':'! FAIL ')+n+(c?'':'  '+e));};
ok('起站完成', true);
// 在子行程裡製造一個沒接住的 rejection
srv.send('reject');
await sleep(1500);
let alive=false;
try { alive = (await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok; } catch {}
ok('一個沒接住的 rejection 不會把站弄死', alive);
ok('log 有記下完整堆疊', /未接住的 rejection/.test(log) && /Error:/.test(log));
console.log(log.split('\n').filter(l=>l.includes('未接住')).slice(0,2).join('\n'));
srv.kill('SIGKILL');
await sleep(400); try{ fs.rmSync(DIR,{recursive:true,force:true}); }catch{}

console.log(`
===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
