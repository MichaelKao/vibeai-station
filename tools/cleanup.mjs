// 把測試帳號真的刪掉，並回報刪掉沒有。
//
// ⚠ 為什麼要抽成共用的一支：這個坑踩過兩次。
// shotsweep 原本只印 `[清理] 測試帳號 X` 就結束，根本沒刪；對正式站跑了
// 兩輪之後，人氣排行第 42～44 名全是測試帳號。修好 shotsweep 之後我沒有
// 回頭查其他工具，於是 safaricheck 與 mobileupload 用同樣的寫法繼續留垃圾
// ——後來在正式站上又撿到 sfr7592。
//
// 教訓有兩層：
//   1. 訊息說做了、實際沒做，比不印還糟——看的人會以為清乾淨了。
//   2. 同一個坑修一處不算修完，要回頭查有沒有別處是照抄的。
// 所以現在只有這一份實作，而且它**驗過才回報**。
//
// 刪除走帳號自己的路徑（要密碼）。密碼對不上就跳過不動——萬一哪天測試
// 名稱撞到真人的帳號，這一道會擋住。
export async function deleteTestAccount(BASE, name, pass = 'test1234') {
  const form = o => new URLSearchParams(o).toString();
  const H = { 'content-type': 'application/x-www-form-urlencoded', origin: BASE };
  try {
    const r = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual',
      headers: H, body: form({ name, pass }) });
    const ck = r.headers.getSetCookie()?.[0]?.split(';')[0];
    if (r.status === 302 && ck) {
      await fetch(BASE + `/${name}/settings/delete`, { method: 'POST', redirect: 'manual',
        headers: { ...H, cookie: ck, referer: BASE + `/${name}/settings` },
        body: form({ pass }) });
    }
    // 一定要回頭確認。刪除請求回 302 不代表帳號真的沒了。
    const gone = (await fetch(BASE + '/' + name)).status === 404;
    console.log(`[清理] 測試帳號 ${name}：${gone ? '已刪除' : '⚠ 刪不掉，請手動處理'}`);
    return gone;
  } catch (e) {
    console.log(`[清理] 測試帳號 ${name}：⚠ 刪除時出錯（${e.message.slice(0, 40)}），請手動處理`);
    return false;
  }
}
