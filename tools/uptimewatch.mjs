// 盯著線上站，把每一次「連不上／非 200」記下來，附時間。
//
// 用途：部署期間到底有沒有真的中斷？Railway 的「Deploy Crashed」信可能是
// 舊容器交接時被算成 crash（使用者沒感覺），也可能是新容器真的起不來
// （使用者會看到 502）。這兩種的修法完全不同，要用數字分辨。
//
//   URL=https://station.vibeaico.com/healthz SECS=600 node tools/uptimewatch.mjs
const URL = process.env.URL || 'https://station.vibeaico.com/healthz';
const SECS = +(process.env.SECS || 600);
const EVERY = +(process.env.EVERY || 5000);

const t0 = Date.now();
let ok = 0, bad = 0;
const events = [];
const stamp = () => new Date().toTimeString().slice(0, 8);

while (Date.now() - t0 < SECS * 1000) {
  const a = Date.now();
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const ms = Date.now() - a;
    if (r.ok) { ok++; if (events.at(-1)?.bad) events.push({ t: stamp(), bad: false, note: '恢復' }); }
    else { bad++; events.push({ t: stamp(), bad: true, note: 'HTTP ' + r.status + ' (' + ms + 'ms)' }); }
  } catch (e) {
    bad++;
    events.push({ t: stamp(), bad: true, note: (e.cause?.code || e.name || e.message).toString().slice(0, 40) });
  }
  await new Promise(r => setTimeout(r, EVERY));
}
console.log(`\n${URL}`);
console.log(`監看 ${SECS}s：成功 ${ok} 次、失敗 ${bad} 次`);
if (!events.length) console.log('全程沒有任何一次失敗 ✓');
else for (const e of events) console.log(`  ${e.t}  ${e.bad ? '✗' : '✓'} ${e.note}`);
