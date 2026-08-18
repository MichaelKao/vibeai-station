// 一次性搬移：SQLite（Railway Volume 上的 station.db）→ Postgres。
//
// 為什麼做成「啟動時執行」而不是本機腳本：舊資料在 Railway 的 Volume 裡，
// 本機碰不到，而進正式容器開遠端 shell 風險太高。改成由服務自己在啟動時搬，
// 過程全部留在部署日誌裡，可以事後稽核。
//
// 用法：
//   1. railway variables --service station --set MIGRATE_SQLITE_TO_PG=1
//   2. 等這次部署跑完，看 railway logs 確認每張表的筆數
//   3. railway variables --service station --set MIGRATE_SQLITE_TO_PG=0
//
// 安全性：
//   - 只在目標表是空的時候搬（任何一張表已有資料就整個跳過），所以重複執行不會產生重複資料
//   - 搬完會把每張表的來源／目標筆數印出來比對
//   - 不刪除來源，SQLite 檔原封不動留在 Volume 上當備援

import fs from 'node:fs';

// 依存關係順序：被參照的表要先搬
const TABLES = [
  'users', 'albums', 'photos', 'photo_comments', 'posts', 'comments', 'trackbacks',
  'guestbook', 'visitors', 'friends', 'favs', 'acts', 'sysmsg', 'reports', 'notices',
];
// 用 IDENTITY 主鍵的表，搬完要把序列推到 max(id)，否則之後 INSERT 會撞主鍵
const SERIAL_TABLES = TABLES.filter(t => !['friends', 'favs'].includes(t));

export async function migrateSqliteToPg({ sqlitePath, pg }) {
  if (!fs.existsSync(sqlitePath)) {
    console.log(`[migrate] 找不到 ${sqlitePath}，沒有東西要搬`);
    return;
  }

  const { DatabaseSync } = await import('node:sqlite');
  const src = new DatabaseSync(sqlitePath, { readOnly: true });

  // 目標非空就整個跳過，避免重跑造成重複
  for (const t of TABLES) {
    const n = (await pg.one(`SELECT count(*)::int c FROM ${t}`))?.c ?? 0;
    if (n > 0) {
      console.log(`[migrate] ${t} 已有 ${n} 筆，判定先前已搬過，整個跳過`);
      src.close();
      return;
    }
  }

  const report = [];
  for (const t of TABLES) {
    let rows;
    try { rows = src.prepare(`SELECT * FROM ${t}`).all(); }
    catch (e) { console.log(`[migrate] ${t} 讀取失敗（來源可能沒有這張表）：${e.message}`); continue; }
    if (!rows.length) { report.push([t, 0, 0]); continue; }

    // 只搬目標表真的有的欄位，來源多出來的舊欄位自動忽略
    const targetCols = new Set((await pg.all(
      'SELECT column_name FROM information_schema.columns WHERE table_name=$1', t))
      .map(r => r.column_name));
    const cols = Object.keys(rows[0]).filter(c => targetCols.has(c));

    const list = cols.map(c => `"${c}"`).join(',');
    for (const r of rows) {
      const ph = cols.map((_, i) => '$' + (i + 1)).join(',');
      await pg.run(
        `INSERT INTO ${t}(${list}) VALUES(${ph}) ON CONFLICT DO NOTHING`,
        ...cols.map(c => r[c]));
    }
    const got = (await pg.one(`SELECT count(*)::int c FROM ${t}`)).c;
    report.push([t, rows.length, got]);
  }

  // 把 IDENTITY 序列推到目前的 max(id)
  for (const t of SERIAL_TABLES) {
    try {
      await pg.run(`SELECT setval(pg_get_serial_sequence('${t}','id'),
        GREATEST((SELECT COALESCE(MAX(id),0) FROM ${t}), 1))`);
    } catch (e) { console.log(`[migrate] ${t} 序列重設略過：${e.message}`); }
  }

  src.close();

  console.log('[migrate] 完成');
  let bad = 0;
  for (const [t, from, to] of report) {
    const ok = from === to;
    if (!ok) bad++;
    console.log(`[migrate]   ${ok ? '✓' : '✗'} ${t.padEnd(16)} 來源 ${String(from).padStart(6)} → 目標 ${String(to).padStart(6)}`);
  }
  if (bad) console.error(`[migrate] 有 ${bad} 張表筆數對不上，請人工確認後再關掉 MIGRATE_SQLITE_TO_PG`);
}
