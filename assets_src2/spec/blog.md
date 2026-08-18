# 無名小站 最後版（2011–2013）網誌 blog 規格書

代號：**blog**　測繪日期：2026-08-18
標記：**【驗】** = 直接讀自下載回來的原始檔　**【推】** = 推測　**查無** = 存檔中找不到

---

## 0. 最重要的三個發現（先看這個）

1. **最後版網誌的 HTML 骨架，跟 2005 年那版是「同一套模板」。**【驗】
   Yahoo 接手後只換掉了外框（`#hugewrapper` / `kukubar` 上下工具列）、加上社群分享列、推文鈕、
   引用（trackback）區、誰來我家等模組；**文章區與側欄的 id/class 命名完全沒變**
   （`#container1 / #main2 / #content / #links / .blogbody / .articletext / .posted / .sidetitle / #boxXxx`）。
   對照組：`assets_src/html/blog_home.html`（2007 年抓的）與本次 2012/2013 抓的頁面，結構一模一樣。

2. **網誌沒有「官方共用樣式表」。每個使用者都掛自己的 `blog.css`。**【驗】
   每一頁 `<head>` 都是：
   ```
   l.yimg.com/e/serv/blog/css/top.css            ← 官方，只有 9 行補丁
   f<N>.wretch.yimg.com/<user>/files/blog.css    ← 版型＋配色全在這（每人一份）
   l.yimg.com/e/serv/common/css/sharing.css      ← 官方，社群分享列
   l.yimg.com/e/serv/blog/css/font.css           ← 官方，迴響/推文鈕/誰來我家
   l.yimg.com/e/serv/blog/css/antiPhishing.css   ← 官方
   l.yimg.com/e/serv/blog/css/trackback.css      ← 官方
   l.yimg.com/e/serv/blog/css/friend_picker.css  ← 官方（誰來收藏彈窗）
   l.yimg.com/e/serv/common/css/kukubar.css      ← 官方（上下工具列，屬 chrome 代號）
   ```
   使用者換造型時，系統把選中的官方樣板 CSS **複製一份**寫進 `<user>/files/blog.css`。
   官方樣板的圖片放在 `l.yimg.com/e/style/<群組>/<樣板編號>/`。

3. **預設樣式 = 樣板 `1/117`。**【驗】（判定理由見 §2）
   找到一份使用者 CSS 開頭寫著：
   ```css
   /*
   無名小站預設樣式，使用者可以亂改
   */
   ```
   這份 CSS 的圖片全部指向 `http://l.yimg.com/e/style/1/117/`。
   我另外抓到的其他使用者 CSS（樣板 8/857、8/883、以及完全手改的）都**沒有**這行註解。
   → 檔案已存 `assets_src2/css/blog_default_skin117_afuuu_blog.css`，六張樣板圖也全抓到了。

> ⚠️ **語言警告（很重要）**【驗】
> Internet Archive 從 2007 到 2013 抓到的**所有**網誌使用者頁面，模板字串都是**英文**
> （`Reply(3)` / `Post A Comment` / `Recent Articles` / `Monthly Archives` …）。
> 我測試了 2008/2009/2010/2011/2012/2013 共 12 個快照，一個中文版都沒有。
> 判斷：IA 爬蟲沒有語系 cookie，無名回英文語系表。
> 但是**後期新加的功能是寫死中文**（推薦此文章／推／收／發文／找知識／1樓搶頭香／歷史上的今天／本篇文章引用自此／音樂播放／誰來收藏…），這些我全部照抄了。
> 所以：**§6 分兩張表**——「A. 抓到的英文字串（【驗】）」與「B. 寫死的中文字串（【驗】）」。
> 台灣使用者實際看到的中文版模板字串，我抓不到，**不編**，見 §6-C 標【推】清單。

---

## 1. 快照清單（我實際下載並打開看過的）

### 1-1 頁面 HTML → `assets_src2/html/`

| 存檔檔名 | 快照網址 | 是什麼 |
|---|---|---|
| `blog_2012_default_skin_afuuu.html` | https://web.archive.org/web/20120621072959id_/http://www.wretch.cc/blog/afuuu | **2012 年、套用預設樣式（1/117）的網誌首頁**。最重要的一頁 |
| `blog_2012_article_boogier_16702046.html` | https://web.archive.org/web/20120415031503id_/http://www.wretch.cc/blog/%20boogier/16702046 | 2012 單篇文章頁。功能最齊：迴響＋站長回覆、收藏、推文、社群列、月曆、自訂欄位 ×20 |
| `blog_2012_index_AndreaCorlen.html` | https://web.archive.org/web/20120817013114id_/http://www.wretch.cc/blog/%20AndreaCorlen | 2012 首頁（多篇文章列表），含 `#boxMusic`、`#boxWho` |
| `blog_2013_index_treehouse16.html` | https://web.archive.org/web/20130727092926id_/http://www.wretch.cc/blog/%20treehouse16 | 2013 首頁，含 `#boxSlideShow` |
| `blog_2013_index_allmodules_f128052035.html` | https://web.archive.org/web/20130525003909id_/http://www.wretch.cc/blog/%20f128052035 | 2013 首頁，**側欄模組最齊**（相簿輪播＋音樂＋誰來我家＋自訂欄位） |
| `blog_2013_article_a000000000_21636113.html` | https://web.archive.org/web/20131224224101id_/http://www.wretch.cc/blog/a000000000/21636113 | 2013 單篇文章頁，含「歷史上的今天」區塊 |
| `blog_2013_article_a0000000_32846743.html` | https://web.archive.org/web/20131227091716id_/http://www.wretch.cc/blog/a0000000/32846743 | 2013 單篇文章頁 |
| `blog_2013_article_comments_page2.html` | https://web.archive.org/web/20131224224105id_/http://www.wretch.cc/blog/a000000000/21761736&page=2 | **迴響分頁**第 2 頁（Previous/1/2/3/4/5/Next） |
| `blog_2013_article_trackback_page2.html` | https://web.archive.org/web/20131224224102id_/http://www.wretch.cc/blog/a000000000/21761736&tpage=2 | **引用分頁**第 2 頁 |
| `blog_2013_category_list.html` | https://web.archive.org/web/20130318024223id_/http://www.wretch.cc/blog/a000000000&category_id=11565752 | 分類文章列表（表格版） |
| `blog_2011_category_paginated_boogier.html` | https://web.archive.org/web/20110904114057id_/http://www.wretch.cc/blog/boogier&category_id=1861420 | 分類列表**有分頁**的樣子（`.list-linkcontrol`） |
| `blog_2013_monthly_calendar.html` | https://web.archive.org/web/20130322103329id_/http://www.wretch.cc/blog/a000000000&schedule=1&year=2008&month=10 | 月曆模式的月份彙整頁 |
| `blog_2012_service_index.html` | https://web.archive.org/web/20120101190513id_/http://www.wretch.cc/blog/ | 網誌服務首頁（`/blog/`，非個人網誌） |

### 1-2 CSS / JS → `assets_src2/css/`

| 存檔檔名 | 快照網址 | 說明 |
|---|---|---|
| `blog_default_skin117_afuuu_blog.css` | https://web.archive.org/web/20131227051458id_/http://f12.wretch.yimg.com/afuuu/files/blog.css?1308738218 | **預設樣式 1/117 全文**（4434 B，Last-Modified 2012-02-06） |
| `blog_top.css` | https://web.archive.org/web/20120416060117id_/http://l.yimg.com/e/serv/blog/css/top.css?20120405 | 官方補丁（353 B） |
| `blog_font.css` | https://web.archive.org/web/20120416060117id_/http://l.yimg.com/e/serv/blog/css/font.css?20120405 | 官方：迴響區、推文鈕、誰來我家、收藏（4430 B） |
| `blog_trackback.css` | https://web.archive.org/web/20120416060118id_/http://l.yimg.com/e/serv/blog/css/trackback.css?20120405 | 引用區展開/收合（414 B） |
| `blog_antiPhishing.css` | https://web.archive.org/web/20120416060118id_/http://l.yimg.com/e/serv/blog/css/antiPhishing.css?20120405 | 外連警告彈窗（1583 B） |
| `blog_friend_picker.css` | https://web.archive.org/web/20130506140632id_/http://l.yimg.com/e/serv/blog/css/friend_picker.css?20120405 | 「誰來收藏」彈窗（2388 B） |
| `blog_func_blog.js` | https://web.archive.org/web/20120416060118id_/http://l.yimg.com/e/serv/blog/js/func_blog.js?20120405 | 官方 JS（7151 B），互動行為全在裡面 |

> `sharing.css`（社群分享列）與其圖示已由 album 代號抓過，**不重複**：
> `assets_src2/css/album_sharing.css`、`assets_src2/img/album/ico_facebook.png` / `ico_plurk.png` / `ico_yim_png8.png` / `ico_wretch.png` / `ico_reblog_arrow.png` / `ico_kplizer.png` / `ico_kplizer_hover.png`。
> kukubar（上下工具列）屬 chrome 代號，見 `assets_src2/css/chrome_kukubar.css`。

### 1-3 圖片 → `assets_src2/img/blog/`

樣板 1/117 六張圖的快照網址：
- https://web.archive.org/web/20111207111128id_/http://l.yimg.com/e/style/1/117/banner.gif
- https://web.archive.org/web/20121105203059id_/http://l.yimg.com/e/style/1/117/blogbody.gif
- https://web.archive.org/web/20111207111128id_/http://l.yimg.com/e/style/1/117/box.gif
- https://web.archive.org/web/20121105203101id_/http://l.yimg.com/e/style/1/117/box1.gif
- https://web.archive.org/web/20121105203104id_/http://l.yimg.com/e/style/1/117/calendar.gif
- https://web.archive.org/web/20120118060123id_/http://l.yimg.com/e/style/1/117/date.gif

其餘官方圖示（皆用 `https://web.archive.org/web/20120415031503id_/` + 原網址取得）詳見 §7。

---

## 2. 「預設樣式」怎麼認定的（證據）

| 來源 | 內容 |
|---|---|
| `afuuu/files/blog.css` 第 1–3 行【驗】 | `/*` / `無名小站預設樣式，使用者可以亂改` / `*/` |
| 該檔六張背景圖【驗】 | 全部 `http://l.yimg.com/e/style/1/117/*.gif` |
| 對照：`ts02670872/files/blog.css`【驗】 | 首行 `* {margin:0;padding:0;}`，圖片是 `e/style/8/857/`，**沒有**那行註解 |
| 對照：`treehouse16/files/blog.css`【驗】 | 首行 `body { background:url(f12.wretch.yimg.com/...)`，圖片是 `e/style/8/883/`，**沒有**那行註解 |
| 對照：`a000000000/files/blog.css`【驗】 | 全手改粉紅版（840px 寬），**沒有**那行註解 |
| 對照：`f128052035/files/blog.css`【驗】 | 全手改，**沒有**那行註解 |

