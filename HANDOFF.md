# 交接：接下來要做什麼

> 最後更新：2026-08-20。換機器接手時先讀這份，再讀 `WRETCH_2012.md`（復刻契約）。

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
| 資料層 | **正式站已跑 Postgres**（新加坡）+ **Redis**（新加坡）+ R2，**示範資料已灌**（2026-08-19） |
| 影音／嘀咕／揪團總站 | 完成。導覽列那三顆之前都指到 /help，現在是 `/video` `/digu` `/join`。這三頁原站沒有存檔，是自製的（WRETCH_2012.md §3-A） |
| 影音／相片牆／嘀咕 | 完成。原站有、我們原本沒有的三個功能，版面 1:1 ＋ 最小可用實作 |
| 廣告版位 | 版位 DOM／id／尺寸照原版，內容換成站方公告與站內連結（`partials/adslot2012.ejs`） |
| 影音／嘀咕／揪團／哈啦／愛正妹 | 完成。導覽列與頁尾都接得到，原站網址 `/hala/viewtopic.php?t=` 也通 |
| 送禮物 | 完成。原站在付費網域，我們不接金流但功能照做，一律免費 |
| 四種 RSS | 網誌／相簿／留言板／迴響，悄悄話與上鎖內容都不外流 |
| RWD | 完成。**桌機零影響**（1000px 以上一條規則都不生效），320〜1440 八個寬度、28 頁全部零問題 |
| 回歸測試 | **174 項全綠**（`node tools/runtests.mjs`，會自己開乾淨資料庫） |
| SQL 方言測試 | **29 項全綠** |
| SSRF 防護測試 | **36 項全綠**（`test_ssrf.mjs`，私有網段／IPv4-mapped／十進位 loopback／轉址繞過） |
| 按鈕全覆蓋 | **136 個表單**、三種身分、零錯誤（`node tools/buttoncheck.mjs`） |

> ⚠ `test_all.mjs` **要對一個乾淨的資料庫跑**（它第一步就是註冊 alpha/bravo/charlie，
> 帳號已存在就會整串連鎖失敗，看起來像「剛改壞了 28 項」）。
> **直接用 `node tools/runtests.mjs`**——它會自己關掉佔埠的 server、開乾淨的 DATA_DIR、
> 跑完兩支測試再收工。這個坑我在同一天踩了三次才固化成腳本。

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

### A. ~~RWD 收尾~~ — **2026-08-20 收完了**

`public/wretch2012-rwd.css` 是**刻意加的響應式圖層**（原站沒有 RWD，2012 是 970px 固定寬，
導覽列那顆「手機(NEW)」連的是另一個獨立的行動版活動頁）。整支包在
`@media (max-width:999px)` 裡，**1000px 以上一條都不生效**，桌機逐像素不變。

實測狀態（`MSYS_NO_PATHCONV=1 BASE=<站台> VW=<寬> node tools/uicheck.mjs <網址…>`）：

| 寬度 | 結果 |
|---|---|
| 320 / 375 / 414 / 600 / 768 / 1024 / 1280 / 1440 | **28 頁全部零問題** ✅ |

這一輪補掉的四類元凶（都是拿瀏覽器實量出來的，不是猜的）：

| 類型 | 例子 | 為什麼難找 |
|---|---|---|
| 寫死寬度 | `#rss-bar .inner` 500、`#msg_list` 604、`#mainSection` 604、`.total-comments-div` 300 | 好找，但選擇器要夠深才蓋得過 |
| 寫死位移 | `#header h1{left:300px}`、`a.message{left:470px}`、分頁列 `margin-left:375px` | 元素寬度是對的，**位置**才是錯的，「超寬元素」清單抓不到 |
| padding | `#wfp-cover .stack .title{padding-left:439px}` | **`width:auto` 蓋不掉 padding**，box-sizing 之下盒子照樣被撐回 439 |
| BFC 避讓 | `#wfp-hybrid .bd`、`#wfp-celebrity h3`（都有 `overflow:hidden`） | 最不直覺：width 明明是 auto，盒子卻自己縮了。`overflow` 讓它自成 BFC，而 **BFC 會主動避開浮動框** |
| 偽元素 | `.stack .block::after` 寫死 408px | uicheck 的「超寬元素」只走真實節點，**偽元素量不到**，要掃 `scrollWidth` 才找得到 |

