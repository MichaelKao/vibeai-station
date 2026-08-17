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