→ 結論：**樣板 1/117 就是官方預設樣式**。【驗 CSS 內文；「所有新帳號預設都是它」這句是【推】】

我**沒有**找到官方換造型（樣板列表）頁面的存檔 —— **查無**。
`l.yimg.com/e/style/` 目錄的 CDX prefix 查詢會 504（資料量太大），只成功列出 `1/117/` 底下的檔案。

---

## 3. 尺寸（全部【驗】，來源標在後面）

### 3-1 版面骨架（預設樣式 1/117）

| 項目 | 值 | 出處 |
|---|---|---|
| 版面總寬 | **750px**，水平置中 | `#container1{margin:0 auto;width:750px}` |
| 內文欄 `#content` | **530px**，`float:left` | `#content{width:530px;float:left}` |
| 側欄 `#links` | **200px**，`float:right` | `#links{width:200px;float:right}` |
| 兩欄之間空隙 | **20px**（750−530−200，靠左右浮動自然產生，沒有明確 margin） | 計算 |
| Banner 高 | **120px**，`margin-bottom:20px` | `#banner{height:120px;margin-bottom:20px}` |
| `#pageheader` | `padding-left:20px` | 同上 |
| `#description2 .description` | `display:block; width:730px; height:60px; overflow:auto` | 同上 |
| body | `margin:0` | `body{margin:0;font:.8em Arial}` |

### 3-2 文章區

| 項目 | 值 | 出處 |
|---|---|---|
| `.date`（日期分隔條） | `height:25px` + `padding-top:5px` → **總高 30px**；`padding-right:25px`；`text-align:right` | `.date{...}` |
| `.date` 背景圖 | `date.gif` `no-repeat top left`（530×30） | 同上 |
| `.blogbody` | `padding-bottom:20px; margin-bottom:20px`；背景 `blogbody.gif no-repeat bottom left`（530×20） | `.blogbody{...}` |
| `.blogbody2` | 純底色 `#ddd`，無其他尺寸 | `.blogbody2{background:#ddd}` |
| `.articletext` | `padding: 5px 20px 0 20px` | `.articletext{...}` |
| `.title`（h3） | `margin-top:0`（其餘用瀏覽器預設 h3） | `.title{margin-top:0}` |
| `.posted` | `text-align:center` | `.posted{text-align:center}` |
| `.total-comments-div`（迴響區外框） | **width:300px; margin-left:30px** ← 注意，迴響區比內文欄窄很多 | `.total-comments-div{...}` |
| 迴響輸入框 `#text` | `width:80%`（於 300px 容器內）＋ inline `style="width: 90%"`（HTML 上有 inline，會蓋掉 CSS） | `#text{width:80%}` ／ HTML |
| `.comments-head` | `border-bottom:1px solid black; font-weight:bold; margin-top:15px` | `.comments-head{...}` |
| `.comments-body` | 底色 `#e6e6e6`（skin）＋ `margin-bottom:12px; border-bottom:1px dashed #666; padding:6px`（font.css） | 兩處疊加 |
| 迴響大頭貼 | `.comments-body span a{display:block;width:90px;height:90px}`；圖片本身 90×90 | font.css |
| `.comments-author`（站長回覆） | `padding:6px 6px 6px 24px; background:#fff; opacity:.8` | font.css |
| `.comments-post` | `font-size:10px; color:#777; text-align:right`（skin）＋ `display:block;clear:both;padding-top:3px`（font.css） | 兩處 |
| 推文鈕 `#content #push` | **81×59**，`border:1px solid #999`，`float:right`，`margin-bottom:3px; margin-left:3px`，`line-height:18px; font-size:12px; font-family:georgia`，背景 `border.png`（81×59） | font.css |
| `#push a`（推／收） | `width:24px; height:19px; padding:0 0 0 12px; border:1px solid #aaa` → **外框實際 38×21**；背景 `push.gif`/`pull.gif`（36×19）置中；`display:block; float:left`，`font-size:13px`，`margin:0 0 0 1px`（標準模式下 `html>body #push a.push{margin:0 0 0 2px}`） | font.css |
| `#push span`（推薦數） | `display:block; font-weight:bold; font-size:16px` | font.css |

### 3-3 側欄

| 項目 | 值 | 出處 |
|---|---|---|
| `.sidetitle`（模組標題列） | `height:19px` + `padding:11px 20px 0 20px` → **總高 30px**；`font-weight:bold; letter-spacing:2px`；背景 `box.gif`（200×30） | `.sidetitle{...}` |
| 模組外框 `#boxXxx` | 背景 `box1.gif no-repeat bottom left`（200×20）；`padding-bottom:20px; margin-bottom:20px` | 見 §4 選擇器清單 |
| `.side`（模組內容） | `background:#eee; border:6px solid #fff; border-bottom:0; border-top:2px solid #fff` → 內容寬 200−12 = **188px** | `.side{...}` |
| `#links a`（側欄連結，塊狀） | `display:block; width:173px; padding:2px 5px 2px 10px`（173+15 = 188，剛好塞滿 `.side`）；`font-size:12px`；`border-bottom:1px solid #eee` | `#links a{...}` |
| `.calendar`（月曆） | **200×200**，`font-size:12px`，`margin-bottom:20px`，背景 `calendar.gif`（200×200） | `.calendar{...}` |
| 月曆 table | `border=0 cellspacing=4 cellpadding=0` | HTML |
| `#boxFolder .side` | HTML 上有 inline `style="width: 200px;"`（**加上 12px border 會超出 200px 欄寬**，是原站的小 bug，照抄） | HTML |
| 誰來我家 `#boxWho #whowrapper` | 容器 `width:166px; overflow:hidden; margin-bottom:1em`；`li` `50×50`，`float:left`，`margin-top:4px; margin-left:4px`；`img` `50×50; border:0` | font.css |
| 誰來我家連結 | `#links #whowrapper a{width:50px}` | skin |
| 相簿輪播 `#boxSlideShow` | 圖 `<td height=95 width=95>`；預設圖 `user_cover.gif` 85×85；標題 `<textarea cols=8 style="height:60px">` | HTML |
| 音樂 `#boxMusic` | flash 播放器 `width=130 height=20` | HTML |
| `.boxCounter1 .side` | 額外 `padding-left:20px` | skin |

### 3-4 圓角半徑（從樣板圖量出來的）【驗】

樣板 1/117 的圓角是**用 GIF 圖做的**，不是 CSS border-radius（2012 年還在相容 IE6）。
從 `calendar.gif` 逐列取樣：

```
y=0  兩側透明 14px   (6px 邊距 + 8px 圓角)
y=1  兩側透明 11px   (6 + 5)
y=3  兩側透明  8px   (6 + 2)
y=10 兩側透明  2px … 之後就是 6px 純邊距
y=100 #FFFFFF x6 | #EEEEEE x188 | #FFFFFF x6
```
→ **左右各留 6px 白邊，圓角半徑約 8px**。若要用 CSS 重製：`border-radius: 8px` 並讓容器內縮 6px。【驗＋計算】

---

## 4. 精確色碼表

### 4-1 預設樣式 1/117（`blog_default_skin117_afuuu_blog.css`）— 全部【驗】

| 用途 | 色碼 | CSS 規則 |
|---|---|---|
| 頁面底色 | *沒有設定* → 瀏覽器預設白 `#FFFFFF` | `body{margin:0;font:.8em Arial}` |
| Banner 底色（圖） | `#EEEEEE`（`banner.gif` 主色） | `#banner{background:url(.../banner.gif)}` |
| 網誌標題連結 | `#777777` | `#banner h1 a{color:#777}` |
| 網誌標題連結 hover | `#333333` | `#banner h1 a:hover{color:#333;text-decoration:none}` |
| 內文區連結 | `#547F8F` | `#content a{color:#547F8F}` |
| 內文區連結 hover | `#2B5D70` | `#content a:hover{color:#2B5D70;text-decoration:none}` |
| 文章卡片底 | `#DDDDDD` | `.blogbody2{background:#ddd}` |
| 文章卡片上下圓角（圖） | `#DDDDDD` | `date.gif` / `blogbody.gif` 主色 |
| 日期條內部 | `#FFFFFF`（`date.gif` 內部） | `date.gif` 取樣 |
| 迴響卡片底 | `#E6E6E6` | `.comments-body{background:#e6e6e6}` |
| 迴響時間/署名 | `#777777` | `.comments-post{font-size:10px;color:#777;text-align:right}` |
| 迴響標題底線 | `black`（`#000000`） | `.comments-head{border-bottom:1px solid black}` |
| 側欄連結文字 | `#728A3E` | `#links a{color:#728A3E}` |
| 側欄連結底 | `#E5E5E5` | `#links a{background:#e5e5e5}` |
| 側欄連結分隔線 | `#EEEEEE` | `#links a{border-bottom:1px solid #eee}` |
| 側欄連結 hover 文字 | `#4381A1` | `#links a:hover{color:#4381A1}` |
| 側欄連結 hover 底 | `#FFFFFF` | `#links a:hover{background:#fff}` |
| 側欄內容底 | `#EEEEEE` | `.side{background:#eee}` |
| 側欄內容外框 | `#FFFFFF`（左右下 6px、上 2px） | `.side{border:6px solid #fff;border-bottom:0;border-top:2px solid #fff}` |
| 模組標題底（圖） | `#DDDDDD` on `#FFFFFF` | `box.gif` 取樣 |
| 模組底部圓角（圖） | `#EEEEEE` on `#FFFFFF` | `box1.gif` 取樣 |
| 月曆底（圖） | `#EEEEEE` on `#FFFFFF` | `calendar.gif` 取樣 |
| 分類/簡介清單「空白字」隱藏色 | `#EEEEEE`（`font-size:0;letter-spacing:-2px`，把樣板文字藏掉的老招） | `.boxCategory1,.boxProfile1{font-size:0px;letter-spacing:-2px;color:#eee}` |
| 最新迴響/引用/RSS 清單附註文字 | `#666666` | `.boxNewComment1 / .boxRssList1 / .boxNewTrackback1{color:#666;font-size:10px}` |

### 4-2 官方 `font.css`（不管換什麼造型都會套用）— 全部【驗】

