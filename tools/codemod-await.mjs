// 把 src/server.js 從「同步 SQLite」改成「非同步資料層」的轉換器。
//
// 用真正的 JS 語法解析器（acorn），不是正則。
//
// 第一版是手寫掃描器（自己配對括號、自己標字串範圍），連續踩了三個坑：
//   1. 往前看的視窗只有 7 字元，比 'function ' 短，於是把
//      `function quotaError(` 改成 `function await quotaError(`。
//   2. 用 /\.$/ 判斷「前面是成員存取就跳過」，結果把展開運算子 `...blogSide(res)`
//      也判成成員存取，整批漏掉。
//   3. 字串遮罩在某處失步，後半個檔案整片被當成字串，一個都沒轉到。
// 三個都是「手寫 parser」這個決定的必然產物，所以換成 acorn。
//
// 轉換規則：
//   - 目標呼叫（資料層與會用到資料層的輔助函式）前面補 await
//   - 已經在 AwaitExpression 底下的不重複加
//   - 呼叫結果馬上取屬性時要包起來：one(...).c → (await one(...)).c
//     不包的話 `await one(...).c` 會先對 Promise 取 .c 得到 undefined 再 await，
//     **不會拋錯**，只會讓所有計數靜靜變成空的（全檔有 19 處是這種寫法）
//   - 包含目標呼叫的函式，自己也要變成 async
//
// 轉換完會自己再解析一次驗證：還有沒 await 到的就報錯退出，不寫檔。
//
//   node tools/codemod-await.mjs --check   只報告，不寫檔
//   node tools/codemod-await.mjs           實際改寫（原檔備份為 .bak）

import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const FILE = path.resolve('src/server.js');
const CHECK = process.argv.includes('--check');

// 這些呼叫回傳 Promise：資料層本身，加上函式體內用到資料層的輔助函式。
const ASYNC_CALLS = new Set([
  'one', 'all', 'run', 'exec',
  'usedBytes', 'quotaError', 'isFriend', 'act', 'bumpHits',
  'calendar', 'blogSide', 'myPhotos', 'albumAllowed',
]);

const parse = code => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

// 走訪整棵樹，對每個節點呼叫 fn(node, parents)
function walk(node, fn, parents = []) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parents);
  const next = [...parents, node];
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, fn, next); }
    else if (v && typeof v.type === 'string') walk(v, fn, next);
  }
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function analyse(code) {
  const ast = parse(code);
  const calls = [];                  // 需要加 await 的呼叫
  const fnsNeedingAsync = new Set(); // 內含目標呼叫、因此必須是 async 的函式

  walk(ast, (node, parents) => {
    if (node.type !== 'CallExpression') return;
    if (node.callee.type !== 'Identifier') return;      // 排除 db.run(...) 這種成員呼叫
    if (!ASYNC_CALLS.has(node.callee.name)) return;

    // 最近的一層函式必須是 async
    for (let i = parents.length - 1; i >= 0; i--) {
      if (FN_TYPES.has(parents[i].type)) { fnsNeedingAsync.add(parents[i]); break; }
    }

    const parent = parents[parents.length - 1];
    if (parent && parent.type === 'AwaitExpression') return;   // 已經 await 過

    // 呼叫結果馬上被取屬性？（one(...).c）
    const memberAccess = parent && parent.type === 'MemberExpression' && parent.object === node;
    calls.push({ start: node.start, end: node.end, memberAccess, name: node.callee.name });
  });

  return { calls, fnsNeedingAsync };
}

const src = fs.readFileSync(FILE, 'utf8');
const { calls, fnsNeedingAsync } = analyse(src);
const asyncFns = [...fnsNeedingAsync].filter(f => !f.async);

// 由後往前套用，位置才不會位移
const edits = [
  ...calls.map(c => ({ pos: c.start, kind: 'await', ...c })),
  ...asyncFns.map(f => ({ pos: f.start, kind: 'async' })),
].sort((a, b) => b.pos - a.pos);

let out = src;
for (const e of edits) {
  if (e.kind === 'await') {
    const call = out.slice(e.start, e.end);
    out = out.slice(0, e.start)
      + (e.memberAccess ? `(await ${call})` : `await ${call}`)
      + out.slice(e.end);
  } else {
    out = out.slice(0, e.pos) + 'async ' + out.slice(e.pos);
  }
}

const memberFixes = calls.filter(c => c.memberAccess).length;
console.log(`資料層呼叫加 await：${calls.length} 處（其中 ${memberFixes} 處是「呼叫後取屬性」，已包成 (await …).x）`);
console.log(`函式補 async：${asyncFns.length} 個`);

// ── 自我驗證：重新解析，確認沒有漏網 ────────────────────────────────────────
let err = null;
try {
  const after = analyse(out);
  if (after.calls.length)
    err = `還有 ${after.calls.length} 個目標呼叫沒有 await：\n` +
      after.calls.slice(0, 10).map(c =>
        `    第 ${out.slice(0, c.start).split('\n').length} 行  ${c.name}(...)`).join('\n');
  const stillSync = [...after.fnsNeedingAsync].filter(f => !f.async);
  if (stillSync.length)
    err = (err ? err + '\n' : '') + `還有 ${stillSync.length} 個含資料層呼叫的函式不是 async`;
} catch (e) {
  err = '轉換後的程式碼解析失敗：' + e.message;
}

if (err) { console.error('\n驗證未通過：\n' + err); process.exit(1); }
console.log('自我驗證通過：沒有漏掉的呼叫，轉換後語法正確。');

if (CHECK) { console.log('\n--check：沒有寫檔'); process.exit(0); }

fs.writeFileSync(FILE + '.bak', src, 'utf8');
fs.writeFileSync(FILE, out, 'utf8');
console.log(`\n已改寫 ${FILE}（原檔備份為 server.js.bak）`);
