// 資料層：Postgres（正式）／node:sqlite（本機開發）雙驅動，對外一律非同步。
//
// 設計重點是**在驅動層做方言轉換**，而不是去改 server.js 裡近百條 SQL：
//   ?          → $1, $2, …            （PG 的位置參數）
//   INSERT OR IGNORE → ON CONFLICT DO NOTHING
//   datetime('now','localtime', ±N)   → 台北時間的字串（見 NOW_TPE）
//   run() 一律回 { lastInsertRowid }，PG 這邊靠自動補上的 RETURNING id 取得
//
// created 欄位在兩邊都存成 'YYYY-MM-DD HH:MM:SS' 的 TEXT（台北時間）。
// 這是刻意的：站上到處都在做 created.slice(0,10)、substr(created,1,7)，
// 存成 timestamptz 的話那些字串切法全部要重寫，收益卻等於零。

import { DB_PATH } from './paths.js';

// 切換資料庫要「明確指定」，不能只看 DATABASE_URL 存不存在。
//
// 原因：Railway 這類平台會自動把 DATABASE_URL 注入服務。如果用「有這個變數就走
// Postgres」當判斷，只要有人在面板上連了一個資料庫，下次部署就會靜悄悄地切到一個
// 空的資料庫——畫面上看起來就是「全站資料消失」。所以要兩個條件同時成立：
//   DB_DRIVER=postgres  ＋  DATABASE_URL 有值
// 資料搬移完成、驗證過筆數之後，才把 DB_DRIVER 設成 postgres。
const PG_URL = process.env.DATABASE_URL || '';
const WANT_PG = (process.env.DB_DRIVER || '').toLowerCase() === 'postgres';

if (WANT_PG && !PG_URL) throw new Error('DB_DRIVER=postgres 但沒有 DATABASE_URL');
if (!WANT_PG && PG_URL) console.log('[db] 偵測到 DATABASE_URL，但 DB_DRIVER 不是 postgres，仍使用 sqlite');

export const driver = WANT_PG ? 'postgres' : 'sqlite';

// 台北時間的 'YYYY-MM-DD HH:MM:SS' 字串
const NOW_TPE = "to_char(now() AT TIME ZONE 'Asia/Taipei','YYYY-MM-DD HH24:MI:SS')";

// ===== SQL 方言轉換 =====
// 只處理本專案實際用到的幾種 SQLite 寫法，不做通用 SQL parser。
export function toPg(sql) {   // export 是為了讓 test_pg.mjs 能直接驗這層轉換
  let s = sql;

  // datetime('now','localtime')            → 現在（台北）
  // datetime('now','localtime','-1 hour')  → 現在減一小時
  s = s.replace(/datetime\(\s*'now'\s*,\s*'localtime'\s*(?:,\s*'([+-]?\d+)\s+(\w+)'\s*)?\)/gi,
    (_, n, unit) => n
      ? `to_char(now() AT TIME ZONE 'Asia/Taipei' + interval '${n} ${unit}','YYYY-MM-DD HH24:MI:SS')`
      : NOW_TPE);

  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');

  // LIKE → ILIKE（大小寫不分的比對）
  //
  // SQLite 的 LIKE 對 ASCII 本來就大小寫不分，Postgres 的 LIKE 則是**分**的。
  // 站上所有的搜尋（站內搜尋、網誌內搜尋、好友搜尋）都用 LIKE，
  // 所以同一個關鍵字在本機搜得到、在正式站搜不到——多代理稽核在正式站
  // 實測 /search?q=AHUA 回 0 筆，改小寫才有結果。
  // ILIKE 是 Postgres 的擴充，語意剛好等同 SQLite 的 LIKE。
  s = s.replace(/\bLIKE\b/gi, 'ILIKE');

  // ? → $1 $2 …（字串常值裡的問號本專案沒有，不特別處理）
  let i = 0;
  s = s.replace(/\?/g, () => '$' + (++i));

  return s;
}
// INSERT OR IGNORE 需要在句尾補 ON CONFLICT DO NOTHING
const needsOnConflict = sql => /INSERT\s+OR\s+IGNORE/i.test(sql);

