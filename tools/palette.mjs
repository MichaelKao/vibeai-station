import sharp from 'sharp';
const hex = (r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
async function pal(f){
  const {data,info} = await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const m = new Map();
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<128) continue;
    const k = hex(data[i],data[i+1],data[i+2]);
    m.set(k,(m.get(k)||0)+1);
  }
  const tot = [...m.values()].reduce((a,b)=>a+b,0);
  return {f:f.split(/[\/]/).pop(), size:`${info.width}x${info.height}`,
    top:[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`${c} ${(n*100/tot).toFixed(1)}%`)};
}
for(const f of process.argv.slice(2)){ const p=await pal(f); console.log(p.f.padEnd(20), p.size.padEnd(9), p.top.join('  ')); }
