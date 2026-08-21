// 手機上真的做得完一件事嗎——用真的觸控走完整個流程。
//
// ⚠ 為什麼 tools/mobilecheck.mjs 不夠：那一支量的是「版面對不對」與
// 「按鈕有沒有被別的層蓋住」，兩件都是靜態的。但使用者說「手機不行」的
// 時候，講的往往是**做不完一件事**：註冊到一半卡住、登出點不動、
// 發文送不出去。那只有真的把流程走一遍才知道。
//
// 這裡刻意用 tap() 而不是 click()：click 是滑鼠事件。「click 過得了、
// tap 過不了」的情況真實存在——元素被別的層蓋住、或者只綁了 mouse 事件
// 沒綁 touch。用 click 測手機，等於沒測到手機真正會遇到的那一半。
//
//   BASE=http://127.0.0.1:3000 node tools/mobileflow.mjs
//   BASE=https://station.vibeaico.com node tools/mobileflow.mjs
import { chromium } from 'playwright-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE=process.env.BASE;
const b=await chromium.launch({executablePath:CHROME,headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const p=await ctx.newPage();
let pass=0,fail=0;
const ok=(n,c,e='')=>{c?pass++:fail++;console.log((c?'  PASS ':'! FAIL ')+n+(c?'':'  '+e));};
const N='flow'+Math.floor(Date.now()/1000%100000);

// 註冊
await p.goto(BASE+'/register',{waitUntil:'domcontentloaded'});
const rf=p.locator('form:has(input[name=pass2])');
await rf.locator('input[name=name]').fill(N);
await rf.locator('input[name=nick]').fill('手機用戶');
await rf.locator('input[name=pass]').fill('test1234');
await rf.locator('input[name=pass2]').fill('test1234');
await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),
  rf.locator('button[type=submit],input[type=submit],button:not([type])').first().click()]);
ok('手機上註冊得起來', p.url().includes(N), '停在 '+p.url());

// 登出（用真的觸控點）
await p.goto(BASE+'/',{waitUntil:'networkidle'});
const lo=p.locator('form[action="/logout"] button').first();
if(await lo.count()){
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}).catch(()=>{}), lo.tap()]);
  const body=await p.textContent('body');
  ok('手機上點得到登出（真的觸控）', !body.includes('手機用戶')||body.includes('會員登入'),
     '點了之後還是登入狀態');
} else ok('首頁有登出按鈕', false, '找不到');

// 登入
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
const lf=p.locator('form:has(input[name=pass])').first();
await lf.locator('input[name=name]').fill(N);
await lf.locator('input[name=pass]').fill('test1234');
await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),
  lf.locator('button[type=submit],input[type=submit],button:not([type])').first().click()]);
ok('手機上登入得起來', !p.url().includes('/login'), '停在 '+p.url());

// 發文
await p.goto(BASE+`/${N}/blog/new`,{waitUntil:'networkidle'});
const pf=p.locator('form:has(textarea)').first();
await pf.locator('input[name=title]').fill('手機發的文');
await pf.locator('textarea[name=body]').first().fill('在手機上打的內容');
await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),
  pf.locator('input[type=submit],button[type=submit]').first().tap()]);
await p.goto(BASE+`/${N}/blog`,{waitUntil:'networkidle'});
ok('手機上發得了文', (await p.textContent('body')).includes('手機發的文'));

// 留言
await p.goto(BASE+`/${N}/guestbook?tab=new`,{waitUntil:'networkidle'});
const gf=p.locator('form[action*="guestbook"]').first();
try{
  await gf.locator('textarea[name=body]').first().fill('手機留言測試');
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),
    gf.locator('input[type=submit],button[type=submit]').first().tap()]);
  await p.goto(BASE+`/${N}/guestbook`,{waitUntil:'networkidle'});
  ok('手機上留得了言', (await p.textContent('body')).includes('手機留言測試'));
}catch(e){ ok('手機上留得了言', false, e.message.slice(0,70)); }

// 建相簿
await p.goto(BASE+`/${N}/album`,{waitUntil:'networkidle'});
const af=p.locator('form[action$="/album"]').first();
try{
  await af.locator('input[name=title]').fill('手機相簿');
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),
    af.locator('input[type=submit],button[type=submit]').first().tap()]);
  ok('手機上建得了相簿', (await p.textContent('body')).includes('手機相簿'));
}catch(e){ ok('手機上建得了相簿', false, e.message.slice(0,70)); }

await b.close();
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail?1:0);
