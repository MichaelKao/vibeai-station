import fs from 'node:fs';
import path from 'node:path';

// 資料目錄：Railway 上請設 DATA_DIR=/app/data（＝Volume 掛載點）。
// 用絕對路徑，避免相對路徑因工作目錄不同而寫到 Volume 外面（會導致重新部署資料全失）。
export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'station.db');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 啟動時把實際路徑與磁碟容量印出來，方便從部署日誌確認有沒有真的落在 Volume 上。
// fs 顯示容器暫存碟容量（數千 GB）＝Volume 沒掛上；顯示約 49GB＝正常。
const existed = fs.existsSync(DB_PATH);
let size = 'n/a';
try {
  const s = fs.statfsSync(DATA_DIR);
  size = `${Math.round(s.blocks*s.bsize/1e9)}GB total / ${Math.round(s.bavail*s.bsize/1e9)}GB free`;
} catch {}
console.log(`[data] DATA_DIR=${DATA_DIR} db=${DB_PATH} existing=${existed} cwd=${process.cwd()} fs=${size}`);
