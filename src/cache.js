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
export async function sessionStore() {
  if (!redis) return undefined;                 // undefined = express-session 用預設 MemoryStore
  const { default: RedisStore } = await import('connect-redis');
  return new RedisStore({ client: redis, prefix: 'sess:' });
}

// ===== 2. 人氣計數 write-behind =====
// bumpHits() 只在 Redis 累加；flush() 定時把增量合併回 DB。
// 掉一次 flush 最多少算 30 秒的人氣，這個代價換掉每次瀏覽一次磁碟寫入，划算。
const HITS_KEY = 'hits:pending';               // hash: userId -> 增量
const pendingLocal = new Map();                // 沒有 Redis 時的本機退回

export async function bumpVisit(userId) {
  if (redis) { await redis.hIncrBy(HITS_KEY, String(userId), 1); return false; }
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
  // 收工前把手上的增量寫回去，不要讓最後 30 秒的人氣消失
  for (const sig of ['SIGTERM', 'SIGINT'])
    process.once(sig, () => flushVisits(applyFn).finally(() => process.exit(0)));
  return t;
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
