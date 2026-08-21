// 正式站（Postgres）的備份。
//
// ⚠ 為什麼需要這一支：tools/backup.mjs 只做得了本機的 SQLite
// （它用 VACUUM INTO），碰到 DATABASE_URL 就直接結束。也就是說在這之前，
// **正式站的資料一份備份都沒有**。
//
// 而站上有不可逆的操作：刪帳號（site.post('/settings/delete')）會連同
// 照片一起清掉，刪相簿、刪文章也都是硬刪除，沒有冷卻期、沒有垃圾桶。
// 誤觸的那一刻，如果沒有備份，那份資料就是沒了。
//
// 用法：
//   node tools/pgbackup.mjs                  存到 ./backups/
//   node tools/pgbackup.mjs --out D:/bak     指定目錄
//   node tools/pgbackup.mjs --keep 14        只留最近 14 份（預設 7）
//
// 在本機對正式站備份（需要 Railway CLI 已登入並 link 好專案）：
//   railway run node tools/pgbackup.mjs --out ./backups
//
// ⚠ 這一支需要系統上有 pg_dump，而且**版本要不低於伺服器**。
// 版本較舊的 pg_dump 連新版伺服器會直接拒絕，錯誤訊息是
// "server version mismatch"——那不是這支腳本壞了。
//
// ⚠ 還原也要練過一次。沒有還原過的備份等於沒有備份——最常見的失敗
// 不是備份沒跑，是那天才發現檔案是空的、或還原指令跑不起來。
//   pg_restore -d "$DATABASE_URL" --clean --if-exists station-XXXX.dump
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg('--out') || 'backups');
const KEEP = Math.max(1, +(arg('--keep') || 7));
const URL = process.env.DATABASE_URL;

if (!URL) {
  console.error('[pgbackup] 沒有 DATABASE_URL——這一支是給正式站（Postgres）用的。');
  console.error('           本機的 SQLite 請用 node tools/backup.mjs。');
  process.exit(1);
}

// 檔名帶時間戳，這樣同一天跑好幾次不會互相覆蓋。
// ⚠ 不用 ISO 字串直接當檔名：裡面的冒號在 Windows 上是非法字元。
const now = new Date();
const p2 = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
              `-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `station-${stamp}.dump`);

// -Fc ＝ custom 格式：壓縮過，而且 pg_restore 可以挑表還原。
// --no-owner/--no-privileges：還原到另一個環境（本機、新的 Railway 專案）時，
// 原本的角色名稱不存在會整批報錯。備份的用途就是「換一個地方也能開起來」。
console.log(`[pgbackup] 備份中 → ${file}`);
const r = spawnSync('pg_dump', [URL, '-Fc', '--no-owner', '--no-privileges', '-f', file],
  { stdio: ['ignore', 'inherit', 'inherit'] });

if (r.error?.code === 'ENOENT') {
  console.error('[pgbackup] 找不到 pg_dump。請先安裝 PostgreSQL 用戶端工具，');
  console.error('           或用 railway run 在有 pg_dump 的環境裡執行。');
  process.exit(1);
}
if (r.status !== 0) { console.error('[pgbackup] pg_dump 失敗，離開碼', r.status); process.exit(1); }

// ⚠ 一定要檢查檔案大小。pg_dump 有可能離開碼 0 但吐出一個幾乎空的檔
// （連到了錯的資料庫、權限只看得到空 schema）。而那正是「備份看起來
// 每天都有跑」卻在還原那天才發現沒東西的典型死法。
const bytes = fs.statSync(file).size;
if (bytes < 1024) {
  console.error(`[pgbackup] ⚠ 產出的檔案只有 ${bytes} 位元組——幾乎可以確定是空的。`);
  console.error('           檢查 DATABASE_URL 指到的是不是正確的資料庫。');
  process.exit(1);
}
console.log(`[pgbackup] 完成：${(bytes / 1024 / 1024).toFixed(2)} MB`);

// 輪替：只留最近 KEEP 份。
const olds = fs.readdirSync(OUT)
  .filter(f => /^station-\d{8}-\d{6}\.dump$/.test(f))
  .sort()
  .slice(0, -KEEP);
for (const f of olds) {
  fs.rmSync(path.join(OUT, f), { force: true });
  console.log('[pgbackup] 刪掉舊備份', f);
}
console.log(`[pgbackup] 目前保留 ${Math.min(KEEP, fs.readdirSync(OUT).filter(f => f.endsWith('.dump')).length)} 份`);