| 用途 | 色碼 | CSS 規則 |
|---|---|---|
| 迴響卡片底部虛線 | `#666666` | `.comments-body{border-bottom:1px dashed #666}` |
| 站長回覆底 | `#FFFFFF`（opacity .8） | `.comments-author{background:#fff;opacity:0.8;filter:alpha(opacity=80)}` |
| 站長回覆文字 | `#555555` | `.comments-author{color:#555}` |
| 站長回覆署名 | `#888888` | `.comments-author .comments-post{color:#888}` |
| 站長回覆署名連結 | `#000000`（底線） | `.comments-author .comments-post a{color:#000;text-decoration:underline}` |
| 站長回覆署名連結 hover | `#999999` | `.comments-author .comments-post a:hover{color:#999}` |
| 推文鈕外框 | `#999999` | `#content #push{border:1px solid #999}` |
| 推文鈕文字 | `#4B4B4B` | `#content #push{color:#4B4B4B}` |
| 推/收 小鈕外框 | `#AAAAAA` | `html #push a{border:1px solid #aaa}` |
| 推/收 小鈕文字 | `#777777` | `html #push a{color:#777}` |
| 「推」hover 文字 | `#0099CC` | `html #push a.push:hover{color:#09c}` |
| 「推」hover 外框 | `#1A84B7` | `html #push a.push:hover{border-color:#1A84B7}` |
| 「收」hover 文字 | `#FF0099` | `html #push a.pull:hover{color:#f09}` |
| 「收」hover 外框 | `#E2669E` | `html #push a.pull:hover{border-color:#e2669e}` |
| 收藏日期文字透明度 | `opacity:0.7` | `p.collect_date{opacity:0.7}` |
| 收藏簡介底線 | `#666666` 虛線 | `#links #boxCollection #collect_description{border-bottom:1px dashed #666}` |

### 4-3 官方 `top.css`【驗】

| 用途 | 色碼 | CSS 規則 |
|---|---|---|
| 樓層別名（隱藏用） | `blue` | `.cmt_floor_hide{color:blue;margin-bottom:.5em;display:none}` |
| 樓層號碼 | 無色設定，`float:right` | `.cmt_floor{float:right}` |

### 4-4 官方 `friend_picker.css`（誰來收藏彈窗＋收藏留言框）【驗】

| 用途 | 色碼 |
|---|---|
| 收藏留言框外框 | `#DFE8F6`（5px） |
| 收藏留言框底 / 文字 | `#FFFFFF` / `#444444` |
| 誰來收藏彈窗外框 | `#DFE8F6`（外 1px + 內 5px） |
| 誰來收藏文字 | `#666666`，寬 **405px**，`font:11px arial,sans-serif` |
| 誰來收藏連結 | `#1A84B7` |
| 頭像格 `.friend-picker-cell` | `70×80`，`border:2px solid #fff` |
| 頭像格 hover | `border:2px solid #B0CCEF; border-radius:5px` |
| 頭像格 選中(IE6) | `border:2px solid #67A7E3` |
| 彈窗標題列 | 底 `#F8FBFC`，高 18px，`text-indent:7px` |
| 標題列選中態 | 底 `#666`、字 `#EFEFEF` |
| 分頁鈕 | 底 `#FFFFFF`，`border:1px solid #CCCCCC`，`padding:2px 7px`，`margin-right:4px` |
| 分頁鈕 current | 底/框都 `#fff` |

### 4-5 官方 `antiPhishing.css`（外連警告彈窗）【驗】

| 用途 | 色碼 |
|---|---|
| 面板底 | `#F2F2F2` |
| 面板外框 | `2px solid #D2D2D2`，`border-radius:10px` |
| 警告標題文字 | `#000000`，`font-size:116%`，`font-weight:bold`，`width:270px` |
| 說明文字 | `#666666`，`font-size:93%`，`width:270px` |
| 說明內連結 | `#3399CC` |
| 存檔訊息 | `#FF0000`，`font-size:85%` |

### 4-6 官方 `sharing.css`（社群分享列，檔案在 `album_sharing.css`）【驗】

| 用途 | 色碼／尺寸 |
|---|---|
| `.social-wrapper` | `height:32px; margin-bottom:5px` |
| 分享鈕 `.social-widget .bd a` | `30×28`，`border:1px solid #E3E3E3`，底 `#FFFFFF`，`background-position:7px 6px`，`text-indent:-9999px` |
| 分享鈕 hover | `border:1px solid #BFBFBF`，底 `#F8F8F8` |
| 第一顆（fb）圓角 | `border-radius:3px 0 0 3px` |
| 「發文」鈕 `.wretch-reblog .bd a.wretch` | 高 28、`line-height:28px`、`padding-left:24px`、`font:12px arial`、文字 `#666666`、`border:1px solid #E3E3E3`、`border-radius:0 3px 3px 0`、底 `#FFFFFF` |
| 「發文」數字泡泡 `.bubble` | `border:1px solid #A3A0A1`，`border-radius:2px`，`font-size:11px`，`padding:1px 3px 2px 4px`，`line-height:12px` |
| 泡泡漸層 `.bubble-gradient` | `#FFFFFF` → `#F7EFF7`（linear-gradient top→bottom） |
| 「找知識」`.kplizer a.kplizer-btn` | `82×27`，`background:url(ico_kplizer.png)`，hover 換 `ico_kplizer_hover.png` |

---

## 5. 字型與字級【驗】

| 位置 | 設定 | 出處 |
|---|---|---|
| **全站基準** | `font: .8em Arial` → **12.8px Arial**，行高瀏覽器預設 | 預設樣式 `body{}` |
| 日期分隔條 `.date` | `font-size:20px; letter-spacing:-1px` | 預設樣式 |
| 文章標題 `h3.title` | 沒設 → 瀏覽器 h3 預設（粗體、約 1.17em ≒ **15px**、上下 margin 1em；`.title{margin-top:0}` 只清掉上 margin） | 預設樣式 |
| 側欄連結 | `font-size:12px` | `#links a` |
| 模組標題 `.sidetitle` | `font-weight:bold; letter-spacing:2px`，字級繼承 12.8px | 預設樣式 |
| 月曆 `.calendar` | `font-size:12px` | 預設樣式 |
| 最新迴響/引用附註 | `font-size:10px`；其中的 `a` 回到 `12px` | 預設樣式 |
| 迴響署名 `.comments-post` | `font-size:10px` | 預設樣式 |
| 推文鈕 `#push` | `font-family:georgia; font-size:12px; line-height:18px` | font.css |
| 推文數字 | `font-size:16px; font-weight:bold` | font.css |
| 推／收 小鈕 | `font-size:13px` | font.css |
| 誰來收藏彈窗 | `font:11px arial, sans-serif` | friend_picker.css |
| 「發文」鈕 | `font-family:arial; font-size:12px` | sharing.css |
| 收藏分類標題 `.collect_cate` | `font-size:1.3em; font-weight:bold` | font.css |

**`font.css` 另外定義了使用者發文時可選的字級 class**【驗】：
```css
.normal-c { font-size:16px; font-family:"新細明體" }
.big-c    { font-size:32px; font-family:"新細明體" }
.small-c  { font-size:12px; font-family:"新細明體" }
.big-e    { font-size:32px; font-family:"Verdana","Arial","Helvetica","sans-serif" }
.normal-e { font-size:20px; font-family:"Verdana","Arial","Helvetica","sans-serif" }
.small-e  { font-size:11px; font-family:"Verdana","Arial","Helvetica","sans-serif" }
```

`font.css` 還有 `input { display:inline !important; }` 一條全域強制規則（避免使用者 CSS 把輸入框弄成 block）。【驗】

---

## 6. 逐字文案

### 6-A 抓到的模板字串（英文語系）【驗】

> 這些是存檔頁面實際輸出的字。**不是**台灣使用者看到的中文版。

**文章區**
| 位置 | 原文 |
|---|---|
| `.datediv` 日期格式 | `December 3, 2011`（`Month D, YYYY`） |
| 分類列表頁 `.datediv` | `Category: 搞笑影片` |
| 全部文章頁 `.datediv` | `All Articles` |
| 首頁摘要「繼續閱讀」 | `(More......)` |
| 文章下方個人分類 | `Personal Category: ` |
| 文章下方站方分類 | `Topic:  ` |
| 上一篇 | `Previous in This Category: ` |
| 下一篇 | `Next in This Category: ` |
| 人氣計數 | `Today's Visitors: 0            Total Visitors: 4530` |
| `.posted` 完整一行 | `boogier at 無名小站 at 06:51 AM post | Reply(3) | Trackback(0) | Collection(2) | prosecute` |
| （2007 年舊版同一位置） | `wretchtalk at WRETCH at 03:00 PM post | Comment(11) | Trackback(0)` ← 註：2012 已改成 `Reply(N)` |

**迴響區**
| 位置 | 原文 |
|---|---|
| 迴響標題 | `Reply` |
| 發表迴響標題 | `Post A Comment` |
| 分頁 | `Previous` / `1` / `2` … / `Next` |
| 迴響者那行 | `上面的好像很厲害 at December 9, 2011 07:13 PM comment` |
| 站長回覆那行 | `Blog Owner at December 9, 2011 07:18 PM Reply` |
| 悄悄話（在最新迴響側欄） | `<img src=lock.gif>Sealed` |
| 檢舉連結 | `prosecute` |
| 表單 label | `Name:` / `Email:` / `URL:` / `Remember Me` / `Comments ( MAX: 1000 characters ) :` |
| 記住我 radio | `Yes` / `No`（預設選 Yes） |
| 驗證碼提示 | `Please input the magic number:` |
| 驗證碼說明 1 | `( Prevent the annoy garbage messages )` |
| 驗證碼說明 2 | `( What if you cannot see the numbers? )`（紅字連 `/hala/viewtopic.php?t=65568`） |
| 驗證碼圖 alt | `Please input the magic number` |
| 送出／取消 | `Post` / `Cancel` |
| JS 空白警告 | `Please input the content` |
| JS 超長警告 | `Comments limit: 1000 characters...` |

**引用（trackback）區**
| 位置 | 原文 |
|---|---|
| 引用網址標題 | `[Trackback URL]` |
| 複製鈕 | `Copy Trackback Url` |
| 複製後 alert | `Already copy to the clipboard` |
| 引用區標題 | `Trackback` |
| 引用分頁 | `Previous` / `1`… / `Next` |
| 每筆引用署名 | `爆笑轉載 【Forever ×￡︴friend…　＆ secret love】 at July 29, 2008 04:23 AM Trackback` |

