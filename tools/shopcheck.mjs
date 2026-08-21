// 小舖／點數／認證申請／個人網頁空間，真的能用嗎
//
// 這四項是功能盤點抓到「無名有、本站沒有」的部分，站主的決定是
// 「現在全部免費，等我想開能隨時開」。所以測的重點有兩層：
//   1. 功能本身走得通（買得到、扣得到點、申請得出去、檔案存得進去）
//   2. **免費期與收費期的差別只在點數來源**——其餘一律照做，
//      不然開關打開的那天會發現整套是空的
//
//   node tools/shopcheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = +(process.env.PORT || 3495);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = path.join(os.tmpdir(), 'vibeai-shop-' + process.pid);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const srv = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, DATA_DIR: DIR, PORT: String(PORT), ADMIN_USERS: 'boss' },
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
const text = async (p, ck) => (await fetch(BASE + p, { headers: ck ? { cookie: ck } : {} })).text();
const reg = async (name) => (await post('/register',
  { name, nick: name, pass: 'test1234', pass2: 'test1234' }))
  .headers.getSetCookie()?.[0]?.split(';')[0];

const BOSS = await reg('boss');
const USER = await reg('shopper');
ok('準備：站長與一般帳號都拿得到 session', !!BOSS && !!USER);

// ── 點數：註冊就有見面禮 ─────────────────────────────────────────
// ⚠ 這一條是整套的地基：沒有點數來源的話，小舖是一個永遠買不起的櫥窗。
{
  const h = await text('/points', USER);
  const bal = +(h.match(/餘額 <b>(\d+)<\/b>/) || [])[1];
  ok(`註冊送了見面禮點數（${bal} 點）`, bal > 0,
     '新帳號餘額是 0——小舖對他來說是一個永遠買不起的櫥窗');
  ok('點數明細列得出那一筆', h.includes('註冊見面禮'),
     '沒有明細的話，使用者覺得點數不對時只能跟站長吵架');
}

// ── 站長上架 → 使用者買得到 → 真的扣點 ───────────────────────────
{
  const before = +((await text('/points', USER)).match(/餘額 <b>(\d+)<\/b>/) || [])[1];
  await post('/admin/shop/new', { name: 'TESTITEM', kind: 'gift', price: 20, descr: '測試用' }, BOSS);

  const shop = await text('/shop', USER);
  ok('上架的商品出現在小舖', shop.includes('TESTITEM'),
     '站長上架了卻不出現，小舖等於是壞的');
  const id = (shop.match(/action="\/shop\/(\d+)\/buy"/) || [])[1];
  ok('商品有購買按鈕', !!id);

  await post(`/shop/${id}/buy`, {}, USER);
  const after = +((await text('/points', USER)).match(/餘額 <b>(\d+)<\/b>/) || [])[1];
  ok(`買完真的扣了 20 點（${before} → ${after}）`, after === before - 20,
     '沒扣點就是免費拿——那整套帳本沒有意義');
  ok('背包裡看得到買到的東西', (await text('/shop', USER)).includes('TESTITEM'));
}

// ── 買不起的時候要講清楚差多少，而且不能扣成負的 ─────────────────
// ⚠ 餘額變負數是使用者自己就能觸發的，不需要任何攻擊技巧——
// 只要商品比餘額貴，而程式沒有擋。
{
  await post('/admin/shop/new', { name: 'EXPENSIVE', kind: 'badge', price: 999999 }, BOSS);
  const shop = await text('/shop', USER);
  const id = (shop.match(/EXPENSIVE[\s\S]{0,600}?action="\/shop\/(\d+)\/buy"/) || [])[1]
          || (shop.match(/action="\/shop\/(\d+)\/buy"[\s\S]{0,600}?EXPENSIVE/) || [])[1];
  if (id) {
    await post(`/shop/${id}/buy`, {}, USER);
    const bal = +((await text('/points', USER)).match(/餘額 <b>(-?\d+)<\/b>/) || [])[1];
    ok(`買不起的時候餘額沒有變成負的（${bal}）`, bal >= 0,
       '餘額被扣成負數——這是使用者自己按兩下就會發生的事');
  } else {
    ok('買不起的時候餘額沒有變成負的', false, '找不到那件貴商品的購買表單');
  }
}

