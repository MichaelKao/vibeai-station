# vibeai 小站

復刻 2005 年台灣網路氛圍的懷舊社群：**相簿・網誌・留言板・名片・好友**。免費、無廣告、沒有 VIP。

版面配色與尺寸取自 Internet Archive 上的原始 HTML/CSS 存檔重建（見 [`WRETCH_SPEC.md`](WRETCH_SPEC.md)）。
名稱與 Logo 為 vibeai 自有，**未使用原站任何圖檔或樣板**，純為致敬之作。

**線上：** https://station-production-6d38.up.railway.app

---

## 功能

### 相簿（橘色主題）
多本相簿、封面、說明、**站內分類 24 類**、地區、**密碼相簿**、**好友限定**、
一次上傳 20 張（自動產生 90×90 縮圖與 1024px 大圖、EXIF 轉正）、
單張瀏覽（第一張／上一張／下一張／最後一張、**C 鍵與方向鍵快捷**）、
**幻燈片**（自動播放、速度切換）、**一頁瀏覽**、照片迴響、每頁 20 本分頁。

### 網誌（藍色主題）
分類、**站內分類 12 類**、**心情／天氣**、**文章密碼**、
內文標記 `[b] [i] [u] [color] [img]`、裸網址自動連結、**14 種顏文字**、**從自己相簿插入照片**、
側欄模組：文章分類／最新文章／**文章日曆**／月份彙整／**搜尋這個網誌**／最新迴響／**人氣指數**／**RSS**、
迴響（暱稱・E-mail・個人網頁・記住我的資料・樓層・**板主回覆**）、**推薦／收藏／引用（trackback）**。

### 留言板
三頁籤（**留言板／系統訊息／我要留言**）、主題（空白顯示「無標題」）、
**悄悄話**（只有板主看得到）、板主回覆、分頁、檢舉。

### 社群
**名片**（姓名／性別／生日／星座／血型／居住地／職業／學校／興趣／座右銘／MSN／個人網頁）、
**好友分組**、**好友動態**、**誰來我家**足跡頁、**今日人氣／累積人氣**雙計數器、收藏清單。

### 全站
2005 版兩欄首頁（熱門相簿 3 欄／熱門網誌左圖右文＋得點）、相簿總站、網誌總站、
排行榜、搜尋、服務說明、**8 種版面樣式**＋自訂 CSS、**音樂盒播放清單**。

### 站長後台 `/admin`
站友管理（設為／取消站長、刪除）、**站內公告**、**群發系統訊息**、
**檢舉佇列**（標記已處理）、**精選相簿／文章**、儲存空間監看。

### 相容網址
`/album/帳號`、`/blog/帳號`、`/guestbook/帳號`、`/friend/帳號`、`/mypage/帳號`、`/user/帳號`
一律 301 導到對應頁面。

---

## 開發

```bash
pnpm install
pnpm dev                 # http://localhost:3000  （需 Node >= 22.13，用內建 node:sqlite）
node test_all.mjs        # 85 項回歸測試（伺服器要先啟動）
```

## 環境變數

| 變數 | 說明 | 預設 |
|---|---|---|
| `PORT` | 埠號 | 3000 |
| `DATA_DIR` | **資料目錄，必須是絕對路徑**（Railway 設 `/app/data`） | `./data` |
| `SESSION_SECRET` | session 金鑰 | 開發用預設值 |
| `ADMIN_USERS` | 逗號分隔，名單內帳號註冊／登入自動成站長 | 空 |
| `USER_QUOTA_MB` | 每人相簿空間上限 | 500 |
| `DISK_RESERVE_MB` | 磁碟保留水位，低於此值停止上傳以保護資料庫 | 1024 |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET` / `R2_BUCKET` / `R2_PUBLIC_URL` / `R2_PREFIX` | 設了就改存 Cloudflare R2，不設則存本機 Volume | 空 |

## 部署 Railway

Start command `pnpm start`，**Volume 掛 `/app/data` 並設 `DATA_DIR=/app/data`**。

### 踩過的坑（重要）
1. **資料路徑必須絕對**。用相對路徑會寫到 Volume 外面，每次重新部署資料全消失。
   驗證方法：看啟動日誌 `[data] ... fs=` — 顯示約 49GB 才是真的掛上了，顯示數千 GB 是容器暫存碟。
2. 用 API 部署要加 `latestCommit:true`，否則只是重 build 舊的 commit。
3. Volume 可能變殭屍（刪不掉又不掛載），遇到就重建 service。
4. 服務區域跟著 Volume 走，用 `serviceInstanceUpdate(input:{multiRegionConfig:{...}})`。
5. GitHub 故障時 Nixpacks 抓不到 nixpkgs 會 build 失敗；用 `deploymentRedeploy` 拿舊映像即可救回站台。

## 安全性

所有使用者輸入一律先 escape 再套白名單標記；網址欄位只收 `http(s)` 或站內相對路徑；
session cookie 為 `httpOnly` + `SameSite=Lax`；密碼用 scrypt + 每人 salt；
上鎖文章／密碼相簿／好友限定在**列表、搜尋、RSS、迴響、推薦、引用**每一條路徑都有擋。