**收藏彈窗 `#collection_comments`**
| 位置 | 原文 |
|---|---|
| 標題 | `You can leave comment to this collection` |
| 分類 | `Collection Category:` |
| 新增分類 | `Add Collection Category` |
| 留言 | `Collection Comment:` |
| 送出／取消 | `Confirm Collection` / `Cancel` |

**側欄模組標題（`.sidetitle`）**
| 模組 id | 標題原文 |
|---|---|
| `#boxMySpace` | `boogier's Home`（`<使用者>'s Home`） |
| `#boxSlideShow` | `Now Playing: 進擊的巨人`（`Now Playing: <相簿名>`） |
| `#boxMusic` | `音樂播放` ← **這個是中文** |
| `#boxNewArticle` | `Recent Articles` |
| `#boxCategory` | `Categories` |
| `#boxDate` | `Monthly Archives` |
| `#boxSearch` | `Search This Blog` |
| `#boxNewComment` | `Recent Comments`（右側附 RSS 圖） |
| `#boxNewTrackback` | `Recent Trackbacks` |
| `#boxFolder` | 使用者自訂，例：`【About  Me】` / `【About My Pets】` / `【線上人數】` / `【FLAG COUNTER】` |
| `#boxWho` | `Who came to my blog` |
| `#boxCounter` | `Visitors Counter` |

**側欄內文**
| 位置 | 原文 |
|---|---|
| `#boxMySpace > #blogCategory` | `Topic:` + 站方分類連結（例 `Entertainment` / `Free Writing`） |
| `#serviceList` 七顆 | `Mypage` / `album` / `blog` / `guestbook` / `User` / `Friend` / `Video`（大小寫就是這樣不一致，照抄） |
| `#interactionList` | `Add to Friend List` |
| 好友下拉 | `- Friends' Blog -` |
| `#boxNewArticle` 每筆 | 只有文章標題連結 + `<br />` |
| `#boxCategory` 展開項 | `◆我家狗貓(2)` → 子項 `【My Cat 】(63)`（前面 7 個 `&nbsp;` 縮排） |
| `#boxCategory` 尾 | `Uncategorized Articles` |
| `#boxDate` | `All Articles` + 下拉 `- Monthly Archives -`，選項 `April 2012(24)` |
| `#boxSearch` | 送出鈕 `Search`；核取方塊 `Title`（預設勾） / `Contents` |
| `#boxNewComment` 每筆 | `Re: 【…文章標題…】, by Sinya (Apr 14)` |
| `#boxNewTrackback` 每筆 | `Re: 【…】, by <a>對方標題</a> (Nov 3)` |
| `#boxCounter` | `Today's Visitors: 235` / `Total Visitors: 2343213` |
| `#boxSlideShow` 三顆鈕 | `Pause` / `Prev` / `Next` |
| `#boxMusic` | `Loading the player ...` |
| 月曆 | 上方連結 `Calendar`；標頭 `<<` `April 2012` `>>`；星期 `Sun Mon Tue Wed Thu Fri Sat` |
| 月份彙整（月曆模式）切換 | `List Mode`；列表模式切換 `Calendar Mode` |

**誰來收藏彈窗**
| 位置 | 原文 |
|---|---|
| 標題 | `誰來收藏` ← **中文** |
| 載入中 | `Loading ...` |

### 6-B 寫死的中文字串（存檔頁面就是中文）【驗】

| 位置 | 原文（一字不差） |
|---|---|
| 推薦區 | `推薦此文章` |
| 推薦鈕 | `推` |
| 收藏鈕 | `收` |
| 分享 fb | `分享在我的Facebook` |
| 分享 plurk | `分享在我的Plurk` |
| 分享即時通 | `分享在我的即時通` |
| 轉貼鈕 | `發文`（title=`發文至無名`） |
| 知識+ 鈕 | `找知識` |
| `.posted` 中的站名連結 | `無名小站` |
| 收藏分類預設值 | `未分類(0)` |
| 歷史文章區標題 | `歷史上的今天:` |
| 引用來源說明 | `本篇文章引用自此` |
| 音樂模組標題 | `音樂播放` |
| 誰來收藏彈窗標題 | `誰來收藏` |
| 迴響樓層 `.cmt_floor` | `1樓` `2樓` `3樓` … `46樓`（純 `N樓`） |
| 迴響樓層別名 `.cmt_floor_hide` | 只有前三樓有別名：`1樓搶頭香` / `2樓頸推` / `3樓坐沙發`；**第 4 樓以後就是 `N樓`**（我掃了 8 份頁面共 46 層，確認到此為止） |
| 未登入預設頭像圖上的字 | `我沒登入`（畫在 `No_Login_90.gif` 裡） |
| `<title>` 尾綴 | `- 無名小站` |
| og:site_name | `無名小站網誌` |

### 6-C 台灣使用者實際看到的中文模板字串 —— **查無**

我抓到的所有存檔都是英文語系表，**因此下列對照全部標【推】，復刻時請另尋佐證，不要當成已驗證**：
`Reply(N)`→回應(N)、`Trackback(N)`→引用(N)、`Collection(N)`→收藏(N)、
`Post A Comment`→發表回應、`Recent Articles`→最新文章、`Categories`→文章分類、
`Monthly Archives`→月份彙整、`Search This Blog`→搜尋本站、`Recent Comments`→最新回應、
`Recent Trackbacks`→最新引用、`Visitors Counter`→訪客人數、`Who came to my blog`→誰來我家、
`All Articles`→全部文章、`(More......)`→(繼續閱讀)、`prosecute`→檢舉、
`Today's Visitors / Total Visitors`→今日人氣 / 累積人氣。

---

## 7. 素材清單

### 7-1 預設樣板 1/117（六張全抓到）【驗】

| 檔名（本地） | 原始檔名 | 尺寸 | 主色 | 用途 |
|---|---|---|---|---|
| `style117_banner.gif` | `banner.gif` | **750×120** | `#EEEEEE` on `#FFFFFF` | `#banner` 頂部橫幅，上圓角、左右各留 6px 白邊 |
| `style117_date.gif` | `date.gif` | **530×30** | `#DDDDDD` 框 + `#FFFFFF` 內部 | `.date` 日期條＝文章卡片的上圓角蓋 |
| `style117_blogbody.gif` | `blogbody.gif` | **530×20** | `#DDDDDD` | `.blogbody` 底部，文章卡片的下圓角蓋 |
| `style117_box.gif` | `box.gif` | **200×30** | `#DDDDDD` on `#FFFFFF` | `.sidetitle` 側欄模組標題（上圓角） |
| `style117_box1.gif` | `box1.gif` | **200×20** | `#EEEEEE` on `#FFFFFF` | `#boxXxx` 底部（下圓角） |
| `style117_calendar.gif` | `calendar.gif` | **200×200** | `#EEEEEE` on `#FFFFFF` | `.calendar` 月曆整塊底圖（四角全圓） |

### 7-2 官方共用圖示【驗】

| 檔名 | 尺寸 | 用途 | 原始網址 |
|---|---|---|---|
| `plus.gif` | 11×11 | 文章分類資料夾「＋」 | `l.yimg.com/e/serv/blog/img/plus.gif` |
| **`minus.gif`** | — | 資料夾展開後的「－」 | **查無**（`l.yimg.com/e/serv/blog/img/minus.gif` 存檔是 404 頁）。JS 確定會用到（`func_blog.js` 的 `onclick_folder`）。【推】應為同 11×11 |
| `rss.gif` | 36×14 | RSS 訂閱（`#FF6600` 橘底白字） | `l.yimg.com/e/serv/blog/img/rss.gif` |
| `close.gif` | 15×15 | 收藏留言框／誰來收藏彈窗的關閉鈕 | `l.yimg.com/e/serv/blog/img/close.gif` |
| `ico_trackback_expand.jpg` | 13×13 | 引用區「展開」箭頭 | `l.yimg.com/e/serv/blog/img/ico_trackback_expand.jpg` |
| `ico_trackback_hide.jpg` | 13×13 | 引用區「收合」箭頭 | `l.yimg.com/e/serv/blog/img/ico_trackback_hide.jpg` |
| `border.png` | **81×59** | 推文鈕背景（`#DADADA`→`#C1C1C1` 灰漸層） | `tw.yimg.com/i/tw/wretch/blog/border.png` |
| `push.gif` | 36×19 | 「推」鈕圖示（hover 藍 `#1D84B7`） | `tw.yimg.com/i/tw/wretch/blog/push.gif` |
| `pull.gif` | 36×19 | 「收」鈕圖示（hover 桃 `#E2669E`） | `tw.yimg.com/i/tw/wretch/blog/pull.gif` |
| `hot.png` | 93×18 | 熱門文章標記（接在 h3 標題後） | `l.yimg.com/e/serv/common/img/hot.png` |
| `lock.gif` | 21×16 | 悄悄話鎖頭 | `l.yimg.com/e/serv/common/img/lock.gif` |
| `isAuth.gif` | 20×20 | 認證帳號（藍） | `l.yimg.com/e/serv/common/img/isAuth.gif` |
| `isAuth_gold.gif` | 20×20 | VIP 認證（金），`.sidetitle` 內 `class="vip_icon"` | `l.yimg.com/e/serv/common/img/isAuth_gold.gif` |
| `No_Login_90.gif` | **90×90** | 未登入者迴響頭像（圖上寫「我沒登入」） | `l.yimg.com/e/serv/common/img/thumbs/No_Login_90.gif` |
| `tpic5.jpg` | **90×90**（檔名 .jpg 但實際是 GIF） | 誰來我家頭像 `onerror` 備援圖 | `l.yimg.com/e/serv/common/img/thumbs/tpic5.jpg` |
| `user_cover.gif` | 85×85 | 相簿輪播預設圖 | `l.yimg.com/e/serv/blog/img/user_cover.gif` |
| `email.gif` | 25×25 | 迴響者留 email 時的信封圖 | `l.yimg.com/e/icon/blog/email.gif` |
| `ico_close.png` | 9×9 | 外連警告彈窗關閉鈕 | `l.yimg.com/e/serv/blog/img/ico_close.png` |
| `ico_warning.png` | 39×35 | 外連警告圖示 | `l.yimg.com/e/serv/blog/img/ico_warning.png` |
| `ico_info.png` | 43×36 | 外連提示圖示 | `l.yimg.com/e/serv/blog/img/ico_info.png` |
| `button-r-b.png` | 145×36 | 外連警告彈窗按鈕底圖 | `l.yimg.com/e/serv/blog/img/button-r-b.png` |

### 7-3 使用者資料圖（URL 規則）【驗】

