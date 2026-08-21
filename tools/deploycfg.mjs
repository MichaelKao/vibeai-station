// 部署設定的守門員：不要再讓啟動指令經過套件管理器。
//
// ⚠ 這一支是為了一個追了一整天的問題而存在的。症狀是「每部署一次，
// Railway 就寄一封 Deployment crashed，但站台明明是好的」。
// 真正的原因在 deploy log 裡：
//
//     16:15:08  [shutdown] 收到 SIGTERM，停止收新連線
//     16:15:08  [shutdown] 現有請求都跑完了
//     16:15:08  [shutdown] 收工              ← 我們的 node 乾淨結束，離開代碼 0
//     16:15:08  ELIFECYCLE  Command failed.  ← pnpm 自己回報失敗
//
// 容器停止時 SIGTERM 是送給整個 cgroup 的，`pnpm start` 那層殼自己也收到，
// 它結束子行程之後**以非零離開**。Railway 看到非零就判定 crash。
// 我們的程式從頭到尾沒有問題，是中間多了一層會擅自改寫離開代碼的殼。
//
// 所以 startCommand 一定要直接跑 node。這支測試把那件事釘住——
// 哪天有人為了「跟本機開發一致」把它改回 pnpm/npm/yarn，這裡就會紅燈。
//
//   node tools/deploycfg.mjs
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};

const raw = fs.readFileSync('railway.json', 'utf8');
let cfg = null;
try { cfg = JSON.parse(raw); } catch (e) { ok('railway.json 是合法的 JSON', false, e.message); }

if (cfg) {
  ok('railway.json 是合法的 JSON', true);

  const start = cfg.deploy?.startCommand || '';
  ok('有設 startCommand', !!start);

  // 這才是重點：不能經過任何套件管理器
  const wrapped = /^\s*(pnpm|npm|yarn|bun|npx)\b/.test(start);
  ok('啟動指令沒有包在套件管理器底下', !wrapped,
     `目前是 "${start}"——SIGTERM 時它會把 node 的離開代碼 0 改寫成非零，` +
     '每次部署都會被 Railway 判定成 crash');

  ok('啟動指令是直接跑 node', /^\s*node\s+src\/server\.js\s*$/.test(start), `目前是 "${start}"`);

  // 健康檢查打在輕量的端點上，不要打會跑整頁查詢與樣板的首頁
  const hc = cfg.deploy?.healthcheckPath || '';
  ok('健康檢查指向 /healthz', hc === '/healthz', `目前是 "${hc}"`);

  // package.json 的 start 腳本仍要在（本機 pnpm start 還是要能用）
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  ok('package.json 還留著 start 腳本（本機開發用）', !!pkg.scripts?.start, JSON.stringify(pkg.scripts));
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
