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
    spawnSync('docker', ['exec', CN, 'psql', '-U', 'postgres', '-c', 'CREATE DATABASE ' + DBNAME], { encoding: 'utf8' });
    const PGURL = 'postgresql://postgres:pw@127.0.0.1:' + PGPORT + '/' + DBNAME;
    const pgEnv = { ...process.env, DB_DRIVER: 'postgres', DATABASE_URL: PGURL, PORT: APPPORT };
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
    for (const [name, file] of pgUp ? [['回歸測試（Postgres）', 'test_all.mjs'], ['Postgres 行為', 'test_pgbehavior.mjs']] : []) {
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
  // 手機可用性：觸控目標大小、圖片 alt、主要內容有沒有被推到看不見的地方
  const r7 = spawnSync(process.execPath, ['tools/touchcheck.mjs'], {
    env: { ...process.env, BASE: b2, MSYS_NO_PATHCONV: '1' }, encoding: 'utf8',
  });
  srv2.kill();
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

console.log(bad ? `\n共 ${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
