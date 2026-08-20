import { chromium } from 'playwright-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE='https://station-production-6d38.up.railway.app';
const paths = process.argv.slice(2);
const b = await chromium.launch({ executablePath: CHROME, headless:true });
for (const p of paths){
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const res=[];
  page.on('response', async r=>{
    let len=0;
    try{ const h=r.headers(); len=+(h['content-length']||0); if(!len){ const bb=await r.body(); len=bb.length; } }catch{}
    res.push({url:r.url(), status:r.status(), type:r.request().resourceType(), len});
  });
  const t0=Date.now();
  await page.goto(BASE+p,{waitUntil:'load',timeout:60000});
  await page.waitForTimeout(1200);
  const tim = await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd)};});
  // oversized images
  const imgs = await page.evaluate(()=>[...document.images].map(i=>({src:i.currentSrc,nw:i.naturalWidth,nh:i.naturalHeight,cw:Math.round(i.clientWidth),ch:Math.round(i.clientHeight)})));
  const total=res.reduce((a,r)=>a+r.len,0);
  const dupes={}; for(const r of res) dupes[r.url]=(dupes[r.url]||0)+1;
  console.log(JSON.stringify({path:p,reqs:res.length,totalKB:+(total/1024).toFixed(1),tim,wall:Date.now()-t0,
    top:res.sort((a,b)=>b.len-a.len).slice(0,6).map(r=>[r.type,+(r.len/1024).toFixed(1)+'KB',r.status,r.url.slice(0,110)]),
    dup:Object.entries(dupes).filter(([,c])=>c>1),
    bigimgs: imgs.filter(i=>i.cw&&i.nw>i.cw*2.5).map(i=>[i.nw+'x'+i.nh,'->',i.cw+'x'+i.ch,i.src.slice(0,110)]).slice(0,10),
    nonok: res.filter(r=>r.status>=300).map(r=>[r.status,r.url.slice(0,100)])
  },null,1));
  await ctx.close();
}
await b.close();
