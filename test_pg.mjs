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

// ── 好友頁的四種關係 ────────────────────────────────────────────────────────
// 這幾條是全站最複雜的 SQL：子查詢 + DISTINCT + LIMIT/OFFSET。
// 位置參數的編號要「照出現順序」數過子查詢，數錯的話 PG 會拿到錯的值卻不報錯。
ok('子查詢裡的 ? 也照順序編號',
  toPg('SELECT 1 FROM friends f WHERE f.user_id=? AND f.friend_id<>? AND f.friend_id NOT IN (SELECT friend_id FROM friends WHERE user_id=?)'),
  'SELECT 1 FROM friends f WHERE f.user_id=$1 AND f.friend_id<>$2 AND f.friend_id NOT IN (SELECT friend_id FROM friends WHERE user_id=$3)');

ok('count(*) 包一層子查詢（DISTINCT 計數）',
  toPg('SELECT count(*) c FROM (SELECT DISTINCT u.id FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=?) t'),
  'SELECT count(*) c FROM (SELECT DISTINCT u.id FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=$1) t');

ok('LIMIT ? OFFSET ? 排在最後面',
  toPg("SELECT DISTINCT u.id,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f WHERE f.user_id=? ORDER BY grp, u.name LIMIT ? OFFSET ?"),
  "SELECT DISTINCT u.id,COALESCE(NULLIF(f.grp,''),'好友') grp FROM friends f WHERE f.user_id=$1 ORDER BY grp, u.name LIMIT $2 OFFSET $3");


// ── 建表與補欄位 ────────────────────────────────────────────────────────────
// schemaSql() 用 CREATE TABLE IF NOT EXISTS，**對已經存在的表不會補欄位**，
// 所以新欄位得靠 addColumns() 的 ALTER TABLE。這一段釘住兩件事：
//   1. 新表／新欄位真的出現在 DDL 裡（漏掉的話正式站會在查詢時才炸）
//   2. ALTER 那段是冪等的，連跑兩次不能出錯
{
  const { schemaSql, migrate, one, driver } = await import('./src/db.js');
  const ddl = schemaSql('postgres').join('\n');
  ok('建表 SQL 含 videos 表', /CREATE TABLE IF NOT EXISTS videos\(/.test(ddl), true);
  ok('建表 SQL 含 digu 表', /CREATE TABLE IF NOT EXISTS digu\(/.test(ddl), true);
  ok('建表 SQL 含 users.vip', /vip INTEGER DEFAULT 0/.test(ddl), true);
  ok('建表 SQL 含 photos 的 EXIF 欄位',
    ['width INTEGER', 'height INTEGER', "taken TEXT", "camera TEXT"].every(s => ddl.includes(s)), true);

  await migrate();
  await migrate();          // 連跑兩次：ALTER TABLE 那段必須是冪等的
  if (driver === 'sqlite') {
    for (const c of ['width', 'height', 'taken', 'camera'])
      ok(`photos 補上 ${c} 欄位`, !!await one(`SELECT 1 FROM pragma_table_info('photos') WHERE name='${c}'`), true);
    ok('users 補上 vip 欄位', !!await one("SELECT 1 FROM pragma_table_info('users') WHERE name='vip'"), true);
  }
}


// ── session store 的匯出形狀 ────────────────────────────────────────────────
// 為什麼要測這個：src/cache.js 的 Redis 路徑在本機**永遠不會執行**
// （沒有 REDIS_URL 就提早 return），所以 connect-redis 的匯出方式寫錯時
// 本機完全測不出來，只會在正式環境炸 TypeError 讓整站起不來——實際發生過一次。
{
  const { RedisStore } = await import('connect-redis');
  ok('connect-redis 匯出 RedisStore（具名，不是 default）', typeof RedisStore, 'function');
  const fake = { get(){}, set(){}, del(){}, expire(){}, sendCommand(){} };
  const store = new RedisStore({ client: fake, prefix: 'sess:' });
  ok('RedisStore 可建構且具備 express-session 介面',
    ['get','set','destroy','touch'].every(m => typeof store[m] === 'function'), true);
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