> ⚠ **不准用 `overflow-x:hidden` 把問題藏起來**。那只會讓量測工具量不到，
> 版面還是壞的而且內容會被裁掉。

> 迭代工具：`tools/rwdprobe.mjs`。它開**正式站**的頁面、注入**本機**那份 CSS 再量，
> 所以不必等部署、也不必本機有種子資料就能改一輪量一輪。
> 改完務必確認「那一頁真的有載到 rwd css」——不然是注入讓它過的，部署後照樣壞。

### A-2. ~~2005 殘留清除~~ — **2026-08-19 清完了**

整站現在**只有 2012**。清掉的東西（都在 git 歷史裡，要救得回來）：

| 清掉的 | 原本是什麼 |
|---|---|
| `views/partials/head.ejs` `foot.ejs` `sitetop.ejs` `sitefoot.ejs` `pager.ejs` | 2005 綠色 table 版的外框，最後一個使用者 `admin.ejs` 已改成 2012 |
| `public/style.css` | 2005 主樣式，0 頁面載入 |
| `public/img/wretch/`（166K） | 2005 素材集 |
| `attic/wretch-2005/`（286K） | 2005 版成果 |
| `src/taxonomy.js` 的 `THEMES` / `isTheme` | 2005 的 `t-x-*` body class 換色機制，已被真正的版型切換取代 |
| `src/config.js` 的 `THEME_FOR` / `ASSETS` / `CDN_VARS` | 同上，全部只服務 2005 那套 |
| `views/{home,index,rank,search}.ejs` 的 5 處回退路徑 | 指向 `CDN + '/icon/user_cover.gif'`＝2005 素材，改指 `/img/wretch2012/blog/user_cover.gif` |

⚠ `src/config.js` 的 `CDN` 預設值也從 `/img/wretch` 改成 **`/img/wretch2012`**——
它現在只服務 `#static-path` 那個 hidden input。**不要再把它指回 `/img/wretch`**，那個目錄已經不存在。

驗證：22 頁全部 200、還原度八頁 100%、測試 149+29 全綠、uicheck 28 頁 0 問題。

### F. ~~原站有、我們沒有的七個功能~~ — **2026-08-20 全部補完**

稽核（比對測繪規格書與原始存檔）列出七項，現在都做完了：

| 功能 | 存檔狀態 | 做法 |
|---|---|---|
| 誰來收藏 | ✅ 完整 DOM ＋ 專屬 CSS | `#friend-picker` 彈窗骨架照抄，`blog_friend_picker.css` 加進 bundle。偏離：原站是 AJAX（`friend_picker.js` 打 `/ajax/` 還帶 crumb），我們沒那組 API，改成後端直接印格子、按鈕只切 visibility |
| 歷史上的今天 | ⚠ 骨架有、內容全空 | `.history > .history_title + .history_articles` 在**單篇文章頁**（不是側欄），照 `blog_2013_article_*.html:354`。每一筆的格式零存檔，自製 |
| boxFolder 自訂欄位 | ✅ 完整 DOM ×2 型態 | 三層結構與 `.side` 的 inline style 照抄，同一個 id 重複也照抄。偏離：原站可貼任意 HTML，我們照契約 §4-4 逸出，走 `render()` |
| 我的訂閱 boxRssList | ✅ 完整 DOM（在 `assets_src/`，不是 src2） | 骨架照抄，含「末尾沒有 `<br />`」這個只有它有的特徵 |
| 切割照片(NEW) | ❌ 零存檔 | 只有 `shot.md:493` 的截圖轉寫證明有這顆。介面自製，工具列那顆與 `.newVideoUpdate` 紅 NEW 章照 2013 存檔 |
| 好友分組 | ✅ 完整 DOM ×3 份 | 改成原站的整數 group id（`friend_groups` 表），分組變成一等公民、可改名 |
| 看地圖 | ❌ 零存檔 | 只有 WRETCH_SPEC.md 兩行文字轉寫。**刻意不做假地圖**——`place` 是四選一的地區分類不是座標，改成按地區攤開文章與相簿 |

