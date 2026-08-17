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
CREATE TABLE IF NOT EXISTS sysmsg(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT, body TEXT, seen INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, kind TEXT, target_id INTEGER, url TEXT, reason TEXT, reporter TEXT, done INTEGER DEFAULT 0, created TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY, body TEXT, created TEXT DEFAULT (datetime('now','localtime')));
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

export const q = (sql)=>db.prepare(sql);
export const one=(sql,...a)=>db.prepare(sql).get(...a);
export const all=(sql,...a)=>db.prepare(sql).all(...a);
export const run=(sql,...a)=>db.prepare(sql).run(...a);
