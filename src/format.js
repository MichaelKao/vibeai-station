// 文章內文格式化：支援當年常見的簡單標記，輸出前一律先 escape，
// 只有白名單標記才會變成 HTML，使用者無法插入任意 HTML／script。

const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

const safeUrl = u => {
  try { return ['http:','https:'].includes(new URL(u).protocol) ? u : ''; }
  catch { return u.startsWith('/uploads/') ? u : ''; }
};

// 顏文字（點一下插入，顯示時轉成圖示文字）
export const EMOTES = [
  [':)','🙂'], [':(','🙁'], [':D','😄'], ['XD','😆'], [';)','😉'],
  [':P','😛'], ['T_T','😢'], ['^^','😊'], ['>_<','😣'], ['O_O','😮'],
  ['<3','❤'], ['*_*','😍'], ['zzz','😴'], ['orz','🙇'],
];

// 使用者自訂 CSS 的過濾（無名的靈魂功能，不能拿掉，但要真的擋得住）。
//
// 這段內容會被原樣塞進 <style>…</style>，所以只要能讓瀏覽器提早結束樣式區塊，
// 就等於任意 HTML 注入。
//
// 原本寫成 css.replace(/<\/style/gi,'') 是**錯的**：單次取代可以被繞過——
//   輸入 `<</style/style>alert`  →  取代掉中間那段之後，剩下的字元重新拼成 `</style>`
// 正確做法是不要玩「移除危險字串」的貓捉老鼠，直接讓 `<` `>` 不可能出現：
// 合法的 CSS 幾乎用不到角括號，全部拿掉不影響正常使用者。
//
// 另外擋掉幾個會讓 CSS 變成執行入口的老東西：
//   expression()  舊 IE 可以在 CSS 裡跑 JS
//   javascript: / vbscript: / data:text/html   url() 裡的可執行協定
//   behavior: / -moz-binding                   把外部檔案綁成行為
//   @import                                    可以再拉一份不受控的樣式進來
// 依「字」截斷，不要用 String.prototype.slice。
//
// slice 是用 UTF-16 code unit 數的，emoji 與部分漢字佔兩個 unit，
// 剛好切在中間就會留下一個**孤兒代理對**，存進資料庫再讀出來變成 U+FFFD（�）。
// 暱稱只要中了這個，站上每一頁印到那個人的地方都會有一個問號方塊。
// [...s] 走的是 code point，切不壞。
export function cut(s, max) {
  const a = [...String(s ?? '')];
  return a.length <= max ? a.join('') : a.slice(0, max).join('');
}

export function safeCss(css, max = 20000){
  return String(css ?? '')
    .slice(0, max)
    .replace(/[<>]/g, '')                                   // 不可能提早關掉 <style>
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/(javascript|vbscript|livescript)\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'blocked:')
    .replace(/(behavior|-moz-binding)\s*:/gi, 'blocked:')
    .replace(/@\s*import/gi, '@blocked');
}

export function render(body){
  let h = esc(body);

  // [img]網址[/img]
  h = h.replace(/\[img\]([^\[\]]+)\[\/img\]/gi, (m, u) => {
    const url = safeUrl(u.replace(/&amp;/g,'&').trim());
    return url ? `<img class="inpost" src="${esc(url)}" alt="">` : m;
  });

  // [b] [i] [u]
  h = h.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<b>$1</b>')
       .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<i>$1</i>')
       .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');

  // [color=#abc]文字[/color]（只收合法色碼與英文色名）
  h = h.replace(/\[color=([#a-zA-Z0-9]{3,20})\]([\s\S]*?)\[\/color\]/gi,
    (m,c,t) => /^#[0-9a-f]{3,6}$/i.test(c) || /^[a-z]+$/i.test(c) ? `<span style="color:${c}">${t}</span>` : m);

  // 裸網址自動變連結（已 escape 過，所以只會是純文字）
  h = h.replace(/(^|[\s(])((?:https?:\/\/)[^\s<>"']+)/g,
    (m, pre, u) => `${pre}<a href="${u}" rel="nofollow noopener" target="_blank">${u}</a>`);

  // 顏文字
  for (const [k, v] of EMOTES) {
    const k2 = esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(k2, 'g'), v);
  }

  return h.replace(/\n/g, '<br>');
}
