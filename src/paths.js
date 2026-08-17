import fs from 'node:fs';
import path from 'node:path';

// 資料目錄：Railway 上請設 DATA_DIR=/app/data（＝Volume 掛載點）。
// 用絕對路徑，避免相對路徑因工作目錄不同而寫到 Volume 外面（會導致重新部署資料全失）。
export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'station.db');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 啟動時把實際路徑印出來，方便從部署日誌確認有沒有落在 Volume 上。
const existed = fs.existsSync(DB_PATH);
let size = 'n/a';
try { const s = fs.statfsSync(DATA_DIR); size = `${Math.round(s.blocks*s.bsize/1e9)}GB total / ${Math.round(s.bavail*s.bsize/1e9)}GB free`; } catch {}
console.log(`[data] DATA_DIR=${DATA_DIR} db=${DB_PATH} existing=${existed} cwd=${process.cwd()} fs=${size}`);
);
      console.log(`[data] boot marker lines: ${fs.readFileSync(path.join(DATA_DIR,'.boot'),'utf8').trim().split('\n').length}`); } catch(e){ console.log('[data] marker failed', e.message); }
