// 把 public/img/wretch/ 底下的無名素材推上 R2，並印出對照表。
//
// 素材是靜態、永不變動的小檔（最大 12KB），設 immutable 快取一年，
// 讓瀏覽器與 Cloudflare 邊緣節點都不用再回源。
//
// 執行（需要 R2_* 環境變數）：
//   railway run node tools/upload-assets.mjs
// 或本機：
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY=... R2_SECRET=... R2_BUCKET=... node tools/upload-assets.mjs

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'node:fs';
import path from 'node:path';

const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY', 'R2_SECRET', 'R2_BUCKET'];
const missing = need.filter(k => !process.env[k]);
if (missing.length) {
  console.error('缺少環境變數：' + missing.join(', '));
  process.exit(1);
}

const c = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY, secretAccessKey: process.env.R2_SECRET },
});

const TYPE = { '.gif': 'image/gif', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const ROOT = path.resolve('public/img/wretch');
const PREFIX = 'wretch/';

function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + '/') : [base + e.name]);
}

const files = walk(ROOT);
let bytes = 0, n = 0;
for (const rel of files) {
  const body = fs.readFileSync(path.join(ROOT, rel));
  await c.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: PREFIX + rel,
    Body: body,
    ContentType: TYPE[path.extname(rel)] || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  bytes += body.length; n++;
  process.stdout.write(`\r  上傳 ${n}/${files.length}  ${rel.padEnd(34)}`);
}
console.log(`\n完成：${n} 個檔案 / ${(bytes / 1024).toFixed(1)} KB → r2://${process.env.R2_BUCKET}/${PREFIX}`);
if (process.env.R2_PUBLIC_URL)
  console.log(`公開網址前綴：${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${PREFIX}`);
