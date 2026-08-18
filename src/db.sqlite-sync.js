// 【已停用】舊的同步 SQLite 資料層，保留供對照與緊急回退。
// 現行資料層是 src/db.js（Postgres/SQLite 雙驅動，對外一律非同步）。
// 這支不再被任何程式碼 import；schema 的權威定義在 src/db.js 的 migrate()。

import { DatabaseSync as Database } from 'node:sqlite';
import { DB_PATH } from './paths.js';
export const db = new Database(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE, pass TEXT, salt TEXT, nick TEXT, intro TEXT DEFAULT '', avatar TEXT DEFAULT '/img/avatar.png', css TEXT DEFAULT '', music TEXT DEFAULT '', visits INTEGER DEFAULT 0, admin INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS albums(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT, descr TEXT DEFAULT '', cover TEXT DEFAULT '', pass TEXT DEFAULT '', views INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY, album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE, url TEXT, caption TEXT DEFAULT '', views INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS photo_comments(id INTEGER PRIMARY KEY, photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE, author TEXT, body TEXT, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT, body TEXT, category TEXT DEFAULT '未分類', views INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, author TEXT, body TEXT, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS trackbacks(id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, from_post INTEGER, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS guestbook(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, author TEXT, body TEXT, secret INTEGER DEFAULT 0, reply TEXT DEFAULT '', created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS visitors(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, who TEXT, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS friends(user_id INTEGER, friend_id INTEGER, created TEXT DEFAULT (datetime('now','localtime')), PRIMARY KEY(user_id,friend_id));
CREATE TABLE IF NOT EXISTS favs(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, created TEXT DEFAULT (datetime('now','localtime')), PRIMARY KEY(user_id,post_id));
CREATE TABLE IF NOT EXISTS acts(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, kind TEXT, title TEXT, url TEXT, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS sysmsg(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT, body TEXT, seen INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, kind TEXT, target_id INTEGER, url TEXT, reason TEXT, reporter TEXT, done INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY, body TEXT, created TEXT DEFAULT (datetime('now','localtime')));
`);

// 索引：站上每一頁幾乎都是「某人的東西，依 id 倒序」，沒有索引在資料變多後會全表掃描
db.exec(`
CREATE INDEX IF NOT EXISTS idx_albums_user   ON albums(user_id, id DESC);
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
CREATE INDEX IF NOT EXISTS idx_acts_user     ON acts(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sysmsg_user   ON sysmsg(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_albums_views  ON albums(views DESC);
`);
// 舊資料庫補欄位（照片檔案大小，用於配額計算）
try { db.exec('ALTER TABLE photos ADD COLUMN bytes INTEGER DEFAULT 0'); } catch {}
try { db.exec("ALTER TABLE photos ADD COLUMN thumb TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN mood TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN weather TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN pass TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE friends ADD COLUMN grp TEXT DEFAULT '好友'"); } catch {}
// 無名有「今日人氣」與「累積人氣」兩個計數器
try { db.exec('ALTER TABLE users ADD COLUMN today_hits INTEGER DEFAULT 0'); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN hits_date TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE albums ADD COLUMN topic TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE albums ADD COLUMN place TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN topic TEXT DEFAULT ''"); } catch {}
// 名片欄位（無名的「個人資料（名片）」）
try { db.exec("ALTER TABLE users ADD COLUMN realname TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN sex TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN birthday TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN zodiac TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN blood TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN job TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN school TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN hobby TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN motto TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN msn TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN homepage TEXT DEFAULT ''"); } catch {}
// 迴響欄位（無名迴響表單有 E-mail 與個人網頁）
try { db.exec("ALTER TABLE comments ADD COLUMN email TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE comments ADD COLUMN homepage TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE comments ADD COLUMN reply TEXT DEFAULT ''"); } catch {}
// 留言板：主題欄位；系統訊息與檢舉
try { db.exec("ALTER TABLE guestbook ADD COLUMN subject TEXT DEFAULT ''"); } catch {}
// 版面樣式（無名的「網誌樣式」）
try { db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT ''"); } catch {}
// 好友限定（無名的「好友保護」）與站長精選
try { db.exec('ALTER TABLE albums ADD COLUMN friends_only INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE albums ADD COLUMN featured INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE posts ADD COLUMN featured INTEGER DEFAULT 0'); } catch {}

export const q = (sql)=>db.prepare(sql);
export const one=(sql,...a)=>db.prepare(sql).get(...a);
export const all=(sql,...a)=>db.prepare(sql).all(...a);
export const run=(sql,...a)=>db.prepare(sql).run(...a);
