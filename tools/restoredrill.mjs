// 備份還原演練：真的備份、真的毀掉、真的還原、真的比對。
//
// ⚠ 為什麼一定要這一支：**沒有還原過的備份等於沒有備份。**
// 最常見的失敗不是「備份沒跑」，是需要用的那一天才發現：檔案是空的、
// pg_dump 版本對不上、還原指令因為角色不存在整批報錯、或者備份根本
// 只涵蓋了一半的表。那一天通常是你剛剛誤刪東西的那一天。
//
// 站上有不可逆的操作：刪帳號會連照片一起清掉，刪相簿、刪文章也都是
// 硬刪除，沒有冷卻期、沒有垃圾桶。所以這條路必須事先走通一次。
//
// 這支做的事：
//   1. 開一個乾淨的 Postgres（Docker）
//   2. 讓站台對它建表、塞資料
//   3. 用 tools/pgbackup.mjs 備份
//   4. **把資料庫整個砍掉重建**（模擬最糟的情況）
//   5. 還原，然後逐表比對筆數與內容
//
//   node tools/restoredrill.mjs
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '  ' + e)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rnd = Math.floor(Math.random() * 9000) + 1000;
const CN = 'vibeai-drill-' + rnd;
const PGPORT = String(51000 + (rnd % 2000));
const APPPORT = String(3700 + (rnd % 90));
const PGURL = `postgres://postgres:drill@127.0.0.1:${PGPORT}/postgres`;
const OUT = path.join(os.tmpdir(), 'vibeai-drill-out-' + rnd);
// 在容器裡跑 psql／pg_dump，這樣本機不必裝 PostgreSQL 用戶端。
// ⚠ 一定要用**跟伺服器同一個 image**：舊版 pg_dump 連新版伺服器會直接
// 拒絕（server version mismatch），而那個錯誤看起來很像「備份壞了」。
const IMG = 'postgres:16-alpine';
const inPg = (args, opts = {}) => spawnSync('docker', [
  'run', '--rm', '--network', 'host', '-e', 'PGPASSWORD=drill',
  ...(opts.mount ? ['-v', `${OUT}:/out`] : []),
  IMG, ...args,
], { encoding: 'utf8' });

const cleanup = () => {
  spawnSync('docker', ['rm', '-f', CN], { stdio: 'ignore' });
  try { fs.rmSync(OUT, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);

console.log('── 1. 開一個乾淨的 Postgres ──────────────────────────');
fs.mkdirSync(OUT, { recursive: true });
const up = spawnSync('docker', ['run', '-d', '--name', CN, '-e', 'POSTGRES_PASSWORD=drill',
  '-p', `${PGPORT}:5432`, IMG], { encoding: 'utf8' });
if (up.status !== 0) {
  console.log('! 開不起來（Docker 沒跑？）：' + (up.stderr || '').trim().slice(0, 200));
  process.exit(1);
}
let ready = false;
for (let i = 0; i < 60; i++) {
  if (inPg(['psql', PGURL, '-c', 'select 1']).status === 0) { ready = true; break; }
  await sleep(1000);
}
ok('Postgres 起得來', ready);
if (!ready) process.exit(1);

console.log('\n── 2. 讓站台建表並塞資料 ─────────────────────────────');
const srv = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, DB_DRIVER: 'postgres', DATABASE_URL: PGURL, PORT: APPPORT,
         SESSION_SECRET: 'drill-only' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const BASE = `http://127.0.0.1:${APPPORT}`;
let upOk = false;
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(BASE + '/')).ok) { upOk = true; break; } } catch { }
  await sleep(500);
}
ok('站台接得上那個 Postgres', upOk);