| 用途 | URL 樣板 | 尺寸 |
|---|---|---|
| 側欄大頭照 `.boxMySpaceImg` | `http://l.yimg.com/e/cover/<user>_90.jpg?<版本號>` | 90×90 |
| 迴響者頭像（YUI lazy load） | 同上；未登入者用 `No_Login_90.gif` | 90×90 |
| 誰來我家頭像 | `http://l.yimg.com/e/cover/<user>_60.jpg?<版本號>` | 60×60（CSS 縮成 50×50） |
| 驗證碼圖 | `http://pic.wretch.cc/e/wsi/1/<magicUUID>`；inline style `width:200pt;height:72pt` | — |
| 文章圖片 | `http://f<N>.wretch.yimg.com/<user>/<相簿>/<檔名>.jpg?<簽章>` | — |
| 縮圖 | 同上但路徑多 `/thumbs/t` 前綴 | — |

### 7-4 社群列圖示（album 代號已抓，勿重複）
`ico_facebook.png` / `ico_plurk.png` / `ico_yim_png8.png` / `ico_wretch.png` / `ico_reblog_arrow.png` / `ico_kplizer.png` / `ico_kplizer_hover.png` → 在 `assets_src2/img/album/`。

---

## 8. DOM 結構（照抄原始 HTML，未簡化）

### 8-0 `<head>`【驗，取自 `blog_2012_default_skin_afuuu.html`】

```html
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta http-equiv="imagetoolbar" content="no"/>
<meta name="description" content="Reading無名小站 A-FU，Share afuuu's mood and creations，Topic:Free Writing …" />
<meta name="medium" content="" />                      <!-- 文章頁是 content="blog" -->
<title>A-FU - 無名小站</title>                          <!-- 文章頁：文章標題 - 網誌標題 - 無名小站 -->
<link rel="shortcut icon" type="image/x-icon" href="http://l.yimg.com/e/serv/common/favicon.ico" />
<meta name="keywords" content="">
<meta property="og:type" content="blog" />             <!-- 文章頁是 "article" -->
<meta property="og:title" content="A-FU - 無名小站" />
<meta property="og:description" content="…" />
<meta property="og:url" content="http://www.wretch.cc/blog/afuuu" />
<meta property="og:site_name" content="無名小站網誌" />
<meta property="og:image" content="http://l.yimg.com/e/cover/afuuu_90.jpg?18" />
<link rel="canonical" href="http://www.wretch.cc/blog/afuuu" />
<link rel="stylesheet" href="http://l.yimg.com/e/serv/blog/css/top.css?20120524" type="text/css" />
<link rel="alternate" type="application/rss+xml" title="RSS" href="/blog/afuuu&rss20=1" />
<link rel="stylesheet" href="http://f12.wretch.yimg.com/afuuu/files/blog.css?1308738218" type="text/css">
<link rel="stylesheet" href="http://l.yimg.com/e/serv/common/css/sharing.css?20120524" type="text/css">
<link rel="stylesheet" href="http://l.yimg.com/e/serv/blog/css/font.css?20120524" type="text/css" />
<link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.8.1/build/container/assets/skins/sam/container.css?…">
<link rel="stylesheet" type="text/css" href="http://yui.yahooapis.com/2.8.1/build/button/assets/skins/sam/button.css?…">
<link rel="stylesheet" type="text/css" href="http://l.yimg.com/e/serv/blog/css/antiPhishing.css?…">
<link rel="stylesheet" type="text/css" href="http://l.yimg.com/e/serv/blog/css/trackback.css?…">
<style></style>
</head>

<body id="blog_main" onDragStart="return false" onContextmenu="return false"
      onSelectStart="return false" class="yui-skin-sam">
```
> `body` 上那三個 `return false` 是原站防右鍵／防選取的設定，照抄。

### 8-1 整頁骨架

```
body#blog_main.yui-skin-sam
└─ div#hugewrapper
   ├─ input#wretch-crumb  (hidden, value="&.c=…&.t=…")
   ├─ input#static-path   (hidden, value="http://l.yimg.com/e/serv/common/")
   ├─ div#kukubar-upper.kukubar-bar.kukubar-customized.font-black|font-white   ← chrome 代號負責
   ├─ div#bigcontainer  style="position:relative !important; zoom:1 !important"
   │  └─ div#container1                    (750px, 置中)
   │     ├─ div#container2
   │     │  ├─ div#banner
   │     │  │  └─ div#pageheader
   │     │  │     ├─ h1
   │     │  │     │  ├─ a[href=/blog/<user>]  ← 網誌標題
   │     │  │     │  └─ span.description      ← 文章頁：放文章標題；首頁：空白
   │     │  │     └─ div#description2
   │     │  │        └─ span.description      ← 首頁：放網誌簡介；文章頁：空白
   │     │  ├─ div#main2
   │     │  │  ├─ div#content       (530px float:left)   ← 見 8-2
   │     │  │  └─ div#links         (200px float:right)  ← 見 8-4
   │     │  ├─ div#extraDiv1 > span
   │     │  └─ div#extraDiv2 > span
   │     ├─ div#footer               ← 空的 <div id="footer"></div>
   │     ├─ div#extraDiv3 > span
   │     └─ div#extraDiv4 > span
   ├─ br clear="all"
   ├─ div#extraDiv5 > span
   ├─ div#extraDiv6 > span
   └─ div#friend-picker              ← 「誰來收藏」彈窗（預設 visibility:hidden）
      └─ div#friend-picker-container
         ├─ div#friend-picker-hd
         │  ├─ span  「誰來收藏」
         │  ├─ div#loading  「Loading ...」
         │  └─ a#friend-picker-closebtn > img(close.gif 15×15)
         ├─ div#friend-picker-pagination
         └─ div#friend-picker-bd
div#kukubar-lower.kukubar-bar                            ← chrome 代號負責
```
> `#extraDiv1`…`#extraDiv6` 是給使用者 CSS 塞裝飾用的空 hook，一律 `<div id="extraDivN"><span></span></div>`。【驗】

### 8-2 `#content` — 首頁（文章列表）

```html
<div id="content">
<input type="hidden" name="check_url" value="on">
<div class="blog" >

      <div class="date">
        <div class="datediv">
          August 13, 2012        </div>
      </div>

      <div class="blogbody">
        <div class="blogbody2">
            <div class="articletext">
            <a name="27887438"></a>
            <h3 class="title">Candy二次發燒<a href='/blog/?tab=cat&sort=ave&class_id=32&page=1' target='_blank'><img src='http://l.yimg.com/e/serv/common/img/hot.png' border=0></a></h3>
            <div class="social-wrapper">…見 8-3…</div>

            <div class="innertext">
              <p>…文章內容…</p>
            </div>

            <div class="extended"><a href="/blog/AndreaCorlen/27887438">(More......)</a></div>
              <br clear="all" />
            </div> <!-- end of articletext -->

            <div class="posted">
            <a href="/blog/AndreaCorlen">AndreaCorlen</a> at <a href="/blog/">無名小站</a> at 01:25 PM post            | <a href="/blog/AndreaCorlen/27887438#postComments">Reply(31)</a>
            | <a href="/blog/AndreaCorlen/27887438#trackbacks">Trackback(0)</a>
                                                | <a href="http://cc.wretch.cc/help/prosecute.php?badid=…&aid=…&cs=…" target="_blank">prosecute</a>
                      </div>

        </div> <!-- end of blogbody2 -->
      </div> <!-- end of blogbody -->

      <div class="date">…下一篇的日期…</div>
      <div class="blogbody">…</div>
      …（重複 N 篇）…

</div> <!-- end of class=blog -->
</div> <!-- end of content -->
```
重點【驗】：
- **每篇文章前面都有自己的 `.date`**，不是只有換日才出現分隔（同一天的兩篇會各印一次日期）。
- `.date` 與 `.blogbody` 是**兄弟**，不是父子。
- 首頁不做分頁（沒有任何 `page=` 連結）。往前翻文章要靠側欄的月份彙整 / 全部文章 / 分類。
- 首頁不顯示迴響區、不顯示 `Collection(N)`、不顯示 `#push` 推文鈕。

### 8-3 `#content` — 單篇文章頁

