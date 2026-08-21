import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const p = await b.newPage({ viewport:{width:375,height:800}, isMobile:true, hasTouch:true });
  await p.goto('http://127.0.0.1:3422/rank', { waitUntil:'networkidle' });
  console.log(await p.$$eval('a[href], button', els => els.filter(e=>{
    const r=e.getBoundingClientRect(); return r.width&&r.height&&(r.width<24||r.height<24);
  }).slice(0,3).map(e=>{
    const path=[]; let x=e;
    while(x&&x!==document.body){ path.unshift(x.tagName.toLowerCase()+(x.id?'#'+x.id:'')+(typeof x.className==='string'&&x.className?'.'+x.className.trim().split(/\s+/).join('.'):'')); x=x.parentElement; }
    const r=e.getBoundingClientRect();
    return Math.round(r.width)+'x'+Math.round(r.height)+' text='+JSON.stringify(e.textContent.slice(0,10))+' :: '+path.slice(-4).join(' > ');
  }).join('\n')));
} finally { await b.close(); }
