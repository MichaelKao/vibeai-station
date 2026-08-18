// 驗 SQLite → Postgres 的 SQL 方言轉換。
// 從本機連不到 Railway 內網的 Postgres，所以先把最容易出錯的這一層單獨驗過。
import { toPg } from './src/db.js';

let pass = 0, fail = 0;
const ok = (name, got, want) => {
  const good = got === want;
  good ? pass++ : fail++;
  console.log((good ? '  PASS ' : '! FAIL ') + name);
  if (!good) { console.log('      得到: ' + got); console.log('      期望: ' + want); }
};

ok('? 換成 $1 $2',
  toPg('SELECT * FROM users WHERE name=? AND admin=?'),
  'SELECT * FROM users WHERE name=$1 AND admin=$2');

ok('多個 ? 依序編號',
  toPg('INSERT INTO acts(user_id,kind,title,url) VALUES(?,?,?,?)'),
  'INSERT INTO acts(user_id,kind,title,url) VALUES($1,$2,$3,$4)');

ok("datetime('now','localtime') 換成台北時間字串",
  toPg("INSERT INTO notices(body,created) VALUES(?,datetime('now','localtime'))"),
  "INSERT INTO notices(body,created) VALUES($1,to_char(now() AT TIME ZONE 'Asia/Taipei','YYYY-MM-DD HH24:MI:SS'))");

ok("datetime 帶位移（-1 hour）",
  toPg("SELECT 1 WHERE created>datetime('now','localtime','-1 hour')"),
  "SELECT 1 WHERE created>to_char(now() AT TIME ZONE 'Asia/Taipei' + interval '-1 hour','YYYY-MM-DD HH24:MI:SS')");

ok("datetime 帶位移（-10 minutes）",
  toPg("SELECT 1 WHERE created>datetime('now','localtime','-10 minutes')"),
  "SELECT 1 WHERE created>to_char(now() AT TIME ZONE 'Asia/Taipei' + interval '-10 minutes','YYYY-MM-DD HH24:MI:SS')");

ok('INSERT OR IGNORE 去掉 OR IGNORE',
  toPg('INSERT OR IGNORE INTO friends(user_id,friend_id) VALUES(?,?)'),
  'INSERT INTO friends(user_id,friend_id) VALUES($1,$2)');

ok('substr 不動（PG 也有）',
  toPg("SELECT substr(created,1,7) ym FROM posts WHERE user_id=?"),
  "SELECT substr(created,1,7) ym FROM posts WHERE user_id=$1");

ok('COALESCE/NULLIF 不動',
  toPg("SELECT COALESCE(NULLIF(f.grp,''),'好友') g FROM friends f WHERE user_id=?"),
  "SELECT COALESCE(NULLIF(f.grp,''),'好友') g FROM friends f WHERE user_id=$1");

ok('1-featured 這種切換寫法不動',
  toPg('UPDATE albums SET featured=1-featured WHERE id=?'),
  'UPDATE albums SET featured=1-featured WHERE id=$1');

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
