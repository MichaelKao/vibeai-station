// 「每一個會長很多筆的清單，分頁真的能用嗎」
//
// ⚠ 使用者明確要求「所有頁面都能分頁」。在這之前我沒有一支專門測這件事的
// 工具——迴響與彙整頁是逐一補的，其他清單頁從來沒有系統性驗過。
//
// 分頁壞掉的方式不只一種，而且每一種的症狀都是「使用者找不到東西」：
//   1. 資料超過一頁，但分頁列根本沒出現 → 第 11 筆之後的東西永遠看不到
//   2. 分頁列出現了，但點下一頁還是同一批 → 看起來像壞掉
//   3. 沒有上限也沒有分頁 → 一萬筆一次全印，頁面幾十 MB
//   4. 頁碼亂給會 500
//
// 所以這一支不是只看「有沒有分頁列」，而是**真的塞資料進去**，
// 逐一驗四件事。
//
//   node tools/pagercheck.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = +(process.env.PORT || 3493);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = path.join(os.tmpdir(), 'vibeai-pager-' + process.pid);

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
const text = async (p, ck) => (await fetch(BASE + p, { headers: ck ? { cookie: ck } : {} })).text();
const get = (p, ck) => fetch(BASE + p, { headers: ck ? { cookie: ck } : {} , redirect: 'manual' });

const reg = await post('/register', { name: 'pagerq', nick: '分頁', pass: 'test1234', pass2: 'test1234' });
const CK = reg.headers.getSetCookie()?.[0]?.split(';')[0];
ok('準備：註冊得到 session', !!CK);

// 每一種清單：怎麼塞資料、清單網址、一頁幾筆、怎麼從 HTML 認出「一筆」
const LISTS = [
  {
    name: '網誌列表',
    url: '/pagerq/blog',
    per: 10,
    make: async n => post('/pagerq/blog/new', { title: '文章' + n, body: '內容', category: '心情' }, CK),
    count: h => new Set(h.match(/文章\d+/g) || []).size,
  },
  {
    name: '留言板',
    url: '/pagerq/guestbook',
    per: 10,
    make: async n => post('/pagerq/guestbook', { author: '訪客' + n, body: '留言' + n }, CK),
    count: h => new Set(h.match(/留言\d+(?!\d)/g) || []).size,
  },
  {
    name: '相簿列表',
    url: '/pagerq/album',
    per: 20,
    make: async n => post('/pagerq/album', { title: '相簿' + n }, CK),
    count: h => new Set(h.match(/相簿\d+/g) || []).size,
  },
  {
    name: '嘀咕',
    url: '/pagerq/digu',
    per: 20,
    make: async n => post('/pagerq/digu', { body: '嘀咕' + n }, CK),
    count: h => new Set(h.match(/嘀咕\d+/g) || []).size,
  },
];

for (const L of LISTS) {
  // 塞到「超過兩頁」為止
  const N = L.per * 2 + 3;
  for (let i = 1; i <= N; i++) await L.make(i);

  const p1 = await text(L.url, CK);
  const n1 = L.count(p1);
  ok(`${L.name}：第一頁只印 ${L.per} 筆（實際 ${n1}）`, n1 === L.per,
     `塞了 ${N} 筆，第一頁卻印 ${n1} 筆——${n1 > L.per ? '沒有分頁，資料一多就整頁噴出去' : '比預期少'}`);

  // 分頁列要出現，而且頁數要對
  const wantPages = Math.ceil(N / L.per);
  const hasPager = /page_control|w2-pager|下一頁|pagelink|pagination/i.test(p1);
  ok(`${L.name}：資料超過一頁時分頁列有出現`, hasPager,
     `塞了 ${N} 筆（應該有 ${wantPages} 頁）但頁面上找不到分頁列`);

  // 第二頁要是**不同的**內容
  const sep = L.url.includes('?') ? '&' : '?';
  const p2 = await text(`${L.url}${sep}p=2`, CK);
  const n2 = L.count(p2);
  ok(`${L.name}：第二頁有東西（${n2} 筆）`, n2 > 0);
  const same = JSON.stringify([...new Set(p1.match(/[一-龥]+\d+/g) || [])].slice(0, 5))
            === JSON.stringify([...new Set(p2.match(/[一-龥]+\d+/g) || [])].slice(0, 5));
  ok(`${L.name}：第二頁跟第一頁不是同一批`, !same, '兩頁內容一模一樣——分頁列點了等於沒用');

  // 最後一頁 + 超出範圍
  const last = await get(`${L.url}${sep}p=${wantPages}`, CK);
  ok(`${L.name}：最後一頁開得起來`, last.status === 200, 'HTTP ' + last.status);
  for (const bad of ['0', '-1', 'abc', '1e999', '999999']) {
    const r = await get(`${L.url}${sep}p=${bad}`, CK);
    ok(`${L.name}：頁碼 ${bad} 不會壞`, r.status === 200, 'HTTP ' + r.status);
  }

  // 超出範圍的頁碼要退回**最後一頁**，不是印空狀態。
  //
  // ⚠ 這是實測抓到的原話「畫面公然自相矛盾」：相簿頁同時印著
  // 「90 pictures」和「這本相簿還沒有照片」。使用者點到過期的分頁連結、
  // 或別人貼了一個舊頁碼的網址，看到的就是一片空白＋一個總數，
  // 直覺是「我的資料被刪光了」。
  {
    const over  = await text(`${L.url}${sep}p=999999`, CK);
    const lastH = await text(`${L.url}${sep}p=${wantPages}`, CK);
    ok(`${L.name}：頁碼超出範圍時退回最後一頁，不是空狀態`,
       L.count(over) > 0 && L.count(over) === L.count(lastH),
       `p=999999 印了 ${L.count(over)} 筆（最後一頁是 ${L.count(lastH)} 筆）` +
       '——超出範圍卻給空清單，畫面會跟旁邊的總數自相矛盾');
  }
}

