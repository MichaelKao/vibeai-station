// 跑回歸測試的正確方式：**每次都對一個全新的資料庫**。
//
// 為什麼需要這一支：test_all.mjs 第一步就是註冊 alpha/bravo/charlie，
// 對已經跑過的資料庫再跑一次會整串連鎖失敗（100 passed / 28 failed 那種），
// 看起來像「剛剛改壞了 28 項」，其實只是帳號已存在。
// 這個坑我自己在同一個 session 裡踩了三次，所以固化成腳本。
//
// 它做三件事，順序很重要：
//   1. 先把佔用該埠的舊 server 殺掉（不殺的話 SQLite 檔被鎖住，砍不掉）
//   2. 砍掉舊的 DATA_DIR，開一個全新的
//   3. 起 server、跑 test_all.mjs 與 test_pg.mjs、收工再把 server 關掉
//
//   node tools/runtests.mjs

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = +(process.env.TEST_PORT || 3021);
const DIR = path.join(os.tmpdir(), 'vibeai-test-' + PORT);

// 1) 殺掉佔用該埠的行程。Windows 上 netstat -ano 拿 PID 最可靠——
//    `node src/server.js` 這些行程的命令列一模一樣（DATA_DIR 是環境變數，
//    在命令列上看不到），照名字殺會把別人的 server 一起殺掉。
function killPort(port) {
  const isWin = process.platform === 'win32';
  const r = isWin
    ? spawnSync('netstat', ['-ano'], { encoding: 'utf8' })
    : spawnSync('lsof', ['-ti', ':' + port], { encoding: 'utf8' });
  if (isWin) {
    for (const line of (r.stdout || '').split('\n')) {
      const m = line.match(new RegExp(`\\s(?:0\\.0\\.0\\.0|\\[::\\]|127\\.0\\.0\\.1):${port}\\s+.*LISTENING\\s+(\\d+)`));
      if (m) { spawnSync('taskkill', ['/PID', m[1], '/F'], { stdio: 'ignore' }); console.log(`  關掉佔用 ${port} 的行程 ${m[1]}`); }
    }
  } else {
    for (const pid of (r.stdout || '').split('\n').filter(Boolean))
      spawnSync('kill', ['-9', pid], { stdio: 'ignore' });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

killPort(PORT);
await sleep(1500);
fs.rmSync(DIR, { recursive: true, force: true });
console.log(`乾淨的資料庫：${DIR}`);

const srv = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, DATA_DIR: DIR, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit'],
});

// 等它真的起來再開始，不要用固定秒數賭
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(base + '/')).ok) break; } catch { }
  await sleep(500);
}

