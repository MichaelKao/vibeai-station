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
async function put(key, body, type){
  if (R2){ await R2.c.send(new R2.PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:body,ContentType:type}));
           return process.env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+key; }
  const name = path.basename(key); fs.writeFileSync(path.join(UPLOAD_DIR,name),body); return '/uploads/'+name;
}

// 存一張照片：回傳 {url, thumb, bytes, width, height}
// 大圖最長邊壓到 1024（無名當年大圖也差不多這個級距），縮圖 90x90 置中裁切。
export async function save(file){
  const base = (process.env.R2_PREFIX||'station/') + crypto.randomUUID();
  let big = file.buffer, thumbBuf = null, meta = {};
  try {
    const sharp = (await import('sharp')).default;
    const img = sharp(file.buffer, { animated: file.mimetype === 'image/gif' });
    meta = await img.metadata();
    if (file.mimetype !== 'image/gif') {
      big = await sharp(file.buffer).rotate().resize(1024, 1024, { fit:'inside', withoutEnlargement:true }).jpeg({ quality:86 }).toBuffer();
    }
    thumbBuf = await sharp(file.buffer).rotate().resize(90, 90, { fit:'cover', position:'centre' }).jpeg({ quality:82 }).toBuffer();
  } catch { /* 轉檔失敗就退回原圖，不擋使用者上傳 */ }
  const isJpeg = big !== file.buffer;
  const url   = await put(base + (isJpeg ? '.jpg' : ext(file.mimetype)), big, isJpeg ? 'image/jpeg' : file.mimetype);
  const thumb = thumbBuf ? await put(base + '_t.jpg', thumbBuf, 'image/jpeg') : url;
  return { url, thumb, bytes: big.length + (thumbBuf?.length || 0), width: meta.width||0, height: meta.height||0 };
}
export async function remove(url){
  try{ if (R2 && url.startsWith(process.env.R2_PUBLIC_URL)) await R2.c.send(new R2.DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:url.slice(process.env.R2_PUBLIC_URL.replace(/\/$/,'').length+1)}));
  else if (url.startsWith('/uploads/')) fs.unlinkSync(path.join(DATA_DIR,url.replace('/uploads/','uploads/'))); }catch{}
}
