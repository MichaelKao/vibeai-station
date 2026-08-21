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

// 成對標記：用線性掃描，不要用正規表示式。
//
// ⚠ 原本四個標記都寫成 /\[b\]([\s\S]*?)\[\/b\]/gi 這種形式。惰性量詞碰到
// 「有開沒關」的內容會退化成 O(n²)：每一個 [b] 都得往後掃到文末才確定沒有
// 收尾標記，下一個 [b] 再掃一次。改版前實測：
//     12 萬字的 [b]          → 647ms
//     48 萬字的 [color=#fff] → 3682ms
// 全部卡在 event loop 上，那幾秒整台站誰都連不進來。而且內文是**存起來**的，
// 一篇貼好之後每一次瀏覽都重算一次，任何人不用登入就能把站拖垮。
//
// 下面兩支的配對規則和原本的惰性量詞一致——開頭標記配「它後面最近的」收尾
// 標記，配到的內容不再往內遞迴——所以輸出一個字都不會變。差別只在找不到收尾
// 標記時整個停手（後面的開頭標記更不可能找到收尾），總成本是線性的。
function pairTag(h, name, open, close){
  const lower = h.toLowerCase();
  const o = '[' + name + ']', c = '[/' + name + ']';
  let out = '', from = 0;
  for(;;){
    const i = lower.indexOf(o, from);
    if (i < 0) break;
    const j = lower.indexOf(c, i + o.length);
    if (j < 0) break;
    out += h.slice(from, i) + open + h.slice(i + o.length, j) + close;
    from = j + c.length;
  }
  return out + h.slice(from);
}

// [color=…] 多一段屬性要驗。這裡刻意複製舊正規表示式的兩段行為，
// 連它的怪癖一起留著——這次改動只為了速度，語意不能動：
//   1. 屬性字元集是 [#a-zA-Z0-9]{3,20}。長度或字元不合 → 舊版在這個位置
//      「根本沒配到」，指標只前進一格，後面的 [/color] 還留給別人用。
//   2. 字元集合格但顏色不合法（像 #gg）→ 舊版**配到了**整段，callback 回傳
//      原字串，但 lastIndex 已經跳過那個 [/color]。所以那個收尾標記會被吃掉，
//      後面真正合法的 [color=…] 就配不到它。看起來像 bug，但那是既有行為，
//      改掉會讓舊文章的畫面跟著變。
//
// 兩個地方會讓「線性」偷偷變回 O(n²)，都要擋掉：
//   · 找不到 [/color] 時要**整個停手**，不能只跳過這一個開頭標記——
//     不然 [color=#fff] 重複四萬次會每次都往後掃到文末（實測 7.8 秒）。
//   · 屬性不合法而不吃掉收尾標記時，下一輪不要重新掃一次同一個 [/color]，
//     用 jCache 記住上次找到的位置。
function colorTag(h){
  const lower = h.toLowerCase();
  let out = '', from = 0, jCache = -1, jFrom = -1;
  for(;;){
    const i = lower.indexOf('[color=', from);
    if (i < 0) break;
    const e = lower.indexOf(']', i + 7);
    if (e < 0) break;
    const c = h.slice(i + 7, e);
    // 字元集／長度不合：等同舊版在此處沒有配到，收尾標記留給後面的人
    if (!/^[#a-zA-Z0-9]{3,20}$/.test(c)){
      out += h.slice(from, i + 7);
      from = i + 7;
      continue;
    }
    if (jCache < e + 1 || jFrom > e + 1){
      jCache = lower.indexOf('[/color]', e + 1);
      jFrom = e + 1;
    }
    if (jCache < 0) break;              // 之後的開頭標記也不可能找到收尾
    const j = jCache;
    if (/^#[0-9a-f]{3,6}$/i.test(c) || /^[a-z]+$/i.test(c))
      out += h.slice(from, i) + '<span style="color:' + c + '">' + h.slice(e + 1, j) + '</span>';
    else
      out += h.slice(from, j + 8);      // 顏色不合法：原樣留著，但收尾標記一起吃掉
    from = j + 8;
  }
  return out + h.slice(from);
}


export function render(body){
  let h = esc(body);

  // [img]網址[/img]
  h = h.replace(/\[img\]([^\[\]]+)\[\/img\]/gi, (m, u) => {
    const url = safeUrl(u.replace(/&amp;/g,'&').trim());
    return url ? `<img class="inpost" src="${esc(url)}" alt="">` : m;
  });

  // [b] [i] [u]
  h = pairTag(h, 'b', '<b>', '</b>');
  h = pairTag(h, 'i', '<i>', '</i>');
  h = pairTag(h, 'u', '<u>', '</u>');

  // [color=#abc]文字[/color]（只收合法色碼與英文色名）
  h = colorTag(h);

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