let bad = 0;
for (const [name, file] of [['回歸測試', 'test_all.mjs'], ['SQL 方言', 'test_pg.mjs'], ['SSRF 防護', 'test_ssrf.mjs'], ['啟動搬移', 'test_migrate.mjs'], ['回頭路', 'tools/navback.mjs']]) {
  const r = spawnSync(process.execPath, [file], {
    env: { ...process.env, BASE: base, DATA_DIR: DIR }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n${name}：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  // ⚠「沒有結果」一定要當成失敗。本來寫成 `|| '(沒有結果)'`，只是印一行字、
  // bad 沒有加，於是測試整支崩掉時這裡照樣印「全部通過」——
  // 綠燈但其實沒跑，比紅燈還危險。實際發生過一次（server 還沒起來就開跑）。
  if (!line) {
    bad += 1;
    console.log('  ' + out.trim().split('\n').slice(-8).join('\n  '));
  }
  if (fails.length) bad += fails.length;
}

srv.kill();

// ── 瀏覽器流程（登入態）────────────────────────────────────────────────
// ownerflow.mjs **自己開站**（它要一個乾淨的資料庫走建立／刪除的流程），
// 所以不能塞進上面那個共用 BASE 的清單，要等這支 server 收掉之後再跑。
// 用 SKIP_BROWSER=1 可以跳過（例如在沒有 Chrome 的機器上）。
// ── Postgres 行為（要一個真的 Postgres）────────────────────────────────
// 為什麼一定要跑這一段：test_all 對兩個驅動都是全綠，**但正式站在 Postgres 上
// 壞掉的東西它一個都抓不到**（帳號大小寫、count/SUM 的型別、LIKE 的大小寫）。
// 多代理稽核在 Postgres 上挖出四個高嚴重度問題時，回歸網是 199 passed / 0 failed。
// 有 Docker 就自動開一個拋棄式的 Postgres 跑；沒有就跳過並明講（不要靜靜略過）。
if (!process.env.SKIP_PG) {
  const hasDocker = spawnSync('docker', ['info'], { encoding: 'utf8' }).status === 0;
  if (!hasDocker) {
    console.log('\nPostgres 行為：(略過——這台機器沒有可用的 Docker)');
  } else {
    // ⚠ 容器名與埠都要**每次不同**。多代理稽核時會有幾十個代理同時開自己的
    // Postgres 容器，固定名稱與固定埠會互相搶——症狀是 test_all 第一步
    // 「註冊三個帳號」就失敗（連到別人的資料庫），整串連鎖紅燈。
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    const CN = 'vibeai-runtests-pg-' + rnd, PGPORT = String(50000 + rnd), APPPORT = String(3900 + (rnd % 90));
    spawnSync('docker', ['rm', '-f', CN], { encoding: 'utf8' });
    spawnSync('docker', ['run', '-d', '--name', CN, '-e', 'POSTGRES_PASSWORD=pw',
      '-e', 'POSTGRES_DB=w2', '-p', PGPORT + ':5432', 'postgres:16-alpine'], { encoding: 'utf8' });
    for (let i = 0; i < 40; i++) {
      if (spawnSync('docker', ['exec', CN, 'pg_isready', '-q'], { encoding: 'utf8' }).status === 0) break;
      await sleep(1000);
    }
    // ⚠ 每次跑都用**新的資料庫名**。
    // `docker rm -f` 之後馬上 `docker run` 綁同一個埠，移除是非同步的——
    // 新容器可能綁不上，app 就連到**還沒死透的舊容器**，裡面還有上一輪的資料。
    // 症狀是 test_all 第一步「註冊三個帳號」就失敗（alpha 已存在），
    // 整串連鎖紅燈，看起來像「剛改壞了」。用不重複的資料庫名就完全避開。
    const DBNAME = 'w2_' + Date.now().toString(36);
    // ⚠ CREATE DATABASE 的結果一定要檢查，而且要重試。
    //
    // 之前這一行的回傳值直接丟掉。而 `pg_isready` 會在容器**第一次啟動的
    // 初始化階段**就回報 ready——那時 Postgres 跑的是內部的暫時伺服器，
    // 之後還會重啟一次。撞上那個窗口的話 CREATE DATABASE 失敗，
    // 接著 app 連一個不存在的資料庫，開不起來，報表印一句
    // 「server 沒起來，跳過」就過去了。
    //
    // 後果不是「少跑一支測試」，是**正式站用的資料庫引擎沒有被驗過**，
    // 而且沒有人會注意到——同一種「測試靜默沒跑」的問題，這是第三次了
    // （前兩次是 SESSION_SECRET 擋住開機、Docker 沒開）。所以這裡寧可吵。
    let dbMade = false, dbErr = '';
    for (let i = 0; i < 20 && !dbMade; i++) {
      const r = spawnSync('docker', ['exec', CN, 'psql', '-U', 'postgres',
        '-c', 'CREATE DATABASE ' + DBNAME], { encoding: 'utf8' });
      if (r.status === 0) { dbMade = true; break; }
      dbErr = ((r.stderr || '') + (r.stdout || '')).trim().split('\n').pop() || '';
      await sleep(1000);
    }
    if (!dbMade) console.log(`\n⚠ Postgres：建不出測試資料庫（${dbErr}）——` +
      '下面的 Postgres 測試會全部跳過，而正式站跑的正是 Postgres。');
    const PGURL = 'postgresql://postgres:pw@127.0.0.1:' + PGPORT + '/' + DBNAME;
    // ⚠ SESSION_SECRET 一定要給。
    // src/server.js 判斷「是不是正式站」的方式是「有沒有 DATABASE_URL」，
    // 而這裡的測試用 Postgres 也有——於是伺服器認定自己是正式站，
    // 缺 SESSION_SECRET 就拒絕開機（那個檢查是刻意的，見 sessionSecret()）。
    // 少了這一行的後果不是報錯，是**整套 Postgres 測試被靜默跳過**：
    // 報表只印一句「server 沒起來，跳過」，而正式站跑的正是 Postgres。
    const pgEnv = { ...process.env, DB_DRIVER: 'postgres', DATABASE_URL: PGURL, PORT: APPPORT,
                    SESSION_SECRET: 'runtests-only-not-a-real-secret' };
    // stderr 收起來：server 起不來的時候要看得到原因，
    // 不然只會看到 test_all 整串連鎖紅燈，完全不知道是它根本沒起來。
    const pgSrv = spawn(process.execPath, ['src/server.js'], { env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'] });
    let pgErr = '';
    pgSrv.stderr.on('data', d => { pgErr += d; });
    const pgBase = 'http://127.0.0.1:' + APPPORT;
    let pgUp = false;
    for (let i = 0; i < 90; i++) {
      try { if ((await fetch(pgBase + '/')).ok) { pgUp = true; break; } } catch { }
      await sleep(500);
    }
    // ⚠ 起不來就**直接說起不來**，不要讓 test_all 跑下去。
    // 那樣只會得到「註冊三個帳號 FAIL」開頭的一整串連鎖紅燈，
    // 看起來像剛把註冊功能改壞了，實際上是 server 根本沒在那個埠上。
    if (!pgUp) {
      bad += 1;
      console.log(`\nPostgres 測試：**server 沒起來**（${pgBase}），跳過。`);
      console.log('  ' + (pgErr.trim().split('\n').slice(-8).join('\n  ') || '(沒有錯誤輸出)'));
    }
    // ⚠ loadcheck 一定要在這裡也跑一次。
    // 它的「快取到期不會雪崩」那一條在 SQLite 上**沒有鑑別力**：SQLite 在
    // 同一個行程裡，第一個請求查完了第二個才到，根本沒有雪崩的窗口——
    // 實測把防護整個拿掉，SQLite 照樣回報「重建 1 次」，同一份程式碼對
    // Postgres 則是「重建 7 次」。所以那一條真正的驗證只發生在這一輪。
    for (const [name, file] of pgUp ? [['回歸測試（Postgres）', 'test_all.mjs'],
                                       ['Postgres 行為', 'test_pgbehavior.mjs'],
                                       ['併發負載（Postgres）', 'tools/loadcheck.mjs']] : []) {
      const r = spawnSync(process.execPath, [file], { env: { ...pgEnv, BASE: pgBase }, encoding: 'utf8' });
      const out = (r.stdout || '') + (r.stderr || '');
      const line = out.split('\n').filter(l => l.includes('passed')).pop();
      const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
      console.log(`\n${name}：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
      for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
      if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-8).join('\n  ')); }
      if (fails.length) bad += fails.length;
    }
    pgSrv.kill();
    spawnSync('docker', ['rm', '-f', CN], { encoding: 'utf8' });
  }
}

if (!process.env.SKIP_BROWSER) {
  await sleep(800);
  const r = spawnSync(process.execPath, ['tools/ownerflow.mjs'], {
    env: { ...process.env, PORT: '3131', MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n瀏覽器流程：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails.length) bad += fails.length;
}


// ── 頁籤／範圍切換（要 Chrome）────────────────────────────────────────
// 為什麼要單獨一支：uicheck --dead 找的是「點了完全沒反應」的控制項，
// 但搜尋範圍那四顆是 radio+label，點下去 radio 真的會被選起來——對它來說
// 算「有反應」，所以它對 /albums 回報 0 問題，而使用者實際的感受是
// 「那排頁籤不能點」（後端當時根本不讀 type）。這一支點完還會比對結果頁。
if (!process.env.SKIP_BROWSER) {
  const srv2 = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, DATA_DIR: DIR, PORT: '3132' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const b2 = 'http://127.0.0.1:3132';
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(b2 + '/')).ok) break; } catch { }
    await sleep(500);
  }
  const r = spawnSync(process.execPath, ['tools/tabclick.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  // 登入／登出入口：三套頁首 × 兩種螢幕寬度。
  // test_all 在同一個資料庫裡建過 alpha/test1234，直接借用。
  const r3 = spawnSync(process.execPath, ['tools/authnav.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1',
           USER_NAME: 'alpha', USER_PASS: 'test1234' }, encoding: 'utf8',
  });
  // 無障礙：每個輸入框都要唸得出名字（label / aria-label / title）
  const r4 = spawnSync(process.execPath, ['tools/labelcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1',
           USER_NAME: 'alpha', USER_PASS: 'test1234' }, encoding: 'utf8',
  });
  // 鍵盤操作：kukubar 那幾顆「展開」用 Enter 按得動嗎
  const r5 = spawnSync(process.execPath, ['tools/keyboardcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1',
           USER_NAME: 'alpha', USER_PASS: 'test1234' }, encoding: 'utf8',
  });
  // 客製化：自訂 CSS／版型／音樂盒真的套到畫面上了嗎
  const r6 = spawnSync(process.execPath, ['tools/customcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1',
           USER_NAME: 'alpha', USER_PASS: 'test1234' }, encoding: 'utf8',
  });
  // 眼睛看得到的回饋：點下去畫面有沒有變、Tab 走過去看不看得出焦點在哪。
  // ⚠ 這一支補的是「測試全綠但畫面是壞的」那個盲點——使用者連續兩次回報
  // 相簿頁籤不能點，而當時的測試都在量「機器看得到的狀態改變」。
  const r8 = spawnSync(process.execPath, ['tools/visualclick.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1',
           USER_NAME: 'alpha', USER_PASS: 'test1234' }, encoding: 'utf8',
  });
  // 手機可用性：觸控目標大小、圖片 alt、主要內容有沒有被推到看不見的地方
  const r7 = spawnSync(process.execPath, ['tools/touchcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  // 手機：版面與流程。
  //
  // ⚠ 上面那支 touchcheck 只量觸控目標大小與圖片 alt，而且只跑**未登入的
  // 站台層級**頁面。使用者回報「手機端不行」之後才發現，它一項都測不到
  // 真正的症狀：橫向破版、按鈕被浮層蓋住、個人小站的頁面、登入後的畫面。
  //   mobilecheck  三種寬度 × 24 頁的破版與遮擋
  //   mobileflow   用真的觸控（tap，不是 click）走完註冊→登入→發文→留言
  const r9 = spawnSync(process.execPath, ['tools/mobilecheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const r10 = spawnSync(process.execPath, ['tools/mobileflow.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  // 上傳照片：相簿站的核心功能，而前面兩支一次都沒碰過檔案上傳
  // （mobilecheck 只量版面，mobileflow 走的是純文字表單）。
  const r11 = spawnSync(process.execPath, ['tools/mobileupload.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  // Safari（WebKit）。
  // ⚠ 上面全部都是 Chromium。在台灣 iPhone 佔比很高，而 iPhone 上**所有**
  // 瀏覽器都是 WebKit（iOS 規定），所以 Chromium 全綠不代表 iPhone 沒事。
  const r12 = spawnSync(process.execPath, ['tools/safaricheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  // 疊字：截圖審查在這件事上最不可靠——相鄰常被當成相疊，真的疊字反而
  // 漏掉。這一支用量的：相交、不是螢幕外的無障礙標籤、而且捲過去之後
  // 那個點畫出來的真的是它們其中一個。首頁「投稿精選」就是它抓出來的。
  const r13 = spawnSync(process.execPath, ['tools/overlapcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  srv2.kill();
  for (const [nm, rr] of [['手機版面', r9], ['手機流程', r10], ['手機上傳', r11],
                          ['Safari 引擎', r12], ['文字疊字', r13]]) {
    const o = (rr.stdout || '') + (rr.stderr || '');
    const ln = o.split('\n').filter(l => l.includes('passed')).pop();
    const fs2 = o.split('\n').filter(l => l.startsWith('! FAIL'));
    console.log(`\n${nm}：${ln ? ln.trim() : '(沒有結果——測試根本沒跑完)'}`);
    for (const f of fs2.slice(0, 20)) console.log('  ' + f.trim());
    if (!ln) { bad += 1; console.log('  ' + o.trim().split('\n').slice(-8).join('\n  ')); }
    if (fs2.length) bad += fs2.length;
  }
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n頁籤切換：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails.length) bad += fails.length;

  const out3 = (r3.stdout || '') + (r3.stderr || '');
  const line3 = out3.split('\n').filter(l => l.includes('passed')).pop();
  const fails3 = out3.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n登入登出入口：${line3 ? line3.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails3.slice(0, 20)) console.log('  ' + f.trim());
  if (!line3) { bad += 1; console.log('  ' + out3.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails3.length) bad += fails3.length;

  const out4 = (r4.stdout || '') + (r4.stderr || '');
  const line4 = out4.split('\n').filter(l => l.includes('passed')).pop();
  const fails4 = out4.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n欄位標籤：${line4 ? line4.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails4.slice(0, 20)) console.log('  ' + f.trim());
  if (!line4) { bad += 1; console.log('  ' + out4.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails4.length) bad += fails4.length;

  const out5 = (r5.stdout || '') + (r5.stderr || '');
  const line5 = out5.split('\n').filter(l => l.includes('passed')).pop();
  const fails5 = out5.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n鍵盤操作：${line5 ? line5.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails5.slice(0, 20)) console.log('  ' + f.trim());
  if (!line5) { bad += 1; console.log('  ' + out5.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails5.length) bad += fails5.length;

  const out6 = (r6.stdout || '') + (r6.stderr || '');
  const line6 = out6.split('\n').filter(l => l.includes('passed')).pop();
  const fails6 = out6.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n客製化：${line6 ? line6.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails6.slice(0, 20)) console.log('  ' + f.trim());
  if (!line6) { bad += 1; console.log('  ' + out6.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails6.length) bad += fails6.length;

  const out8 = (r8.stdout || '') + (r8.stderr || '');
  const line8 = out8.split('\n').filter(l => l.includes('passed')).pop();
  const fails8 = out8.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n看得到的回饋：${line8 ? line8.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails8.slice(0, 20)) console.log('  ' + f.trim());
  if (!line8) { bad += 1; }
  if (fails8.length) bad += fails8.length;

  const out7 = (r7.stdout || '') + (r7.stderr || '');
  const line7 = out7.split('\n').filter(l => l.includes('passed')).pop();
  const fails7 = out7.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n手機可用性：${line7 ? line7.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails7.slice(0, 20)) console.log('  ' + f.trim());
  if (!line7) { bad += 1; console.log('  ' + out7.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails7.length) bad += fails7.length;
}


// ── 收工排空（自己開站，不需要 Chrome）──────────────────────────────
// 為什麼要單獨一支：它要對一個真的 server 送訊號，不能跟別人共用 BASE。
{
  const r = spawnSync(process.execPath, ['tools/shutdowncheck.mjs'], {
    env: { ...process.env, PORT: '3491', MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n收工排空：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails.length) bad += fails.length;
}


// ── Redis 掛掉時的降級（自己開站）──────────────────────────────────
// 為什麼要單獨一支：它要用不同的 REDIS_URL 各開一次站，不能共用 BASE。
{
  const r = spawnSync(process.execPath, ['tools/redisdown.mjs'], {
    env: { ...process.env, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\nRedis 降級：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-8).join('\n  ')); }
  if (fails.length) bad += fails.length;
}


// ── 沒接住的錯誤不會把站弄死（自己開站）──────────────────────────
{
  const r = spawnSync(process.execPath, ['tools/crashcheck.mjs'], {
    env: { ...process.env, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split(String.fromCharCode(10)).filter(l => l.includes('passed')).pop();
  const fails = out.split(String.fromCharCode(10)).filter(l => l.startsWith('! FAIL'));
  console.log(`
崩潰防護：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}


// ── async route 的例外會走到錯誤中介層（自己開站）────────────────
{
  const r = spawnSync(process.execPath, ['tools/asyncerr.mjs'], {
    env: { ...process.env, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\nasync 錯誤轉交：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}


// ── 部署設定（不用開站，純讀檔）──────────────────────────────────
// 擋的是「啟動指令又被包回 pnpm」——那會讓每次部署都被判定成 crash。
{
  const r = spawnSync(process.execPath, ['tools/deploycfg.mjs'], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n部署設定：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}


// ── 分頁（自己開站，不需要 Chrome）────────────────────────────────
// 使用者明確要求「所有頁面都能分頁」。這一支真的塞資料進去，逐一驗
// 分頁列有沒有出現、點下一頁是不是換了內容、邊界頁碼會不會壞、
// 以及空清單有沒有話講（一片空白使用者分不出是沒東西還是壞了）。
{
  const r = spawnSync(process.execPath, ['tools/pagercheck.mjs'], {
    env: { ...process.env, PORT: '3493', MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n分頁：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}

// ── 上線防護（自己開站，不需要 Chrome）──────────────────────────
// 一次上線稽核抓到的幾道鎖。它們的共同點是「站跑得好好的，什麼都不會壞」——
// 所以沒有測試守著就會在某次重構中安靜地掉回去，而代價是使用者的帳號或隱私。
{
  const r = spawnSync(process.execPath, ['tools/hardening.mjs'], {
    env: { ...process.env, PORT: '3494', MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n上線防護：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}

// ── 小舖／點數／認證申請／個人網頁空間 ────────────────────────────
// 功能盤點抓到「無名有、本站沒有」的四項。站主的決定是「現在全部免費，
// 等我想開能隨時開」——所以帳本、商品、背包、扣點全部照做，
// 只有「點數從哪裡來」掛在 PAID_MODE 上。
{
  const r = spawnSync(process.execPath, ['tools/shopcheck.mjs'], {
    env: { ...process.env, PORT: '3495', MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n小舖與新功能：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; }
  if (fails.length) bad += fails.length;
}

// ── 收費模式與併發（自己開站，不需要 Chrome）──────────────────────
// 收費模式：站主的「等我想開能隨時開」是一個**從沒被執行過的分支**，
//           而它第一次跑的那天，站上已經有真實使用者與真實點數。
// 併發：    其餘所有測試都是一次一個請求。真正上線那天來的是一群人，
//           而我們對那件事一個數字都沒有。
for (const [name, file, port] of [
  ['收費模式', 'tools/paidcheck.mjs', '3498'],
  ['併發負載', 'tools/loadcheck.mjs', '3500'],
]) {
  const r = spawnSync(process.execPath, [file], {
    env: { ...process.env, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  void port;
  const out = (r.stdout || '') + (r.stderr || '');
  const line = out.split('\n').filter(l => l.includes('passed')).pop();
  const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
  console.log(`\n${name}：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
  // 併發那一支會印出延遲數字，那是要看的，不是雜訊
  for (const l of out.split('\n').filter(l => l.includes('[基準]') || l.includes('併發]')))
    console.log('  ' + l.trim());
  for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
  if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-6).join('\n  ')); }
  if (fails.length) bad += fails.length;
}

// ── 備份還原演練（要 Docker）───────────────────────────────────────
// ⚠ 沒有還原過的備份等於沒有備份。最常見的失敗不是「備份沒跑」，是需要
// 用的那一天才發現檔案是空的、版本對不上、或還原指令跑不起來——而那一天
// 通常就是你剛剛誤刪東西的那一天。站上刪帳號／相簿／文章都是硬刪除。
{
  const hasDocker = spawnSync('docker', ['ps'], { stdio: 'ignore' }).status === 0;
  if (!hasDocker) {
    console.log('\n備份還原演練：(略過——Docker 沒在跑。⚠ 這一項略過等於' +
                '「備份能不能還原」這件事沒有人驗過)');
  } else {
    const r = spawnSync(process.execPath, ['tools/restoredrill.mjs'],
      { env: { ...process.env, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    const line = out.split('\n').filter(l => l.includes('passed')).pop();
    const fails = out.split('\n').filter(l => l.startsWith('! FAIL'));
    console.log(`\n備份還原演練：${line ? line.trim() : '(沒有結果——測試根本沒跑完)'}`);
    for (const f of fails.slice(0, 20)) console.log('  ' + f.trim());
    if (!line) { bad += 1; console.log('  ' + out.trim().split('\n').slice(-6).join('\n  ')); }
    if (fails.length) bad += fails.length;
  }
}

console.log(bad ? `\n共 ${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
