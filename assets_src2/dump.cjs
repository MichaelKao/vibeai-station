const fs=require('fs');
const f=process.argv[2];
let h=fs.readFileSync(f,'utf8');
h=h.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
const start=process.argv[3]||'';
const len=parseInt(process.argv[4]||'9000');
let i= start? h.indexOf(start):0;
if(i<0){console.log('NOT FOUND: '+start); i=0;}
process.stdout.write(h.slice(Math.max(0,i-200), i+len));
