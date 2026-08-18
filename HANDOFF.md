# 交接：接下來要做什麼

> 最後更新：2026-08-18。換機器接手時先讀這份，再讀 `WRETCH_2012.md`（復刻契約）。

---

## 0. 換機器後的第一件事

```bash
pnpm install
node tools/seed-demo.mjs --reset     # 灌示範資料（會上網抓台灣照片，約 10 分鐘）
pnpm dev                             # http://localhost:3000
```

正式站：https://station-production-6d38.up.railway.app
（Railway 專案 `vibeai-station` / 服務 `station`；`railway link` 選 production + station）

示範帳號密碼一律 `demo1234`，站長帳號 `vibeai`。

---

## 1. 目前狀態

### 已完成

| 項目 | 狀態 |
|---|---|
| 首頁 2012 版 | 完成。22 個關鍵選擇器零缺漏，寬度／左位移／字級／顏色全相符 |
| 相簿／網誌／留言板／名片／好友 | 完成，五套**原廠預設版型**（skin 117 / 189 / 1911 / 577 / 名片純 CSS） |
| 登入／註冊 | 完成。原站沒有這兩頁（導去 Yahoo），用 2012 元件語言自製 |
| 版型切換 | 完成。照原站做法：選版型 → 載那支版型 CSS，不是 body class |
| 資料層 | **正式站已跑 Postgres**（新加坡）+ **Redis**（新加坡）+ R2 |
| 回歸測試 | 86 項全綠（`node test_all.mjs`，需先啟一個 server） |
| SQL 方言測試 | 11 項全綠（`node test_pg.mjs`） |

### 還原度（離線量測，可重現）

```bash
pnpm dev &                    # 先啟站
node tools/fidelity.mjs --all
```

最近一次結果：**結構平均 74%**
名片 89% / 首頁 81% / 單張照片 76% / 網誌 75% / 相簿 69% / 留言板 66% / 好友 60%

> 該工具同時會印「文案覆蓋率」，**那個數字不要採用**。原版頁面上的中文大多是
> 別人的內容（相簿名、文章、留言）和我們沒有的功能（影音／揪團／嘀咕／VIP），
> 量到的是內容差異不是還原度。

---

## 2. 待辦（依優先序）

### A. 補結構缺漏 — 這是把 74% 往上推的主要工作

`node tools/fidelity.mjs --all` 會列出每頁缺的 id/class。缺漏分三類，**只有第 2 類要補**：

1. **不該補**：`#share_facebook`、`.g-plusone`、`#photowall`（VIP 相片牆）、
   `#linkVideo`（影音）、`.vip_icon`、`#exif`、`#rapid_*`（Yahoo 埋點）、
   `#ad_banner`／`#ad_gbook`（廣告位）— 我們沒有這些功能
2. **該補**：
   - `#wretch-crumb` 麵包屑 — **每一頁都缺**，影響最大
   - `#first` / `#prev` — 照片頁導覽的 id（文字有、id 沒帶）
   - `#page_link_2..7` — 留言板分頁
   - `#cateSelect` / `#searchInput` — 好友頁的分類與搜尋
   - 網誌的 `.blogbody` / `.blogbody2` / `.articletext` / `.posted` / `.innertext` / `.extended`
     ← **上次量測時站上沒有文章，所以測不到，要重測確認是不是真的缺**
3. **不會一樣**：`#u_a7512128` 這種由使用者 id 產生的

### B. 補更多原廠版型

機制已完成，加一套版型只要三步：
1. 版型 CSS 放 `assets_src2/css/`、素材放 `assets_src2/img/skin<編號>/`
2. `tools/build-css2012.mjs` 的 `BUNDLES` 加一則（照 `wretch2012-album-188.css` 寫法，只換版型那層）
3. `src/skins.js` 的 `SKINS` 登記，然後 `node tools/build-css2012.mjs`

目前只有相簿有兩套（189 粉＝預設、188 灰）。網誌／留言板／名片／好友各一套。

原廠版型的辨識法（`assets_src2/spec/skin.md` 有完整說明）：
- 檔頭有「無名小站預設…樣式」字樣 — 最可靠
- 出現率統計 — 已知是預設的網誌 skin117 在隨機抽樣只佔 5%（大家都換過版型），
  明顯高於這個基準的就是原廠
- 筆跡：tab 縮排、無作者署名、無外部圖床

### C. 換站名與 logo — **最後才做**

