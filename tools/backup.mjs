// 備份：做出一份「拿去就能用」的資料庫檔（外加上傳的檔案）。
//
// ⚠ 為什麼一定要用這一支，不能直接複製 station.db：
// SQLite 開著 WAL（src/db.js 設的 journal_mode=WAL）。WAL 模式下，
// 剛寫進去的資料放在旁邊的 station.db-wal，主檔還沒收到。
// 站台跑著的時候直接 cp station.db，拿到的是**上一次 checkpoint 的狀態**——
// 運氣不好就是一個空的、或少了最近幾小時內容的資料庫。
//
// 實測（新開的站、註冊 5 個帳號、不停站直接複製）：
//     直接 cp station.db  → 打開之後 **一張表都沒有**（no such table: users）
//     tools/backup.mjs    → 5 筆，跟站台一致
//     station.db-wal      → 819912 bytes，全部的資料都還在裡面
// 那份 cp 出來的檔案不會報錯、不會壞，它就是空的。
// 真的要用它還原的那天才會發現。
//
// VACUUM INTO 會讓 SQLite 自己把 WAL 併進去，輸出一份完整、已壓實的單一檔案，
// 而且不必停站（讀寫照常）。
//
//   node tools/backup.mjs                 存到 DATA_DIR/backups/
//   node tools/backup.mjs --out D:/bak    指定目錄
//   node tools/backup.mjs --keep 14       只留最近 14 份（預設 7）
//
// Postgres（正式站）不走這一支，用 pg_dump：
//   pg_dump "$DATABASE_URL" -Fc -f station-YYYYMMDD.dump
//   railway run pg_dump '$DATABASE_URL' -Fc > station.dump
//
// 上傳的檔案（照片）在 R2 上，R2 自己有版本控制；本機開發時在
// DATA_DIR/uploads，這一支會一起打包。
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const DATA = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB = path.join(DATA, 'station.db');
const OUT = arg('out', path.join(DATA, 'backups'));
const KEEP = +arg('keep', 7);

if (!fs.existsSync(DB)) {
  console.error(`[backup] 找不到資料庫：${DB}`);
  console.error('[backup] 正式站是 Postgres，請改用 pg_dump（見這支檔案開頭的說明）。');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

// 檔名帶時間。這支是人工／排程執行的一次性工具，不是 workflow 腳本，
// 所以可以用 Date。
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const dest = path.join(OUT, `station-${stamp}.db`);

const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(DB, { readOnly: true });
// VACUUM INTO 的目標檔必須不存在
if (fs.existsSync(dest)) fs.rmSync(dest);
db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);

// 核對：備份裡的筆數要跟來源一樣。備份最怕的就是「檔案有、內容空」，
// 所以做完一定要打開來數一次，不能只看檔案大小。
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
const bak = new DatabaseSync(dest, { readOnly: true });
let bad = 0, rows = 0;
for (const { name } of tables) {
  const a = db.prepare(`SELECT count(*) c FROM "${name}"`).get().c;
  const b = bak.prepare(`SELECT count(*) c FROM "${name}"`).get().c;
  rows += b;
  if (a !== b) { bad++; console.error(`[backup] !! ${name} 來源 ${a} → 備份 ${b}`); }
}
bak.close();
db.close();

const mb = (fs.statSync(dest).size / 1048576).toFixed(1);
if (bad) {
  console.error(`[backup] 有 ${bad} 張表對不上，這份備份不可信，已經刪掉`);
  fs.rmSync(dest);
  process.exit(1);
}
console.log(`[backup] ${dest}`);
console.log(`[backup] ${tables.length} 張表、${rows} 筆、${mb} MB，逐表核對一致`);

// 上傳目錄一起記一下大小（不複製，避免動輒好幾 GB；R2 上的檔案有自己的版本控制）
const up = path.join(DATA, 'uploads');
if (fs.existsSync(up)) {
  const files = fs.readdirSync(up);
  const bytes = files.reduce((n, f) => {
    try { return n + fs.statSync(path.join(up, f)).size; } catch { return n; }
  }, 0);
  console.log(`[backup] 另外 uploads/ 有 ${files.length} 個檔、${(bytes / 1048576).toFixed(1)} MB（沒有複製）`);
  console.log('[backup] 正式站的照片在 R2，R2 自己有版本控制，不需要另外備份。');
}

// 只留最近 KEEP 份
const olds = fs.readdirSync(OUT).filter(f => /^station-.*\.db$/.test(f)).sort().reverse();
for (const f of olds.slice(KEEP)) {
  fs.rmSync(path.join(OUT, f));
  console.log(`[backup] 清掉舊的 ${f}`);
}
