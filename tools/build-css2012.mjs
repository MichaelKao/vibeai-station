// 2012 版樣式管線。
//
// 不重寫原始 CSS——直接用無名當年那份 92KB 的 wfp-css，只做兩件事：
//   1. 把 url(../img/xxx) 換成我們的素材位置
//   2. 檢查每一個被引用的圖檔是不是真的抓到了，沒抓到就明確列出來
//
// 這樣做的理由：手抄 92KB 的 CSS 必然會抄錯，而原始檔本身就是最準的規格。
//
//   node tools/build-css2012.mjs                    → 產生 public/wretch2012.css（指向本機素材）
//   ASSET_BASE=https://…/wretch2012 node tools/build-css2012.mjs   → 指向 R2

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('assets_src2');
const IMG_OUT = path.resolve('public/img/wretch2012');
const CSS_OUT = path.resolve('public/wretch2012.css');
const BASE = (process.env.ASSET_BASE || '/img/wretch2012').replace(/\/$/, '');

// 依序串接：YUI reset+fonts 是字級基準，一定要在版面主檔之前。
const PARTS = [
  ['YUI 3.2.0 reset + fonts（字級基準，原站就是載這個）', 'css/index_yui320_reset-fonts.css', null],
  ['首頁版面主檔 wfp-css_201205171100.css（2012-05～關站未再改動）', 'css/index_wfp-css_201205171100.css', 'index'],
  ['chameleon.css（換膚／腰帶寬度覆蓋）', 'css/index_chameleon.css', 'index'],
];

// 素材：assets_src2/img/<代號>/ → public/img/wretch2012/<代號>/
const IMG_GROUPS = ['index', 'chrome', 'album', 'blog', 'gb', 'common'];

fs.rmSync(IMG_OUT, { recursive: true, force: true });
let copied = 0;
const have = new Map();                        // 代號 → Set(檔名)
for (const g of IMG_GROUPS) {
  const from = path.join(SRC, 'img', g);
  if (!fs.existsSync(from)) continue;
  const to = path.join(IMG_OUT, g);
  fs.mkdirSync(to, { recursive: true });
  const names = new Set();
  for (const f of fs.readdirSync(from)) {
    if (fs.statSync(path.join(from, f)).isDirectory()) continue;
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    names.add(f); copied++;
  }
  have.set(g, names);
  console.log(`  素材 ${g}/  ${names.size} 檔`);
}

const missing = new Set();
const chunks = [];
for (const [title, rel, group] of PARTS) {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) { console.error(`  !! 缺檔 ${rel}`); continue; }
  let css = fs.readFileSync(p, 'utf8');
  if (group) {
    css = css.replace(/url\((['"]?)\.\.\/img\/([^)'"]+)\1\)/g, (m, q, file) => {
      const name = file.split('?')[0].split('/').pop();
      if (!have.get(group)?.has(name)) missing.add(`${group}/${name}`);
      return `url(${BASE}/${group}/${name})`;
    });
  }
  chunks.push(`/* ===== ${title} ===== */\n${css}`);
}

const header = `/* 無名小站 2012 最後版樣式
 *
 * 這個檔是 tools/build-css2012.mjs 產生的，**請不要手改**——
 * 改了下次重建就會被蓋掉。要調整請改 assets_src2/css/ 底下的來源，或改建置腳本。
 *
 * 內容是無名當年的原始 CSS，只把 url(../img/…) 改指到 ${BASE}/。
 * 版面主檔 wfp-css_201205171100.css 從 2012-05 到 2013 關站都沒再改過
 * （已 diff 過 2013 末版，只多了關站公告框的 .notification 一組規則）。
 * 出處與逐條說明見 assets_src2/spec/index.md。
 */
`;

fs.writeFileSync(CSS_OUT, header + chunks.join('\n\n'), 'utf8');
const kb = (fs.statSync(CSS_OUT).size / 1024).toFixed(1);
console.log(`\n→ ${CSS_OUT}  ${kb} KB　素材共 ${copied} 檔　素材前綴 ${BASE}`);

if (missing.size) {
  console.log(`\n!! CSS 有引用但素材沒抓到（${missing.size} 個）：`);
  for (const m of [...missing].sort()) console.log('   ' + m);
  console.log('   → 這些位置在畫面上會是空白，要回 Wayback 補抓。');
} else {
  console.log('\n所有被引用的素材都到齊了。');
}