```html
<div id="content">
<input type="hidden" name="check_url" value="on">
<div class="blog" >

      <div class="date"><div class="datediv">December 3, 2011</div></div>

      <div class="blogbody">
        <div class="blogbody2">
            <div class="articletext">
            <a name="16702046"></a>
            <h3 class="title">【看看別人想想自己：莫斯科的流浪狗問題（1）】</h3>

            <!-- ===== 社群分享列（標題下方，文章下方再出現一次） ===== -->
            <div class="social-wrapper">
              <div class="social-widget">
                <div class="bd">
                  <a class="fb"    title="分享在我的Facebook" target="_blank" href="…">分享在我的Facebook</a>
                  <a class="plurk" title="分享在我的Plurk"    target="_blank" href="…">分享在我的Plurk</a>
                  <a class="yim"   title="分享在我的即時通"   href="ymsgr:customstatus?…">分享在我的即時通</a>
                </div>
              </div>
              <div class="wretch-reblog fixinline">
                <div class="bd ">                      <!-- 沒有轉貼數時 class="bd bubble-none" -->
                  <a class="wretch" href="http://www.wretch.cc/blog/post.php?rtype=article&t=…" target="_blank" title="發文至無名">發文
                    <span class="bubble bubble-gradient"><span></span>2</span>
                  </a>
                </div>
              </div>
              <div class="kplizer fixinline">
                <a class="kplizer-btn" href="javascript:disp_kplizer_16702046();">找知識</a>
              </div>
              <!-- 下面這塊是 document.write 出來的 -->
              <div class="plus-wrapper">
                <div class="social-gpluson"><div class="g-plusone" …></div></div>
                <a href="https://twitter.com/share" class="twitter-share-button" …></a>
                <iframe class="fixinline" id="share_facebook" … style="overflow:hidden;width:85px;height:21px;"></iframe>
              </div>
            </div>

            <div class="innertext">
              …文章內容…

              <!-- ===== 推文＋再一次社群列 ===== -->
              <div class="clearfix">
                <div id="push">
                  <span id="recommendcount">7</span>推薦此文章
                  <a href="javascript:void(0)" id="pushbtn"    class="push">推</a>
                  <a href="javascript:void(0)" id="collectbtn" class="pull">收</a>
                </div>
                <div class="social-wrapper">…同上整組…</div>
              </div>
            </div>

            <div id="article_counter" align="right">
              Today's Visitors: 0            Total Visitors: 4530            </div>

            <!-- ===== 收藏留言彈窗（預設隱藏，按「收」才顯示） ===== -->
            <div id="collection_comments" style="visibility:hidden">
              <span><strong><nobr>You can leave comment to this collection</nobr></strong></span>
              <img class="icon" src="http://l.yimg.com/e/serv/blog/img/close.gif"
                   onclick="$('collection_comments').style.visibility = 'hidden'">
              <form action="../do_collect.php" method="post" name='ajax_favorites_pop' id="word_form_pop">
                <input type=hidden name=".c" value="…"><input type=hidden name=".t" value="…">
                <p id="postContentPop">
                  <nobr>Collection Category:<select name="category">
                    <option value="0">未分類(0)</option>
                  </select>
                  <a href="/admin/blog/?func=collection&col=folder" target="_blank">Add Collection Category</a></nobr><br/>
                  <nobr>Collection Comment:<input type="text" class="text" name="comments_text_pop" value='' maxlength='100'></nobr>
                </p>
                <p id="submitPost">
                  <nobr>
                  <span class="head"></span>
                    <input name="owner"     type="hidden" value="boogier" />
                    <input name="aid"       type="hidden" value="16702046" />
                    <input name="viewer_id" type="hidden" value="">
                    <input name="title"     type="hidden" value="【…文章標題…】" />
                    <input name="save"   type="submit" value="Confirm Collection" onclick="…" />
                    <input name="cancel" type="reset"  value="Cancel"             onclick="…" />
                  </nobr>
                </p>
              </form>
            </div><!--end of div id=comments -->

            <!-- ===== 文章footer ===== -->
            <div class="extended">
              Personal Category: <a href="…&category_id=11949463">【動保事件簿】</a>
              <span>Topic:  <a href="/blog/?tab=cat&class_id=15" target="_blank">life</a> / <a href="/blog/?tab=cat&sort=ave&class_id=32&main=15" target="_blank">pets</a> / 動物關懷</span>
              <br />
              Previous in This Category: <a href="/blog/boogier/16701396">【…】</a> &nbsp;
              Next in This Category: <a href="/blog/boogier/16702058">【…】</a>
            </div>

            <!-- 只有部分文章有：歷史上的今天 -->
            <div class="history">
              <div class="history_title">歷史上的今天:</div>
              <div class="history_articles"></div>
            </div>

            </div> <!-- end of articletext -->

            <div class="posted">
            <a href="/blog/boogier">boogier</a> at <a href="/blog/">無名小站</a> at 06:51 AM post            | <a href="/blog/boogier/16702046#postComments">Reply(3)</a>
            | <a href="/blog/boogier/16702046#trackbacks">Trackback(0)</a>
            | <a href="javascript:void(0)" id="showCollector">Collection(2)</a>
                                                | <a href="http://cc.wretch.cc/help/prosecute.php?…" target="_blank">prosecute</a>
                      </div>

            <div class="total-comments-div">…見 8-3-2…</div>

        </div> <!-- end of blogbody2 -->
      </div> <!-- end of blogbody -->
</div> <!-- end of class=blog -->
</div> <!-- end of content -->
```

#### 8-3-1 `#Wretch-ysm` 廣告槽【驗】
2013 的文章頁在 `.posted` 之後、`.total-comments-div` 之前多一個 Yahoo 廣告槽：
```html
<div id="Wretch-ysm" style="position:static !important; width:100% !important; display:block !important;
     opacity:1 !important; filter:alpha(opacity=100) !important; visibility:visible !important;
     clip:rect(auto auto auto auto) !important"> … </div>
```
（一堆 `!important` 是為了防使用者 CSS 把廣告藏起來。復刻時可省略內容但保留位置。）

#### 8-3-2 迴響區 `.total-comments-div`

```html
<div class="total-comments-div">

    <!-- (a) 引用網址（有開放引用才出現） -->
    <div class="trackback-url">
      [Trackback URL]
      <input type="text" id="trackback_url" value='http://www.wretch.cc/blog/trackback.php?blog_id=…&article_id=…'>
      <input type="button" value="Copy Trackback Url"
             onClick="copy_to_clipborad('trackback_url'); alert('Already copy to the clipboard')">
    </div>

    <!-- (b) 引用列表（可展開/收合，預設收合 #HiddenTrackback.hide-list{display:none}） -->
    <div class="trackbacks-head">
      <div class="comments-head">
        <a name="trackbacks"><span>Trackback</span><span id="trackback-switch"></span></a>
      </div>
    </div>
    <div id="HiddenTrackback" class="hide-list">
      <div class="trackback-linkcontrol">
        <span class="previous"><a href="…&tpage=1#trackbacks">Previous</a></span>
        <span><a href="…&tpage=1#trackbacks">1</a></span>
        <span class="current">2</span>
        <span><a href="…&tpage=3#trackbacks">3</a></span>
        <span class="next"><a href="…&tpage=3#trackbacks">Next</a></span>
      </div>
      <div class="trackbacks-body">
        <div class="comments-body">
          <a name="trackback3800108"></a>
          <ul class="comments-user">
            <li></li>
            <li><p>本篇文章引用自此</p></li>
            <li class="trackbacks-post">
              <div class="comments-post">
                <a target="_blank" href="http://www.wretch.cc/blog/dxexpig/10263715">爆笑轉載</a>
                【Forever ×￡︴friend…　＆ secret love】 at July 29, 2008 04:23 AM Trackback
                | <a href="http://cc.wretch.cc/help/prosecute.php?…" target="_blank">prosecute</a>
              </div>
            </li>
          </ul>
        </div>
      </div>
      …（每筆引用重複一組 .trackbacks-body）…
      <div class="trackback-linkcontrol">…同上，底部再一份…</div>
    </div>

    <br />

    <!-- (c) 迴響列表 -->
    <div class="comments-head">
      <a name="comments"></a>Reply                </div>

    <div class="comments-linkcontrol">
      <span class="previous"><a href="…&page=1#comments">Previous</a></span>
      <span><a href="…&page=1#comments">1</a></span>
      <span class="current">2</span>
      <span><a href="…&page=3#comments">3</a></span>
      <span><a href="…&page=4#comments">4</a></span>
      <span><a href="…&page=5#comments">5</a></span>
      <span class="next"><a href="…&page=3#comments">Next</a></span>
    </div>

    <div class="comments-body">
      <a name="comment1814930"></a>
      <ul class="comments-user">
        <span><a target="_blank" href="/blog/juice8" class="bighead"><img id="bhg2_2"><cite></cite></a></span>
        <li class="comments-word">
          <p id="floor_2"  class="cmt_floor">2樓</p>
          <p id="fhide_2"  class='cmt_floor_hide'>2樓頸推</p>
          <p>迴響內容<br />第二行</p>
        </li>
        <li class="comments-post">
          <a class='postuser' target='_blank' href='/blog/juice8'>juice8</a><a target='_blank' href='/blog/WretchFAQ&article_id=6614002'><img class='postisAuth' border=0 align='absmiddle' src='http://l.yimg.com/e/serv/common/img/isAuth.gif'></a> at July 26, 2008 05:51 PM comment
          | <a href="http://cc.wretch.cc/help/prosecute.php?…" target="_blank">prosecute</a>
        </li>
      </ul>

      <!-- 站長回覆（有回才出現，包在同一個 .comments-body 裡） -->
      <div class="comments-reply" id="comments-reply-1814930">
        <ul class="comments-author">
          <li><p>回覆內容</p></li>
          <li class="comments-post">
            Blog Owner at December 9, 2011 07:18 PM Reply                                            </li>
        </ul>
      </div>
    </div>
    …（每筆迴響重複一組 .comments-body）…

    <div class="comments-linkcontrol">…底部再一份分頁…</div>

    <!-- (d) 發表迴響 -->
    <div class="comments-bottom">
      <div class="comments-head">
        <a name="postComments"></a>Post A Comment                    </div>
    </div>

    <div class="comments-body">
      <form method="post" name='form' action="/blog/do_modify.php"
            onSubmit="return check_new_comment_input('Please input the content', 'Comments limit: 1000 characters...');">
        <input type=hidden name=".c"  value="24qFJnEmb42">
        <input type=hidden name=".t"  value="1334459701">
        <input type='hidden' name='func'       value="comment" />
        <input type='hidden' name='article_id' value='16702046' />
        <input type='hidden' name='blog_id'    value='boogier' />

        <label for="name_id">Name:</label><br />
        <input type='text' id='name_id' name='cookie_name' maxlength='15' value='' />
        <br /><br />
        <label for="email">Email:</label><br />
        <input type='text' id="email" name='email' maxlength='50' value='' />
        <br /><br />
        <label for="url">URL:</label><br />
        <input type='text' id="url" name='url' maxlength='85' value='' />
        <br /><br />
        <label for="rem">Remember Me</label>
        <input type="radio" id="rem" name="rem" value="true" checked />Yes
        <input type="radio" id="rem" name="rem" value="false" />No
        <br /><br />
        <label for="text">Comments ( MAX: 1000 characters ) :</label>
        <br /><textarea style="width: 90%" id="text" name='text' rows="10" cols="64" wrap="hard"></textarea>
        <br />
        Please input the magic number:
        <input type='hidden' name='magicUUID' value='3VpPSlBDdxUx3Iyb1tKrMBg01grwsYGV8TJHeII-'>
        <input type='text' id='magic' name='magic' maxlength='15'
               onKeyUp="…只允許輸入數字…"><br /><br />
        ( Prevent the annoy garbage messages )<br />
        ( <a target=_blank href=/hala/viewtopic.php?t=65568><font color=red>What if you cannot see the numbers?</font></a> )<br>
        <img border="1" alt="Please input the magic number"
             style="display:inline; FILTER:Alpha(opacity=100); width:200pt; height:72pt"
             src="http://pic.wretch.cc/e/wsi/1/3VpPSlBDdxUx3Iyb1tKrMBg01grwsYGV8TJHeII-"/>
        <br />
        <input type="submit" name="confirm" value="Post" />
        <input type="reset"  name="go_prev" value="Cancel" />
      </form>
    </div>
</div> <!--  end of total-comments-div -->
```

迴響區細節【驗】：
- 頭像用 YUI ImageLoader 延遲載入，頁尾有：
  ```html
  <script language="JavaScript">
  var bhGroup2 = new YAHOO.util.ImageLoader.group(window, 'scroll');
  bhGroup2.registerSrcImage('bhg2_1', 'http://l.yimg.com/e/cover/juice8_90.jpg?67');
  bhGroup2.registerSrcImage('bhg2_2', 'http://l.yimg.com/e/serv/common/img/thumbs/No_Login_90.gif');
  bhGroup2.foldConditional = true;
  bhGroup2.addTrigger(window, 'resize');
  </script>
  ```
  未登入者一律 `No_Login_90.gif`；`.bighead` 的 `href` 未登入者是 `/blog/`。
