// Postgres **實際行為**的測試（要一個真的 Postgres，不是方言字串轉換）。
//
// 為什麼需要這一支：test_pg.mjs 只驗 toPg() 的字串轉換，test_all.mjs 對兩個驅動
// 都跑得過——**但正式站在 Postgres 上壞掉的東西，這兩支一個都抓不到**。
// 多代理稽核在 Postgres 上挖出四個高嚴重度問題，而當時 test_all 在兩邊都是
// 199 passed / 0 failed。也就是說回歸網完全保護不到正式站真正跑的那個驅動。
//
// 這支專門測「兩個驅動行為不一樣」的地方：
//   1. 帳號比對的大小寫（SQLite 有 COLLATE NOCASE，PG 沒有）
//   2. count(*) 與 SUM() 的型別（PG 的 int8 預設回字串，拿去算術會變字串相接）
//   3. LIKE 的大小寫（SQLite 不分，PG 分）
//   4. 並行註冊撞唯一鍵（PG 會拋 23505）
//
// 沒有 Postgres 就整支跳過（印訊息、回 0），不要讓沒有 Docker 的機器卡住。
//   DB_DRIVER=postgres DATABASE_URL=… BASE=… node test_pgbehavior.mjs
const BASE = process.env.BASE;
const isPg = (process.env.DB_DRIVER || '').toLowerCase() === 'postgres';
// 1x1 的透明 PNG（base64），夠小又是合法圖片，用來測配額而不佔空間
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

if (!isPg) {
  console.log('  (略過：這一支要對 Postgres 跑，設 DB_DRIVER=postgres 與 DATABASE_URL)');
  console.log('\n===== 0 passed, 0 failed =====');
  process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ← ' + extra));
};
const get = (p, ck) => fetch(BASE + p, { headers: ck ? { cookie: ck } : {}, redirect: 'manual' });
const post = (p, body, ck) => fetch(BASE + p, {
  method: 'POST',
  headers: { ...(ck ? { cookie: ck } : {}), 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(), redirect: 'manual',
});
const text = async (p, ck) => (await fetch(BASE + p, { headers: ck ? { cookie: ck } : {} })).text();

console.log('\n=== 帳號大小寫（SQLite 有 COLLATE NOCASE，PG 沒有）===');
ok('大寫帳號開得了小站', (await get('/ALPHA')).status === 200);
ok('混合大小寫帳號開得了小站', (await get('/Alpha')).status === 200);
ok('大寫帳號登得進去', (await post('/login', { name: 'ALPHA', pass: 'test1234' })).status === 302);
// 重複註冊要回「已經有人用了」，不是 500（PG 的唯一索引是 lower(name)）
{
  const r = await post('/register', { name: 'Alpha', nick: 'x', pass: 'test1234', pass2: 'test1234' });
  const t = await r.text();
  ok('大小寫不同的重複帳號被擋而不是 500', r.status === 200 && t.includes('已經有人用了'), '狀態 ' + r.status);
}

console.log('\n=== count(*) / SUM() 的型別 ===');
// PG 的 int8 預設回**字串**：('11531') + 41333 = '1153141333'，
// 相簿配額因此永遠判定「空間不足」——使用者上傳第一張之後就再也傳不上去。
{
  const A = (await post('/login', { name: 'alpha', pass: 'test1234' })).headers.getSetCookie()?.[0]?.split(';')[0];
  const alb = await text('/alpha/album', A);
  const aid = Math.max(...[...alb.matchAll(/\/alpha\/album\/([0-9]+)/g)].map(m => +m[1]));
  // 相簿已經有照片了（test_all 上傳過），再傳一張看會不會被誤判成空間不足
  const f = new FormData();
  f.append('photos', new Blob([Buffer.from(PNG_1x1, 'base64')], { type: 'image/png' }), 'q.png');
  const r = await fetch(`${BASE}/alpha/album/${aid}/upload`, { method: 'POST', headers: { cookie: A }, body: f, redirect: 'manual' });
  ok('相簿已有照片時還傳得上去（配額不會誤判）', r.status === 302, '狀態 ' + r.status);
  // 留言板的計數也吃同一個型別
  ok('系統訊息的計數不會多印括號', !(await text('/alpha/guestbook', A)).includes('(('));
}

console.log('\n=== LIKE 的大小寫（SQLite 不分，PG 分）===');
ok('大寫關鍵字搜得到小寫帳號', (await text('/search?q=ALPHA')).includes('alpha'));
ok('小寫關鍵字也搜得到', (await text('/search?q=alpha')).includes('alpha'));

console.log('\n=== 並行 ===');
// 表單被雙擊就會同時送兩份註冊。先查再插擋不住，PG 的唯一索引會拋 23505。
{
  const body = { name: 'racer1', nick: '賽跑', pass: 'test1234', pass2: 'test1234' };
  const rs = await Promise.all([post('/register', body), post('/register', body)]);
  ok('同名帳號並行註冊不會 500', rs.every(r => r.status < 500), rs.map(r => r.status).join('/'));
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);

