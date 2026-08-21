// 同時很多人來的時候會怎樣。
//
// ⚠ 為什麼需要：站上所有測試都是「一次一個請求」。真正上線那天，
// 如果有人把網址貼到社群，來的不是一個人是一群人，而我們對這件事
// **一個數字都沒有**——不知道會慢、會排隊、還是會直接倒。
//
// 這一支不追求「壓到掛」（那需要另一台機器發壓力），它問的是三件
// 上線前一定要知道的事：
//   1. 併發之下還會不會全部成功（有沒有 5xx、有沒有連線被拒）
//   2. 慢到什麼程度（p95 比單人慢幾倍）
//   3. 資料會不會錯（同一個人同時操作，計數與配額有沒有被算壞）
//
// 第 3 點最重要。前兩點慢一點使用者只是等，第 3 點是**資料壞掉**，
// 而且事後很難發現。
//
//   node tools/loadcheck.mjs                      測本機（自己開站）
//   BASE=https://station.vibeaico.com node tools/loadcheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '  ' + e)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REMOTE = !!process.env.BASE;
let BASE = (process.env.BASE || '').replace(/\/$/, '');
let srv = null, DIR = null;
if (!REMOTE) {
  DIR = path.join(os.tmpdir(), 'vibeai-load-' + process.pid);
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  BASE = 'http://127.0.0.1:3500';
  srv = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, DATA_DIR: DIR, PORT: '3500' }, stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE + '/')).ok) break; } catch { }
    await sleep(400);
  }
}
const post = (p, body, ck) => fetch(BASE + p, {
  method: 'POST', redirect: 'manual',
  headers: { ...(ck ? { cookie: ck } : {}), 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(),
});

const pct = (arr, q) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * q))];

// ── 1) 單人基準：一頁要多久 ──────────────────────────────────────────
let base1 = 0;
{
  const t = [];
  for (let i = 0; i < 8; i++) {
    const s = Date.now(); const r = await fetch(BASE + '/'); await r.text(); t.push(Date.now() - s);
  }
  base1 = pct(t, 0.5);
  console.log(`  [基準] 一個人讀首頁，中位數 ${base1}ms`);
  ok('單人讀首頁在 3 秒內', base1 < 3000, base1 + 'ms');
}

// ── 2) 併發讀取 ──────────────────────────────────────────────────────
// 讀取是絕大多數的流量（訪客瀏覽），先看這一段。
for (const n of [10, 30]) {
  const paths = ['/', '/albums', '/blogs', '/rank', '/hala', '/help'];
  const t = [], bad = [];
  await Promise.all(Array.from({ length: n }, async (_, i) => {
    const s = Date.now();
    try {
      const r = await fetch(BASE + paths[i % paths.length]);
      await r.text();
      if (r.status >= 400) bad.push(paths[i % paths.length] + ' → ' + r.status);
    } catch (e) { bad.push(paths[i % paths.length] + ' → ' + e.message.slice(0, 40)); }
    t.push(Date.now() - s);
  }));
  ok(`${n} 人同時讀，沒有任何一個失敗`, bad.length === 0,
     bad.slice(0, 4).join('；'));
  const p95 = pct(t, 0.95);
  console.log(`  [${n} 併發] p50 ${pct(t, 0.5)}ms、p95 ${p95}ms`);
  // ⚠ 門檻放寬到 15 秒不是因為 15 秒可以接受，而是因為這一支只想抓
  // 「排隊排到爆」與「直接倒」。真正的效能調校要另外做。
  ok(`${n} 人同時讀，p95 在 15 秒內`, p95 < 15000, p95 + 'ms');
}

// ── 3) 同一個人同時寫：計數會不會被算壞 ─────────────────────────────
// ⚠ 這是整支最重要的一段。前面慢一點使用者只是等，這裡錯的話是**資料壞掉**，
// 而且事後幾乎不可能發現——沒有人會去對帳說「我的點數少了 20」。
{
  const N = 'load' + Math.floor(Date.now() / 1000 % 100000);
  const ck = (await post('/register', { name: N, nick: N, pass: 'test1234', pass2: 'test1234' }))
    .headers.getSetCookie()?.[0]?.split(';')[0];
  ok('準備：註冊得到 session', !!ck);

  if (ck) {
    const bal = async () => +((await (await fetch(BASE + '/points', { headers: { cookie: ck } })).text())
      .match(/餘額 <b>(-?\d+)<\/b>/) || [])[1];
    const before = await bal();

    // 同時發 12 則嘀咕：每一則都該進去，一則都不能少也不能重複
    await Promise.all(Array.from({ length: 12 }, (_, i) =>
      post(`/${N}/digu`, { body: '併發嘀咕' + i }, ck).catch(() => {})));
    const page = await (await fetch(`${BASE}/${N}/digu`, { headers: { cookie: ck } })).text();
    const got = new Set(page.match(/併發嘀咕\d+/g) || []).size;
    ok(`同時送 12 則嘀咕，全部都進去了（實際 ${got} 則）`, got === 12,
       '少掉的那幾則使用者以為送出了，其實沒有');

    // 餘額不該因為併發讀寫而變動（嘀咕不扣點）
    ok('併發寫入沒有動到點數餘額', await bal() === before,
       `${before} → ${await bal()}`);
  }
}

if (srv) { srv.kill('SIGKILL'); await sleep(300); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} }
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
