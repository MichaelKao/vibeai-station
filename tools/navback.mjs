// 「點進去之後回得來嗎」——每一種頁面都要有回上一層與回總站的路。
//
// 為什麼需要這一支：
//   tools/linksweep.mjs  爬得到的連結會不會 500（往前走）
//   tools/clickcheck.mjs 連結有沒有被蓋住（點不點得到）
//   這一支                **往回走**：站在這一頁，有沒有路回上一層／回總站
//
// 使用者實際回報的就是這個：從相簿總站點進一本相簿之後，畫面上找不到任何
// 一條回相簿總站的連結（原站唯一的入口是左上角那個「Album」字，看起來像
// 標籤不像連結），只好一路點回首頁。結構檢查與死連結掃描都看不出這種問題，
// 因為每一條連結都是好的——少的是**該有而沒有的那一條**。
//
//   BASE=http://127.0.0.1:3401 node tools/navback.mjs
const BASE = process.env.BASE || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log((cond ? '  PASS ' : '! FAIL ') + name + (cond ? '' : '  ' + extra));
};
const get = async p => {
  const r = await fetch(BASE + p);
  return { status: r.status, html: await r.text() };
};
// 頁面上有沒有一條真的連到 target 的 <a>。比對 href 的完整值，
// 不要用 includes(target)——那會讓 /albums 被 /albums?topic=x 誤判成有。
const linksTo = (html, target) =>
  [...html.matchAll(/<a\b[^>]*?href="([^"]*)"/g)]
    .map(m => m[1].replace(/&amp;/g, '&'))
    .some(h => h === target || h.startsWith(target + '?') || h.startsWith(target + '#'));

// 先問站上真的有哪些內容，不要寫死 id
const albumsPage = (await get('/albums')).html;
const one = (re, from) => (from.match(re) || [])[0] || '';
const albumUrl = one(/\/[a-z0-9_-]+\/album\/\d+/i, albumsPage);
const blogsPage = (await get('/blogs')).html;
const postUrl = one(/\/[a-z0-9_-]+\/blog\/\d+/i, blogsPage);
const user = (albumUrl.match(/^\/([^/]+)\//) || [])[1] || '';
// 文章的作者不一定是相簿那一位，各自取各自的
const buser = postUrl.split('/')[1] || '';
const albumPage = albumUrl ? (await get(albumUrl)).html : '';
const photoUrl = one(/\/[a-z0-9_-]+\/photo\/\d+/i, albumPage);

console.log(`受測內容：相簿 ${albumUrl || '(無)'}　文章 ${postUrl || '(無)'}　照片 ${photoUrl || '(無)'}`);
if (!albumUrl || !postUrl) {
  console.log('\n站上沒有可以測的內容，先跑 node tools/seed-demo.mjs');
  process.exit(2);
}

// 每一種頁面「應該要有」的回頭路。左邊是頁面，右邊是必須出現的連結。
const RULES = [
  [albumUrl,               [['/albums', '相簿總站'], [`/${user}/album`, '這個人的相簿列表'], ['/', '首頁']]],
  [`/${user}/album`,       [['/albums', '相簿總站'], [`/${user}`, '這個人的小站首頁'], ['/', '首頁']]],
  [postUrl,                [['/blogs', '網誌總站'], [`/${buser}/blog`, '這個人的網誌列表'], ['/', '首頁']]],
  [`/${user}/blog`,        [['/blogs', '網誌總站'], [`/${user}`, '這個人的小站首頁'], ['/', '首頁']]],
  [`/${user}/guestbook`,   [[`/${user}`, '這個人的小站首頁'], ['/', '首頁']]],
  [`/${user}/friends`,     [[`/${user}`, '這個人的小站首頁'], ['/', '首頁']]],
  [`/${user}`,             [['/', '首頁']]],
  ['/albums',              [['/', '首頁'], ['/blogs', '網誌總站']]],
  ['/blogs',               [['/', '首頁'], ['/albums', '相簿總站']]],
  ['/rank',                [['/', '首頁']]],
  ['/video',               [['/', '首頁']]],
  ['/digu',                [['/', '首頁']]],
  ['/join',                [['/', '首頁']]],
  ['/hala',                [['/', '首頁']]],
  ['/search?q=a',          [['/', '首頁']]],
  ['/help',                [['/', '首頁']]],
];
if (photoUrl) RULES.push([photoUrl, [[albumUrl, '這一本相簿'], [`/${user}/album`, '這個人的相簿列表'], ['/', '首頁']]]);

for (const [page, wants] of RULES) {
  const { status, html } = await get(page);
  if (status !== 200) { ok(`${page} 開得起來`, false, 'HTTP ' + status); continue; }
  for (const [target, label] of wants)
    ok(`${page} 回得到${label}（${target}）`, linksTo(html, target));
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
