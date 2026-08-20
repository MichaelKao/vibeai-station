// 「每一顆按鈕都真的按下去」的全覆蓋測試。
//
// 跟其他幾支的分工：
//   linksweep.mjs   只送 GET，唯讀，對正式站安全
//   clickcheck.mjs  不按，只問「這個連結點得到嗎」（有沒有被別的元素蓋住）
//   這一支          **真的按**：每個 <form> 都送出一次
//
// ⚠ 它會刪帳號、刪相簿、刪文章。**只對自己開的拋棄式資料庫跑**，
//    不吃 BASE 環境變數，想指到別的站也指不了。
//
//   node tools/buttoncheck.mjs
//
// ── 這支工具自己踩過的兩個坑（都會讓報告變成廢紙）─────────────────────
//
// 1. 掃描器會把**每一個**表單都用預設值送出去，包括登入表單。
//    預設值裡剛好有 name/pass，於是「訪客」那一輪送出登入表單就真的登入成
//    alpha——alpha 是第一個註冊者＝站長——接著它以站長身分按到後台的
//    「刪除帳號」，把 bravo 與 charlie 刪了。後面兩輪整片 404，
//    看起來像網站壞掉，其實是測試工具自己把資料清了。
//    → 登入／註冊／登出不進掃描，另外單獨測。
//
// 2. 就算不誤登入，站主那一輪本來就會按到「刪相簿」「刪文章」「刪帳號」。
//    三種身分共用一個站的話，先跑的那一輪會把後面的內容清光。
//    → **每一種身分都重開一個乾淨的站、重灌一次內容**。慢，但數字才是真的。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = +(process.env.PORT || 3021);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), 'vibeai-buttoncheck-' + PORT);

// 這些路由**本來就該**回這個狀態，不算壞掉
const EXPECT = [
  [/\/settings$/,            [200, 302, 403]],
  [/\/album\/\d+\/unlock$/,  [200, 302]],
  [/\/report$/,              [200, 302]],
];
// 掃描時要跳過的：送出去會換掉身分，另外單獨測
const AUTH_FORMS = /\/(login|register|logout)$/;