// 哈啦主題的回覆
//
// ⚠ 回覆原本是一次全撈、完全沒有分頁——一串熱門主題累積上千則之後，
// 這一頁要把每一則的 BBCode 都算過再吐出去，手機直接卡住。
// 而且送出回覆之後要跳到**最後一頁**，不然使用者看不到自己剛打的那則，
// 跟「沒送出去」長得一模一樣。
{
  const r = await post('/hala', { title: '分頁主題', body: '內容' }, CK);
  const tid = (r.headers.get('location') || '').match(/\/hala\/(\d+)/)?.[1];
  ok('哈啦：主題發得出來', !!tid, 'location=' + r.headers.get('location'));
  if (tid) {
    const N = 23, per = 20;
    for (let n = 1; n <= N; n++) await post(`/hala/${tid}/reply`, { body: '回覆' + n }, CK);
    const cnt = h => new Set(h.match(/回覆\d+(?!\d)/g) || []).size;
    const p1 = await text(`/hala/${tid}`, CK);
    ok(`哈啦回覆：第一頁只印 ${per} 則（實際 ${cnt(p1)}）`, cnt(p1) === per,
       `塞了 ${N} 則卻一次全印出來——沒有分頁`);
    ok('哈啦回覆：分頁列有出現', /page_control/.test(p1));
    ok('哈啦回覆：總數印的是全部不是本頁', p1.includes('<b>' + N + '</b>'),
       '頁面上寫「回覆 20」，但其實有 23 則');
    const p2 = await text(`/hala/${tid}?p=2`, CK);
    ok(`哈啦回覆：第二頁有東西（${cnt(p2)} 則）`, cnt(p2) === N - per);
    const over = await text(`/hala/${tid}?p=999999`, CK);
    ok('哈啦回覆：頁碼超出範圍退回最後一頁', cnt(over) === N - per,
       `p=999999 印了 ${cnt(over)} 則，應該跟最後一頁一樣是 ${N - per} 則`);
    // 送出之後要看得到自己那則
    const rr = await post(`/hala/${tid}/reply`, { body: '回覆999' }, CK);
    const loc = rr.headers.get('location') || '';
    ok('哈啦回覆：送出後跳到最後一頁（看得到自己剛打的）', /\?p=2/.test(loc),
       'location=' + loc + '——跳回第一頁的話，畫面上只有最舊的 20 則，' +
       '使用者會以為回覆沒送出去');
  }
}

// 空狀態：新帳號的每一種清單都要有話講，不能是一片空白
{
  await post('/register', { name: 'emptyq', nick: '空的', pass: 'test1234', pass2: 'test1234' });
  const E = (await post('/login', { name: 'emptyq', pass: 'test1234' }))
    .headers.getSetCookie()?.[0]?.split(';')[0];
  for (const [u, what] of [['/emptyq/blog', '網誌'], ['/emptyq/guestbook', '留言板'],
                           ['/emptyq/friends', '好友'], ['/emptyq/favs', '收藏'],
                           ['/emptyq/visitors', '訪客'], ['/emptyq/digu', '嘀咕']]) {
    const h = await text(u, E);
    // 「有話講」＝出現「還沒」「沒有」「目前」這類空狀態字樣
    ok(`${what}空的時候有話講`, /還沒|沒有|目前|尚無/.test(h),
       '空清單一片空白，使用者不知道是沒東西還是壞了');
  }
}

srv.kill('SIGKILL');
await sleep(400);
try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { }
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
