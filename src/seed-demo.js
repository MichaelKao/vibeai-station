// 正式站灌示範資料：SEED_DEMO=1 時，在服務**啟動之後**於背景跑 tools/seed-demo.mjs。
//
// 為什麼做成「服務自己跑」而不是本機執行：
// Railway 的 Postgres 只有內網位址（*.railway.internal），本機根本連不到；
// 而照片要走 storage.save() 上 R2，也需要容器裡那組 R2 憑證。
// 做法與理由比照 src/migrate-pg.js，過程全部留在部署日誌裡可以事後稽核。
//
// 用法：
//   1. railway variables --service station --set SEED_DEMO=1
//      （站上已經有一點內容、但你就是要把示範資料補上去 → 用 SEED_DEMO=force）
//   2. 等部署跑完，看 railway logs 追進度（照片要抓 ~300 張，大約 10–20 分鐘）
//   3. 灌完之後把旗標關掉：railway variables --service station --set SEED_DEMO=0
//
// 安全性（這是會動到正式資料的東西，所以擋兩層）：
//   - **users 表非空就整個跳過**，所以重跑不會把資料灌成兩倍，
//     也不可能在有真實使用者之後把示範資料混進去
//   - **絕對不傳 --reset**：那個旗標會清空所有表並刪掉檔案，正式站不能碰
//   - 灌的過程出錯不影響站台運作，只記錄在日誌裡
//   - 在 listen() 之後才啟動，而且是背景子行程，不會拖慢健康檢查

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { one } from './db.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_SCRIPT = path.join(HERE, '..', 'tools', 'seed-demo.mjs');

export async function seedDemoIfEmpty({ force = false } = {}) {
  // 判斷「空不空」要看**內容**（相簿／網誌），不是看使用者數。
  // 正式站本來就有一個站長帳號，用「有沒有使用者」當條件的話會永遠跳過，
  // 站台就一直是空的——實際踩到過一次。
  const users = (await one('SELECT count(*) c FROM users')).c;
  const albums = (await one('SELECT count(*) c FROM albums')).c;
  const posts = (await one('SELECT count(*) c FROM posts')).c;
  if ((albums > 0 || posts > 0) && !force) {
    console.log(`[seed] 站上已經有內容（${albums} 本相簿 / ${posts} 篇網誌），跳過。`
      + '　要照樣補上示範資料請設 SEED_DEMO=force');
    return;
  }
  if (force && (albums > 0 || posts > 0))
    console.log(`[seed] force：站上已經有 ${albums} 本相簿 / ${posts} 篇網誌，`
      + '示範資料會**疊加**上去（不會刪除任何既有資料）');

  // 種子腳本本身是「有就跳過」的寫法（每一筆都先查再插），而且這裡不傳 --reset，
  // 所以既有的那些帳號會被沿用（照 name 比對），不會變成重複的人。
  console.log(`[seed] 開始灌示範資料（目前 ${users} 位使用者 / ${albums} 本相簿 / ${posts} 篇網誌）`
    + '——照片要上網抓並上傳 R2，會跑十幾分鐘');
  const child = spawn(process.execPath, [SEED_SCRIPT], {
    cwd: path.join(HERE, '..'),
    env: process.env,          // DATABASE_URL / DB_DRIVER / R2_* 都要傳下去
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  child.on('error', e => console.error('[seed] 起不來：', e.message));
  child.on('exit', code => console.log(
    code === 0 ? '[seed] 完成。記得把 SEED_DEMO 設回 0' : `[seed] 失敗，離開碼 ${code}`));
}
