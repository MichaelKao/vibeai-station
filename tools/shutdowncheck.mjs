// 「收到 SIGTERM 之後，正在跑的請求會不會被攔腰砍斷」。
//
// ⚠ 為什麼要有這一支：Railway 每一次重新部署、重啟、擴縮容都是先送 SIGTERM。
// 原本唯一的 SIGTERM 處理在 src/cache.js，把人氣刷回去之後就 process.exit(0)
// ——不等 HTTP 連線收尾、不等正在跑的 handler。實測一個要跑 1.2 秒的請求，
// SIGTERM 之後「寫入完成」永遠不會印出來，行程直接 exit 0。
//
// 使用者遇到的是：正在上傳 20 張照片的請求停在「檔案已經寫進 R2、
// photos 那幾筆 INSERT 還沒下去」的中間——瀏覽器只看到連線中斷，
// 相簿裡什麼都沒有，而 R2 上多了永遠沒人參照卻要一直付錢的物件。
// 這不是罕見時機，是每部署一次就截斷一次。
//
// 這一支拿真的站台驗：送一個會慢慢跑的請求（上傳一張圖），中途 SIGTERM，
// 看那個請求有沒有正常收到回應。
//
//   node tools/shutdowncheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const PORT = +(process.env.PORT || 3491);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = path.join(os.tmpdir(), 'vibeai-shutdown-' + process.pid);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 產一張真的 PNG（跟 test_all.mjs 同一套，不外連）
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0}
function ch(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])}
function png(w,h){const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;const raw=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*(w*3+1)+1+x*3;raw[i]=x%255;raw[i+1]=y%255;raw[i+2]=120;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]);}

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

// ⚠ Windows 沒有真正的 POSIX 訊號：child.kill('SIGTERM') 走的是
// TerminateProcess，行程當場消失，handler 一行都不會跑，開發機上根本測不到
// 關機流程。所以這裡透過 tools/shutdown-wrap.mjs 用 IPC 叫子行程自己
// process.emit('SIGTERM')——走的是和正式站（Linux）**完全相同的那一段
// handler**，只有「訊號怎麼來的」不一樣。驗的是我們的關機邏輯，不是作業系統。
const srv = spawn(process.execPath, ['tools/shutdown-wrap.mjs'], {
  env: { ...process.env, DATA_DIR: DIR, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});
let log = '';
srv.stdout.on('data', d => { log += d; });
srv.stderr.on('data', d => { log += d; });

for (let i = 0; i < 80; i++) {
  try { if ((await fetch(BASE + '/')).ok) break; } catch { }
  await sleep(300);
}

// 註冊 + 建相簿
const reg = await fetch(BASE + '/register', {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ name: 'shutq', nick: '收工', pass: 'test1234', pass2: 'test1234' }).toString(),
});
const ck = reg.headers.getSetCookie()?.[0]?.split(';')[0];
ok('準備：註冊得到 session', !!ck);
await fetch(BASE + '/shutq/album', {
  method: 'POST', redirect: 'manual',
  headers: { cookie: ck, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ title: '收工測試' }).toString(),
});
const page = await (await fetch(BASE + '/shutq/album', { headers: { cookie: ck } })).text();
const aid = Math.max(...[...page.matchAll(/\/shutq\/album\/(\d+)/g)].map(m => +m[1]));
ok('準備：建好相簿', aid > 0);

// 送一個會跑一陣子的請求（多張大圖，sharp 要花時間），不 await
const fd = new FormData();
for (let i = 0; i < 20; i++) fd.append('photos', new Blob([png(2400, 1800)], { type: 'image/png' }), `p${i}.png`);
const t0 = Date.now();
const inflight = fetch(`${BASE}/shutq/album/${aid}/upload`, {
  method: 'POST', headers: { cookie: ck }, body: fd, redirect: 'manual',
}).then(r => ({ status: r.status, ms: Date.now()-t0 })).catch(e => ({ error: e.cause?.code || e.message, ms: Date.now()-t0 }));

// 等它真的開始跑，再送 SIGTERM
await sleep(700);
srv.send('term');

const result = await inflight;
ok('SIGTERM 期間正在跑的上傳有正常收到回應',
   result.status === 302, JSON.stringify(result));
console.log(`    （上傳共花 ${result.ms}ms，SIGTERM 在第 300ms 送出）`);

// 行程要自己收乾淨（不是被我們硬殺）
const exited = await new Promise(res => {
  const t = setTimeout(() => res('timeout'), 25_000);
  srv.on('exit', code => { clearTimeout(t); res(code); });
});
ok('行程自己結束（不必 SIGKILL）', exited !== 'timeout', String(exited));
ok('關機流程有跑完（log 有「收工」）', /\[shutdown\] 收工/.test(log),
   log.split('\n').filter(l => l.includes('[shutdown]')).join(' | ') || '(log 裡沒有 shutdown)');

// 照片真的進資料庫了（不是寫了檔案卻沒有那幾筆）
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(path.join(DIR, 'station.db'), { readOnly: true });
const n = db.prepare('SELECT count(*) c FROM photos').get().c;
db.close();
ok(`上傳的照片有進資料庫（${n} 張）`, n === 20, `只有 ${n} 張`);

try { srv.kill('SIGKILL'); } catch { }
fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