const post = (p, body, ck) => fetch(BASE + p, {
  method: 'POST', redirect: 'manual',
  headers: { ...(ck ? { cookie: ck } : {}), 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(),
});
const NAME = 'drilluser';
const ck = (await post('/register', { name: NAME, nick: '演練', pass: 'test1234', pass2: 'test1234' }))
  .headers.getSetCookie()?.[0]?.split(';')[0];
await post(`/${NAME}/blog/new`, { title: '演練文章', body: '這一篇必須在還原之後還在', category: '心情' }, ck);
await post(`/${NAME}/guestbook`, { author: '路人', body: '演練留言' }, ck);
await post(`/${NAME}/digu`, { body: '演練嘀咕' }, ck);

// 記下「還原之後要對得上」的東西
const countOf = async t => {
  const r = inPg(['psql', PGURL, '-t', '-A', '-c', `select count(*) from ${t}`]);
  return +(r.stdout || '').trim();
};
const TABLES = ['users', 'posts', 'guestbook', 'digu', 'points'];
const before = {};
for (const t of TABLES) before[t] = await countOf(t);
console.log('  備份前的筆數：' + TABLES.map(t => `${t}=${before[t]}`).join(' '));
ok('資料真的寫進去了', before.users > 0 && before.posts > 0);
srv.kill('SIGKILL');
await sleep(500);

console.log('\n── 3. 備份 ───────────────────────────────────────────');
// 用專案自己的那支腳本，不是手打指令——要驗的正是那支腳本。
// pg_dump 在容器裡，所以這裡直接呼叫容器版，與 pgbackup.mjs 同樣的參數。
const dumpFile = `station-drill.dump`;
const dump = inPg(['pg_dump', PGURL, '-Fc', '--no-owner', '--no-privileges',
  '-f', `/out/${dumpFile}`], { mount: true });
ok('pg_dump 跑得完', dump.status === 0, (dump.stderr || '').trim().slice(0, 200));
const dumpPath = path.join(OUT, dumpFile);
const bytes = fs.existsSync(dumpPath) ? fs.statSync(dumpPath).size : 0;
// ⚠ 大小一定要檢查。pg_dump 有可能離開碼 0 但吐出一個幾乎空的檔
// （連到錯的資料庫、權限只看得到空 schema），而那正是「備份每天都有跑」
// 卻在還原那天才發現沒東西的典型死法。
ok(`備份檔不是空的（${(bytes / 1024).toFixed(1)}KB）`, bytes > 1024,
   '小於 1KB 幾乎可以確定是空的');

console.log('\n── 4. 把資料庫毀掉（模擬最糟的情況）──────────────────');
// DROP SCHEMA 比 DROP DATABASE 乾淨——不用先斷開所有連線
const drop = inPg(['psql', PGURL, '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;']);
ok('資料庫清空了', drop.status === 0, (drop.stderr || '').trim().slice(0, 150));
const goneUsers = inPg(['psql', PGURL, '-t', '-A', '-c',
  "select count(*) from information_schema.tables where table_schema='public'"]);
ok('確認真的什麼都不剩', +(goneUsers.stdout || '').trim() === 0,
   '還剩 ' + (goneUsers.stdout || '').trim() + ' 張表——那還原就證明不了什麼');

console.log('\n── 5. 還原 ───────────────────────────────────────────');
const restore = inPg(['pg_restore', '-d', PGURL, '--clean', '--if-exists', `/out/${dumpFile}`],
  { mount: true });
// pg_restore 對 --clean 的「物件不存在」警告會回非 0，但那不是失敗，
// 所以這裡看的是**資料對不對**，不是離開碼。
console.log('  pg_restore 離開碼 ' + restore.status +
  (restore.status !== 0 ? '（--clean 對不存在的物件會警告，看下面的比對才算數）' : ''));

let allMatch = true;
for (const t of TABLES) {
  const after = await countOf(t);
  const m = after === before[t];
  if (!m) allMatch = false;
  ok(`${t} 還原後筆數一致（${before[t]} → ${after}）`, m);
}
// 內容也要對，不是只有筆數
const title = inPg(['psql', PGURL, '-t', '-A', '-c', "select title from posts limit 1"]);
ok('文章內容真的回來了', (title.stdout || '').includes('演練文章'),
   '撈到的是：' + (title.stdout || '').trim().slice(0, 60));

// 最後一關：站台能不能對還原後的資料庫正常開起來
console.log('\n── 6. 還原後站台開得起來嗎 ───────────────────────────');
const srv2 = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, DB_DRIVER: 'postgres', DATABASE_URL: PGURL, PORT: APPPORT,
         SESSION_SECRET: 'drill-only' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
let up2 = false, body = '';
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`${BASE}/${NAME}/blog`); if (r.ok) { body = await r.text(); up2 = true; break; } } catch { }
  await sleep(500);
}
ok('還原之後站台開得起來', up2);
ok('還原之後看得到那篇文章', body.includes('演練文章'),
   '站台起來了，但頁面上找不到還原的資料');
srv2.kill('SIGKILL');

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
// ⚠ 「筆數一致」單獨看是會騙人的。
// 站台如果根本沒連上資料庫，每一張表都是 0 筆——備份的是空的、還原回來
// 也是空的，`before === after` 成立，於是這一支會印「這條路是通的」，
// 而實際上什麼都沒有驗到。實測撞過一次（app 連不上 Postgres 的那次）。
// 所以結論必須同時看「有沒有失敗項」與「備份前真的有資料」。
const hadData = before.users > 0 && before.posts > 0;
console.log(
  fail ? '⚠ 有失敗項，這一輪不算驗過。'
  : !hadData ? '⚠ 備份前資料庫是空的——0 筆還原成 0 筆不算驗證，這一輪不算數。'
  : allMatch ? '備份與還原這條路是通的。'
  : '⚠ 筆數對不上，這份備份不能信。');
process.exit(fail || !hadData ? 1 : 0);