使用者要求先 100% 還原（含原版品牌），最後再換。要換時只有一處：
`src/config.js` 的 `SITE_NAME` / `SITE_LOGO`。

但注意：目前**多處 view 直接寫死「無名小站」與 `logo_wretch.png`**（這是刻意的），
換的時候要一起處理。用 `grep -rn "無名小站" views/` 找。

### D. 線上示範資料

正式站的 Postgres 目前是**空的**。使用者已同意灌示範資料。
要灌的話需要在能連到 Postgres 的環境跑 `tools/seed-demo.mjs`
（Railway 的 PG 只有內網位址，本機連不到；可考慮加一個 `SEED_DEMO=1` 的啟動旗標，
做法比照 `src/migrate-pg.js`）。

**照片一定要走 `storage.save()`**，它會在有 R2 時上傳 R2。
種子腳本原本自己寫本機磁碟，已修正。

---

## 3. 踩過的坑（別再踩一次）

| 坑 | 說明 |
|---|---|
| **Express 4 不接住 async handler 的錯誤** | 那是 Express 5 才有的行為。沒有 `wrapAsync` 的話，任何 DB 錯誤都會變成 unhandled rejection，請求永遠掛著。已在 `src/server.js` 註冊層處理 |
| **`one(...).c` 加 await 的陷阱** | `await one(...).c` 會先對 Promise 取屬性得到 undefined 再 await，**不拋錯**，只是所有計數變空。要寫成 `(await one(...)).c`。全檔有 24 處 |
| **connect-redis 是具名匯出** | v7 起沒有 default。寫錯會讓正式站起不來，而且**本機測不出來**（沒有 REDIS_URL 就提早 return，那段程式碼從沒被執行）。`test_pg.mjs` 已加測試釘住 |
| **只看 DATABASE_URL 存不存在來切資料庫很危險** | 平台會自動注入這個變數，一個不小心整站切到空資料庫。現在要 `DB_DRIVER=postgres` 明確指定 |
| **archive.org 會拒連，也會回自己的錯誤頁** | 錯誤頁是正常 DOM，會被當成載入成功，量出假數據。`tools/shot.mjs` 已加哨兵選擇器偵測 |
| **手寫 parser 做 codemod 必錯** | 我踩了三次（視窗太短、把 `...` 誤判成成員存取、字串遮罩失步，漏 47 處）。`tools/codemod-await.mjs` 已改用 acorn，並會自己再解析一次驗證 |
| **測試不要綁 class 名稱** | 復刻不同年代時 class 一定會變，綁 class 會在功能沒壞時誤報。要驗行為 |
| **原版用詞** | 2012 是「回上一層」，「回頂端」是 2005 的說法 |

---

## 4. 工具

| 工具 | 用途 |
|---|---|
| `tools/fidelity.mjs --all` | **還原度量測**（離線，不靠 archive.org） |
| `tools/shot.mjs geo <原版> <我們> <選擇器清單>` | 幾何比對（要連 archive.org，會被限流） |
| `tools/shot.mjs shot/pair/tree/measure` | 截圖／像素 diff／版面藍圖／元素量測 |
| `tools/build-css2012.mjs` | 從原站原始 CSS 產生樣式 bundle，**不要手改 `public/wretch2012*.css`** |
| `tools/build-assets.mjs` | 2005 版素材管線（已停用，`attic/` 那批才用得到） |
| `tools/seed-demo.mjs [--reset]` | 示範資料（台灣照片，走 R2） |
| `tools/codemod-await.mjs <檔>` | 同步→非同步轉換（acorn，含自我驗證） |
| `test_all.mjs` / `test_pg.mjs` | 回歸測試 86 項／SQL 方言 11 項 |

---

## 5. 重要檔案

```
WRETCH_2012.md          復刻契約：目標版本、實測尺寸、已定案方針、稽核推翻的說法
assets_src2/spec/       六份測繪規格書 + AUDIT.md（總稽核，會推翻其他規格書的錯誤）
assets_src2/html/       44 份原始頁面 HTML（還原度量測的基準）
assets_src2/css/        原站原始 CSS
src/skins.js            版型登記表
src/db.js               雙驅動資料層 + schemaSql(driver)
src/cache.js            Redis（session／人氣 write-behind／熱查詢快取）
src/migrate-pg.js       SQLite→Postgres 一次性搬移（啟動時執行）
attic/wretch-2005/      2005 綠色 table 版的成果，之後可做復古版型
```
