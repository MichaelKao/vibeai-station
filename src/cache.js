// Redis：session store、人氣計數 write-behind、熱查詢快取。
//
// 三件事都是「有 Redis 更好，沒有也要能跑」，所以整層設計成優雅降級：
// 沒有 REDIS_URL 時 session 回到 MemoryStore、計數直接寫 DB、快取變成直通，
// 本機開發不需要起 Redis。
//
// 為什麼需要：
//   1. session ─ express-session 預設的 MemoryStore 會漏記憶體，而且每次部署所有人被登出。
//   2. 人氣計數 ─ 每次瀏覽都 UPDATE 一次是全站最頻繁的寫入；改成 Redis 累加、
//      每 30 秒把增量刷回資料庫，把 N 次寫入壓成 1 次。
//   3. 熱查詢 ─ 首頁與排行榜的 ORDER BY views DESC 是最重的幾支查詢，快取 30 秒。

import { createClient } from 'redis';

const URL = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '';

export let redis = null;
export const hasRedis = !!URL;

if (URL) {
  redis = createClient({
    url: URL,
    socket: {
      // Railway 內網偶爾會斷，重連採指數退避，最多等 3 秒
      reconnectStrategy: n => Math.min(n * 200, 3000),
    },
  });
  // 沒有 error listener 的話，連線中斷會直接讓 process 掛掉
  redis.on('error', e => console.error('[redis]', e.message));
  await redis.connect();
  console.log('[redis] connected');
} else {
  console.log('[redis] REDIS_URL 未設定，session 用 MemoryStore、計數直接寫 DB');
}

// ===== 1. session store =====
//
// connect-redis 從 v7 起改成**具名匯出** `{ RedisStore }`，沒有 default。
// 寫成 `const { default: RedisStore }` 會拿到 undefined，
// 到 `new RedisStore(...)` 才炸成 TypeError——而且只會在正式環境炸：
// 本機沒有 REDIS_URL，這個函式在第一行就 return 了，整段從來沒被執行過。
//
// 所以這裡除了修匯出方式，也加上防護：session store 建不起來就退回
// MemoryStore 並記一筆錯誤。session 存哪裡是效能與體驗問題，
// **不該讓整個站台起不來**。
export async function sessionStore() {
  if (!redis) return undefined;                 // undefined = express-session 用預設 MemoryStore
  try {
    const { RedisStore } = await import('connect-redis');
    if (typeof RedisStore !== 'function')
      throw new TypeError('connect-redis 沒有匯出 RedisStore，套件版本可能不相容');
    return new RedisStore({ client: redis, prefix: 'sess:' });
  } catch (e) {
    console.error('[redis] session store 建立失敗，退回 MemoryStore：' + e.message);
    return undefined;
  }
}

// ===== 2. 人氣計數 write-behind =====
// bumpHits() 只在 Redis 累加；flush() 定時把增量合併回 DB。
// 掉一次 flush 最多少算 30 秒的人氣，這個代價換掉每次瀏覽一次磁碟寫入，划算。
const HITS_KEY = 'hits:pending';               // hash: userId -> 增量
const pendingLocal = new Map();                // 沒有 Redis 時的本機退回

export async function bumpVisit(userId) {
  // ⚠ 這裡**一定要包 try/catch**。這是全檔唯一一個沒有包的 Redis 呼叫，
  // 而呼叫端（src/server.js 的個人小站首頁）是 await——
  // Redis 一斷線，`/某人` 就對**所有人（包含訪客）**回 500。
  // 實測：Redis 停掉之後 `/`、`/login`、`/某人/blog` 都還是 200，只有 `/某人` 掛。
  // 人氣計數是全站最不重要的數字，不該有能力打掛頁面。
  if (redis) {
    try { await redis.hIncrBy(HITS_KEY, String(userId), 1); return false; }
    catch (e) {
      // Redis 掛了就退回「呼叫端自己寫 DB」。
      // ⚠ 這裡**不要**同時塞進 pendingLocal——那會在 Redis 復原後被
      // flushVisits 再算一次，變成重複計數。
      console.error('[redis] 人氣計數失敗，改直接寫 DB：', e.message);
      return true;
    }
  }
  pendingLocal.set(userId, (pendingLocal.get(userId) || 0) + 1);
  return true;                                  // true = 呼叫端自己寫 DB
}

// 把累積的增量刷回資料庫。applyFn(userId, n) 由 db 層提供。
export async function flushVisits(applyFn) {
  let entries;
  if (redis) {
    const h = await redis.hGetAll(HITS_KEY);
    if (!Object.keys(h).length) return 0;
    await redis.del(HITS_KEY);                  // 先取後刪：極端情況寧可少算，不要重複算
    entries = Object.entries(h).map(([k, v]) => [Number(k), Number(v)]);
  } else {
    if (!pendingLocal.size) return 0;
    entries = [...pendingLocal.entries()];
    pendingLocal.clear();
  }
  for (const [id, n] of entries) await applyFn(id, n);
  return entries.length;
}

export function startVisitFlusher(applyFn, ms = 30_000) {
  const t = setInterval(() => flushVisits(applyFn).catch(e => console.error('[hits]', e.message)), ms);
  t.unref?.();
  // ⚠ 這裡原本自己註冊 SIGTERM/SIGINT，把人氣刷回去之後就 process.exit(0)。
  // 那等於「一個計數用的小工具擁有整個行程的生殺大權」——收到訊號的當下
  // 立刻結束，**不等 HTTP 連線收尾、不等正在跑的 handler**。
  //
  // Railway 每次重新部署、重啟、擴縮容都是先送 SIGTERM，所以這不是罕見時機，
  // 是每部署一次就截斷一次：正在上傳照片的請求會停在「檔案已經寫進 R2、
  // photos 那幾筆 INSERT 還沒下去」的中間——瀏覽器只看到連線中斷，
  // 相簿裡什麼都沒有，而 R2 上多了永遠沒人參照卻要一直付錢的物件。
  // 刪帳號、切割照片、註冊（INSERT users 之後、INSERT albums 之前）同理。
  //
  // 關機流程改由 src/server.js 統一負責（那裡才拿得到 http server 可以排空），
  // 這一支只回傳「把手上的增量寫回去」這件事給它呼叫。
  return { timer: t, flush: () => flushVisits(applyFn) };
}

// ===== 3. 熱查詢快取 =====
// cached('home', 30, () => …) ── 命中就回快取，沒命中就跑一次並存起來。
export async function cached(key, seconds, fn) {
  if (!redis) return fn();
  try {
    const hit = await redis.get('q:' + key);
    if (hit) return JSON.parse(hit);
  } catch { /* 快取讀失敗不能影響出頁 */ }
  const val = await fn();
  try { await redis.setEx('q:' + key, seconds, JSON.stringify(val)); } catch { }
  return val;
}

// 資料變動時清掉相關快取；傳前綴，例如 bust('home')
export async function bust(...keys) {
  if (!redis) return;
  try { await redis.del(keys.map(k => 'q:' + k)); } catch { }
}

// 關機時把 Redis 連線收乾淨。沒有 Redis（本機開發）就什麼都不做。
// quit() 會等待手上的指令跑完再斷；不呼叫的話 node 會被這條連線拖住不結束。
export async function closeRedis(){
  if (!redis) return;
  try { await redis.quit(); } catch { try { redis.disconnect(); } catch {} }
  redis = null;
}
