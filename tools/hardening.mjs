// 「上線之後會不會出事」的那幾道鎖，真的鎖上了嗎
//
// ⚠ 這一支守的是一次上線稽核抓到的七項。它們的共同點是：
// **站跑得好好的，什麼都不會壞**，所以沒有測試守著就會在某次重構中
// 安靜地掉回去，而掉回去的代價是使用者的帳號或隱私。
//
//   node tools/hardening.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = +(process.env.PORT || 3494);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = path.join(os.tmpdir(), 'vibeai-hard-' + process.pid);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const srv = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, DATA_DIR: DIR, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit'],
});
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(BASE + '/')).ok) break; } catch { }
  await sleep(400);
}
const post = (p, body, ck) => fetch(BASE + p, {
  method: 'POST', redirect: 'manual',
  headers: { ...(ck ? { cookie: ck } : {}), 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(),
});

{
  const reg = await post('/register',
    { name: 'writer1', nick: '寫手', pass: 'test1234', pass2: 'test1234' });
  const CK = reg.headers.getSetCookie()?.[0]?.split(';')[0];
  ok('準備：拿得到 session', !!CK);
  let blocked = false;
  for (let i = 0; i < 130 && !blocked; i++) {
    const r = await post('/writer1/digu', { body: '洗版' + i }, CK);
    if (r.status === 429) blocked = true;
  }
  ok('連續狂寫嘀咕會被擋下來', blocked,
     '寫了 130 則都沒被擋——沒有洪水閘門，資料庫可以被整晚灌爆');
}

// ── 1) 註冊有洪水閘門 ────────────────────────────────────────────────
// 原本完全沒有限速：一支迴圈就能無限狂建帳號，灌爆 users 表、
// 把好聽的暱稱整批佔走，之後再拿那些帳號洗留言。
{
  let blocked = false;
  for (let i = 0; i < 130 && !blocked; i++) {
    const r = await post('/register',
      { name: 'flood' + i, nick: 'f' + i, pass: 'test1234', pass2: 'test1234' });
    if (r.status === 429) blocked = true;
  }
  ok('註冊狂建帳號會被擋下來', blocked,
     '連建 130 個帳號都沒有被擋——腳本可以整晚灌爆 users 表');
}

// ── 2) 登入後的寫入也有洪水閘門 ──────────────────────────────────────
// 原本只檢查 requireLogin，一次上限都沒有：可以腳本洗版別人的留言板。
// ── 上鎖／好友限定的相簿不可以出現在任何公開清單 ──────────────────
//
// ⚠ 為什麼這一項值得一支測試：照片檔名是 randomUUID，猜不到，所以整套
// 隱私其實是靠「不上鎖的相簿才印得出網址」這一條在守。只要有人在首頁、
// 相簿總覽、地區地圖任何一個查詢裡漏寫一次 `pass='' AND friends_only=0`，
// 那本相簿的封面網址就被印進公開 HTML——而網址一旦看過就永久有效，
// 事後把相簿鎖回去也救不回來。
//
// 這種漏寫不會壞任何畫面，只會安靜地多印一張圖，所以人眼看不出來。
{
  const reg = await post('/register',
    { name: 'locker1', nick: '鎖', pass: 'test1234', pass2: 'test1234' });
  const CK = reg.headers.getSetCookie()?.[0]?.split(';')[0];
  await post('/locker1/album', { title: '公開相簿AAA' }, CK);
  await post('/locker1/album', { title: '密碼相簿BBB', pass: '1234' }, CK);
  await post('/locker1/album', { title: '好友相簿CCC', friends_only: '1' }, CK);

  for (const [url, what] of [['/', '首頁'], ['/albums', '相簿總覽']]) {
    const h = await (await fetch(BASE + url)).text();   // 不帶 cookie＝路人
    ok(`${what}沒有印出密碼相簿的標題`, !h.includes('密碼相簿BBB'),
       '上鎖相簿出現在公開清單上，封面網址跟著被印進 HTML');
    ok(`${what}沒有印出好友限定相簿的標題`, !h.includes('好友相簿CCC'),
       '好友限定相簿出現在公開清單上，封面網址跟著被印進 HTML');
  }
}

srv.kill('SIGKILL');
await sleep(400);
try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { }

// ── 3~5) 不需要跑起來就驗得到的：讀原始碼 ────────────────────────────
const server = fs.readFileSync('src/server.js', 'utf8');
const mail = fs.readFileSync('src/mail.js', 'utf8');

// SESSION_SECRET 不可以有寫死的 fallback
// 那個 fallback 是公開原始碼裡的字串——正式站漏設環境變數的話，
// 任何看過這一行的人都能自己簽一張 session cookie，指定 uid 是誰就冒充誰。
ok('session secret 沒有寫死的預設值直接餵給 session()',
   !/secret:\s*process\.env\.SESSION_SECRET\s*\|\|/.test(server),
   '正式站漏設 SESSION_SECRET 時會用公開原始碼裡的字串當簽章金鑰＝任何人都能冒充站長');
ok('正式環境沒有 SESSION_SECRET 就不准開機',
   /IS_PROD\s*\)\s*throw/.test(server) || /if\s*\(IS_PROD\)\s*throw/.test(server),
   '應該直接 throw 讓 deploy 紅一次，而不是安靜地用弱金鑰跑起來');

// 沒設 RESEND_API_KEY 時不可以把信的內容（含重設密碼連結）印進正式站的 log
ok('正式環境不會把信的內容印進 log',
   /IS_PROD/.test(mail) && mail.indexOf('IS_PROD') < mail.indexOf("console.log('─'"),
   '漏設 RESEND_API_KEY 時會把重設密碼的連結印進 Railway log＝看得到 log 的人可以接管帳號');

// 留言者的 Email 不可以明文出現在公開頁面的 HTML 裡
const post_ejs = fs.readFileSync('views/post.ejs', 'utf8');
ok('留言者的 Email 沒有明文寫進文章頁 HTML',
   !/href=['"]mailto:<%=\s*c\.email/.test(post_ejs),
   '爬蟲可以整站收割留言者的 Email 去發垃圾信——受害的是替你留言的人');

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
