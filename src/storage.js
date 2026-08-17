import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, UPLOAD_DIR } from './paths.js';
const R2 = process.env.R2_BUCKET ? await (async()=>{
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const c = new S3Client({ region:'auto', endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{ accessKeyId:process.env.R2_ACCESS_KEY, secretAccessKey:process.env.R2_SECRET } });
  return { PutObjectCommand, DeleteObjectCommand, c };
})() : null;
const ext = m => ({'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp'}[m]||'');
export const hasR2 = !!R2;
// 本地磁碟剩餘可用位元組（存 R2 時不受限）
export function diskFree(){
  if (R2) return Infinity;
  try { const s = fs.statfsSync(DATA_DIR); return s.bavail * s.bsize; } catch { return Infinity; }
}
export async function save(file){
  const key = (process.env.R2_PREFIX||'station/') + crypto.randomUUID() + ext(file.mimetype);
  if (R2){ await R2.c.send(new R2.PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:file.buffer,ContentType:file.mimetype})); return process.env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+key; }
  const name = path.basename(key); fs.writeFileSync(path.join(UPLOAD_DIR,name),file.buffer); return '/uploads/'+name;
}
export async function remove(url){
  try{ if (R2 && url.startsWith(process.env.R2_PUBLIC_URL)) await R2.c.send(new R2.DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:url.slice(process.env.R2_PUBLIC_URL.replace(/\/$/,'').length+1)}));
  else if (url.startsWith('/uploads/')) fs.unlinkSync(path.join(DATA_DIR,url.replace('/uploads/','uploads/'))); }catch{}
}
