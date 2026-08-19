# 交接：接下來要做什麼

> 最後更新：2026-08-19。換機器接手時先讀這份，再讀 `WRETCH_2012.md`（復刻契約）。

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
| 影音／相片牆／嘀咕 | 完成。原站有、我們原本沒有的三個功能，版面 1:1 ＋ 最小可用實作 |
| 廣告版位 | 版位 DOM／id／尺寸照原版，內容換成站方公告與站內連結（`partials/adslot2012.ejs`） |
| 回歸測試 | **119 項全綠**（`node test_all.mjs`） |
| SQL 方言測試 | **23 項全綠**（`node test_pg.mjs`） |

> ⚠ `test_all.mjs` **要對一個乾淨的資料庫跑**（它第一步就是註冊 alpha/bravo/charlie，
> 帳號已存在就會整串連鎖失敗）。做法：
> `DATA_DIR=/tmp/x PORT=3002 node src/server.js` 再 `BASE=http://localhost:3002 node test_all.mjs`。

### 示範資料的量（2026-08-19 重灌）

| 項目 | 數量 |
|---|---|
| 站友 | 38 位（8 個主要帳號 ＋ 30 個補充站友，都有大頭貼、相簿、網誌、影音、嘀咕） |
| 相簿／照片 | 全部 24 類每類至少一本，照片**全部是真的**（loremflickr 的 CC 授權 Flickr 照片，關鍵字對著相簿主題抓） |
| 網誌 | 全部 12 類每類都有文章 |
| 其他 | 留言板 238 則（分頁列看得到）、好友 100+ 組（四種關係都有）、影音 57 支、嘀咕 110 則、收藏 228 筆、照片迴響 298 則、系統訊息 62 則、檢舉 6 筆、好友動態 100 筆、音樂盒 13 人、自訂 CSS 4 人、上鎖／好友限定相簿與私密文章各數本 |
| **時間** | **攤在過去 25 個月**（2024-08 起），越近越密。全部同一天的話文章日曆只有一格、月份彙整只有一個月，一眼就看得出是灌的 |

> ⚠ 加種子資料時，`spread()` 的序號**要倒過來**（`spread(total - seq, total)`）。
> 站上到處都是 `ORDER BY id DESC`，先插入的如果日期比較新，列表就會出現
> 「8月9日、5月26日、6月5日」這種跳來跳去的順序。

灌資料前後都要跑 `node tools/emptycheck.mjs`，那支會把「看起來空空的」頁揪出來。
**照片抓失敗會退回純色方塊**，那一眼就看得出是假的，所以 `--photos` 那個模式要顧著看。

### 還原度（離線量測，可重現）

```bash
pnpm dev &                    # 先啟站
node tools/fidelity.mjs --all
```

最近一次結果：**八頁全部 100%**（首頁／相簿列表／單本相簿／單張照片／網誌／留言板／名片／好友）

> 2026-08-19 修好了量測工具本身的三個 bug，所以**新舊數字不能直接比**：
>   1. **頁面配錯**：`album_album_list.html` 其實是「單本相簿的照片列表」，
>      舊表把它配給「相簿列表」，等於拿 A 頁對 B 頁，憑空多出 20 個假缺漏。
>   2. **單張照片永遠抓第一張**：第一張本來就不該有「第一張／上一張」連結，
>      於是 `#first`／`#prev` 被誤報成缺漏。改抓中間那張。
>   3. **沒剝掉 `<script>`**：原版把 FB／G+／Twitter 外掛塞在 `document.write` 的字串裡，
>      那不是 DOM；反過來說，我們塞一段死 script 就能加分。兩邊都剝掉，分數才不能造假。
> 修好之後的**真實起點是 86%**（不是 74%），再補到 100%。

報表印兩個百分比：
- **可達** ＝ 命中 ÷（原版全部 − 排除項）← 這才是要推到 100% 的分母
- **原始** ＝ 命中 ÷ 原版全部（含排除項）

排除項只有 9 個，全部集中在網誌頁，而且每一條都印得出理由：使用者把 Word／
Facebook 頁面貼進文章帶進來的 class（`.MsoNormal` `.uiInfoTable` `.data` …）。
那是內容不是版面，而且 `WRETCH_2012.md` §4-4 規定使用者輸入一律逸出，結構上不可達。

> 該工具同時會印「文案覆蓋率」，**那個數字不要採用**。原版頁面上的中文大多是
> 別人的內容（相簿名、文章、留言），量到的是內容差異不是還原度。

---

## 2. 待辦（依優先序）

### A. ~~補結構缺漏~~ — **2026-08-19 做完了，八頁都 100%**

使用者當時的三個決定（往後同類問題照這個走）：