// 這兩張表是「關聯表」，主鍵是兩個欄位合起來的，**沒有 id 欄位**：
//   friends(user_id, friend_id, ...)  PRIMARY KEY(user_id, friend_id)
//   favs(user_id, post_id, ...)       PRIMARY KEY(user_id, post_id)
// PG 的 run() 會自動幫 INSERT 補 RETURNING id 好拿到新的主鍵，
// 但對這兩張表補下去就會炸「column "id" does not exist」——
// 加好友、收藏文章這兩個功能在 Postgres 上會直接 500。
// （src/migrate-pg.js 的 SERIAL_TABLES 早就把這兩張表排除掉了，是同一個原因。）
const TABLES_WITHOUT_ID = new Set(['friends', 'favs', 'join_members', 'photo_votes']);

// 這句 INSERT 該不該補 RETURNING id。export 是為了讓 test_pg.mjs 直接驗。
export function needsReturningId(sql) {
  if (!/^\s*INSERT\s/i.test(sql) || /RETURNING/i.test(sql)) return false;
  const m = /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["']?(\w+)/i.exec(sql);
  return !(m && TABLES_WITHOUT_ID.has(m[1].toLowerCase()));
}

let impl;

if (driver === 'postgres') {
  const { default: pg } = await import('pg');

  // ⚠⚠ Postgres 的 int8（bigint）預設會回**字串**，不是數字。
  // `count(*)` 與 `SUM(...)` 的型別都是 int8，所以：
  //   ('11531') + 41333  →  '1153141333'      ← 字串相接，不是加法
  // 相簿配額因此永遠判定「空間不足」——**使用者上傳第一張之後就再也傳不上去**，
  // 而且訊息還自相矛盾（說用了 0.01 MB 卻說會超過 1024 MB）。
  // 留言板的「系統訊息(0)」多印一組括號也是同一個根因。
  // 這一行讓 int8 回 number，一次治好所有拿 count/SUM 去算術的地方。
  // （站上的計數不可能超過 Number.MAX_SAFE_INTEGER，轉 number 是安全的。）
  pg.types.setTypeParser(20, v => v === null ? null : Number(v));

  const pool = new pg.Pool({
    connectionString: PG_URL,
    max: +(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // 正式環境走 Railway 內網（*.railway.internal），流量不出私有網路，不需要 TLS。
    // 連外網 endpoint 時才啟用 TLS，且預設驗證憑證；
    // 只有本機一次性搬資料、對方是自簽憑證時，才用 PGSSL_INSECURE=1 明確放行。
    ssl: /\.railway\.internal(:|$|\/)/.test(PG_URL) || /^localhost|127\.0\.0\.1/.test(PG_URL)
      ? false
      : { rejectUnauthorized: process.env.PGSSL_INSECURE !== '1' },
  });
  pool.on('error', e => console.error('[pg]', e.message));

  const query = async (sql, args) => {
    let text = toPg(sql);
    if (needsOnConflict(sql)) text += ' ON CONFLICT DO NOTHING';
    return pool.query(text, args);
  };

  impl = {
    one: async (sql, ...a) => (await query(sql, a)).rows[0] ?? undefined,
    all: async (sql, ...a) => (await query(sql, a)).rows,
    run: async (sql, ...a) => {
      // INSERT 需要回 id 的場合，自動補 RETURNING id
      let text = toPg(sql);
      if (needsOnConflict(sql)) text += ' ON CONFLICT DO NOTHING';
      if (needsReturningId(sql)) text += ' RETURNING id';
      const r = await pool.query(text, a);
      return { lastInsertRowid: r.rows?.[0]?.id, changes: r.rowCount };
    },
    exec: async sql => { await pool.query(sql); },
    close: () => pool.end(),
  };
  console.log('[db] postgres');
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  impl = {
    one: async (sql, ...a) => db.prepare(sql).get(...a),
    all: async (sql, ...a) => db.prepare(sql).all(...a),
    run: async (sql, ...a) => db.prepare(sql).run(...a),
    exec: async sql => db.exec(sql),
    close: async () => db.close(),
  };
  console.log('[db] sqlite ' + DB_PATH);
}

export const one = impl.one;
export const all = impl.all;
export const run = impl.run;
export const exec = impl.exec;
export const close = impl.close;

// ===== 建表 =====
// 兩邊共用一份定義，只有主鍵與大小寫不敏感欄位的寫法不同。
// 建表 SQL 依「指定的」driver 產生，而不是綁定當前 driver——
// 搬移工具需要在站台還跑在 SQLite 的時候，對 Postgres 產生正確的 DDL。
const dialect = d => ({
  PK:  d === 'postgres' ? 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY' : 'INTEGER PRIMARY KEY',
  NOW: d === 'postgres' ? NOW_TPE : "(datetime('now','localtime'))",
  CI:  d === 'postgres' ? 'TEXT' : 'TEXT COLLATE NOCASE',   // PG 用 lower() 唯一索引達成
});

// 回傳建表與建索引的 SQL（不執行）。exec 由呼叫端決定要打去哪個資料庫。
export function schemaSql(forDriver = driver) {
  const { PK, NOW, CI } = dialect(forDriver);
  const T = (name, cols) => `CREATE TABLE IF NOT EXISTS ${name}(${cols});`;
  const created = `created TEXT DEFAULT ${NOW}`;
  const fkUser = 'user_id INTEGER REFERENCES users(id) ON DELETE CASCADE';

  const stmts = [];
  stmts.push([
    T('users', `id ${PK}, name ${CI} UNIQUE, pass TEXT, salt TEXT, nick TEXT,
      intro TEXT DEFAULT '', avatar TEXT DEFAULT '/img/avatar.png', css TEXT DEFAULT '',
      music TEXT DEFAULT '', visits INTEGER DEFAULT 0, admin INTEGER DEFAULT 0, vip INTEGER DEFAULT 0,
      today_hits INTEGER DEFAULT 0, hits_date TEXT DEFAULT '',
      realname TEXT DEFAULT '', sex TEXT DEFAULT '', birthday TEXT DEFAULT '',
      zodiac TEXT DEFAULT '', blood TEXT DEFAULT '', city TEXT DEFAULT '',
      job TEXT DEFAULT '', school TEXT DEFAULT '', hobby TEXT DEFAULT '',
      motto TEXT DEFAULT '', msn TEXT DEFAULT '', homepage TEXT DEFAULT '',
      theme TEXT DEFAULT '', ${created}`),
    T('albums', `id ${PK}, ${fkUser}, title TEXT, descr TEXT DEFAULT '', cover TEXT DEFAULT '',
      pass TEXT DEFAULT '', views INTEGER DEFAULT 0, topic TEXT DEFAULT '', place TEXT DEFAULT '',
      friends_only INTEGER DEFAULT 0, featured INTEGER DEFAULT 0, ${created}`),
    // width/height/taken/camera 是照片頁 #exif（圖片資訊）面板要用的。
    // 只有「之後上傳」的照片會有值——舊照片的 EXIF 在當初壓縮時就沒留下來，
    // 那是既成事實，面板要能處理空值（見 src/storage.js 的 readExif）。
    T('photos', `id ${PK}, album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
      url TEXT, thumb TEXT DEFAULT '', caption TEXT DEFAULT '', views INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0, width INTEGER DEFAULT 0, height INTEGER DEFAULT 0,
      taken TEXT DEFAULT '', camera TEXT DEFAULT '', ${created}`),
    T('photo_comments', `id ${PK}, photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      author TEXT, body TEXT, ${created}`),
    T('posts', `id ${PK}, ${fkUser}, title TEXT, body TEXT, category TEXT DEFAULT '未分類',
      views INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, mood TEXT DEFAULT '',
      weather TEXT DEFAULT '', pass TEXT DEFAULT '', topic TEXT DEFAULT '',
      featured INTEGER DEFAULT 0, ${created}`),
    T('comments', `id ${PK}, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      author TEXT, body TEXT, email TEXT DEFAULT '', homepage TEXT DEFAULT '',
      reply TEXT DEFAULT '', ${created}`),
    T('trackbacks', `id ${PK}, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      from_post INTEGER, ${created}`),
    T('guestbook', `id ${PK}, ${fkUser}, author TEXT, author_id INTEGER, subject TEXT DEFAULT '',
      body TEXT, secret INTEGER DEFAULT 0, reply TEXT DEFAULT '', ${created}`),
    T('visitors', `id ${PK}, ${fkUser}, who TEXT, ${created}`),
    T('friends', `user_id INTEGER, friend_id INTEGER, grp TEXT DEFAULT '好友',
      ${created}, PRIMARY KEY(user_id,friend_id)`),
    // 好友分組。原站 #cateSelect 的 option value 是**稀疏的整數 group id**
    // （存檔實證：gb_friend_a000000000aa_20131225.html:187 的 value 是 8/3/1/7/4/0/-1，
    // 不連續也不照排序，0 固定是預設組、-1 是「全部」）——也就是說分組在原站是
    // 一等公民，可以改名、可以排序，不是掛在每一筆好友上的一個字串。
    //
    // 本站原本把分組名直接存在 friends.grp（TEXT），功能都在，
    // 但「把某一組改名」得掃過每一筆好友去改字串，而且兩個人打同一個名字
    // 是不是同一組也講不清楚。改成真正的分組表。
    // friends.grp 保留不動（見 ADD_COLUMNS 的 group_id 與 backfillGroups 的說明）。
    T('friend_groups', `id ${PK}, ${fkUser}, name TEXT, ord INTEGER DEFAULT 0, ${created}`),
    T('favs', `${fkUser}, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      ${created}, PRIMARY KEY(user_id,post_id)`),
    // 網誌側欄的自訂欄位。原站叫 #boxFolder，同一個 id 可以重複很多次
    // （blog.md §1097 有存檔實證：【About Me】【線上人數】【FLAG COUNTER】…）。
    // 原站可以塞任意 HTML（Facebook badge、廣告 iframe），
    // 我們照 WRETCH_2012.md §4-4「使用者輸入一律逸出」走 render()，
    // 允許的是站上通用那套標記（[img] [b] 連結…），不是原生 HTML。
    T('folders', `id ${PK}, ${fkUser}, title TEXT, body TEXT, seq INTEGER DEFAULT 0, ${created}`),
    // 網誌側欄的「我的訂閱」（原站 #boxRssList，assets_src/html/blog_home.html:341）。
    // 原站顯示的是**站方公告**那類外部 RSS 的最新一則：來源名 +（日期）+ 條目標題連結。
    // title 是來源名（＝側欄第一行那個 span），url 是 feed 網址；
    // last_* 三欄是最近一次抓到的條目，抓不到就沿用上一次的，側欄不會忽然空掉。
    T('subs', `id ${PK}, ${fkUser}, title TEXT, url TEXT,
      last_title TEXT DEFAULT '', last_url TEXT DEFAULT '', last_date TEXT DEFAULT '',
      fetched TEXT DEFAULT '', ${created}`),
    T('acts', `id ${PK}, ${fkUser}, kind TEXT, title TEXT, url TEXT, ${created}`),
    T('sysmsg', `id ${PK}, ${fkUser}, title TEXT, body TEXT, seen INTEGER DEFAULT 0, ${created}`),
    T('reports', `id ${PK}, kind TEXT, target_id INTEGER, url TEXT, reason TEXT,
      reporter TEXT, done INTEGER DEFAULT 0, ${created}`),
    T('notices', `id ${PK}, body TEXT, ${created}`),
    // 揪團：原站導覽列有這個服務，但整個服務 archive.org 一份存檔都沒有，
    // 所以是本站自製的最小可用版本（見 views/joins.ejs 的說明）。
    T('joins', `id ${PK}, ${fkUser}, title TEXT, descr TEXT DEFAULT '',
      place TEXT DEFAULT '', when_text TEXT DEFAULT '', quota INTEGER DEFAULT 0, ${created}`),
    T('join_members', `join_id INTEGER REFERENCES joins(id) ON DELETE CASCADE,
      ${fkUser}, ${created}, PRIMARY KEY(join_id,user_id)`),
    // 哈啦論壇：原站的官方說明／討論區（www.wretch.cc/hala/viewtopic.php?t=…）。
    // 存檔裡它一律是被當成「說明文」連進去的（RSS HOWTO、看不到驗證碼怎麼辦），
    // 版面本身沒有任何存檔，所以是自製的（見 views/hala.ejs）。
    T('hala_topics', `id ${PK}, ${fkUser}, title TEXT, body TEXT DEFAULT '',
      cat TEXT DEFAULT '', official INTEGER DEFAULT 0, views INTEGER DEFAULT 0, ${created}`),
    T('hala_posts', `id ${PK}, topic_id INTEGER REFERENCES hala_topics(id) ON DELETE CASCADE,
      ${fkUser}, author TEXT, body TEXT, ${created}`),
    // 送禮物：原站在 bill.wretch.cc/gift.php?to=<帳號>（付費網域）。
    // 我們沒有金流也不打算接，但「送一份禮物給某個人」這個功能本身不需要收錢，
    // 所以照做，禮物改成站上自己的圖示，一律免費。
    T('gifts', `id ${PK}, to_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      from_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT DEFAULT '', msg TEXT DEFAULT '', ${created}`),
    // 愛正妹的投票：原站是 /svcs/wretch_girl/，首頁的「無名優質正妹」模組
    // （featuredJSON.featured_beauty）就是它的精選，more_url 指向
    // /album/?func=hot&hid=0&class_id=9，也就是「相簿總站的熱門榜、篩人物分類」。
    T('photo_votes', `photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
      ${fkUser}, ${created}, PRIMARY KEY(photo_id,user_id)`),
    // 影音（原站 www.wretch.cc/video/<帳號>，導覽第七顆 #linkVideo）。
    // 我們沒有轉檔與串流，做「最小可用」：存 YouTube 影片 id，用 <iframe> 內嵌。
    // vid 存純 id 而不是整條網址——內嵌網址要自己組，把 id 單獨存起來才不會
    // 每次顯示都重新解析使用者貼進來的字串。
    T('videos', `id ${PK}, ${fkUser}, title TEXT, vid TEXT, url TEXT DEFAULT '',
      descr TEXT DEFAULT '', views INTEGER DEFAULT 0, ${created}`),
    // 嘀咕（原站 www.wretch.cc/digu/<帳號>，噗浪式的一句話）。
    // 不併進 acts：acts 是「好友動態」的事件記錄（kind/title/url），
    // 嘀咕是使用者自己寫的內容，語意不同，混在一起之後兩邊都不好改。
    T('digu', `id ${PK}, ${fkUser}, body TEXT, ${created}`),
  ].join('\n'));

  // 帳號大小寫不敏感：SQLite 靠 COLLATE NOCASE，PG 靠 lower() 唯一索引
  if (forDriver === 'postgres')
    stmts.push('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(name));');

  // 站上每一頁幾乎都是「某人的東西，依 id 倒序」，沒有索引在資料變多後會全表掃描
  stmts.push(`
    CREATE INDEX IF NOT EXISTS idx_albums_user   ON albums(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_albums_views  ON albums(views DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_album  ON photos(album_id, id);
    CREATE INDEX IF NOT EXISTS idx_pcom_photo    ON photo_comments(photo_id, id);
    CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_views   ON posts(views DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, id);
    CREATE INDEX IF NOT EXISTS idx_tb_post       ON trackbacks(post_id);
    CREATE INDEX IF NOT EXISTS idx_gb_user       ON guestbook(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_visitors_user ON visitors(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_friends_rev   ON friends(friend_id);
    CREATE INDEX IF NOT EXISTS idx_favs_user     ON favs(user_id, created DESC);
    -- 反向查詢：「這篇文章有誰收藏」（單篇文章頁的「誰來收藏」彈窗）。
    -- 主鍵是 (user_id, post_id)，開頭不是 post_id，所以這個方向用不到主鍵索引，
    -- 沒有這一條就是每開一篇文章全表掃一次 favs。
    CREATE INDEX IF NOT EXISTS idx_favs_post     ON favs(post_id, created DESC);
    -- 好友頁的分組篩選（?cateSelect=）
    CREATE INDEX IF NOT EXISTS idx_friends_grp   ON friends(user_id, grp);
    -- 側欄自訂欄位：每一頁網誌都要撈一次
    CREATE INDEX IF NOT EXISTS idx_folders_user  ON folders(user_id, seq);
    CREATE INDEX IF NOT EXISTS idx_acts_user     ON acts(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_sysmsg_user   ON sysmsg(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_joins_user    ON joins(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_jmembers_join ON join_members(join_id);
    CREATE INDEX IF NOT EXISTS idx_hala_topics   ON hala_topics(id DESC);
    CREATE INDEX IF NOT EXISTS idx_hala_posts    ON hala_posts(topic_id, id);
    CREATE INDEX IF NOT EXISTS idx_gifts_to      ON gifts(to_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_pvotes_photo  ON photo_votes(photo_id);
    CREATE INDEX IF NOT EXISTS idx_videos_user   ON videos(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_digu_user     ON digu(user_id, id DESC);
  `);

  return stmts;
}

// ===== 補欄位 =====
// schemaSql() 用的是 CREATE TABLE IF NOT EXISTS，**對已經存在的表不會補欄位**。
// 本機的 station.db 與正式站的 Postgres 都是既有的表，所以新欄位一定要另外
// 走 ALTER TABLE，而且要冪等（每次啟動都會跑一次）：
//   Postgres 有 ADD COLUMN IF NOT EXISTS；
//   SQLite 沒有，要先問 pragma_table_info 有沒有這一欄。
// 表名與欄名都是下面這張常數表裡的字面值，不是使用者輸入，可以直接拼進 SQL。
const ADD_COLUMNS = [
  ['users',  'vip',    'INTEGER DEFAULT 0'],   // 認證／VIP 徽章 .vip_icon、相片牆 .vip_only
  ['photos', 'width',  'INTEGER DEFAULT 0'],   // 以下四欄給照片頁的 #exif 面板
  ['photos', 'height', 'INTEGER DEFAULT 0'],
  ['photos', 'taken',  "TEXT DEFAULT ''"],
  ['photos', 'camera', "TEXT DEFAULT ''"],
  // 留言者的帳號。原版留言板每一則的暱稱與大頭貼都是連到那個人的小站
  // （gb_guestbook_a000000010_20131226.html:12441），認證章 .vip_icon 也掛在這裡。
  // 我們原本只存 author 文字，連不回帳號，那三個東西就都做不出來。
  // 可為 NULL——訪客不登入也能留言，那種就沒有連結、沒有認證章。
  ['guestbook', 'author_id', 'INTEGER'],
  // 原站的自訂 CSS 是**兩份**：f10.wretch.yimg.com/<帳號>/files/album.css 與 blog.css
  // （WRETCH_SPEC.md §6 最後兩行）。我們原本只有一份 users.css 套在每一頁上，
  // 想把相簿弄成一個樣、網誌弄成另一個樣的人做不到——那正是當年大家在玩的事。
  // users.css 保留原意＝相簿那份，網誌另存一份。
  ['users', 'css_blog', "TEXT DEFAULT ''"],
  // 好友屬於哪一組（friend_groups.id）。0＝預設組，對得上原站 #cateSelect 的
  // `option value="0" → Default group`。
  // ⚠ 舊的 friends.grp（文字組名）**故意留著不刪**：
  //   1. 正式站上是有資料的，砍掉就回不去了
  //   2. backfillGroups() 靠它把既有資料搬進 friend_groups
  // 讀取一律以 group_id 為準，grp 只當歷史資料看。
  ['friends', 'group_id', 'INTEGER DEFAULT 0'],
  // 文章的地區。原站網誌側欄 boxDate 裡有一顆「看地圖」（WRETCH_SPEC.md:278、:382），
  // 但那個功能連一份 DOM 存檔都沒有，只有截圖上的四個字。
  // 相簿早就有 place（四選一的地區分類，src/taxonomy.js 的 PLACES），
  // 文章沒有——沒有地點資料的話「看地圖」就沒有東西可看。
  // 補上同一組白名單，讓兩邊講同一種話。
  ['posts', 'place', "TEXT DEFAULT ''"],
];

export async function addColumns(forDriver = driver) {
  for (const [table, col, type] of ADD_COLUMNS) {
    try {
      if (forDriver === 'postgres') {
        await exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
      } else {
        const has = await one(`SELECT 1 c FROM pragma_table_info('${table}') WHERE name='${col}'`);
        if (!has) await exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    } catch (e) {
      // 「欄位已存在」是可以吞掉的（兩個行程同時啟動就會撞到）；
      // 其他錯誤要讓它炸出來，不然schema 沒補成功會在很遠的地方才出事。
      if (!/duplicate column|already exists/i.test(e.message)) throw e;
    }
  }
}

// 好友分組從「每一筆好友身上的一個字串」搬到真正的分組表。
//
// 冪等：每次啟動都會跑，但只處理「還沒有 group_id 的好友」。
// 已經搬過的資料 group_id 不是 0，第二次跑就整批跳過，
// 所以正式站重啟幾次都不會多出重複的分組。
//
// 為什麼不寫成一次性的 migration 腳本：本機 SQLite 與正式站 Postgres
// 是各自獨立的資料庫，而且開發機隨時可能拿到一份舊的備份。
// 每次啟動自我修復比「記得去跑那支腳本」可靠。
// ⚠⚠ 這一支讓正式站掛過兩次（"Application failed to respond"），
// 而且**本機四種組態都重現不出來**。真因與教訓寫在這裡，不要再犯：
//
//   `friends` 表**沒有外鍵**（`user_id INTEGER`，沒有 REFERENCES），
//   所以帳號被刪掉之後，那個人的好友關係還留在表裡＝孤兒列。
//   而新加的 `friend_groups.user_id` **有**外鍵。
//   搬移時拿孤兒列的 user_id 去 INSERT friend_groups 就違反外鍵 → 拋錯 →
//   `await migrate()` 在頂層拋 → 行程直接結束 → 連 listen 都沒跑到 → 502。
//
//   正式站有被刪掉的帳號（`/test/visitors` 曾經連到一個 404 的帳號就是證據），
//   本機的測試資料沒有，所以怎麼試都是好的。
//   **加外鍵的新表，一定要先想「舊表有沒有孤兒列」。**
//
// 三道防線，缺一不可：
//   1. WHERE 條件加 `EXISTS (SELECT 1 FROM users …)`，孤兒列直接不處理
//   2. 改成集合式 SQL（兩句），不再一列一個來回——
//      原本 44 個分組要送 176 次查詢，正式站的量級更大，跨區延遲會很可觀
//   3. 整支包在 try/catch：**搬移失敗絕對不可以讓站起不來**。
//      分組沒搬成頂多是好友暫時都在預設組，站掛掉是另一個等級的事
export async function backfillGroups() {
  try {
    // 「好友」是 friends.grp 的 DEFAULT，對應原站的 group id 0（Default group），
    // 不必替它建分組——建了反而每個人都多一組叫「好友」的東西。
    const WHERE = `COALESCE(f.group_id,0)=0 AND COALESCE(f.grp,'')<>'' AND f.grp<>'好友'
      AND EXISTS (SELECT 1 FROM users u WHERE u.id=f.user_id)`;
    await exec(`INSERT INTO friend_groups(user_id,name,ord)
      SELECT DISTINCT f.user_id, f.grp, 0 FROM friends f
      WHERE ${WHERE}
        AND NOT EXISTS (SELECT 1 FROM friend_groups g WHERE g.user_id=f.user_id AND g.name=f.grp)`);
    await exec(`UPDATE friends SET group_id=COALESCE(
        (SELECT g.id FROM friend_groups g WHERE g.user_id=friends.user_id AND g.name=friends.grp), 0)
      WHERE COALESCE(group_id,0)=0 AND COALESCE(grp,'')<>'' AND grp<>'好友'
        AND EXISTS (SELECT 1 FROM users u WHERE u.id=friends.user_id)`);
  } catch (e) {
    console.error('[migrate] 好友分組搬移失敗，站台照常運作：', e.message);
  }
}

// 對目前這個資料庫建表。搬移工具要對「另一個」資料庫建表時，
// 自己拿 schemaSql('postgres') 去打。
export async function migrate() {
  for (const sql of schemaSql(driver)) await exec(sql);
  await addColumns(driver);
  await backfillGroups();
}
