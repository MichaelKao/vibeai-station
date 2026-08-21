// 寄信（Resend）
// ═══════════════════════════════════════════════════════════════════════
// 站上只有一個功能真的需要寄信：**忘記密碼**。
//
// 為什麼只做這一個：原站的帳號是 Yahoo ID，密碼救援走 Yahoo；我們自己做
// 帳號系統，就得自己承擔這件事。在這之前 views/help.ejs 寫的是
// 「忘記密碼？目前請聯絡站長協助」——那句話在開放給陌生人之後不可行。
// 其他通知（新留言、新迴響）站內已經有 sysmsg，原站當年也不寄信，不加。
//
// ── 沒有金鑰時的行為 ──────────────────────────────────────────────────
// ⚠ 沒設 RESEND_API_KEY 就**不寄、但不當機**，跟 Redis／R2 同一套原則：
// 外部服務是加分項，不該讓站起不來或讓請求 500。
// 本機開發時信會印在 console 上（連結照樣可以複製來測），
// /healthz 也會如實回報 mail 這一欄是 off。
//
// ⚠ 金鑰永遠不進 log。連錯誤訊息都只印狀態碼與 Resend 回的 message。
const KEY  = process.env.RESEND_API_KEY || '';
const FROM = process.env.MAIL_FROM || 'vibeai 小站 <no-reply@send.vibeaico.com>';

export const hasMail = !!KEY;

/** 現在的寄信狀態，給 /healthz 用。不洩漏任何金鑰內容。 */
export const mailState = () => (hasMail ? 'resend' : 'off');

/**
 * 寄一封信。**不會 throw**——寄不出去是「這一次沒寄成功」，
 * 不該讓呼叫端的請求爆掉（忘記密碼那條路尤其不能爆）。
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function sendMail({ to, subject, html, text }) {
  if (!to || !subject) return { ok: false, error: '缺少收件人或主旨' };

  if (!hasMail) {
    // 本機開發：印出來讓人可以直接複製連結測試。
    console.log('─'.repeat(60));
    console.log('[mail] 沒有 RESEND_API_KEY，這封信只印在這裡：');
    console.log('[mail] 收件人：', to);
    console.log('[mail] 主旨　：', subject);
    console.log('[mail] 內容　：\n' + (text || String(html || '').replace(/<[^>]+>/g, ' ')));
    console.log('─'.repeat(60));
    return { ok: false, error: '沒有設定寄信服務（本機開發模式，內容已印在 log）' };
  }

  try {
    // 逾時要短。忘記密碼那一頁在等這個回來，使用者盯著空白畫面。
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      // ⚠ 只印狀態碼與對方回的訊息，**不要**把 headers 或請求內容印出來，
      // 那裡面有金鑰。
      let msg = '';
      try { msg = (await r.json())?.message || ''; } catch { }
      console.error(`[mail] Resend 回 ${r.status} ${msg}`.trim());
      return { ok: false, error: `寄信服務回了 ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[mail] 寄不出去：', e.name === 'TimeoutError' ? '逾時（8 秒）' : e.message);
    return { ok: false, error: '寄信服務暫時沒有回應' };
  }
}

/** 忘記密碼信。文案用站上一貫的口吻，不要用系統通知的語氣。 */
export function resetMail({ nick, name, link, minutes }) {
  const safe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const text =
`${nick} 你好，

有人（希望是你）要求重設 vibeai 小站帳號「${name}」的密碼。
點下面這個連結就可以設定新密碼：

${link}

這個連結 ${minutes} 分鐘後失效，而且只能用一次。
如果不是你要求的，這封信可以直接刪掉，你的密碼不會有任何變動。

— vibeai 小站`;

  const html =
`<div style="font-family:'微軟正黑體',Arial,sans-serif;font-size:14px;line-height:1.8;color:#333">
  <p>${safe(nick)} 你好，</p>
  <p>有人（希望是你）要求重設 vibeai 小站帳號「<b>${safe(name)}</b>」的密碼。<br>
     點下面這個按鈕就可以設定新密碼：</p>
  <p><a href="${safe(link)}"
        style="display:inline-block;padding:10px 20px;background:#c30;color:#fff;
               text-decoration:none;border-radius:3px">設定新密碼</a></p>
  <p style="color:#666;font-size:13px">
     按鈕點不開的話，把這個網址複製到瀏覽器：<br>
     <span style="word-break:break-all">${safe(link)}</span></p>
  <p style="color:#666;font-size:13px">
     這個連結 ${minutes} 分鐘後失效，而且只能用一次。<br>
     如果不是你要求的，這封信可以直接刪掉，你的密碼不會有任何變動。</p>
  <p style="color:#999;font-size:12px">— vibeai 小站</p>
</div>`;

  return { subject: '重設你的 vibeai 小站密碼', text, html };
}
