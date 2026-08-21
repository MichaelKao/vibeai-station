// Redis 掛掉的時候，站還活著嗎。
//
// ⚠ 第八輪稽核抓到兩個獨立的洞，都是「有 Redis 更好、沒有也要能跑」這句話
// 沒有真的做到：
//
//   1. REDIS_URL 指到連不上的位址 → 頂層 await redis.connect() 因為
//      reconnectStrategy 永遠回傳數字而無限重連，promise 既不 resolve 也不
//      reject。那是 ESM 的頂層 await，於是 src/server.js 的 import 永遠不會
//      完成、app.listen 永遠不會執行、連 /healthz 都沒開。
//      實測：25 秒過去只是一行一行印 ECONNREFUSED，port 從頭到尾沒被監聽。
//      正式站的情境是 Railway 的 Redis 重啟時剛好碰到部署 → 應用程式無限期
//      不綁 port，健康檢查一路失敗、邊緣回 502，而且 Redis 回來前不會自己好。
//
//   2. /healthz 的 redis 欄位看的是「有沒有設 REDIS_URL」而不是「有沒有連上」，
//      降級之後照樣回報 redis——假訊號比不回報更糟。
//
//   node tools/redisdown.mjs
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 找一個沒有人在聽的 port 當「連不上的 Redis」
const deadPort = 6399;
await new Promise(res => {
  const s = net.createServer();
  s.once('error', () => res());                 // 有人在聽？那就換一個
  s.listen(deadPort, '127.0.0.1', () => s.close(res));
});

async function boot(label, env, port, waitMs = 20_000) {
  const DIR = path.join(os.tmpdir(), 'vibeai-redisdown-' + port);
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const srv = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, DATA_DIR: DIR, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  srv.stdout.on('data', d => { log += d; });
  srv.stderr.on('data', d => { log += d; });

  const deadline = Date.now() + waitMs;
  let health = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) });
      health = await r.json();
      break;
    } catch { await sleep(500); }
  }
  return { srv, log: () => log, health, DIR };
}

// ── 1. Redis 連不上，站還是要起得來 ──────────────────────────────────
{
  const t0 = Date.now();
  const b = await boot('連不上', { REDIS_URL: `redis://127.0.0.1:${deadPort}` }, 3481);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  ok(`Redis 連不上時站照樣起得來（${secs}s）`, !!b.health, '20 秒內 /healthz 都沒有回應');
  ok('降級之後 /healthz 誠實回報 redis=memory', b.health?.redis === 'memory', JSON.stringify(b.health));
  ok('log 有講清楚是降級不是壞掉', /降級/.test(b.log()),
     b.log().split('\n').filter(l => l.includes('[redis]')).slice(0, 3).join(' | '));
  b.srv.kill('SIGKILL');
  await sleep(500);
  try { fs.rmSync(b.DIR, { recursive: true, force: true }); } catch { /* Windows 上剛殺掉的行程還握著檔案，留給暫存目錄自己清 */ }
}

// ── 2. 沒設 REDIS_URL（本機開發的常態）──────────────────────────────
{
  const b = await boot('沒設定', { REDIS_URL: '', REDIS_PRIVATE_URL: '' }, 3482, 15_000);
  ok('沒設 REDIS_URL 也起得來', !!b.health, '15 秒內 /healthz 都沒有回應');
  ok('/healthz 回報 redis=memory', b.health?.redis === 'memory', JSON.stringify(b.health));
  b.srv.kill('SIGKILL');
  await sleep(500);
  try { fs.rmSync(b.DIR, { recursive: true, force: true }); } catch { /* Windows 上剛殺掉的行程還握著檔案，留給暫存目錄自己清 */ }
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
