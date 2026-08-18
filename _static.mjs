import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('public');
const mt={'.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.gif':'image/gif','.jpg':'image/jpeg','.ico':'image/x-icon','.js':'text/javascript'};
http.createServer((q,s)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/album.ejs.html';
  const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf '+p);}
  s.writeHead(200,{'content-type':mt[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
}).listen(4321,()=>console.log('http://127.0.0.1:4321/'));