- 迴響者留了 email 會多一顆信封：
  `<a class='postemail' href='mailto: …'><img src='http://l.yimg.com/e/icon/blog/email.gif' …></a>`
- **零迴響時的空狀態文案 — 查無**（我找到的可用快照都至少有一則迴響）。

### 8-4 `#links` 側欄

模組順序（4 份頁面交叉比對，順序完全一致）【驗】：

```
div#links
└─ div#links2
   ├─ div.calendar[align=center]        ← 月曆（可關）
   ├─ div#boxMySpace                    ← 個人資訊（永遠有）
   ├─ div#boxSlideShow                  ← 相簿輪播（可關）
   ├─ div#boxMusic                      ← 背景音樂（可關）
   ├─ div#boxNewArticle                 ← 最新文章
   ├─ div#boxCategory                   ← 文章分類
   ├─ div#boxDate                       ← 月份彙整
   ├─ div#boxSearch                     ← 站內搜尋
   └─ div#divThird
      ├─ div#divThird2
      │  ├─ div#boxNewComment           ← 最新迴響（標題右側有 RSS 圖）
      │  ├─ div#boxNewTrackback         ← 最新引用
      │  ├─ div#boxFolder  × N          ← 自訂欄位，可重複很多次（同一個 id 重複，原站就這樣）
      │  ├─ div#boxWho                  ← 誰來我家
      │  └─ div#boxCounter              ← 計數器
      └─ div.syndicate > a > img(rss.gif)
```

**通用模組模板**（`#boxNewArticle` 為例）【驗】：
```html
<div id="boxNewArticle">
  <div class="boxNewArticle0">
    <div class="sidetitle">
      Recent Articles        </div>
  </div>
  <div class="boxNewArticle1">
    <div class="side">
      <a href="/blog/boogier/16711274">【…】</a><br />
      <a href="/blog/boogier/16711270">【…】</a><br />
      …
    </div>
  </div>
  <br />
</div>
```
規律：`#boxXxx` → `.boxXxx0`（裡面放 `.sidetitle`）→ `.boxXxx1`（裡面放 `.side`）→ 模組尾 `<br />`。
**唯一例外是 `#boxWho`**，它沒有 `0/1` 兩層：
```html
<div id="boxWho" align="center">
  <div class="sidetitle">Who came to my blog</div>
  <div id="whowrapper">
    <ul>
      <li><a href="http://tw.rd.yahoo.com/referurl/wretch/blog/user/whocome/*http://www.wretch.cc/blog/han855" target="_blank">
        <img src="http://l.yimg.com/e/cover/han855_60.jpg?115"
             onerror="this.src='http://l.yimg.com/e/serv/common/img/thumbs/tpic5.jpg'" alt="han855"></a></li>
      …（共 9 筆）…
    </ul>
  </div>
</div><!-- end of div id="boxWho" -->
```

**`#boxMySpace` 完整內容**【驗】：
```html
<div id="boxMySpace">
 <div class="boxMySpace0">
  <div class="sidetitle">
   <a target="_blank" href="http://tw.rd.yahoo.com/referurl/wretch/vip/insidepage/evt=47619/*http://bill.wretch.cc/">
    <img align="middle" border="0" class="vip_icon" src="http://l.yimg.com/e/serv/common/img/isAuth_gold.gif" alt="vip_icon"/>
   </a>
   afuuu's Home  </div>
 </div>
 <div class="boxMySpace1">
  <div class="side">
   <div class="boxMySpaceImg">
    <a href="/user/afuuu"><img border="0" src="http://l.yimg.com/e/cover/afuuu_90.jpg?18"/></a>
   </div>
   <div id="blogCategory">
    <span>Topic:</span>
    <a href="http://www.wretch.cc//blog/?tab=hot&class_id=50">Free Writing</a>
   </div>
   <div id="service">
    <ul id="serviceList">
     <li><a class="mySpaceLink" id="linkMypage" href="http://tw.rd.yahoo.com/referurl/wretch/index/mprd/*http://www.wretch.cc/">Mypage</a></li>
     <li><a class="mySpaceLink" id="linkAlbum"  href="/album/afuuu">album</a></li>
     <li><a class="mySpaceLink" id="linkBlog"   href="/blog/afuuu">blog</a></li>
     <li><a class="mySpaceLink" id="linkGbook"  href="/guestbook/afuuu">guestbook</a></li>
     <li><a class="mySpaceLink" id="linkUser"   href="/user/afuuu">User</a></li>
     <li><a class="mySpaceLink" id="linkFriend" href="/friend/afuuu">Friend</a></li>
     <li><a class="mySpaceLink" id="linkVideo"  href="/video/afuuu">Video</a></li>
    </ul>
    <ul id="interactionList">
     <li class="boxAddFriendLink"><a class="mySpaceLink" href="/album/addfriend.php?uid=afuuu" id="link_addfriend">Add to Friend List</a></li>
    </ul>
   </div>
   <select id="friendlist" name="friendlist" onChange="MeetFriend('http://www.wretch.cc/blog/', this);">
     <option>- Friends' Blog -</option>
   </select>
  </div>
 </div>
</div>
```
（`font.css` 有 `#boxMySpace ul {margin:0;padding:0;list-style:none}`）

**`#boxCategory`（兩層分類，可展開）**【驗】：
```html
<div class="side">
  <a onClick="onclick_folder(document.getElementById('HiddenCategoryFolder_3739984'),
                             document.getElementById('CategoryFolder_3739984'),
                             'http://l.yimg.com/e/serv/blog/img/', '1');" >
    <img id="CategoryFolder_3739984" src="http://l.yimg.com/e/serv/blog/img/plus.gif"  />
    ◆我家狗貓(2)
  </a>
  <br />
  <div id="HiddenCategoryFolder_3739984" style=display:none>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="…&category_id=117042">【My Cat 】(63)</a><br />
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="…&category_id=117043">【My Dogs】(266)</a><br />
  </div>
  …（每個資料夾一組）…
  <a href="/blog/boogier&category_id=0">Uncategorized Articles</a><br />
</div>
```
- 資料夾標題前綴是全形實心菱形 `◆`（使用者自己打的，不是系統加的）。
- 子項縮排用 **7 個 `&nbsp;`**。

**`#boxDate`**【驗】：
```html
<div class="side">
  <a href="http://www.wretch.cc/blog/boogier&list=1">All Articles</a>
  <br />
  <select onChange="goMonthly(this);">
    <option value="-1">- Monthly Archives -</option>
    <option value="http://www.wretch.cc/blog/boogier&schedule=1&year=2012&month=4">April 2012(24)</option>
    <option value="…year=2012&month=3">March 2012(52)</option>
    …
  </select>
</div>
```

**`#boxSearch`**【驗】：
```html
<div class="side">
  <br />
  <form action="http://www.wretch.cc/blog/blog.php" method="get" >
    <input type="hidden" name="id" value='boogier'>
    <input type="text" name="search" id="blog_search_key" size="12" maxlength="12">
    <input type="submit" id="blog_search_submit" value="Search">
    <br />
    <input type="checkbox" name="search_title"   class="blog_search_filter" value="1" checked>Title</input>
    <input type="checkbox" name="search_content" class="blog_search_filter" value="1">Contents</input>
  </form>
</div>
```
（`</input>` 這種不合法收尾標籤是原站就有的，照抄）

**`#boxNewComment` 的標題含 RSS**【驗】：
```html
<div class="sidetitle">
  Recent Comments
  <span class="syndicate">
    <a href="/blog/boogier&commentsRss20=1"><img border="0" src="http://l.yimg.com/e/serv/blog/img/rss.gif" /></a>
  </span>
</div>
```
每筆：`<a href="/blog/boogier/16711274#comment1829091">Re: 【…】</a>, by Sinya (Apr 14)<br />`
悄悄話：`, by <img border="0" src="http://l.yimg.com/e/serv/common/img/lock.gif">Sealed (Apr 3)`

**`#boxNewTrackback`**【驗】：
`<a href="/blog/boogier/16698741&tpage=1#trackback4412655">Re: 【…】</a><span>, by <a target=_blank href="…">£  Leaf  of  the  hemp  £</a> (Nov 3)</span><br />`

**`#boxFolder`（自訂欄位，可有 N 個）**【驗】：
```html
<div id="boxFolder">
  <div class="boxFolder0"><div class="sidetitle">【About  Me】          </div></div>
  <div class="boxFolder1">
    <div class="side" style="width: 200px; ">
      <a target="_blank" href="http://www.wretch.cc/blog/boogier/14369787" title="">
        <br/><img border="0" src="http://f8.wretch.yimg.com/…jpg?…"><br/>
      </a><br />
      …
    </div>
  </div>
  <br />
</div>
```
可放任意 HTML（Facebook badge、`whos.amung.us` 線上人數、flagcounter、`js.wretch.yahoo.net/iframe.php` 廣告 iframe…）。

**`#boxCounter`**【驗】：
```html
<div class="side">
  Today's Visitors: 235<br />
  Total Visitors: 2343213    <br />
</div>
```

**月曆 `.calendar`**【驗】：
```html
<div align="center" class="calendar">
  <a href="http://www.wretch.cc/blog/boogier&schedule=1&year=2012&month=4" rel="nofollow">Calendar</a>
  <table border="0" cellspacing="4" cellpadding="0" summary="Monthly calendar with links to each day's posts">
    <caption class="calendarhead">
      <a href="…&year=2012&month=3" rel="nofollow">&lt&lt</a>
      <a href="…&year=2012&month=4" rel="nofollow">April 2012</a>
      <a href="…&year=2012&month=5" rel="nofollow">&gt&gt</a>
    </caption>
    <tr>
      <th abbr="Sunday" align="center"><span class="calendar">Sun</span></th>
      …Mon Tue Wed Thu Fri Sat…
    </tr>
    <tr>
      <td align="center"><span class="calendar"><a href="…&year=2012&month=4&day=1" rel="nofollow">1</a></span></td>
      …有文章的日子才是連結，沒有的只印數字…
    </tr>
  </table>
</div>
```
（`&lt&lt` `&gt&gt` 沒有分號，是原站的寫法，照抄）

### 8-5 分類 / 全部文章 / 月份彙整（列表模式）

