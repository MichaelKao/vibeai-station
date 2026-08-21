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
import { schemaSql, addColumnSql } from './db.js';

// 依存關係順序：被外鍵參照的表要先搬。
// ⚠ 新增資料表時**一定要同步加進這裡**。漏了的話搬移會安靜地把那張表整個丟掉，
// 而且下面的筆數報表還是印「一致」——因為它只比對這張清單裡的表。
// 曾經漏掉 folders / subs / friend_groups / gifts / photo_votes 五張，
// 使用者的側欄自訂欄位、訂閱、好友分組會永久消失。
// 底下的 assertNoMissingTable() 就是為了讓這種疏漏當場失敗而不是靜靜發生。
export const MIGRATE_TABLES = [
  'users', 'albums', 'photos', 'photo_comments', 'posts', 'comments', 'trackbacks',
  'guestbook', 'visitors', 'friend_groups', 'friends', 'favs', 'acts', 'sysmsg',
  'reports', 'notices', 'videos', 'digu', 'joins', 'join_members',
  'hala_topics', 'hala_posts', 'gifts', 'photo_votes', 'folders', 'subs',
];
// 用 IDENTITY 主鍵的表，搬完要把序列推到 max(id)，否則之後 INSERT 會撞主鍵
// 沒有 id 欄位的關聯表不用推序列（推了會找不到那個序列而報錯）。
// 這份清單要跟 src/db.js 的 TABLES_WITHOUT_ID 一致。
const TABLES = MIGRATE_TABLES;
const SERIAL_TABLES = TABLES.filter(t => !['friends', 'favs', 'join_members', 'photo_votes'].includes(t));

// 搬移清單漏表是「安靜的資料遺失」——報表照樣印一致，因為它只看清單裡的表。
// 拿 schemaSql 產生的建表語句反推真正的表名，跟清單對差集，缺了就直接失敗。
function assertNoMissingTable() {
  const declared = new Set();
  for (const sql of schemaSql('postgres'))
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\(/g)) declared.add(m[1]);
  const missing = [...declared].filter(t => !TABLES.includes(t));
  if (missing.length) throw new Error(
    `[migrate] 搬移清單漏了這些表：${missing.join(', ')}。`
    + '請把它們加進 src/migrate-pg.js 的 TABLES（注意外鍵依存順序），否則搬移會靜靜地把資料丟掉。');
}

export async function migrateSqliteToPg({ sqlitePath, pgUrl }) {
  if (!fs.existsSync(sqlitePath)) {
    console.log(`[migrate] 找不到 ${sqlitePath}，沒有東西要搬`);
    return;
  }

  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: pgUrl,
    // localhost 與 railway 內網都不走 TLS（比照 src/db.js 的判斷）。
    // 少了 localhost 這一條，本機拿 Docker 的 Postgres 測搬移會直接連不上。
    ssl: /\.railway\.internal(:|$|\/)/.test(pgUrl) || /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1)/.test(pgUrl)
      ? false
      : { rejectUnauthorized: process.env.PGSSL_INSECURE !== '1' },
  });

  try {
    assertNoMissingTable();          // 清單漏表就在這裡失敗，不要搬到一半才發現
    // 目標端建表（用 PG 方言，與站台目前跑哪個驅動無關）
    for (const sql of schemaSql('postgres')) await pool.query(sql);
    // 後補欄位一定要跟著跑。少了這一步，靠 addColumns 加上去的欄位
    // 在目標端不存在，資料會在下面「只搬目標表有的欄位」那一段被默默濾掉。
    for (const sql of addColumnSql()) await pool.query(sql);
    console.log('[migrate] Postgres 建表與補欄位完成');

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
    const lostCols = [];   // [表名, [被丟掉的欄位…]]

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
      // ⚠ 來源有、目標沒有的欄位＝**這一欄的資料會整個不見**。
      // 原本這裡靜靜地濾掉就算了，核對又只比筆數，於是搬移印出
      // 「所有表筆數一致」而實際上少了幾欄。少資料比搬移失敗更糟——
      // 失敗至少會被發現。這裡記下來，最後當成失敗處理。
      const dropped = Object.keys(rows[0]).filter(c => !targetCols.has(c));
      if (dropped.length) lostCols.push([t, dropped]);
      const list = cols.map(c => `"${c}"`).join(',');
      const ph = cols.map((_, i) => '$' + (i + 1)).join(',');

      for (const r of rows)
        // ⚠ id 欄位是 GENERATED ALWAYS AS IDENTITY（db.js 的 PK），
        // Postgres **拒絕**明寫值進去，會拋
        // `cannot insert a non-DEFAULT value into column "id"`——
        // 搬移在第一張表就整個炸掉，而錯誤又被外面的 try/catch 吞成一行日誌，
        // 站台就這樣起在一個空的資料庫上。
        // OVERRIDING SYSTEM VALUE 才能把原本的 id 一起搬過去（搬移就是要保留 id）。
        await pool.query(`INSERT INTO ${t}(${list}) OVERRIDING SYSTEM VALUE VALUES(${ph}) ON CONFLICT DO NOTHING`,
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
    for (const [t, cols] of lostCols)
      console.error(`[migrate]   !! ${t.padEnd(16)} 這幾欄目標端沒有，資料已經遺失：${cols.join(', ')}`);
    if (bad || lostCols.length)
      console.error(`[migrate] 有 ${bad} 張表筆數對不上、${lostCols.length} 張表少了欄位，`
        + '先不要設 DB_DRIVER=postgres');
    else console.log('[migrate] 逐表筆數與欄位都一致，可以設 DB_DRIVER=postgres 了');
  } finally {
    await pool.end();
  }
}