> ⚠ 補功能時**先去 assets_src2/ 與 assets_src/ 找存檔再動手**。
> 我第一版把「歷史上的今天」做成側欄模組、「誰來收藏」做成內文下方一排頭像，
> 兩個都放錯位置也用錯結構——存檔裡明明都有，是我沒查就開始寫。
> 另外 `assets_src`（沒有 2）那個目錄也有東西，`boxRssList` 只有那邊有。

### E. 正式站的禮物種子 —— **下一個接手的人從這裡開始**

`tools/emptycheck.mjs` 對正式站跑，全站只剩**一個**空模組：每個人的名片都寫
「還沒有收到禮物」。禮物功能本身是好的（`test_all.mjs` 有五項在驗：送禮物／
出現在對方名片／對方收到系統訊息／不能送給自己／未登入不能送），
純粹是**正式站的資料是 2026-08-19 灌的，而禮物那一塊是之後才加進種子腳本的**。

補法就是待辦 D 那一套（種子腳本每一塊都先查再插，重跑只會補上缺的）：

```bash
railway login                                                # ⚠ CLI 目前是未授權狀態
railway variables --service station --set SEED_DEMO=force
railway logs                                                 # 禮物那塊很快，其餘會整片跳過
railway variables --service station --set SEED_DEMO=0
```

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

### D. ~~線上示範資料~~ — **2026-08-19 灌完了**

正式站現在有：39 位站友、63 本相簿、298 張真實照片（存在 R2）、64 篇網誌、
10 個揪團，以及留言／影音／嘀咕／收藏／系統訊息／檢舉。

做法是 `SEED_DEMO` 啟動旗標（`src/seed-demo.js`），因為 Railway 的 Postgres
只有內網位址、本機根本連不到，照片又要用容器裡那組 R2 憑證：

```bash
railway variables --service station --set SEED_DEMO=force   # 灌
railway logs                                                 # 追進度，約 20 分鐘
railway variables --service station --set SEED_DEMO=0        # 灌完關掉
```

- `SEED_DEMO=1`　站上沒有內容才灌
- `SEED_DEMO=force`　已經有一點內容也照樣疊加（**不刪任何既有資料**）

種子腳本**是可以重跑的**：每一塊都先查再插，重跑只會補上缺的。
實測正式站第二次跑時，照片迴響／系統訊息／檢舉／好友動態全部跳過、
照片一張都沒有重抓，只補上新的揪團。

> 加新的種子區塊時**一定要照這個寫法**（先查再插或「補到 N 筆」）。
> 無條件插入的話，正式站重跑一次資料就變兩倍——本機曾經被跑成
> photo_comments 894 筆（正確是 298）。

---

## 3. 踩過的坑（別再踩一次）

