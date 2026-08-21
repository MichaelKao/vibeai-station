// 收費模式（PAID_MODE=1）那條路真的走得通嗎。
//
// ⚠ 為什麼需要這一支：站主的決定是「現在全給免費，等我想開能隨時開」。
// 那個「隨時開」是一個**從來沒有被執行過的分支**——開關打開的那一天
// 才第一次跑，而那天正好是站上有真實使用者、真實點數的時候。
// 沒測過的分支不是「應該會動」，是「不知道會怎樣」。
//
// 這一支把兩種模式都跑一遍，確認：
//   免費模式：每天登入會送點（點數來源存在，小舖才不是空櫥窗）
//   收費模式：不再自動送點，但**帳本、商品、購買、扣點全部照常**
//             ——這是整個設計的重點：開關打開時使用者是無感的
//
//   node tools/paidcheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '! FAIL ') + n + (c ? '' : '  ' + e)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 起一個站，回傳操作它的小工具
async function boot(paid, port) {
  const DIR = path.join(os.tmpdir(), `vibeai-paid-${paid ? 'on' : 'off'}-` + process.pid);
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const env = { ...process.env, DATA_DIR: DIR, PORT: String(port), ADMIN_USERS: 'boss' };
  if (paid) env.PAID_MODE = '1'; else delete env.PAID_MODE;
  const srv = spawn(process.execPath, ['src/server.js'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
  const BASE = `http://127.0.0.1:${port}`;
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
  const reg = async name => (await post('/register', { name, nick: name, pass: 'test1234', pass2: 'test1234' }))
    .headers.getSetCookie()?.[0]?.split(';')[0];
  const login = async name => (await post('/login', { name, pass: 'test1234' }))
    .headers.getSetCookie()?.[0]?.split(';')[0];
  const bal = async ck => +((await text('/points', ck)).match(/餘額 <b>(-?\d+)<\/b>/) || [])[1];
  const done = () => { srv.kill('SIGKILL'); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} };
  return { BASE, post, text, reg, login, bal, done };
}

// ── 免費模式 ────────────────────────────────────────────────────────
{
  console.log('── 免費模式（PAID_MODE 沒設）────────────────────────');
  const s = await boot(false, 3498);
  const ck = await s.reg('freeuser');
  ok('免費：註冊送了見面禮', await s.bal(ck) > 0);
  // 重新登入一次＝第二天登入。⚠ 用 ref 去重，同一天再登入不該再送。
  const ck2 = await s.login('freeuser');
  const after = await s.bal(ck2);
  ok('免費：同一天重複登入不會重複送點', after === await s.bal(ck),
     `重登之後變成 ${after}——每日獎勵沒有去重，一天登十次就領十次`);
  ok('免費：小舖頁講得出點數怎麼來', /每天登入/.test(await s.text('/shop', ck)),
     '沒講的話使用者不知道點數從哪來，小舖看起來就是個買不起的櫥窗');
  s.done();
}

// ── 收費模式 ────────────────────────────────────────────────────────
{
  console.log('\n── 收費模式（PAID_MODE=1）────────────────────────────');
  const s = await boot(true, 3499);
  const boss = await s.reg('boss');
  const ck = await s.reg('paiduser');

  // ⚠ 註冊的見面禮**故意保留**：那是「歡迎」不是「日常發放」，
  // 收費之後拿掉會讓新使用者連試都試不了。
  const b0 = await s.bal(ck);
  ok(`收費：註冊見面禮還在（${b0} 點）`, b0 > 0,
     '收費模式下新帳號 0 點，連小舖長什麼樣都看不到');

  await s.login('paiduser');
  ok('收費：登入不再自動送點', await s.bal(ck) === b0,
     `餘額從 ${b0} 變成 ${await s.bal(ck)}——收費模式還在免費發點`);

  ok('收費：小舖頁不再宣傳「每天登入送」', !/每天登入/.test(await s.text('/shop', ck)),
     '收費了卻還寫著每天送點，使用者會覺得被騙');

  // 重點：帳本與交易要**完全照常**
  await s.post('/admin/shop/new', { name: 'PAIDITEM', kind: 'gift', price: 20 }, boss);
  const shop = await s.text('/shop', ck);
  ok('收費：商品照樣上架得了', shop.includes('PAIDITEM'));
  const id = (shop.match(/action="\/shop\/(\d+)\/buy"/) || [])[1];
  ok('收費：商品有購買按鈕', !!id);
  if (id) {
    await s.post(`/shop/${id}/buy`, {}, ck);
    ok(`收費：買得下去而且真的扣點（${b0} → ${await s.bal(ck)}）`, await s.bal(ck) === b0 - 20,
       '開關打開之後交易就壞了——那正是這一支要擋的事');
    ok('收費：背包收得到東西', (await s.text('/shop', ck)).includes('PAIDITEM'));
  }
  ok('收費：點數明細照樣看得到', /購買商品/.test(await s.text('/points', ck)));

  // 認證申請與網頁空間在收費模式下也不能整個消失
  ok('收費：認證申請頁還開得起來', (await s.text('/vip', ck)).includes('認證'));
  ok('收費：網頁空間還開得起來', (await s.text('/paiduser/files', ck)).includes('網頁空間'));
  s.done();
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
