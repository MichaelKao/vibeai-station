// 一次性搬移：SQLite（Railway Volume 上的 station.db）→ Postgres。
//
// 為什麼做成「服務啟動時執行」而不是本機腳本：舊資料在 Railway 的 Volume 裡，
// 本機碰不到，而進正式容器開遠端 shell 風險太高。改成由服務自己在啟動時搬，
// 過程全部留在部署日誌裡，可以事後稽核。
//
// 用法：
//   1. railway variables --service station --set MIGRATE_SQLITE_TO_PG=1
//   2. 等部署跑完，看 railway logs 核對每張表的來源／目標筆數
//   3. 筆數都對 → railway variables --service station --set DB_DRIVER=postgres
//   4. 再部署一次，確認站台正常後，把 MIGRATE_SQLITE_TO_PG 設回 0
//
// 安全性：
//   - 目標表只要有任何一張非空就整個跳過，所以重跑不會產生重複資料
//   - 不刪除來源，SQLite 檔原封不動留在 Volume 上當備援
//   - 搬移失敗不會讓站台起不來（呼叫端會接住），只是記錄錯誤

import fs from 'node:fs';
import { schemaSql } from './db.js';

// 依存關係順序：被外鍵參照的表要先搬
const TABLES = [
  'users', 'albums', 'photos', 'photo_comments', 'posts', 'comments', 'trackbacks',
  'guestbook', 'visitors', 'friends', 'favs', 'acts', 'sysmsg', 'reports', 'notices',
];
// 用 IDENTITY 主鍵的表，搬完要把序列推到 max(id)，否則之後 INSERT 會撞主鍵
const SERIAL_TABLES = TABLES.filter(t => !['friends', 'favs'].includes(t));

export async function migrateSqliteToPg({ sqlitePath, pgUrl }) {
  if (!fs.existsSync(sqlitePath)) {
    console.log(`[migrate] 找不到 ${sqlitePath}，沒有東西要搬`);
    return;
  }

  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: pgUrl,
    ssl: /\.railway\.internal(:|$|\/)/.test(pgUrl) ? false
      : { rejectUnauthorized: process.env.PGSSL_INSECURE !== '1' },
  });

  try {
    // 目標端建表（用 PG 方言，與站台目前跑哪個驅動無關）
    for (const sql of schemaSql('postgres')) await pool.query(sql);
    console.log('[migrate] Postgres 建表完成');

    // 目標非空就整個跳過，避免重跑造成重複
    for (const t of TABLES) {
      const n = (await pool.query(`SELECT count(*)::int c FROM ${t}`)).rows[0].c;
      if (n > 0) {
        console.log(`[migrate] ${t} 已有 ${n} 筆，判定先前已搬過，整個跳過`);
        return;
      }
    }

    const { DatabaseSync } = await import('node:sqlite');
    const src = new DatabaseSync(sqlitePath, { readOnly: true });
    const report = [];

    for (const t of TABLES) {
      let rows;
      try { rows = src.prepare(`SELECT * FROM ${t}`).all(); }
      catch (e) { console.log(`[migrate] ${t} 讀取失敗（來源可能沒有這張表）：${e.message}`); continue; }
      if (!rows.length) { report.push([t, 0, 0]); continue; }

      // 只搬目標表真的有的欄位，來源多出來的舊欄位自動忽略
      const targetCols = new Set(
        (await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1', [t]))
          .rows.map(r => r.column_name));
      const cols = Object.keys(rows[0]).filter(c => targetCols.has(c));
      const list = cols.map(c => `"${c}"`).join(',');
      const ph = cols.map((_, i) => '$' + (i + 1)).join(',');

      for (const r of rows)
        await pool.query(`INSERT INTO ${t}(${list}) VALUES(${ph}) ON CONFLICT DO NOTHING`,
          cols.map(c => r[c]));

      const got = (await pool.query(`SELECT count(*)::int c FROM ${t}`)).rows[0].c;
      report.push([t, rows.length, got]);
    }

    // 把 IDENTITY 序列推到目前的 max(id)，否則之後 INSERT 會從 1 開始撞主鍵
    for (const t of SERIAL_TABLES) {
      try {
        await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'),
          GREATEST((SELECT COALESCE(MAX(id),0) FROM ${t}), 1))`);
      } catch (e) { console.log(`[migrate] ${t} 序列重設略過：${e.message}`); }
    }

    src.close();

    let bad = 0;
    console.log('[migrate] 完成，逐表核對：');
    for (const [t, from, to] of report) {
      const okRow = from === to;
      if (!okRow) bad++;
      console.log(`[migrate]   ${okRow ? 'OK ' : '!! '} ${t.padEnd(16)} 來源 ${String(from).padStart(6)} → 目標 ${String(to).padStart(6)}`);
    }
    if (bad) console.error(`[migrate] 有 ${bad} 張表筆數對不上，先不要設 DB_DRIVER=postgres`);
    else console.log('[migrate] 所有表筆數一致，可以設 DB_DRIVER=postgres 了');
  } finally {
    await pool.end();
  }
}
