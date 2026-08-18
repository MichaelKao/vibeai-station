const fs=require('fs'),path=require('path');
function dims(buf){
  if(buf.slice(0,3).toString('latin1')==='GIF'){return {t:'gif',w:buf.readUInt16LE(6),h:buf.readUInt16LE(8)};}
  if(buf[0]===0x89&&buf[1]===0x50){return {t:'png',w:buf.readUInt32BE(16),h:buf.readUInt32BE(20)};}
  if(buf[0]===0xFF&&buf[1]===0xD8){
    let i=2;
    while(i<buf.length){
      if(buf[i]!==0xFF){i++;continue;}
      const m=buf[i+1];
      if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){
        return {t:'jpg',h:buf.readUInt16BE(i+5),w:buf.readUInt16BE(i+7)};
      }
      const len=buf.readUInt16BE(i+2); i+=2+len;
    }
  }
  return {t:'?',w:0,h:0};
}
function walk(d){
  for(const f of fs.readdirSync(d)){
    const p=path.join(d,f);
    const st=fs.statSync(p);
    if(st.isDirectory()){walk(p);continue;}
    const b=fs.readFileSync(p);
    const D=dims(b);
    console.log(`${p.split(String.fromCharCode(92)).join("/")}\t${D.t}\t${D.w}x${D.h}\t${st.size}B`);
  }
}
walk(process.argv[2]);