```html
<div id="content">
<input type="hidden" name="check_url" value="on">
<div class="blog" >
  <div class="date"><div class="datediv">Category: 搞笑影片      </div></div>   <!-- 全部文章時是 "All Articles" -->
  <form method="post" action="/blog/do_modify.php">
  <div class="blogbody">
    <div class="blogbody2">
      <div class="articletext" >
        <br />
        <div class="list-linkcontrol">
          <span class="current">1</span>
          <span><a href="…&category_id=1861420&page=2">2</a></span>
          <span><a href="…&page=3">3</a></span>
          <span><a href="…&page=4">4</a></span>
          <span><a href="…&page=5">5</a></span>
          <span class="next"><a href="…&page=2">Next</a></span>
        </div>
        <br />
        <table>
          <tr>
            <td nowrap>
            2011.11.16 <a href="/blog/a000000000/32347487">違規真識相????</a>
            </td>
            <td>a000000000</td>
          </tr>
          …
        </table>
        <br />
        <div class="list-linkcontrol">…底部再一份…</div>
      </div>
    </div>
  </div>
  </form>
</div> <!-- end of class=blog -->
</div> <!-- end of content -->
```
- 日期格式在列表模式是 **`YYYY.MM.DD`**（跟文章區的 `Month D, YYYY` 不同）。【驗】
- 第二欄印的是作者帳號（共筆網誌才會不同）。
- 外面包一層 `<form action="/blog/do_modify.php">`，是給站長勾選批次刪除用的（訪客看不到 checkbox）。

### 8-6 月份彙整（月曆模式，`&schedule=1&year=&month=`）【驗】

```html
<div class="blog" >
  <br /><br />
  <a href="…&year=2008&month=10" rel="nofollow">List Mode</a>
  <br />
  <table width="100%" border="1" cellspacing="0" cellpadding="0" summary="Monthly calendar with links to each day's posts">
    <caption class="calendarhead">
      <a href="…&schedule=1&year=2008&month=9" rel="nofollow">&lt&lt</a>
      October 2008      <a href="…&schedule=1&year=2008&month=11" rel="nofollow">&gt&gt</a>
    </caption>
    <tr><th abbr="Sunday" align="center"><span class="calendar">Sun</span></th>…</tr>
    <tr>
      <td width="12%" height="60" align="center" valign="top"><span class="calendar">1</span></td>
      …
    </tr>
  </table>
</div>
```
注意：這頁的 `<table>` 沒有包在 `.blogbody` 裡，直接放在 `.blog` 下。【驗】

---

## 9. 互動行為

全部來自 `blog_func_blog.js` 與各 CSS，**皆【驗】**。

| 行為 | 實作 |
|---|---|
| **文章分類展開/收合** | `onclick_folder(hiddenDiv, imgEl, 'http://l.yimg.com/e/serv/blog/img/', '1')`：若目前 `display:none` → 把圖片換成 `minus.gif` 並展開；否則換回 `plus.gif` 並收合。第 4 參數傳 `'0'` 時只切換不換圖 |
| **月份彙整下拉** | `goMonthly(select)`：取 `options[selectedIndex].value`，非 `-1` 就 `document.location = link`（同頁跳轉） |
| **好友網誌下拉** | `MeetFriend('http://www.wretch.cc/blog/', select)`：`window.open(link + value, "_blank")`（**開新視窗**） |
| **相簿輪播** | `nextSlide()` / `prevSlide()` / `SlideShowPlayPause('Play','Pause')`；自動播放間隔 `slideShowSpeed = 5 * 1000`（5 秒）；IE 用 `filters.blendTrans`，`crossFadeDuration = 3`；標題寫進 `#SlidePicTitle`（textarea），連結寫進 `#SlidePicLink` |
| **送出迴響驗證** | `check_new_comment_input(msg, msgOverLength)`：`text` 為空 → `alert('Please input the content')`；長度 > 1000 → `alert('Comments limit: 1000 characters...')` |
| **驗證碼欄位** | `onKeyUp` 逐字檢查，非 `0–9` 就把最後一字砍掉（只能輸入數字） |
| **複製引用網址** | `copy_to_clipborad('trackback_url')`：`obj.select()` 後 IE 用 `clipboardData.setData`，Firefox 走 `netscape.security.PrivilegeManager`；接著 `alert('Already copy to the clipboard')` |
| **引用區展開/收合** | `#HiddenTrackback.hide-list{display:none}` 預設收合；點 `#trackback-switch`（13×13）切換。收合圖 `ico_trackback_expand.jpg`，展開後 `#trackback-switch.hide` 換成 `ico_trackback_hide.jpg` |
| **「收」（收藏）** | 點 `#collectbtn` → `#collection_comments` 由 `visibility:hidden` 變 `visible`；框內 `close.gif`、`Cancel`、`Confirm Collection` 三處都會設回 `visibility:hidden` |
| **`Collection(N)` → 誰來收藏** | 點 `.posted` 裡的 `a#showCollector` → 顯示 `#friend-picker`（405px 寬，`visibility:hidden` → visible），標題「誰來收藏」，`#loading` 顯示 `Loading ...`，`#friend-picker-bd` 用 AJAX 塞頭像格；有分頁 `#friend-picker-pagination`。頭像格 hover 變 `2px solid #B0CCEF` + 5px 圓角 |
| **「推」** | 點 `#pushbtn`，`#recommendcount` 數字 +1。hover：文字 `#09c`、外框 `#1A84B7`（`#collectbtn` hover 是 `#f09` / `#e2669e`） |
| **社群鈕 hover** | `border` `#e3e3e3` → `#bfbfbf`，底 `#fff` → `#f8f8f8`，並 `position:relative; z-index:100`（避免相鄰邊框被蓋住） |
| **「找知識」** | `href="javascript:disp_kplizer_XXXXX();"`，呼叫 `YKPlizer.load({appid, spaceid:'2145320486', intl:'tw', catid, page_title, proxy:'http://www.wretch.cc/index/kplizer_proxy.html'})`；載入失敗會用 `YAHOO.util.Get.script` 補抓 `l.yimg.com/qo/widget/kplizer_loader.js`。按鈕 hover 換圖 |
| **迴響頭像延遲載入** | YUI 2 `ImageLoader.group(window,'scroll')`，`foldConditional = true`，另 `addTrigger(window,'resize')`；捲到才載 |
| **誰來我家頭像載入失敗** | `onerror="this.src='http://l.yimg.com/e/serv/common/img/thumbs/tpic5.jpg'"` |
| **站長回覆編輯框（站長登入時）** | `extandTextarea(id)` / `closeTextarea(id)` 切換 `#comments-reply-edit-<id>` 的 `display: inline/none` |
| **外連防釣魚** | `antiPhishing.js` + `#panel`（YUI Container），圓角 10px、`2px solid #d2d2d2`；有「不再提醒」checkbox 與 `#save-msg` |
| **側欄連結 hover** | `#links a` 由 `#728A3E`/`#e5e5e5` 變 `#4381A1`/`#fff`（整條 173px 塊狀反白） |
| **樓層別名** | `.cmt_floor_hide` 是 `display:none`（藍字），`.cmt_floor` `float:right` 顯示「N樓」。別名 HTML 有輸出但預設看不到 |
| **防右鍵／防選取** | `<body onDragStart="return false" onContextmenu="return false" onSelectStart="return false">` |

**沒有的東西**（別自己加）【驗】：
- 首頁**沒有**上一頁/下一頁分頁。
- 沒有 tab 頁籤（文章區與側欄都沒有）。
- 沒有 CSS3 圓角（圓角一律用 GIF）；唯一用到 `border-radius` 的是社群列、antiPhishing 彈窗、friend-picker 這三個 Yahoo 後期加的元件。
- 沒有 sticky／固定側欄。

---

## 10. 復刻時要注意的坑

1. **迴響區只有 300px 寬且左邊縮 30px**（`.total-comments-div{width:300px;margin-left:30px}`），
   夾在 530px 的 `#content` 裡，看起來會「偏窄偏左」。這是原站行為，不是 bug，**要照做**。【驗】
2. `.date` 和 `.blogbody` 是**兄弟節點**，圓角是兩張圖上下夾出來的；中間 `.blogbody2` 純 `#ddd` 撐開。【驗】
3. `#boxFolder .side` 的 inline `width:200px` 加上 `.side` 的 12px border 會撐到 212px，超出 200px 的 `#links`。原站就這樣。【驗】
4. `#content` 沒有清除浮動；`#main2` 也沒有。全靠 `sharing.css` 的 `#main2, #content { zoom:1 }` 和 `<br clear="all" />`。【驗】
5. 每個模組尾巴那個 `<br />` 在 `#links br {display:none}` 下是隱藏的，但**改造型時它會跑出來**，所以照抄要留著。【驗】
6. 使用者 CSS 可以整份改掉版面（改寬度、改成 840px、換整組背景），所以復刻時要把「預設樣式」跟「骨架 HTML」分開實作。【驗】
7. 網誌沒有「文章分頁」，只有「迴響分頁」(`&page=`)、「引用分頁」(`&tpage=`)、「列表分頁」(`&list=1&page=` / `&category_id=X&page=`)。三種分頁的 class 不同：`.comments-linkcontrol` / `.trackback-linkcontrol` / `.list-linkcontrol`，但內部 span 結構一樣。【驗】
8. URL 用的是 `&` 而不是 `?` 當第一個參數分隔符：`/blog/<user>&category_id=123`、`/blog/<user>&schedule=1&year=2012&month=4`、`/blog/<user>&rss20=1`。單篇文章是 `/blog/<user>/<article_id>`。【驗】
9. 頁面 charset 幾乎都是 UTF-8（`<meta charset=utf-8>`），但**少數舊帳號的頁面實際是 Big5 位元組**（例：`shania2` 2013 的快照）。復刻不用管，記錄一下。【驗】

---

## 11. 尚未取得（誠實清單）

| 項目 | 狀態 |
|---|---|
| 中文語系的模板字串 | **查無**（所有存檔都是英文語系，見 §6 說明） |
| `minus.gif`（分類展開圖示） | **查無**（原網址存檔是 404 頁） |
| 官方「換造型」樣板列表頁 / 其他樣板 CSS | **查無**（`l.yimg.com/e/style/` 的 CDX prefix 查詢一律 504） |
| 零迴響時的空狀態 HTML | **查無** |
| 站長登入後的編輯／刪除按鈕 HTML | **查無**（存檔都是訪客視角） |
| `#boxProfile` / `#boxRssList` / `#scupioSearch` 的 HTML | **查無**（只在預設樣式 CSS 的選擇器清單裡出現過，我抓到的 10 份頁面都沒有實際輸出這三個模組） |
| 推文 / 收藏的後端 endpoint | 只確認 `../do_collect.php`（收藏）與 `/blog/do_modify.php`（迴響/批次），推文的 AJAX endpoint **查無** |
