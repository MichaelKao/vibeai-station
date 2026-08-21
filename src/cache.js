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

// ⚠ **啟動不能被 Redis 綁架**。
//
// 這一段原本是 `await redis.connect()`，而 reconnectStrategy 永遠回傳數字、
// 從不回傳 Error——node-redis 於是無限重連，connect() 的 promise 既不 resolve
// 也不 reject。因為它是 ESM 的頂層 await，src/server.js 的 import 永遠不會完成，
// app.listen 永遠不會執行，連 /healthz 都沒開。
//
// 實測（REDIS_URL 指到沒有東西在聽的 port）：25 秒過去只是一行一行印
// [redis] connect ECONNREFUSED，port 從頭到尾沒有被監聽。
//
// 正式站的情境：Railway 的 Redis 附加服務重啟、或內網暫時不通時剛好碰到部署，
// 應用程式就無限期不綁 port——健康檢查一路失敗、邊緣回 502，
// log 看起來像「部署卡住」而不是「Redis 掛了」，而且 Redis 回來之前不會自己好。
//
// session 存哪裡、人氣怎麼算，都是效能與體驗問題，**不該讓整個站台起不來**。
// 所以：等最多 5 秒，連不上就降級（session 退回 MemoryStore、人氣直接寫 DB），
// 站照樣起得來，/healthz 會如實回報 redis 這一欄是 memory。
const CONNECT_TIMEOUT_MS = 5000;
export let redisReady = false;

if (URL) {
  redis = createClient({
    url: URL,
    socket: {
      // Railway 內網偶爾會斷，重連採指數退避，最多等 3 秒。
      // ⚠ 一定要有放棄條件（回傳 Error）：一直回數字等於「永遠重連」，
      // 那正是上面說的無限期卡住。
      reconnectStrategy: n => (n > 20 ? new Error('Redis 重連 20 次都失敗，放棄') : Math.min(n * 200, 3000)),
    },
  });
  // 沒有 error listener 的話，連線中斷會直接讓 process 掛掉
  redis.on('error', e => console.error('[redis]', e.message));

  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`連線超過 ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS).unref?.());
  try {
    await Promise.race([redis.connect(), timeout]);
    redisReady = true;
    console.log('[redis] connected');
  } catch (e) {
    console.error(`[redis] 連不上（${e.message}），降級：session 用 MemoryStore、人氣直接寫 DB。站照常啟動。`);
    try { redis.destroy?.() ?? redis.disconnect?.(); } catch { }
    redis = null;
  }
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
    return degradeOnError(new RedisStore({ client: redis, prefix: 'sess:' }));
  } catch (e) {
    console.error('[redis] session store 建立失敗，退回 MemoryStore：' + e.message);
    return undefined;
  }
}

// Redis 在**運作中**掛掉時，讓 session 讀寫安靜地失敗，而不是把整頁弄爆。
//
// ⚠ express-session 在 store.get() 失敗時直接 next(err)，這條路上沒有任何降級。
// Redis 一斷，凡是瀏覽器帶了 sess cookie 的請求（＝所有登入者，以及任何因為
// flash／背景音樂建過 session 的訪客）都會先等到 node-redis 的指令逾時
// （實測穩定 5 秒）才進錯誤處理，看到「伺服器發生錯誤」。
// 使用者連 /login 都是同一頁，沒辦法用「重新登入」自救，只能自己清 cookie；
// 而且每個請求都佔住一條連線 5 秒，流量一來就把併發吃光，
// 連還能正常服務的匿名頁面也一起被拖垮。
//
// 包一層之後：get 失敗當成「沒有這個 session」（等同被登出，重新登入就好），
// set/touch 失敗就當作寫過了。站是活的，登入狀態掉了——比整站 500 好得多。
// 失敗會印 log，也會讓 /healthz 的 redis 標成 degraded。
export let redisDegraded = false;
function degradeOnError(store) {
  const warn = (op, e) => {
    if (!redisDegraded) console.error(`[redis] session ${op} 失敗，暫時當成未登入：${e.message}`);
    redisDegraded = true;
  };
  const get = store.get.bind(store);
  store.get = (sid, cb) => {
    try { get(sid, (e, sess) => e ? (warn('get', e), cb(null, null)) : cb(null, sess)); }
    catch (e) { warn('get', e); cb(null, null); }
  };
  for (const op of ['set', 'touch', 'destroy']) {
    const fn = store[op]?.bind(store);
    if (!fn) continue;
    store[op] = (...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      try { fn(...args, e => { if (e) warn(op, e); cb?.(null); }); }
      catch (e) { warn(op, e); cb?.(null); }
    };
  }
  return store;
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

// /healthz 用：現在到底是什麼狀態。
//   redis     連上了，正常
//   degraded  連上過但運作中出過錯（session 讀寫失敗過），資料可能不完整
//   memory    沒設定或連不上，session 在記憶體裡——**重新部署大家會一起被登出**
export function redisState(){
  if (!redis || !redisReady) return 'memory';
  return redisDegraded ? 'degraded' : 'redis';
}