let srv;
async function freshServer() {
  if (srv) { srv.kill(); await new Promise(r => setTimeout(r, 400)); }
  fs.rmSync(DATA, { recursive: true, force: true });
  srv = spawn(process.execPath, ['src/server.js'],
    { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/'); break; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  // 借 test_all.mjs 灌內容：註冊 alpha/bravo/charlie、開相簿、上傳照片、
  // 發文、留言、開揪團…跑完就有東西可以按了，順便再驗一次那 149 項。
  await new Promise((res, rej) => {
    const t = spawn(process.execPath, ['test_all.mjs'],
      { env: { ...process.env, BASE }, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    t.stdout.on('data', d => { out += d; });
    t.on('exit', c => c === 0 ? res(out) : rej(new Error('test_all 沒過，先修那個再回來')));
  });
}

const jar = {};
async function req(method, url, body, who = 'anon', redirect = 'manual') {
  const h = {};
  if (jar[who]) h.cookie = jar[who];
  const r = await fetch(BASE + url, { method, headers: h, body, redirect });
  const sc = r.headers.get('set-cookie');
  if (sc) jar[who] = sc.split(';')[0];
  return r;
}
async function form(url, fields, who) {
  const b = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) b.append(k, v);
  return req('POST', url, b, who);
}

// 表單欄位的預設值：照 name 猜一個合理的值，猜不到就填字串
const VALUE = {
  nick: '測試暱稱', title: '按鈕測試標題', body: '按鈕測試內容', descr: '說明',
  subject: '主旨', author: '訪客', q: 'a', keyword: 'a',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  msg: '訊息', reason: '測試', kind: 'flower', to: 'bravo', when: '2026-12-01',
};
function fill(f) {
  const o = {};
  for (const inp of f.inputs) {
    if (inp.type === 'submit' || inp.type === 'button') continue;
    o[inp.name] = inp.value !== '' && inp.value != null ? inp.value
      : (VALUE[inp.name] !== undefined ? VALUE[inp.name] : '測試');
  }
  return o;
}

// 很陽春的 form 抽取（頁面是我們自己產的，結構單純）
function parseForms(html) {
  const out = [];
  for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = m[1], inner = m[2];
    const inputs = [];
    for (const i of inner.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
      const a = i[2];
      const name = (a.match(/name="([^"]*)"/) || [])[1];
      if (!name) continue;
      inputs.push({ name,
        type: (a.match(/type="([^"]*)"/) || [])[1] || 'text',
        value: (a.match(/value="([^"]*)"/) || [])[1] || '' });
    }
    out.push({
      action: (attrs.match(/action="([^"]*)"/) || [])[1] || '',
      method: ((attrs.match(/method="([^"]*)"/) || [])[1] || 'get').toLowerCase(),
      inputs, hasFile: /type="file"/i.test(inner),
      label: (inner.match(/<button[^>]*>([^<]*)</) || [])[1] || '送出',
    });
  }
  return out;
}

// 明細頁的網址要從站上真的有的東西撈，寫死 id 會在種子改動後失效
async function discover(who) {
  const grab = async (url, re) => {
    const h = await (await req('GET', url, null, who, 'follow')).text();
    return [...new Set([...h.matchAll(re)].map(m => m[0]))];
  };
  const out = [];
  const albums = (await grab('/alpha/album', /\/alpha\/album\/[0-9]+/g)).slice(0, 2);
  out.push(...albums);
  for (const a of albums) out.push(a + '/slide', a + '/wall');
  for (const a of albums) out.push(...(await grab(a, /\/alpha\/photo\/[0-9]+/g)).slice(0, 2));
  out.push(...(await grab('/alpha/blog', /\/alpha\/blog\/[0-9]+(?![0-9/])/g)).slice(0, 2));
  out.push(...(await grab('/join', /\/join\/[0-9]+/g)).slice(0, 2));
  out.push(...(await grab('/hala', /\/hala\/[0-9]+/g)).slice(0, 2));
  return [...new Set(out.filter(Boolean))];
}

const BASE_PAGES = ['/', '/albums', '/blogs', '/rank', '/search', '/help', '/login', '/register',
  '/video', '/digu', '/join', '/hala', '/svcs/wretch_girl', '/admin',
  '/alpha', '/alpha/album', '/alpha/blog', '/alpha/guestbook', '/alpha/card',
  '/alpha/friends', '/alpha/favs', '/alpha/visitors', '/alpha/digu', '/alpha/video',
  '/alpha/settings', '/alpha/feed', '/alpha/blog/new'];

// 每一種身分，看不到某些頁是**正常**的，別報成 bug
const OK_BLOCKED = {
  anon:  { 403: /.*/, 302: /.*/ },
  other: { 403: /\/(admin|alpha\/(settings|feed|blog\/new))/ },
  owner: {},
};

const bad = [], skipped = [];
let tried = 0, pagesScanned = 0;
// 刪除類的按鈕要**留到最後**再按。
// 不然「刪相簿」按下去之後，後面才要掃的單本相簿／幻燈片／相片牆／單張照片
// 全部變 404，看起來像一堆 bug，其實是自己剛剛刪掉的。
const DESTRUCTIVE = /\/(del|delete)$/;

for (const who of ['anon', 'other', 'owner']) {
  await freshServer();                       // ← 坑 2：每一輪都用乾淨的站
  for (const k of Object.keys(jar)) delete jar[k];
  if (who !== 'anon') {
    const r = await form('/login', { name: who === 'owner' ? 'alpha' : 'bravo', pass: 'test1234' }, who);
    if (r.status !== 302) throw new Error(`${who} 登不進去（${r.status}）`);
  }
  const PAGES = [...BASE_PAGES, ...await discover(who === 'anon' ? 'anon' : who)];
  console.log(`\n── ${who} ── 掃 ${PAGES.length} 頁`);
  const later = [];        // 刪除類的按鈕排到這裡，整輪掃完再按

  for (const p of PAGES) {
    const r = await req('GET', p, null, who, 'follow');
    pagesScanned++;
    if (r.status >= 500) { bad.push([who, 'GET ' + p, r.status, '頁面本身就 500']); continue; }
    if (!(r.headers.get('content-type') || '').includes('html')) continue;
    const html = await r.text();
    const forms = parseForms(html).filter(f => f.action && f.method === 'post');
    // 0 顆按鈕有兩種可能，要分得出來：頁面沒開 vs 開了但本來就沒有互動
    if (r.status !== 200) {
      const okBlocked = Object.entries(OK_BLOCKED[who])
        .some(([code, re]) => +code === r.status && re.test(p));
      if (!okBlocked) bad.push([who, 'GET ' + p, r.status, '這頁應該打得開']);
      continue;
    }
    for (const f of forms) {
      if (f.hasFile) { skipped.push([who, f.action, '有檔案上傳欄位，這一支不送二進位']); continue; }
      const url = f.action.startsWith('/') ? f.action : p.replace(/\/[^/]*$/, '/') + f.action;
      if (AUTH_FORMS.test(url)) { skipped.push([who, url, '登入／註冊／登出另外單獨測']); continue; }
      if (DESTRUCTIVE.test(url)) { later.push([url, f]); continue; }
      await press(who, url, f);
    }
  }
  // 整輪掃完了，現在才按刪除。同一顆刪除鈕常常在兩頁都出現
  // （例如相簿列表與單本相簿都有「刪除這本相簿」），按第二次當然 404，
  // 那是重複按不是壞掉——所以照網址去重。
  // 而且要**先刪子項再刪父項**：`/blog/1/del` 會連帶把文章的迴響一起刪掉，
  // 先按它的話 `/blog/1/comment/1/del` 就 404 了。網址層數多的排前面剛好就是子項。
  later.sort((a, b) => b[0].split('/').length - a[0].split('/').length);
  const seenDel = new Set();
  for (const [url, f] of later) {
    if (seenDel.has(url)) continue;
    seenDel.add(url);
    await press(who, url, f);
  }
}

async function press(who, url, f) {
  tried++;
  let res;
  try { res = await form(url, fill(f), who); }
  catch (e) { bad.push([who, 'POST ' + url, 'fetch 失敗', e.message]); return; }
  const ok = res.status < 400
    || EXPECT.some(([re, list]) => re.test(url) && list.includes(res.status))
    || (who !== 'owner' && [403, 401, 302].includes(res.status));
  if (process.env.VERBOSE) console.log(`    [${who}] POST ${url} -> ${res.status}`);
  if (!ok) bad.push([who, 'POST ' + url, res.status, `「${f.label}」`]);
}

// ── 權限與登入／登出，單獨在乾淨的站上測 ────────────────────────────────
// 後台那幾支是破壞性的，一定要確認訪客與一般站友按不動。
// 上面那個坑（掃描器自己登入成站長）正好證明了：這一條沒測到就等於沒有。
await freshServer();
for (const k of Object.keys(jar)) delete jar[k];
await form('/login', { name: 'bravo', pass: 'test1234' }, 'other');
console.log('\n── 權限與登入／登出 ──');
const guard = [
  ['anon',  '/admin/user/2/del',   [302, 403]],
  ['anon',  '/admin/broadcast',    [302, 403]],
  ['anon',  '/alpha/settings',     [302, 403]],
  ['other', '/admin/user/2/del',   [403]],
  ['other', '/admin/broadcast',    [403]],
  ['other', '/alpha/settings',     [403]],
];
for (const [who, url, want] of guard) {
  const r = await form(url, { nick: 'x', body: 'x' }, who);
  const ok = want.includes(r.status);
  console.log(`  ${ok ? '✓' : '✗'} [${who}] POST ${url} → ${r.status}（要 ${want.join('/')}）`);
  if (!ok) bad.push([who, 'POST ' + url, r.status, `權限沒擋住，應該是 ${want.join('/')}`]);
}
{
  const r1 = await form('/login', { name: 'bravo', pass: 'wrongpass' }, 'fresh');
  const okBad = r1.status === 200 && (await r1.text()).includes('帳號或密碼錯誤');
  console.log(`  ${okBad ? '✓' : '✗'} 密碼錯誤擋下來`);
  if (!okBad) bad.push(['fresh', 'POST /login（錯密碼）', r1.status, '沒有擋下來']);

  const r2 = await form('/login', { name: 'bravo', pass: 'test1234' }, 'fresh');
  console.log(`  ${r2.status === 302 ? '✓' : '✗'} 密碼正確登得進去`);
  if (r2.status !== 302) bad.push(['fresh', 'POST /login', r2.status, '登不進去']);

  const r3 = await req('POST', '/logout', null, 'fresh');
  const okOut = r3.status === 302 && (await req('GET', '/bravo/settings', null, 'fresh')).status !== 200;
  console.log(`  ${okOut ? '✓' : '✗'} 登出之後就進不去設定頁了`);
  if (!okOut) bad.push(['fresh', 'POST /logout', r3.status, '登出沒生效']);
}

console.log(`\n掃了 ${pagesScanned} 頁次，真的按下去 ${tried} 個表單`);
if (skipped.length) {
  const kinds = {};
  for (const s of skipped) kinds[s[2]] = (kinds[s[2]] || 0) + 1;
  console.log('略過：' + Object.entries(kinds).map(([k, n]) => `${k}（${n}）`).join('、'));
}
if (bad.length) {
  console.log(`\n有問題 ${bad.length}：`);
  for (const b of bad) console.log(`  [${b[0]}] ${b[1]} → ${b[2]} ${b[3] || ''}`);
} else console.log('\n每一顆都按得動，沒有 5xx、沒有預期外的 4xx');

srv.kill();
process.exit(bad.length ? 1 : 0);
