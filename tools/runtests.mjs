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
for (const [name, file] of [['回歸測試', 'test_all.mjs'], ['SQL 方言', 'test_pg.mjs']]) {
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
console.log(bad ? `\n共 ${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