| 坑 | 說明 |
|---|---|
| **具名路由會被同層的 `:id` 吃掉，而且只有正式站會爆** | `/album/rss` 註冊在 `/album/:id` 後面，`rss` 就被當成相簿編號送進 SQL。**SQLite 只是靜靜回空**（看起來像 404，本機完全測不出來），**Postgres 直接拋 invalid input syntax for integer → 500**。全站每個帳號的相簿 RSS 都掛了一整天沒人發現。現在 router 層擋掉非數字的 id/pid/cid/aid |
| **`width:auto` 治不好所有的「太寬」** | 三個例外：①`padding-left:439px` 這種 padding 比容器還寬，box-sizing 之下盒子照樣被撐回去 ②`left:300px` 這種位移，元素寬度是對的、位置才是錯的 ③`overflow:hidden` 讓元素自成 BFC，**BFC 會主動避開浮動框**，於是 width 明明是 auto 盒子卻自己縮成 37px。前兩個要連 padding／left 一起歸零，第三個要拿掉 overflow 或清掉浮動 |
| **量測工具看不到偽元素** | `uicheck.mjs` 的「超寬元素」只走真實節點，`.block::after{width:408px}` 這種一律漏掉。頁面明明還在橫向捲、清單卻是空的，就是它。改掃 `scrollWidth` 才找得到 |
| **對正式站跑工具前先確認工具認得正式站** | `emptycheck.mjs` 只認 `/uploads/` 的照片，正式站照片在 R2，於是**整排誤報「沒有照片」**——差點照著這份假報告去重灌種子。看到「幾乎每一頁都有問題」，先懷疑工具 |
| **`--click` 與 `--dead` 會真的按下刪除鍵** | 那兩個模式只能對拋棄式資料庫跑。要驗正式站就用 `tools/linksweep.mjs`（只送 GET） |
| **檢查網址字串擋不住 SSRF** | 我第一版用正則擋 `127.` `10.` `192.168.`——兩個洞：①**DNS 才是決定連去哪裡的東西**，`evil.example.com` 的 A 記錄可以指到 127.0.0.1 或 169.254.169.254 ②**跟著轉址就等於沒檢查**，第一跳合法、302 到內網照樣跟過去。正確做法：自己做 DNS、每個解析出來的位址都驗、**把驗過的位址交給連線用**（先查再讓底層查第二次＝DNS rebinding 的空窗），轉址自己處理每跳重驗。見 `src/feed.js` |
| **私有網段要用數值比對** | `10.0.0.1` 用字串開頭比得出來，`::ffff:10.0.0.1`（IPv4-mapped IPv6）比不出來，而那是同一個位址 |
| **表單不能巢狀** | 把一個 `<form>` 塞進另一個 `<form>` 裡，瀏覽器會把內層丟掉，內層的按鈕全部變成送出外層那一份——按「刪除欄位」其實是在存設定，而且畫面上完全看不出來 |
| **測試工具會把資料清光而你以為是網站壞了** | `buttoncheck` 把每個表單都送出，包括登入表單，於是「訪客」那一輪真的登入成站長，接著按到後台的刪除帳號。後面兩輪整片 404。看到「一整片都壞了」先懷疑是不是自己剛剛刪的 |
| **刪除鈕要留到最後按，而且先刪子項** | 先按刪相簿，後面要掃的單本相簿／幻燈片／相片牆全變 404；先按 `/blog/1/del` 再按 `/blog/1/comment/1/del` 也是 404（父層刪掉會連帶刪迴響） |
| **`overflow` 會讓元素自己縮** | `overflow:hidden` 使元素自成 BFC，而 **BFC 會主動避開浮動框**。於是 width 明明是 auto、盒子卻只有 37px。這是 RWD 最不直覺的一類，查半天都在看 width |
| **量測工具看不到偽元素** | uicheck 的「超寬元素」只走真實節點，`::after{width:408px}` 一律漏掉。頁面還在橫向捲、清單卻是空的，就是它 |
| **鎖文標題本來就會出現在列表** | 原站的列表印鎖文標題加一個鎖頭圖，只有內容要密碼。所以「整頁不能出現鎖文標題」這種斷言是錯的，要驗的是**那一區**有沒有列它、以及內文有沒有外洩 |
| **Express 4 不接住 async handler 的錯誤** | 那是 Express 5 才有的行為。沒有 `wrapAsync` 的話，任何 DB 錯誤都會變成 unhandled rejection，請求永遠掛著。已在 `src/server.js` 註冊層處理 |
| **`one(...).c` 加 await 的陷阱** | `await one(...).c` 會先對 Promise 取屬性得到 undefined 再 await，**不拋錯**，只是所有計數變空。要寫成 `(await one(...)).c`。全檔有 24 處 |
| **connect-redis 是具名匯出** | v7 起沒有 default。寫錯會讓正式站起不來，而且**本機測不出來**（沒有 REDIS_URL 就提早 return，那段程式碼從沒被執行）。`test_pg.mjs` 已加測試釘住 |
| **只看 DATABASE_URL 存不存在來切資料庫很危險** | 平台會自動注入這個變數，一個不小心整站切到空資料庫。現在要 `DB_DRIVER=postgres` 明確指定 |
| **archive.org 會拒連，也會回自己的錯誤頁** | 錯誤頁是正常 DOM，會被當成載入成功，量出假數據。`tools/shot.mjs` 已加哨兵選擇器偵測 |
| **手寫 parser 做 codemod 必錯** | 我踩了三次（視窗太短、把 `...` 誤判成成員存取、字串遮罩失步，漏 47 處）。`tools/codemod-await.mjs` 已改用 acorn，並會自己再解析一次驗證 |
| **測試不要綁 class 名稱** | 復刻不同年代時 class 一定會變，綁 class 會在功能沒壞時誤報。要驗行為 |
| **原版用詞** | 2012 是「回上一層」，「回頂端」是 2005 的說法 |
| **EJS 註解裡不能寫出 EJS 的標記符號** | 會被當成標記提早結束，整頁 500。**同一天踩了三次**：把註解塞進 include 的參數物件、註解裡寫 `width=100` 加百分號加大於號、註解裡寫未逸出輸出的寫法。要提到就用文字描述，不要寫符號 |
| **樣板字串裡的 `\d` 會被吃掉** | `` new RegExp(`/x/(\d+)`) `` 組出來是 `(d+)`，永遠比不到。用一般字串相接，或直接寫 `[0-9]` |
| **Windows 上不能照行程名殺 server** | `node src/server.js` 那些行程命令列一模一樣（DATA_DIR 是環境變數，命令列上看不到），照名字殺會把別人的 server 一起殺掉——我就這樣把五個 agent 的 server 全關了。要照 port 找 PID（`Get-NetTCPConnection -LocalPort <埠>`） |
| **種子資料的值一定要對得上白名單** | 名片的性別／居住地／星座、網誌的 topic 都有白名單過濾，對不上就存空字串或變成騙人的連結，而且**畫面不會報錯**。踩過兩次 |
| **不要憑 grep 次數下結論** | 我曾拿「心情」grep 原版存檔中了 5 次就斷定列表頁有這個欄位，實際上那 5 次全是文章標題裡的「小心情」。要看上下文 |
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
| `tools/uicheck.mjs` | **真的用瀏覽器檢查**：playwright-core 開系統 Chrome 把頁面畫出來，量橫向溢出（跑版）、超寬元素、壞圖、文字被切、JS 錯誤、失敗請求。`--click` 把站內連結全點一次；`--dead` **真的按下去**找「看起來能按、點了沒反應」的死控制項（按完看網址／DOM／請求有沒有變，三個都沒有才算死）。`VW=375` 之類可換視窗寬 |
| `tools/buttoncheck.mjs` | **每一顆按鈕都真的按下去**：三種身分 × 每一頁的每個 form 都送出一次。會刪東西，只對它自己開的拋棄式資料庫跑 |
| `tools/clickcheck.mjs` | **「看得到卻點不到」掃描**：不按，只問瀏覽器「這個連結的中心點實際上會收到點擊的是誰」。唯讀，對正式站安全 |
| `tools/linksweep.mjs` | **唯讀全站連結掃描**：廣度優先爬完整站，回報非 2xx／3xx 並印出「是哪一頁連過去的」。只送 GET，**對正式站跑是安全的**。相簿 RSS 全站 500 就是它抓到的 |
| `tools/rwdprobe.mjs` | **RWD 迭代**：開正式站的頁面、注入本機那份 rwd css 再量，不必等部署也不必本機有種子資料 |
| `tools/runtests.mjs` | **跑測試就用這支**：自己關掉佔埠的 server、開乾淨的 DATA_DIR、跑 test_all 與 test_pg |
| `tools/emptycheck.mjs` | **空頁檢查**：掃全站每一頁（含 24 個相簿分類、12 個網誌分類），找出還印著「還沒有…」的模組、沒有照片的頁、以及純色色塊假照片。還原度 100% 不代表看起來不空，這兩支要一起跑 |
| `tools/shot.mjs geo <原版> <我們> <選擇器清單>` | 幾何比對（要連 archive.org，會被限流） |
| `tools/shot.mjs shot/pair/tree/measure` | 截圖／像素 diff／版面藍圖／元素量測 |
| `tools/build-css2012.mjs` | 從原站原始 CSS 產生樣式 bundle，**不要手改 `public/wretch2012*.css`** |
| `tools/build-assets.mjs` | 2005 版素材管線（已停用，`attic/` 那批才用得到） |
| `tools/seed-demo.mjs [--reset]` | 示範資料（台灣照片，走 R2） |
| `tools/codemod-await.mjs <檔>` | 同步→非同步轉換（acorn，含自我驗證） |
| `test_all.mjs` / `test_pg.mjs` | 回歸測試 128 項／SQL 方言 29 項（`test_all` 要對乾淨的 DB 跑，見第 1 節） |
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