// ── 認證申請：使用者端真的有入口 ─────────────────────────────────
// ⚠ 這正是功能盤點抓到的原話：在這之前徽章只有站長後台掛得上去，
// 使用者端看不到任何入口，等於這個功能對使用者不存在。
{
  const blank = await post('/vip', { want: 2, reason: '   ' }, USER);
  ok('空白理由的申請會被退回，不是假裝成功', blank.status === 400,
     'HTTP ' + blank.status + '——302 走人的話使用者以為送出了，其實什麼都沒有');

  await post('/vip', { want: 2, reason: '我在站上寫了很多文章' }, USER);
  ok('申請送得出去，而且看得到在審核中',
     (await text('/vip', USER)).includes('審核中'));

  await post('/vip', { want: 2, reason: '再來一次' }, USER);
  const mine = await text('/vip', USER);
  const rows = (mine.match(/<td class="w2-when">/g) || []).length;
  ok(`重複送不會多一筆（站長不會看到一排重複的），實際 ${rows} 筆`, rows === 1,
     '連按兩次就多一筆申請');

  const admin = await text('/admin', BOSS);
  const aid = (admin.match(/action="\/admin\/vip\/(\d+)\/ok"/) || [])[1];
  ok('申請出現在站長後台', !!aid, '送出去卻沒人看得到，等於丟進黑洞');
  if (aid) {
    await post(`/admin/vip/${aid}/ok`, { note: '好' }, BOSS);
    ok('通過之後徽章真的掛上去了',
       (await text('/vip', USER)).includes('目前的認證是 <b>金</b>'),
       '審核按了「通過」但徽章沒掛——分兩步做一定會有人只按了前一半');
  }
}

// ── 個人網頁空間 ─────────────────────────────────────────────────
{
  const bad = await post('/shopper/files', { name: '../../etc/passwd', body: 'x' }, USER);
  ok('路徑穿越的檔名收不進去', bad.status === 302);
  ok('穿越的檔案真的不存在', !(await text('/shopper/files', USER)).includes('passwd'),
     '檔名會被拼進網址，放行 .. 等於開了路徑穿越');

  await post('/shopper/files', { name: 'index.html', body: '<h1>hi</h1><script>alert(1)</script>' }, USER);
  const list = await text('/shopper/files', USER);
  ok('檔案存得進去，列表看得到', list.includes('index.html'));

  // ⚠ 這一條是整個功能最重要的一道鎖：讓使用者上傳的 HTML 在本站網域上
  // 被當網頁執行，等於把站上所有人的 session cookie 交給上傳者。
  const r = await fetch(`${BASE}/shopper/files/index.html`);
  const ct = r.headers.get('content-type') || '';
  ok('上傳的 HTML 不是以 text/html 回應', !/text\/html/.test(ct),
     'content-type=' + ct + '——瀏覽器會把它當網頁跑，上傳者的 JavaScript ' +
     '就在本站網域上執行，讀得到所有人的登入 cookie');
  ok('有掛 nosniff', (r.headers.get('x-content-type-options') || '').includes('nosniff'),
     '沒有 nosniff 的話舊瀏覽器會自己猜型別，猜出 text/html 就前功盡棄');
  ok('檔案內容讀得回來', (await r.text()).includes('<h1>hi</h1>'));

  await post('/shopper/files', { name: 'bad.exe', body: 'x' }, USER);
  ok('不支援的副檔名收不進去', !(await text('/shopper/files', USER)).includes('bad.exe'));
}

srv.kill('SIGKILL');
await sleep(400);
try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { }
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