| 題目 | 決定 | 落在哪 |
|---|---|---|
| 廣告版位 | **保留版位，放自家內容**——DOM／id／尺寸照原版，裡面換成站方公告與站內連結 | `partials/adslot2012.ejs` |
| 我們沒有的功能（影音／VIP 相片牆／嘀咕） | **版面照做＋最小功能**，不做空殼 | `/:user/video`、`/:user/album/:id/wall`、`/:user/digu` |
| 社群外掛 | **能用的做真的**（FB／Twitter／Plurk 純 `<a href>`，不載 SDK）；**死掉的留外觀**（Google+／Yahoo IM 只留 class 與圖，不連外） | `partials/socialshare2012.ejs`、`wfpsharing2012.ejs` |

> 上一版這一節寫的「不該補／該補」分類**有幾條是錯的**，別再照抄：
> - `#wretch-crumb` **不是麵包屑**，是 `#hugewrapper` 裡的 hidden input（CSRF token），
>   旁邊是 `#static-path`。而且 `blog2012_head.ejs` 當時早就有了，不是「每一頁都缺」。
> - `#first` / `#prev` **根本沒缺**，是量測工具永遠抓相簿第一張造成的誤判。
> - `.blogbody` 那一整組**當時就都有了**，缺的只有 `.extended`，而且原因是種子文章太短
>   沒觸發「繼續閱讀」，不是 markup 沒寫。

**還沒做完的只剩一件事**：`.vip_icon` 那套認證章的**後台介面**。
欄位（`users.vip`，0 無／1 銀／2 金／3 白金）與畫面都好了，
但目前只能靠 `tools/seed-demo.mjs` 或直接改資料庫來設定，`/admin` 沒有對應的操作。

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
本機的種子資料已經重灌過（2026-08-19），162 張都是真的台灣照片。
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
| **量測工具本身會錯，先驗工具再驗版面** | 這次八頁裡有三頁的「缺漏」是工具的 bug（頁面配錯、永遠抓第一張、沒剝 script），照著補會做出原版不存在的東西。看到「缺很多」先去讀那一頁的原始檔確認它真的是同一頁 |
| **`test_all.mjs` 不是冪等的** | 第一步就註冊 alpha/bravo/charlie，對已經跑過的 DB 再跑一次會整串連鎖失敗，看起來像「改壞了 14 項」。一定要開一個 `DATA_DIR` 全新的 server 來跑 |
| **EJS 標記不能巢狀** | `<%# 註解 %>` 塞進 `<%- include(...) %>` 的參數物件裡會 500（`Could not find matching close tag`）。要在 include 參數裡寫註解就用 JS 的 `/* */` |
| **`<%= %>` 會逸出引號** | 寫 `<li <%= on ? ' class="current"' : '' %>>` 會輸出 `class=&quot;current&quot;`，class 整個失效而且畫面看不出來。要寫成 `class="<%= on ? 'current' : '' %>"` |
| **種子資料的模數會撞在一起** | 悄悄話用 `i%17===5`、板主回覆用 `i%9===2`，兩個在 i=56 同時成立，那則對訪客是隱藏的，`.reply_content` 就永遠量不到。挑間隔時要確認不會同步 |

---

## 4. 工具

| 工具 | 用途 |
|---|---|
| `tools/fidelity.mjs --all` | **還原度量測**（離線，不靠 archive.org） |
| `tools/emptycheck.mjs` | **空頁檢查**：掃全站每一頁（含 24 個相簿分類、12 個網誌分類），找出還印著「還沒有…」的模組、沒有照片的頁、以及純色色塊假照片。還原度 100% 不代表看起來不空，這兩支要一起跑 |
| `tools/shot.mjs geo <原版> <我們> <選擇器清單>` | 幾何比對（要連 archive.org，會被限流） |
| `tools/shot.mjs shot/pair/tree/measure` | 截圖／像素 diff／版面藍圖／元素量測 |
| `tools/build-css2012.mjs` | 從原站原始 CSS 產生樣式 bundle，**不要手改 `public/wretch2012*.css`** |
| `tools/build-assets.mjs` | 2005 版素材管線（已停用，`attic/` 那批才用得到） |
| `tools/seed-demo.mjs [--reset]` | 示範資料（台灣照片，走 R2） |
| `tools/codemod-await.mjs <檔>` | 同步→非同步轉換（acorn，含自我驗證） |
| `test_all.mjs` / `test_pg.mjs` | 回歸測試 119 項／SQL 方言 23 項（`test_all` 要對乾淨的 DB 跑，見第 1 節） |
| `tools/fidelity.mjs --page <名稱>` | 只量一頁，開發時用 |
| `tools/fidelity.mjs --all --json out.json` | 機器可讀的明細 |

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
