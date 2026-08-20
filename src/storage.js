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

// 從 EXIF 位元組取「圖片資訊」面板要用的欄位：相機廠牌／型號／拍攝時間。
//
// 為什麼自己解而不裝套件：sharp 的 metadata().exif 給的就是原始 TIFF 區塊，
// 我們只要三個標籤，值得為此多一個相依套件的理由不夠強。格式很固定：
//   位元組 0-1 位元序（'II' 小端／'MM' 大端）、4-7 IFD0 的位移
//   每個項目 12 bytes：tag(2) type(2) count(4) value/offset(4)
// 需要的三個標籤：0x010F Make、0x0110 Model（在 IFD0）、
//                 0x9003 DateTimeOriginal（在 0x8769 指到的 ExifIFD）。
// 解析失敗一律回空物件——沒有 EXIF 的照片（截圖、轉檔過的圖）本來就是多數。
function readExif(buf){
  try {
    if (!buf || buf.length < 8) return {};
    const le = buf.toString('ascii', 0, 2) === 'II';
    const u16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
    const u32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
    const str = (o, n) => buf.toString('latin1', o, o + n).replace(/\0[\s\S]*$/, '').trim();
    const SIZE = { 1:1, 2:1, 3:2, 4:4, 5:8, 7:1, 9:4, 10:8 };
    const out = {};
    const walk = (ifd, depth) => {
      if (depth > 2 || ifd <= 0 || ifd + 2 > buf.length) return;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > buf.length) return;
        const tag = u16(e), size = (SIZE[u16(e + 2)] || 1) * u32(e + 4);
        const off = size > 4 ? u32(e + 8) : e + 8;
        if (tag === 0x8769) { walk(u32(e + 8), depth + 1); continue; }
        if (off + size > buf.length || size <= 0) continue;
        if (tag === 0x010F) out.make = str(off, size);
        else if (tag === 0x0110) out.model = str(off, size);
        else if (tag === 0x0132) out.dt = str(off, size);        // DateTime（IFD0）
        else if (tag === 0x9003) out.dto = str(off, size);       // DateTimeOriginal（優先）
      }
    };
    walk(u32(4), 0);
    // EXIF 的時間寫成 'YYYY:MM:DD HH:MM:SS'，站上到處都在切 created 這種
    // 'YYYY-MM-DD HH:MM:SS' 字串，統一成同一種格式才好排序與顯示
    const t = (out.dto || out.dt || '').replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const camera = [out.make, out.model]
      .filter(Boolean)
      // 很多相機的 Model 已經含廠牌（NIKON / NIKON D90），重複印很醜
      .filter((v, i, a) => i === 0 || !v.toUpperCase().startsWith(a[0].toUpperCase()))
      .join(' ');
    return { taken: /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 19) : '', camera: camera.slice(0, 60) };
  } catch { return {}; }
}

// 存一張照片：回傳 {url, thumb, bytes, width, height, taken, camera}
// 大圖最長邊壓到 1024（無名當年大圖也差不多這個級距），縮圖 90x90 置中裁切。
//
// 輸出的 JPEG 刻意**不**保留 EXIF：這條鏈有 .rotate()，把原本的方向標籤一起帶
// 出去會讓部分瀏覽器再轉一次；而且 EXIF 裡可能有 GPS 座標，重新發佈等於幫
// 使用者洩漏拍攝地點。#exif 面板要的資料改成解析後存進 photos 表。
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
  const ex = readExif(meta.exif);
  return { url, thumb, bytes: big.length + (thumbBuf?.length || 0),
    width: meta.width||0, height: meta.height||0, taken: ex.taken||'', camera: ex.camera||'' };
}
export async function remove(url){
  try{ if (R2 && url.startsWith(process.env.R2_PUBLIC_URL)) await R2.c.send(new R2.DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:url.slice(process.env.R2_PUBLIC_URL.replace(/\/$/,'').length+1)}));
  else if (url.startsWith('/uploads/')) fs.unlinkSync(path.join(DATA_DIR,url.replace('/uploads/','uploads/'))); }catch{}
}
