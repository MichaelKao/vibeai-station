// 啟動時的資料搬移（migrate / addColumns / backfillGroups）。
//
// 為什麼要單獨一支：**這一層讓正式站掛過兩次**，而且用一般的整合測試抓不到——
// test_all.mjs 是對一個乾淨的資料庫跑，乾淨的資料庫沒有「歷史包袱」，
// 而搬移這件事整個的重點就是歷史包袱。
//
// 那次的真因：`friends` 沒有外鍵，帳號刪掉會留下孤兒列；
// 新加的 `friend_groups.user_id` 有外鍵，拿孤兒列的 user_id 去 INSERT 就違反外鍵，
// `await migrate()` 在頂層拋 → 行程結束 → 連 listen 都沒跑到 → 502。
//
// 這支就是把那個情境做出來：先塞孤兒列，再跑搬移。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DIR = path.join(os.tmpdir(), 'vibeai-migrate-test-' + process.pid);
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.DATA_DIR = DIR;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const db = await import('./src/db.js');
const { one, all, run, exec, migrate } = db;

await migrate();
ok('第一次 migrate 跑得完', true);

// 兩個真的帳號 + 一筆「帳號已經被刪掉」的孤兒好友關係
await run("INSERT INTO users(name,pass,salt,nick) VALUES('m1','x','y','一')");
await run("INSERT INTO users(name,pass,salt,nick) VALUES('m2','x','y','二')");
const u1 = (await one("SELECT id FROM users WHERE name='m1'")).id;
const u2 = (await one("SELECT id FROM users WHERE name='m2'")).id;
await run('INSERT INTO friends(user_id,friend_id,grp,group_id) VALUES(?,?,?,0)', u1, u2, '同學');
// 99999 這個帳號不存在——正式站上就是這種東西讓啟動掛掉的
await run('INSERT INTO friends(user_id,friend_id,grp,group_id) VALUES(?,?,?,0)', 99999, u1, '被刪帳號的分組');
// 預設組不該被建成一筆分組
await run('INSERT INTO friends(user_id,friend_id,grp,group_id) VALUES(?,?,?,0)', u2, u1, '好友');

let boom = null;
try { await migrate(); } catch (e) { boom = e; }
ok('有孤兒列也不會讓 migrate 拋錯', !boom, boom?.message || '');

const groups = await all('SELECT * FROM friend_groups');
ok('真帳號的分組搬進來了', groups.some(g => g.name === '同學' && g.user_id === u1));
ok('孤兒列的分組沒有被建出來', !groups.some(g => g.name === '被刪帳號的分組'),
   JSON.stringify(groups.map(g => g.name)));
ok('預設組「好友」不建成分組', !groups.some(g => g.name === '好友'));

const f1 = await one('SELECT group_id FROM friends WHERE user_id=? AND friend_id=?', u1, u2);
ok('好友指到了新的分組', f1.group_id > 0);
const f3 = await one('SELECT group_id FROM friends WHERE user_id=? AND friend_id=?', u2, u1);
ok('預設組的好友維持 group_id=0', (f3.group_id || 0) === 0);

// 冪等：再跑一次不可以多出重複的分組
const before = (await one('SELECT count(*) c FROM friend_groups')).c;
await migrate();
const after = (await one('SELECT count(*) c FROM friend_groups')).c;
ok('重跑不會多出重複的分組', before === after, `${before} → ${after}`);

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
// SQLite 的檔案控制代碼在行程結束前不一定放得掉，Windows 會 EPERM。
// 暫存目錄留著沒關係（開頭會先砍掉舊的），不要讓清理失敗蓋掉測試結果。
try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
