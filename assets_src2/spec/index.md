# 無名小站 最後版首頁（www.wretch.cc/）測繪規格書 — 代號 `index`

> 標記說明：**【驗】**＝直接讀自我下載並打開過的原始檔案（HTML／CSS／PNG）；**【推】**＝推測，未經原始檔證實。
> 主要基準：**2012-06-15 快照**（CSS `wfp-css_201205171100.css`）。已交叉比對 2012-02、2012-12、2013-03、2013-12。

---

## 0. 一個重要的前提修正

**首頁沒有 kukubar。**【驗】
我 grep 過 2012-02／2012-06／2012-12／2013-03／2013-12 五份原始 HTML，全文都**沒有** `kukubar` 這個字串，也沒有載入 `kukubar.css`。
kukubar（頂部黑色工具列）是**網誌／相簿／留言板等內頁**才有的元件；首頁用的是自己的 `#wfp-universal-header`（Yahoo!奇摩 ／ 服務說明 ＋ 無名 logo ＋ Yahoo 網頁搜尋列），下面接一條綠色漸層的 `#wfp-navigation`。詳見第 5、6 節。

---

## 1. 快照清單（我實際下載並打開過的）

### 1.1 HTML（都存在 `assets_src2/html/`）

| 檔名 | 完整網址 | 說明 |
|---|---|---|
| `index_20120610082113.html` | https://web.archive.org/web/20120610082113id_/http://www.wretch.cc/ | **主要基準**。2012-06-15 首頁，86,954 bytes，UTF-8。載入 `wfp-css_201205171100.css` |
| `index_20120204090819.html` | https://web.archive.org/web/20120204090819id_/http://www.wretch.cc/ | 2012-02-02，79,813 bytes。載入 `wfp-css_201201091129.css`；側欄下方模組是 `#wfp-join`（揪團）而非投稿精選 |
| `index_20121212103015.html` | https://web.archive.org/web/20121212103015id_/http://www.wretch.cc/ | 2012-12-06，86,342 bytes。CSS 與 2012-06 相同 |
| `index_20130302084933.html` | https://web.archive.org/web/20130302084933id_/http://www.wretch.cc/ | 2013-03-02，87,093 bytes。CSS 仍是 `wfp-css_201205171100.css` |
| `index_20131201061747.html` | https://web.archive.org/web/20131201061747id_/http://www.wretch.cc/ | 2013-12-01，84,162 bytes。**已是唯讀模式公告版**，CSS 換成 `wfp-css_201308261304.css`，導覽列少了「手機」 |

CDX 查詢用的網址（可重跑）：
`https://web.archive.org/cdx/search/cdx?url=www.wretch.cc&matchType=exact&filter=statuscode:200&collapse=timestamp:6&limit=200&fl=timestamp,original,mimetype,length&from=2011&to=2014`

### 1.2 CSS（都存在 `assets_src2/css/`）

| 檔名 | 原始網址（前面加 `https://web.archive.org/web/20120610082113id_/`） | 大小 |
|---|---|---|
| `index_wfp-css_201205171100.css` | http://l.yimg.com/e/serv/index/index3/css/wfp-css_201205171100.css | 92,241 B，**版面主檔** |
| `index_chameleon.css` | http://l.yimg.com/e/serv/index/index3/css/chameleon.css | 3,334 B，廣告／換膚覆蓋層 |
| `index_promotion.css` | http://l.yimg.com/e/serv/common/css/promotion.css | 2,754 B，「請升級瀏覽器」彈窗樣式，與版面無關 |
| `index_yui320_reset-fonts.css` | http://yui.yahooapis.com/combo?3.2.0/build/cssreset/reset-min.css&3.2.0/build/cssfonts/fonts-min.css | 1,296 B，**字級基準** |
| `index_wfp-css_201308261304.css` | （用 `20131201061747id_/`）http://l.yimg.com/e/serv/index/index3/css/wfp-css_201308261304.css | 93,360 B，2013 末版 |

**2012 版 vs 2013 版 CSS 的差異**【驗】：我 diff 過兩份（逐條 rule 排序後比對），2013 版**只多了 `.notification` 這一組 13 條規則**（關站公告框），其餘一字未改。也就是說：**版面 CSS 從 2012-05 到關站都沒動過**，用 2012 版做 1:1 復刻是安全的。

### 1.3 JS（存在 `assets_src2/js/`）

| 檔名 | 原始網址 | 大小 |
|---|---|---|
| `index_wfp-js_201205171100.js` | https://web.archive.org/web/20120610082113id_/http://l.yimg.com/e/serv/index/index3/js/wfp-js_201205171100.js | 57,827 B，YUI 3.4.0 基礎，含 `common`、`wfp-cover`、`wfp-featured`、`wfp-hybrid`、`wfp-celebrity`、`wfp-bgm`、`wfp-archive`、`wfp_top_daily_blogs` 等模組 |

### 1.4 圖片（都存在 `assets_src2/img/index/`）
下載基準時間戳多為 `20120610082113id_`；抓不到的改用 CDX 找出的實際存檔時間（見第 8 節表格「取得時間戳」欄）。

---

## 2. 由上到下的區塊順序（整頁骨架）

【驗】以下順序照抄 2012-06-15 原始 HTML，2012-02 / 2012-12 / 2013-03 / 2013-12 完全相同（只有側欄最後一個模組換過）。

```
body
└ #bg-wrapper                       ← 整頁最外層（換膚背景圖掛這裡）
  ├ #wrapper.clearfix               ← width:970px，白底，左右各一條淡綠外框
  │ ├ .hd#uh-wrapper
  │ │ ├ #wfp-universal-header       ①頂部：活動小字 + Yahoo!奇摩/服務說明 + logo + Yahoo 搜尋列
  │ │ └ #wfp-navigation             ②綠色主導覽：網誌 相簿 影音 揪團 嘀咕 手機(NEW)
  │ │   └ #nav-corner-ad            （導覽右下角廣告位，240×60）
  │ ├ #push-down-ad                 ③下推式橫幅廣告位（存檔時為空）
  │ └ .bd.big-bd.clearfix
  │   ├ .main   (640px, float:left)
  │   │ ├ #wfp-archive              ④左側浮出的日期／日曆小工具（絕對定位在 #wrapper 左外側）
  │   │ ├ #wfp-cover.mod            ⑤今日主題（相片堆疊 stack-layout）
  │   │ ├ #wfp-inner-search         ⑥站內深色搜尋條（文章／相簿／影音）
  │   │ └ #wfp-featured.mod         ⑦熱門相簿（1 大 + 6 小照片牆 + 分頁籤）
  │   │   └ #featured-corner-ad     （200×56 角落廣告）
  │   └ .side   (300px, float:right)
  │     ├ #wfp-my                   ⑧「我的」個人區（未登入態）
  │     ├ #wfp-announcement         ⑨站方公告 + 3 張 85×60 小廣告
  │     └ #wfp-today.mod            ⑩最新熱門活動（活動／癮用王／調查局 3 筆）
  │       └ #today-corner-ad        （140×45 角落廣告）
  ├ .belt                           ← 跨滿版的深色腰帶
  │ └ #wfp-hybrid.mod.<first…fifth> ⑪熱門內容 4 分頁（潮聖趣/大變身/玩透透/嗑美食）
  │   ├ .hd > .tabs > ul.tabs-list
  │   ├ .belt-line
  │   ├ .bd > .main-content + a.more-recommended.main-more + .sub-content
  │   └ .hybrid-decoration-line
  └ #lower-wrapper.clearfix         ← width:970px，白底
    ├ .bd.clearfix
    │ ├ .main
    │ │ ├ #wfp-celebrity            ⑫名家專欄（藝人/模特兒/運動明星/作家/政治名人）
    │ │ └ #wfp-blog-entry.mod       ⑬無名官方部落格（兩欄連結）
    │ └ .side
    │   └ #wfp_top_daily_blogs.mod  ⑭投稿精選（推薦／隨機）※2012-02 這裡是 #wfp-join「揪團」
    └ .ft
      └ #wfp-footer                 ⑮頁尾：中文/English 切換、7 條連結、RSS 列、版權
```

**注意**：`.belt`（腰帶）與 `#lower-wrapper` 是 `#bg-wrapper` 的**兄弟節點**，不在 `#wrapper` 裡面。這就是為什麼熱門內容那條深色腰帶會滿版跨出白色主容器。【驗】

---

## 3. 尺寸總表

### 3.1 版面骨架【驗】

| 項目 | 值 | 出處 |
|---|---|---|
| 總版寬 | **970px**（置中） | `#wrapper,#lower-wrapper{width:970px;margin:0 auto}` |
| 主欄 `.main` | **640px**，`float:left; margin-left:10px` | `.main{...}` |
| 側欄 `.side` | **300px**，`float:right; margin-right:10px` | `.side{...}` |
| 主欄＋側欄＋間距 | 10+640+(留白10)+300+10 = 970 | 【推】由上面三條推算 |
| `.big-bd` | `padding-top:8px; border-top:1px solid #F0F0F0` | `.big-bd{...}` |
| 通用模組框 `.mod` | `margin-bottom:10px; border:1px solid #EFEBEF` | `.mod{...}` |
| 側欄模組框 `.side .mod` | `border-width:0 0 1px 1px`（只有下＋左邊框） | `.side .mod{...}` |
| `#lower-wrapper` | `padding-top:10px; overflow:hidden` | |
| `.belt` | chameleon 覆寫為 `width:970px;margin:0 auto` | `chameleon.css .belt{}` |

### 3.2 各模組寬高【驗】

| 模組 | 尺寸 |
|---|---|
| `#wfp-universal-header` | `width:950px; padding:0 10px 15px`（含 padding 共 970） |
| `#wfp-universal-header .hd` | `height:34px` |
| logo `h1.logo a` | `width:130px; height:36px` |
| 搜尋盒 `.bd div.search` | `width:56.8%; margin-left:40px; padding:3px; border:1px solid #9F9F9F` |
| 搜尋輸入框 `input` | `width:72.6%; height:24px`（IE `height:18px;padding-top:6px`） |
| 搜尋按鈕 `button` | `width:122px; height:24px; border-radius:2px` |
| `#wfp-navigation` | `width:970px; height:37px; margin-bottom:1px`（IE `height:38px`） |
| 導覽 `ul` | `padding:0 10px` |
| 導覽 `li a` | `line-height:2.4; padding:0 20px 0 50px`（各項左 padding 見 §6.2） |
| `#wfp-archive` | `width:56px; position:absolute; top:8px; left:-70px; z-index:9998` |
| `#wfp-archive .hd`（wfp-css） | `width:56px; height:98px` |
| `#wfp-archive .hd div`（便條紙） | `width:56px; height:73px; margin-top:8px` |
| `#wfp-archive .bd` | `width:48px; margin:0 auto; padding-top:6px`；`.expand` 時 `height:267px` |
| 日曆格 `li.date a` | `width:30px; line-height:1.6` |
| `#wfp-cover.mod` | `width:640px; border:1px solid #E5E5E5` |
| `#wfp-cover .stack` | `height:360px` |
| 堆疊照片 `.stack .block` | `width:420px; height:275px; padding:6px; margin:70px 0 0 16px`（實際圖 418×274） |
| 照片說明條 `.block:after` | `width:408px; bottom:6px; left:7px; padding:6px 5px` |
| `.stack .title` | `width:200px; padding-left:439px; text-align:right` |
| 分頁圓點 `.pagination` | `top:340px; left:200px`；`li{width:15px}`；`span{5×5px; border-radius:10px; border:1px solid #333}` |
| `#wfp-inner-search` | `width:638px; padding:4px 0; border:1px solid #000` |
| 內搜下拉鈕 `dl dt` | `19×19px; margin:4px 9px 0 6px` |
| 內搜類別文字 `#inner-search-type` | `width:52px; height:24px; margin-left:9px` |
| 內搜輸入框 | `width:465px; height:22px`；外框 `span{padding-left:7px}` |
| 內搜按鈕 | `width:64px; height:24px` |
| 建議選單 `.suggestMenu` | `width:458px; padding:7px; top:27px; left:95px` |
| `#wfp-featured .hd h2` | `padding:15px 22px 16px` |
| `#wfp-featured .hd ul` | `padding:11px 15px`；`li a{padding:4px 10px}` |
| `#wfp-featured .bd` | `margin:10px 3px 0 10px` |
| 照片格 `li`（一般） | `width:156px; height:96px; border:1px solid #c9c8c8; margin:0 3px 3px 0` |
| 照片格 `li.best` | `width:298px; height:298px`；圖亦 298×298 |
| 5 張版 `li.normal-four` | `height:146px`（`five_photos:true` 時） |
| 冠軍徽章 `span.featured-medal` | `width:125px; height:48px; top:-8px; left:-5px; padding:15px 0 0 18px` |
| `#wfp-my` | `width:299px; height:123px` |
| `#wfp-my .my-promotion li` | `width:83px`；`a{height:36px; border-radius:3px}` |
| `#wfp-my .ft` | `height:30px`；`h2{width:50px; line-height:30px; border-right:2px solid #b1b1b1}` |
| `#wfp-my .my-services` | `width:220px; padding:5px 0 5px 5px` |
| `#wfp-announcement` | `width:279px; padding:5px 10px`（合計 299） |
| 公告小廣告 `.annoad3 p` | `width:85px; height:60px; margin-left:12px`（第一個 `margin-left:0`）；圖 85×60 |
| `.annoad2 p`（兩張版） | `width:135px; margin-left:8px` |
| `#wfp-today` | `width:299px; margin-top:10px` |
| `#wfp-today` 縮圖 | `width:100px; height:75px`（實際圖 100×75） |
| `#wfp-today .bd ol li` | `padding:10px 0 10px 8px`；`div.content{margin-left:108px}`；`p.description{height:55px}` |
| `#wfp-hybrid .hd` | `height:70px; width:970px` |
| hybrid 分頁格 `li.tabs-cell` | `width:180px; height:63px; padding:7px 10px 0 0; border-left:1px solid #515151` |
| hybrid 分頁縮圖 | `55×55px`（實際圖 55×55） |
| hybrid `div.tabs-content` | `width:175px; left:5px` |
| `.belt-line` | `height:3px` |
| `#wfp-hybrid .bd` | `width:970px; height:250px; padding:25px 0` |
| `.main-content` | `width:450px; padding-right:25px; margin-left:10px; border-right:1px solid #282828` |
| `.sub-content` | `width:455px; padding-left:25px; border-left:1px solid #464646` |
| 主圖 `.image-wrapper` | `margin-right:15px`；實際圖 **217×217** |
| `.article-wrapper` | `width:215px; height:217px` |
| `.pic-text-2` | `width:208px; margin-right:18px`；`.mix-article{width:208px}`；實際圖 **207×155** |
| `.mix-item`（一般） | `width:214px; margin-right:10px; margin-bottom:24px` |
| `#wfp-celebrity` | `width:638px; border:1px solid #E5E5E5` |
| celebrity `.bd` | `padding:12px 10px 0` |
| celebrity 首則 `li.first` | `width:402px; height:150px; margin-right:16px`；縮圖 **217×148** |
| celebrity 其他 `li` | `height:72px`；縮圖 **70×70**（原始檔 90×90 被縮放） |
| `#wfp-blog-entry .emphatic` | `float:left; width:296px; padding:0 22px 0 18px` |
| `#wfp-blog-entry .normal` | `float:right; width:257px; padding-left:22px; border-left:1px dotted #E5E5E5` |
| `#wfp_top_daily_blogs` | `width:299px` |
| 投稿精選縮圖 | `width:80px; height:80px`（實際圖 80×80）；`.content{height:82px; margin-left:78px}` |
| `#wfp-footer` | `width:970px; margin-top:10px; padding-top:14px; border-top:1px solid #E5E5E5; line-height:1.8` |
| `#rss-bar .inner` | `width:500px` |
| `#wfp-lang` | `top:13px; right:14px`；`ul{border:1px solid #ddd; border-radius:2px}`；`li{height:17px; padding:0 7px}` |

### 3.3 圓角半徑一覽【驗】

| 元素 | radius |
|---|---|
| 分頁籤 on 態（熱門相簿／名家專欄／投稿精選）`li.on a` | `3px` |
| 日曆選中日 `li.selected a` | `3px` |
| 「我的」登入按鈕 `.my-promotion li a` | `3px` |
| 調查局「我要投票」`p.vote a` | `3px` |
| 頂部搜尋按鈕 | `2px` |
| 語言切換 `#wfp-lang ul` | `2px` |
| 今日主題分頁圓點 `span` | `10px`（`.on` 為 `21px`） |
| 分享泡泡 `.wfp-sharing .hd span.bubble` | `5px` |
| 名家專欄分隔小方點 `li:before` | `1px` |
| 今日主題輪播鈕 `span.up` | `0 0 5px 5px`；`span.down` `5px 5px 0 0` |

---

## 4. 精確色碼表

一律標明「用途 → 色碼 → 出自哪個檔案的哪條規則」。以下全部【驗】。
`W` = `index_wfp-css_201205171100.css`，`C` = `index_chameleon.css`。

### 4.1 基礎與版面

| 用途 | 色碼 | 規則 |
|---|---|---|
| 全頁文字色 | `#000` | YUI reset `html{color:#000;background:#FFF}` |
| 主容器底色 | `#FFF` | W `#wrapper,#lower-wrapper{background-color:#FFF}` |
| `#wrapper` 左右外框（漸層消失） | `#cee2db`（頂端）→ 透明（y=280） | `img_fp_outline.png` 逐像素取樣 |
| `.big-bd` 上分隔線 | `#F0F0F0` | W `.big-bd{border-top:1px solid #F0F0F0}` |
| 通用模組外框 | `#EFEBEF` | W `.mod{border:1px solid #EFEBEF}` |
| 主容器投影（IE 用圖） | `rgba(0,0,0,0.035~0.12)` 3px | `bg_wrapper.png` 取樣 `#000/a9,a18,a30` |
| 主容器投影（現代瀏覽器） | `box-shadow:0 0 5px #000` | C `#lower-wrapper,#wrapper` |

### 4.2 頂部與導覽

| 用途 | 色碼 | 規則 |
|---|---|---|
| 頂部小連結文字（Yahoo!奇摩／服務說明） | `#676767` | W `#wfp-universal-header .hd ul li a{color:#676767}` |
| Yahoo!奇摩 右分隔線 | `#D9D9D9` | W `li.yahoo-home{border-right:1px solid #D9D9D9}` |
| 服務說明 左分隔線 | `#E9E9E9` | W `li.service-guide{border-left:1px solid #E9E9E9}` |
| 活動小字（首頁最上方那行） | `#8080BF` | HTML inline `style="...color:#8080BF"` |
| 搜尋盒外框 | `#9F9F9F` | W `.bd div.search{border:1px solid #9F9F9F}` |
| 搜尋盒底 | `#DFDFE0`；漸層 `#F1F1F4 → #CACACA` | W 同上 |
| 搜尋 input 邊框 | 上左 `#7B797B`，下右 `#CECBCE` | W `.bd div.search input{border-color:#7B797B #CECBCE #CECBCE #7B797B}` |
| 搜尋 input 文字 | `#333`；placeholder `#999` | W |
| 搜尋按鈕底 | `#F8D44C`；漸層 `#FFF39C → #FEE474(40~50%) → #FDD14C(50%) → #FCC42E` | W `.bd div.search button` |
| 搜尋按鈕框 | `#878787` | W 同上 |
| **導覽列綠色漸層**（左→右） | `#B2CD89 → #C3D790(20%) → #92C067(40%) → #65B051(60%) → #5AB166(70%) → #56B27A(100%)`，`to(#56BA99)` | W `#wfp-navigation{background:-webkit-gradient(linear,100% 0,0% 0,...)}` |
| 導覽列上邊框 | `rgba(90,182,132,0.1)` | W 同上 |
| 導覽列白霧覆蓋 | `rgba(255,255,255,0.25) → rgba(94,168,87,0.25)` | W `#wfp-navigation .blog-nav` |
| 導覽列 fallback 圖實測色（y=18，左→右） | `#58af87 → #66bc92 → #60b67f → #63b66f → #6cb667 → #7ebb67 → #94c26e → #abca78 → #b5cf7e → #b7d089` | `bg_nav_default.png` 每 97px 取樣 |
| 導覽文字 | `#000` | W `#wfp-navigation ul li a{color:#000}` |

### 4.3 今日主題（#wfp-cover）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 模組外框 | `#E5E5E5` | W `#wfp-cover.mod{border-color:#E5E5E5}` |
| 亮版底色 | `#F4F4F4` | W `#wfp-cover.stack-layout{background:#F4F4F4}` / `.bright` |
| 暗版底色 | `#333`（配 `bg_cs_stack_dark.png`） | W `.dark-stack-layout{background-color:#333!important}` |
| 暗版外框 | `#7F7F7F` | W `#wfp-cover.dark{border:1px solid #7F7F7F}` |
| 照片白邊 | `#fff`，`padding:6px` | W `.stack .block{background:#fff}` |
| 照片外框 | `#a0a0a0` | W `.first-block/.second-block/...{border:1px solid #a0a0a0}` |
| 照片投影 | `2px 2px 10px #a0a0a0`（webkit）／`#000`（moz） | W `.stack .block` |
| 照片標題條底 | `rgba(0,0,0,0.7)`；IE `#000 + alpha70` | W `.stack .block:after` / `.ieshadow` |
| 照片標題文字 | `#FFF`，`font-size:93%`，`letter-spacing:1px` | W 同上 |
| 大標題 h2 文字 | `#43883F` | W `#wfp-cover .stack h2 a{color:#43883F}` |
| 大標題 h2 下底線 | `2px solid #43883F` | W `#wfp-cover .stack h2` |
| 大標題 hover | `#5ab954` | W `.stack h2 a:hover` |
| 暗版大標題 | `#FFF`，hover `#bdbdbd`，底線 `2px solid #FFF` | W `#wfp-cover.dark .stack h2 a` |
| 「今日主題」小標與內文 | `#333`（暗版 `#C1C1C1`） | W `.stack .title span` / `.stack .title p` |
| 分頁圓點（未選） | 底 `#FDFDFD`、框 `1px solid #333`、radial `#000→#FDFDFD` | W `.stack .pagination span` |
| 分頁圓點（選中） | `#333`，radial `#000→#a0a0a0` | W `.pagination span.on` |
| mess 版背景 radial | `#D0D0D0 → #F4F4F4`（暗版 `#333→#333(70%)→#000`） | W `#wfp-cover .mess` |
| mess 版拍立得底 | `#E3E3D8`，框 `1px solid #a0a0a0` | W `#wfp-cover .mess .block` |
| 廣告標記文字 | `#999` | W `#wfp-cover.stack-layout .ad-logo` |

### 4.4 站內搜尋條（#wfp-inner-search）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 深色底 | `#333` | W `#wfp-inner-search{background-color:#333}` |
| 外框 | `#000` | W 同上 |
| 類別文字 | `#FFF` | W `span#inner-search-type{color:#FFF}` |
| 輸入框底 | `#F1F1F1` | W `.search-input span/input` |
| 輸入框邊框 | 上 `#B6B5B5`、左右 `#C4C2C2`、下 `#D7D5D5` | W `.search-input span{border-color:#B6B5B5 #C4C2C2 #D7D5D5}` |
| 輸入文字／placeholder | `#333` / `#C1C1C1` | W |
| 搜尋鈕漸層 | `#CECFCE(0) → #D6D7D6 → #C6C7C6(1) → #BDBEBD`，文字 `#333` | W `.search-input button` |
| 下拉選單底／框 | `#FFF` / `#DDD` | W `dl dd` |
| 下拉 hover | `#EEE`，文字 `#666` | W `dl dd ul li.on` |
| 建議清單框 | `#CCC`；hover 底 `#E0EDFE`；關鍵字 `#1A84B7` | W `.suggestMenu` |

### 4.5 熱門相簿（#wfp-featured）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 標題文字 | `#000`，`font-weight:bold` | W `#wfp-featured .hd h2` |
| 標題下白線 | `#FFF` | W 同上 |
| 分頁籤區塊左框 | `#F2F2F2` + `line_dot_vertical.png` 直虛線 | W `#wfp-featured .hd ul` |
| 分頁籤下虛線 | `1px dotted #C6C6C6` | W `#wfp-featured .hd div` |
| 分頁籤文字 | `#666` | W `.hd ul li a{color:#666}` |
| **分頁籤選中** | 底 `#91B93F`，字 `#FFF`，`box-shadow:1px 1px 1px #B3B3B3` | W `.hd ul li.on a` |
| 分頁籤之間圓點 | `#b3b3b3`（`ico_fp_dot.png` 2×2 實測） | 圖檔取樣 |
| 照片格外框 | `#c9c8c8` | W `.featured-photos ul li{border:1px solid #c9c8c8}` |
| 冠軍照下緣線 | `#c9c8c8` | W `li.best img{border-bottom:1px solid #c9c8c8}` |
| hover 資訊面板底 | `rgba(0,0,0,0.7)`（IE `#000` + `alpha(opacity=70)`） | W `li .panel` |
| 面板暱稱文字 | `#C1C1C1` | W `li h5 a{color:#C1C1C1}` |
| 面板標題文字 | `#FFF` | W `li p{color:#FFF}` |
| 冠軍徽章文字 | `#723B0E` | W `span.featured-medal{color:#723B0E}` |
| 「更多」連結 | `#999`；箭頭 `#B5B2B5` | W `#wfp-featured .ft a` |

### 4.6 我的（#wfp-my）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 底色 | `#F7F7F7` | W `#wfp-my{background-color:#F7F7F7}` |
| 邊框 | 上 `#F0F0F0`、右 透明、下 `#E5E5E5`、左 `#EAEAEA` | W `#wfp-my{border-color:#F0F0F0 transparent #E5E5E5 #EAEAEA}` |
| 一般連結 | `#666` | W `#wfp-my a{color:#666}` |
| 綠色連結（帳號名／hover） | `#43883F` / `#43883f` | W `.hd p a` / `.my-services li a:hover` |
| 登入鈕漸層 | `#FFF → #E7E7E7`，框 `#CECBCE`，字 `#333` | W `.my-promotion li a` |
| 登入鈕 hover | `#FFF → #D6D7D6`，字 `#43883f` | W `.my-promotion li a:hover` |
| 頂部小連結 | `#999`，分隔 `1px solid #636563` | W `.hd ul li a` / `.hd ul li` |
| 底部工具列漸層 | `#e7e7e7 → #f8f8f8` | W `#wfp-my .ft` |
| 「我的」標籤漸層 | `#a5a5a5 → #bfbfbf`，右框 `2px solid #b1b1b1` | W `#wfp-my .ft h2` |
| 服務清單項目符號三角 | `#B5B5B5`（內填 `#F7F7F7`） | W `.my-services li:before/:after` |
| VIP 分隔線 | `#e5e5e5` | W `.my-messages li.join-vip{border-right}` |
| BGM tooltip | 底 `#FFF`、框 `#DEDEDE`、箭頭 `#A1A1A1`、投影 `#E5E5E5` | W `#wfp-bgm .tooltip` |
| BGM tooltip 副標 | `#7D7D7D` | W `#wfp-bgm .tooltip p.tip` |

### 4.7 公告（#wfp-announcement）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 底色 | `#F7F7F7` | W `#wfp-announcement{background-color:#F7F7F7}` |
| 邊框 | 左 `#EAEAEA`、上 `#FFFBFF`、下 `#E4E4E4` | W 同上 |
| 連結 | `#666`，`font-size:93%` | W `#wfp-announcement a` |
| 「更多站方公告」 | `#9C9A9C`，箭頭 `#B5B2B5` | W `#wfp-announcement p a` |

### 4.8 最新熱門活動（#wfp-today）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 底色 | `#f7f7F7` | W `#wfp-today{background-color:#f7f7F7}` |
| 邊框 | 上 `#F0F0F0`、下 `#E4E4E4`、左 `#EAEAEA` | W 同上 |
| 標題底線 | `#E5E5E5` | W `#wfp-today .hd` |
| 條目分隔 | `1px dotted #E5E5E5` | W `.bd ol li` |
| 文字 | `#666` | W `#wfp-today h3,a` |
| 標題 hover | `#43883F` | W `.bd ol li h3 a:hover` |
| **序號徽章** | 底 `#b3b3b3`，字 `#FFF`，`box-shadow:2px 2px 0 #DBDBDB`，`padding:1px 6px` | W `.bd ol h3:before{content:attr(data-order)}` |
| 「我要投票」鈕 | 漸層 `#fff(50%) → #efebef(51%)`，框 `#CECBCE` | W `li.vote p.vote a` |
| 「更多…」 | `#999`，箭頭 `#B5B2B5` | W `p.more a` |

### 4.9 熱門內容腰帶（#wfp-hybrid）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 腰帶底色 | `#333` + `bg_hugc_gray.png` repeat-x（`left 70px`） | C `html #wfp-hybrid` |
| 腰帶投影 | `0 2px 5px #000` | C 同上 |
| 下邊框 | `1px solid #222` | W `#wfp-hybrid{border-bottom:1px solid #222}` |
| 分頁格左框 | `#515151` | W `li.tabs-cell{border-left:1px solid #515151}` |
| 分頁未選標題 | `#C1C1C1`；描述 `#666` | W `.hd h4` / `.hd span` |
| 分頁 hover | 標題 `#FFF`；描述 `#999` | W `.tab-mouseon h4/span` |
| 分頁選中 | 標題 `#000`（`font-size:116%`）；描述 `#333` | W `li.tabs-cell.on h4` / `.on span` |
| 主/副欄分隔線 | 右 `#282828`、左 `#464646` | W `.main-content` / `.sub-content` |
| 內文段落 | `#AAA` | W `#wfp-hybrid .bd p` |
| 標籤小方塊（每日一推等） | 底 `#030200`，字 `#C1C1C1`，框 `#515151` | W `.article-wrapper span` |
| 底部裝飾線 | `1px solid #515151` | W `.hybrid-decoration-line` |
| belt-line 預設 | `#707070 → #464646` | C `html #wfp-hybrid .belt-line` |

**四／五個分頁各自的主題色**（`#wfp-hybrid` 會被加上 `first`…`fifth`）【驗】W 第 354–414 行：

| class | 深色帶色（10% 停點） | 主題強調色 | belt-line 終點色 | 對應 fallback 圖 |
|---|---|---|---|---|
| `.first` | `#665026` | **`#FFA800`** | `#624D24` | `bg_hugc_orange.png` |
| `.second` | `#505A3E` | **`#A5CE5D`** | `#505A3E` | `bg_hugc_lime.png` |
| `.third` | `#3E5959` | **`#60CACA`** | `#3E5959` | `bg_hugc_mint.png` |
| `.fourth` | `#46515E` | **`#7DAADE`** | `#46515E` | `bg_hugc_violet.png` |
| `.fifth` | `#664250` | **`#FF6FA5`** | `#664250` | `bg_hugc_pink.png` |

強調色套用在：`li.tabs-cell.on:before` 背景、`h5 a` 文字、`a.more-recommended` 文字與箭頭、`.rank h5:after`、`.on div.tabs-content:after` 的上箭頭。
另外 `a.more-recommended` 的**預設色**（未套主題時）是 `#FFAB00`（W 第 297 行）。
背景漸層原型：`linear-gradient(-90deg, #333 19%, <深色帶色> 10%, #333 30%)`（原文照抄，順序即 CSS 原樣）。

### 4.10 名家專欄 / 官方部落格 / 投稿精選

| 用途 | 色碼 | 規則 |
|---|---|---|
| `#wfp-celebrity` 外框 | `#E5E5E5` | W `#wfp-celebrity{border:1px solid #E5E5E5}` |
| 連結預設 | `#666` | W `#wfp-celebrity a` |
| 文章標題 | `#43883F` | W `.bd ul li h3 a{color:#43883F}` |
| 縮圖外框 | `#C9C8C8` | W `.bd ul li a.thumbnail` |
| 標題右虛線 | `1px dotted #C6C6C6` | W `.hd h2{border-right}` |
| 分頁籤選中 | 底 `#91B93F`，字 `#FFF`，`box-shadow:1px 1px 1px #B3B3B3`，`radius:3px` | W `.hd ul li.on a` |
| 分頁籤分隔小方點 | `#B5B2B5`（1px 邊框方塊） | W `.hd ul li:before` |
| 首則內文 | `#000` | W `li.first p` |
| 「更多藝人」 | `#999`，箭頭 `#B5B2B5` | W `.ft p.more a` |
| `#wfp-blog-entry` 連結 | `#666`；強調欄 `#43883F` | W `#wfp-blog-entry a` / `div.emphatic a` |
| `#wfp-blog-entry` 中間分隔 | `1px dotted #E5E5E5` | W `div.normal{border-left}` |
| 清單三角項目符號 | `#B5B5B5`（內填 `#FFF`） | W `#wfp-blog-entry ul:before/:after` |
| `#wfp_top_daily_blogs` 底 | `#F7F7F7`；邊框同 `#wfp-today` | W |
| 分頁籤選中 | 底 `#91B93F`，字 `#FFF` | W `.hd li.on a` |
| 條目分隔（第 2 則上） | `1px dotted #C6C7C6` | W `.bd li.last` |
| 敘述文字 | `#000`；一般 `#333` | W `.content p.description` |

### 4.11 頁尾

| 用途 | 色碼 | 規則 |
|---|---|---|
| 上分隔線 | `#E5E5E5` | W `#wfp-footer{border-top:1px solid #E5E5E5}` |
| 連結 | `#666` | W `#wfp-footer a` |
| 連結之間的小方點 | `#B5B2B5`（1px border 方塊） | W `ul.nav li:before` |
| 「本站設有管理員…」文字 | `#999` | W `#wfp-footer p span` |
| RSS 列下虛線 | `1px dotted #c6c6c6` | W `#rss-bar` |
| RSS 標籤「RSS:」 | `#333` | W `#rss-bar .inner h5` |
| RSS 各項分隔 | `1px dotted #b3b3b3` | W `#rss-bar .inner ul li` |
| 語言鈕漸層 | `#fff(50%) → #efebef(51%)`，框 `#ddd` | W `#wfp-lang ul li` |
| 語言鈕選中 | 底 `#CECFCE`，字 `#000` | W `#wfp-lang ul li.on` |
| 語言鈕文字 | `#666` | W `#wfp-lang ul li a` |

### 4.12 分享泡泡（.wfp-sharing，共用）

| 用途 | 色碼 | 規則 |
|---|---|---|
| 泡泡底／框 | `#FFF` / `1px solid #AAA` | W `.wfp-sharing .hd span.bubble` |
| 泡泡尖角 | 外 `#AAA`、內 `#FFF` | W `span.bubble:before/:after` |

---

## 5. 字型與字級

### 5.1 基準（YUI 3.2.0 fonts-min）【驗】
```css
body { font: 13px/1.231 arial, helvetica, clean, sans-serif; *font-size:small; *font:x-small; }
select,input,button,textarea { font: 99% arial, helvetica, clean, sans-serif; }
table { font-size:inherit; font:100%; }
```
> 沒有指定中文字型，實際靠瀏覽器 fallback（當年 Windows 上是新細明體／微軟正黑體）。
> `#wfp-archive` 是唯一自行指定字族的模組：`font-family:verdana,arial,helvetica,clean,sans-serif`（W 第 703 行）。

### 5.2 百分比 → 像素換算（base 13px）【驗 CSS 值 / 推 換算】

| CSS `font-size` | ≈px | 用在哪 |
|---|---|---|
| `77%` | 10px | 日曆月份標籤 `li.month`；`.pagination span.on`（no-cssgradients） |
| `85%` | 11px | 頂部小連結（Yahoo!奇摩／服務說明）；`#wfp-archive-today .month`；今日主題「今日主題」小標 |
| `93%` | 12px | 大量：`#wfp-my`（模組整體）、搜尋 input/button、今日主題內文、featured 暱稱、hybrid 段落、today 內文、頁尾整體、「更多」連結 |
| `100%` | 13px | `#wfp-featured .hd h2`、`#wfp-celebrity .hd h2`、featured 面板 `p`、hybrid `.hd h4`、`.pic-text-2 h6` |
| `108%` | 14px | `#wfp-my .my-services li` |
| `116%` | 15px | **導覽列文字**、`#wfp-celebrity li.first h3 a`、hybrid `.bd h5 a`、hybrid 選中分頁的 `h4` |
| `123.1%` | 16px | 「我的」登入按鈕文字 |
| `153.9%` | 20px | 日曆大日期 `#wfp-archive-today .day` |
| `197%` | **26px** | **今日主題大標 `#wfp-cover .stack h2`**（`font-weight:bold`，`letter-spacing:0`） |

### 5.3 行高與字重重點【驗】

| 元素 | 值 |
|---|---|
| `#wfp-navigation ul li a` | `line-height:2.4`（≈36px，撐出 37px 導覽列） |
| `#wfp-footer` | `line-height:1.8` |
| `#wfp-cover .stack .title p` | `line-height:1.5` |
| `#wfp-today p.description` | `line-height:1.5` |
| `#wfp-hybrid .bd p` | `line-height:1.385 !important` |
| `#wfp_top_daily_blogs .content p` | `line-height:1.4` |
| `#wfp-celebrity li.first p` | `line-height:1.5` |
| `#wfp-archive li` | `line-height:1.6` |
| `#wfp-my .ft h2` | `line-height:30px` |
| `#wfp-my .my-promotion li a` | `line-height:2.4em` |
| 粗體處 | `#wfp-featured .hd h2`、`#wfp-celebrity .hd h2`、`#wfp-today .hd h2`、`#wfp-today li h3`、`#wfp_top_daily_blogs .hd h2`、`#wfp-blog-entry h2`、`#wfp-cover .stack h2`、`#wfp-my .my-promotion li a`、序號徽章、搜尋按鈕、`#wfp-archive .day` |
| `letter-spacing` | 今日主題大標原設 `2px` 但同條後面被 `0` 覆寫（實際 0）；照片說明條 `1px`；`.mess .block` `2px`；hybrid `.article-wrapper span` `1px` |

---

## 6. DOM 結構（照抄原始 HTML，不簡化）

### 6.1 頂部 `#wfp-universal-header`【驗】

```html
<div class="hd" id="uh-wrapper">
  <div id="wfp-universal-header">
    <header>
      <div class="hd">
        <!--campaign starts-->
        <ul>
          <li><a href="…/starwrds/*http://www.wretch.cc/blog/wretchbeauty/12760894" target="_blank"
                 style="position:absolute;top:10px;left:45%;text-decoration:undeline;color:#8080BF;">足球雜誌募集足球美少女！</a></li>
        </ul>
        <!--campaign ends-->
        <ul class="nav">
          <li class="yahoo-home"><a href="…/head/yahoo/*http://tw.yahoo.com">Yahoo!奇摩</a></li>
          <li class="service-guide"><a href="…/head/help/*http://tw.help.cc.yahoo.com/?product=wretch">服務說明</a></li>
        </ul>
      </div>
      <div class="bd">
        <h1 class="logo">
          <a href="http://www.wretch.cc/" title="無名小站">
            <img src="…/img/logo_wretch.png" alt="無名小站" title="無名小站">
          </a>
        </h1>
        <div class="search">
          <form action="http://tw.blog.search.yahoo.com/search" method="GET">
            <input type="hidden" value="cb-wretch" name="fr">
            <input type="hidden" value="web"       name="type">
            <input type="hidden" value="wretch"    name="provider">
            <fieldset>
              <legend>Yahoo! Search</legend>
              <label for="search-input">搜尋：</label>
              <input type="text" id="search-input" name="p" placeholder="搜尋" autocomplete="off">
              <button type="submit" value="搜尋網頁">搜尋網頁</button>
            </fieldset>
          </form>
        </div>
      </div>
    </header>
  </div>
```
> `legend` 與 `label` 被 `position:absolute;top:-999em` 藏起來（只給輔具讀）。
> 那行活動小字是 `position:absolute; top:10px; left:45%`，浮在 header 中間偏右上。文案每期不同（2013-12 那份是「徵求各式職場美人！」）。

### 6.2 導覽 `#wfp-navigation`【驗】

```html
  <div id="wfp-navigation">
    <nav class="blog-nav">
      <ul>
        <li class="blog first"><a href="…/me/blog/*http://www.wretch.cc/blog/">網誌</a></li>
        <li class="album">     <a href="…/me/album/*http://www.wretch.cc/album/">相簿</a></li>
        <li class="video">     <a href="…/me/video/*http://www.wretch.cc/video/">影音</a></li>
        <li class="join">      <a href="…/me/join/*http://www.wretch.cc/join/">揪團</a></li>
        <li class="digu">      <a href="…/me/digu/*http://www.wretch.cc/digu/">嘀咕</a></li>
        <li class="mobile last new">
          <a href="…/me/mobile/*http://tw.wretch.campaign.yahoo.net/2011mobilecam/">手機<span>(NEW)</span></a>
        </li>
      </ul>
    </nav>
    <div id="nav-corner-ad"></div>
  </div>
</div><!-- /#uh-wrapper -->
```

各項的 sprite 位置與左內距【驗】：

| li class | `padding-left` | `background-position` | 圖示在 sprite 的座標 |
|---|---|---|---|
| `.blog` | 48px | `21px 9px` | (0,0) 18×20 文件 |
| `.album` | 50px | `-141px 11px` | (160,0) 22×15 相機 |
| `.video` | 49px | `-296px 9px` | (319,0) 18×18 播放鍵 |
| `.join` | 50px | `-462px 10px` | (480,0) 22×16 大聲公 |
| `.digu` | 49px | `-618px 11px` | (640,0) 18×15 對話框 |
| `.mobile` | 40px | `-781px 9px` | (798,0) 14×20 手機 |

「(NEW)」是 `li.new span{width:23px; position:absolute; top:0; right:19px; text-indent:999em; background:ico_sprite.png -160px -60px}` → 顯示 sprite (160,72) 那個 23×11 的彩色 NEW 圖。
每個 `li` 右側有 `line_nav_border.png`（2×36 半透明白直線）；`li.first:before` 在最左也補一條。
**2013-12 起「手機」整個 `li` 被移除，`.digu` 變成 `class="digu last"`。**【驗】

### 6.3 日期／日曆 `#wfp-archive`【驗】

```html
<div id="wfp-archive">
  <div class="hd">
    <h3><a href="http://www.wretch.cc/?date=2012-06-15">今天</a></h3>
    <div>
      <p id="wfp-archive-today">
        <span class="month">六月</span>
        <span class="day">15</span>
      </p>
      <a id="wfp-archive-switcher" href="#"><span>展開/收合</span></a>
    </div>
  </div>
  <div class="bd">
    <a id="wfp-archive-forward" href="#">未來</a>
    <ul id="wfp-archive-calendar">
      <li class="date selected"><a href="http://www.wretch.cc/?date=2012-06-15">15</a></li>
      <li class="date normal">  <a href="http://www.wretch.cc/?date=2012-06-14">14</a></li>
      …（共 11 個 li，15 → 05）…
    </ul>
    <a id="wfp-archive-backward" href="#">過去</a>
  </div>
  <input type="hidden" name="monthUnit" value="一月">
  …（十二個 monthUnit：一月 二月 三月 四月 五月 六月 七月 八月 九月 十月 十一月 十二月）…
  <input type="hidden" name="todayTopic" value="今日主題">
</div>
```
> `#wfp-archive-forward/backward/switcher span` 的文字都被 `text-indent:-9999em` 藏起來，只顯示 sprite 箭頭。
> JS 會把外層 `#wrapper > div.bd` 加上 `archive-relative`，並依情況給 `#wfp-archive` 加 `expand` 或 `collapse`。

### 6.4 今日主題 `#wfp-cover`（stack 版）【驗】

```html
<div id="wfp-cover" class="mod stack-layout bright bright-stack-layout">
  <input type="hidden" id="cover-type"     value="stack">
  <input type="hidden" id="cover-sub-type" value="">
  <input type="hidden" id="cover-auto"     value="">
  <div class="bd stack ">
    <div class="title">
      <article class="article">
        <header class="header">
          <span>今日主題</span>
          <h2 data-title="面試拼人氣&lt;br&gt;好感穿搭妝">
            <a target="_blank" href="…">面試拼人氣<br>好感穿搭妝</a>
          </h2>
        </header>
        <p>新鮮人～看過來<br>招桃花 拼人氣<br>穿搭摩人來現身<br>親自示範...<br>一秒好感甜美又顯瘦<br>包你人見人愛！</p>
      </article>
    </div>
    <div class="gallery clearfix">
      <div class="block" data-title="正妹型男必看！修長又顯瘦...圖解快學起來">
        <a title="…" target="_blank" href="…"><img src="…cover_photo…jpg" alt="…"></a>
        <div class="inner-block">
          <h3 class="inner-title"><a title="…" target="_blank" href="…">正妹型男必看！修長又顯瘦...圖解快學起來</a></h3>
          <p class="inner-caption"></p>
        </div>
      </div>
      …（共 3 個 .block）…
    </div>
    <div class="pagination">
      <ol>
        <li><span title="正妹型男必看！修長又顯瘦...圖解快學起來" class="pagi" target="1"></span></li>
        <li><span title="…" class="pagi" target="2"></span></li>
        <li><span title="…" class="pagi" target="3"></span></li>
      </ol>
    </div>
    <div class="wfp-sharing clearfix">
      <div class="right">
        <div class="hd"><span class="bubble off">分享至</span></div>
        <div class="bd clearfix right">
          <a class="fb-sharing share"    target="_blank" href="…" data-title="分享至臉書" title="分享至臉書"></a>
          <a class="plurk-sharing share" target="_blank" href="…" data-title="分享至噗浪" title="分享至噗浪"></a>
        </div>
      </div>
    </div>
  </div>
</div>
```
> JS 會在載入後依序把 3 個 `.block` 加上 `first-block` / `second-block` / `third-block`（`fourth-block`、`stop-block` 為 4 張以上／過場用）。
> 各層旋轉角（來自 head 內的 IE Matrix filter 與 CSS transform）【驗】：
> `second-block: rotate(-5deg)`、`third-block: rotate(3deg)`、`fourth-block: rotate(-10deg)`、`stop-block: rotate(-5deg)`；`#wfp-my .my-coverPic: rotate(-3deg)`。
> 各層位移：`first{top:0;left:-10px}`、`second{top:-10px;left:-10px}`、`third{top:-5px;left:-10px}`、`fourth{top:-10px;left:-5px}`、`stop{top:0;left:-80px;opacity:.8;background:#f0f0f0}`。

### 6.5 站內搜尋 `#wfp-inner-search`【驗】

```html
<div id="wfp-inner-search">
  <form action="http://tw.blog.search.yahoo.com/search" method="GET">
    <input name="provider" type="hidden" value="wretch">
    <input name="ei"       type="hidden" value="UTF-8">
    <input name="fr"       type="hidden" value="cb-wretch">
    <fieldset>
      <legend class="title-hide">Wretch Search</legend>
      <div class="search-type">
        <span class="title-hide">目前搜尋類別：</span>
        <span id="inner-search-type">文章搜尋</span>
        <dl>
          <dt>變更搜尋類別：</dt>
          <dd>
            <ul>
              <li><input type="radio" name="type" id="inner-search-article" value="article" checked="checked"><label for="inner-search-article">文章搜尋</label></li>
              <li><input type="radio" name="type" id="inner-search-photo"   value="photo"><label for="inner-search-photo">相簿搜尋</label></li>
              <li><input type="radio" name="type" id="inner-search-video"   value="video"><label for="inner-search-video">影音搜尋</label></li>
            </ul>
          </dd>
        </dl>
      </div>
      <div class="search-input">
        <label for="inner-search-input" class="title-hide">輸入搜尋字串：</label>
        <span><input type="text" placeholder="搜尋無名小站文章" autocomplete="off" id="inner-search-input" name="p"></span>
        <button value="搜尋" type="submit">搜尋</button>
      </div>
      <div class="suggestMenu"></div>
    </fieldset>
  </form>
  <input type="hidden" id="wfp-inner-search-article" value="搜尋無名小站文章">
  <input type="hidden" id="wfp-inner-search-photo"   value="搜尋無名小站相簿">
  <input type="hidden" id="wfp-inner-search-video"   value="搜尋無名小站影音">
</div>
```

### 6.6 熱門相簿 `#wfp-featured`【驗】

```html
<script>
  var featuredJSON = {};
  featuredJSON.featured_beauty   = '{"title":"無名優質正妹","more_title":"更多無名完美女孩在這！","more_url":"…","content":{"0":{…"label":"本日最鄰家"…},…},"five_photos":false}';
  featuredJSON.featured_selected = '{"title":"無名萌系女孩","more_title":"不夠！給你更多無名萌妹","more_url":"…","content":{…"label":"本日最清純"…},"five_photos":false}';
</script>
<div id="wfp-featured" class="mod">
  <div class="hd">
    <h2>熱門相簿</h2>
    <div class="tab">
      <ul class="skin-tab">
        <li class=" first" data-category="featured_beauty"   rd="…"><a target="_blank" href="#featured_beauty">無名優質正妹</a></li>
        <li class="on"     data-category="featured_selected" rd="…"><a target="_blank" href="#featured_selected">無名萌系女孩</a></li>
      </ul>
    </div>
  </div>
  <div class="bd">
    <div class="featured-photos" id="featured_selected">
      <ul class="clearfix">
        <li class="best">
          <a target="_blank" href="…" title="我對小動物很有愛心喔～呵"><img src="…298x298.jpg" alt="…"></a>
          <span class="featured-medal">本日最清純</span>
          <div class="panel best-panel">
            <div class="panel-text">
              <h5 class="model-name">
                <a target="_blank" href="…album.php?id=shu31&book=37" title="溫妮">溫妮</a>
                <a target="_blank" href="…admin/friend/?func=friend&tab=add&uid=shu31" class="add-friend-btn" title="加為朋友">加為朋友</a>
              </h5>
              <p><a target="_blank" href="…" title="…">我對小動物很有愛心喔～呵</a></p>
            </div>
          </div>
        </li>
        <li class="normal normal-six">…（同結構，panel class = "panel normal-six"）…</li>
        …（共 6 個 normal-six）…
      </ul>
    </div>
    <div id="wfp-featured-sharing-featured_beauty"   class="sharing-tab ">      …wfp-sharing(left)… </div>
    <div id="wfp-featured-sharing-featured_selected" class="sharing-tab tab-on">…wfp-sharing(left)… </div>
  </div>
  <div class="ft">
    <a id="featured-more" target="_blank" href="…album/?func=hot&hid=0&class_id=9" title="不夠！給你更多無名萌妹">不夠！給你更多無名萌妹</a>
  </div>
  <div id="featured-corner-ad"></div>
</div>
```
排版：`li.best`（298×298＋2px 框＝300）浮左，右邊 2 欄 × 3 列的 `li.normal-six`（156×96＋2px 框＝158，`margin:0 3px 3px 0` → 161 步距），合計 300 + 161×2 = 622，塞進 `.bd`（640 − margin 13 = 627）。【驗尺寸／推排版算式】

### 6.7 我的 `#wfp-my`（未登入態）【驗】

```html
<div id="wfp-my">
  <div class="wfp-my">
    <div class="my-setting">
      <script type="text/javascript">
        var bgm_module_msg = {
          'status_on' :'背景音樂設定開啓',
          'status_off':'背景音樂設定關閉',
          'tip_on'    :'點選圖示開啟',
          'tip_off'   :'點選圖示關閉'
        };
      </script>
      <div id="wfp-bgm">
        <div class="tooltip">
          <p class="status">背景音樂設定開啓</p>
          <p class="tip">點選圖示關閉</p>
        </div>
        <a href="#" class="bgm-on"><img src="…/img/ico_fp_musicon.png"></a>
      </div>
    </div>
    <div class="hd"><p>您還沒登入喔</p></div>
    <div class="bd">
      <ul class="my-promotion">
        <li><a class="skin-main-link-hover" href="…/turf/login/*http://www.wretch.cc/IDintegration/?ref=%2525252F">會員登入</a></li>
      </ul>
      <h3 class="block-title">個人服務</h3>
      <div class="my-messages">
        <p><a class="skin-main-link" target="_blank" href="…/turf/text/evt=47758/*"></a></p>
        <ul>
          <li class="join-vip"><a href="…/head/vip/evt=52576/*http://bill.wretch.cc/order.php">加入VIP</a></li>
          <li class="join-in"> <a href="…/turf/login/*http://www.wretch.cc/IDintegration/?ref=%2525252F">加入會員</a></li>
        </ul>
      </div>
      <h3 class="block-title">個人設定</h3>
    </div>
    <div class="ft">
      <h2>我的<i></i></h2>
      <ul class="my-services ft-service4">
        <li><a class="skin-main-link-hover" href="…refdest=/blog/">網誌</a></li>
        <li>…相簿</li><li>…影音</li><li>…揪團</li><li>…嘀咕</li>
        <li>…好友</li><li>…留言</li><li>…名片</li>
        <li><a class="skin-main-link-hover" href="…/turf/vip/*http://bill.wretch.cc/order.php">加入VIP</a></li>
      </ul>
      <ul class="my-services ft-service8"> …完全相同的 9 個 li… </ul>
      <span>my</span>
    </div>
  </div>
</div>
```
> `h3.block-title`（個人服務／個人設定）被 `display:none` 隱藏（W `#wfp-my .bd h3.block-title{display:none}`）——它們只在登入態的皮膚下才顯示。【驗】
> `.ft-service8` 預設 `display:none`；點 `span`（▼）後 `.ft` 加 `expan`，`.ft-service4` 變 `visibility:hidden`、`.ft-service8` 變 `display:block; position:absolute; top:0; left:55px`。【驗】
> `<span>my</span>` 的文字被 `text-indent:-9999px` 藏掉，實際顯示成 10×20 的 ▼／▲ sprite。
> **登入態的 HTML 我沒有樣本**（所有快照都是未登入）→ 【查無】。CSS 顯示登入態會有 `.my-coverPic`（70×70 傾斜 −3deg 的相片）、`.hd ul li`（含 `li.logout`）、`.my-messages p` 等。

### 6.8 公告 `#wfp-announcement`【驗】

```html
<div id="wfp-announcement">
  <div class="annoad3">
    <p class="firstad"><a href="…/ad201/*…"><img src="http://tw.yimg.com/i/tw/wretch/FPad/yahootalent85x60_120610.jpg" /></a></p>
    <p>            <a href="…/ad202/*…"><img src="http://tw.yimg.com/i/tw/wretch/FPad/onecase85x60_120213.jpg" /></a></p>
    <p>            <a href="…/ad203/*…"><img src="http://tw.yimg.com/i/tw/wretch/FPad/wretch_85x60_120610.jpg" /></a></p>
  </div>
  <ul>
    <li><a target="_blank" href="…/ann/2/1/*…">[公告]站長工具服務終止公告</a></li>
    <li><a target="_blank" href="…/ann/2/2/*…">[公告]無名推出新功能無名相片牆</a></li>
    <li><a target="_blank" href="…/ann/2/3/*…">[公告]無名小站行動版 行動相簿上線</a></li>
  </ul>
  <p><a target="_blank" href="…/ann/m/*http://www.wretch.cc/blog/WretchFAQ">更多站方公告</a></p>
</div>
```

### 6.9 最新熱門活動 `#wfp-today`【驗】

```html
<div id="wfp-today" class="mod">
  <div class="hd">
    <header class="header"><h2>最新熱門活動</h2></header>
    <div id="today-corner-ad"></div>
  </div>
  <div class="bd">
    <ol class="skin-order">
      <li class="clearfix activity">
        <article>
          <header><h3 data-order="1"><span class="skin-side-title"><a target="_blank" href="…">2012『Eelin...</a></span></h3></header>
          <a target="_blank" class="thumbnail" href="…"><img src="…banner481.gif"></a>
          <div class="content">
            <p class="description"><a target="_blank" href="…">希望藉此挑選出更多後起之秀，讓更多年輕朋友可以挑戰自我，站上夢想的舞台！</a></p>
            <p class="more"><a target="_blank" href="…Activity/">更多最新活動</a></p>
          </div>
        </article>
        <div class="wfp-sharing clearfix"> …right… </div>
      </li>
      <li class="clearfix talk">
        … h3 data-order="2" …「秘密武器是？！」…
        <p class="more"><a …>更多癮用王</a></p>
      </li>
      <li class="clearfix vote last">
        … h3 data-order="3" …「哪個星座的求職者最適...」…
        <p class="vote"><a target="_blank" href="…">我要投票</a></p>
        <p class="more"><a target="_blank" href="http://vote.wretch.cc/">更多調查局</a></p>
      </li>
    </ol>
  </div>
</div>
```
序號徽章由 `h3:before{content:attr(data-order)}` 產生，不是 HTML 文字。【驗】

### 6.10 熱門內容 `#wfp-hybrid`【驗】

```html
<div class="belt">
  <div id="wfp-hybrid" class="mod second">
    <div class="hd">
      <div class="tabs">
        <ul class="tabs-list clearfix">
          <li class="tabs-cell "   data-order="1" rd="…/hybrid/a/*">
            <div class="tabs-content"><img src="…hybrid_…3071.jpg" alt="潮聖趣"><h4>潮聖趣</h4><span class="desc break">必學！巧用穿搭瞬間有型</span></div>
          </li>
          <li class="tabs-cell on " data-order="2" rd="…/hybrid/b/*">
            <div class="tabs-content"><img src="…3072.jpg" alt="大變身"><h4>大變身</h4><span class="desc break">甩開舊形象～煥然一新超改造</span></div>
          </li>
          <li class="tabs-cell "   data-order="3" rd="…/hybrid/c/*">
            <div class="tabs-content"><img src="…3073.jpg" alt="玩透透"><h4>玩透透</h4><span class="desc break">旅遊…發現體驗生活新鮮事</span></div>
          </li>
          <li class="tabs-cell "   data-order="4" rd="…/hybrid/d/*">
            <div class="tabs-content"><img src="…3074.jpg" alt="嗑美食"><h4>嗑美食</h4><span class="desc break">帶路吃美食！尋覓真正好味道</span></div>
          </li>
        </ul>
      </div>
    </div>
    <div class="belt-line"></div>
    <div class="bd clearfix">
      <div class="main-content clearfix">
        <div class="image-wrapper ugc-block">
          <a target="_blank" href="…" title="渡假放醬開～粉嫩變身登場" class="no-line"><img alt="…" src="…217x217.jpg"></a>
        </div>
        <div class="article-wrapper ugc-block">
          <span>每日一推</span>
          <div class="mix-article">
            <h5><a target="_blank" href="…" title="…">渡假放醬開～粉嫩變身登場</a></h5>
            <p>以為渡假就該放肆不上妝就太傻啦～…</p>
          </div>
          <div class="recommended-links">
            <span>變身日記</span>
            <ul>
              <li><a target="_blank" href="…" title="…">感謝笑過我～好身材美麗史曝光</a></li>
              <li><a target="_blank" href="…" title="…">三週小3吋！20小習慣自動瘦</a></li>
              <li><a target="_blank" href="…" title="…">妒嫉死惹…產後超正S曲線辣媽</a></li>
            </ul>
          </div>
        </div>
      </div>
      <a class="more-recommended main-more" title="更多" target="_blank" href="…">更多</a>
      <div class="sub-content clearfix">
        <div class="mix-wrapper ugc-block pic-text-2 clearfix">
          <span>達人變身教學</span>
          <div class="mix-item ugc-block clearfix">
            <a target="_blank" href="…" class="ugc-block image" title="…"><img src="…207x155.jpg" class="mix-img" alt="…"></a>
            <div class="mix-article"><h6><a …>變身假歐美人？眼睛被放得好亮</a></h6><p>…</p></div>
          </div>
        </div>
        <div class="mix-wrapper ugc-block pic-text-2 clearfix last normal">
          <span>變美麗分享</span>
          <div class="mix-item ugc-block clearfix">
            <a target="_blank" href="…" class="ugc-block" title="…"><img src="…" class="mix-img image" alt="…"></a>
            <div class="mix-article"><h5><a …>十分鐘變妝：驚人改造公開</a></h5><p>…</p></div>
            <div class="recommended-links">
              <div class="mix-article"><h6><a …>同鞋是你嗎？放學趕趴快速變身</a></h6><p>…</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="hybrid-decoration-line"></div>
  </div>
</div>
```
> `.mod second` 的 `second` 就是「目前選第 2 個分頁」→ 決定整條腰帶的主題色（見 §4.9）。JS 會把它換成 `first`…`fifth`。
> `a.more-recommended.main-more` 在 DOM 上介於 `.main-content` 與 `.sub-content` 之間，靠 `position:absolute; right:505px; bottom:24px` 定位。

### 6.11 名家專欄 `#wfp-celebrity`【驗】

```html
<div id="wfp-celebrity">
  <div class="hd">
    <header><h2>名家專欄</h2></header>
    <div class="nav">
      <ul class="skin-tab">
        <li id="celebrity_artist"     class="first on" rd="…/cele/a/*"><a href="#celebrity_artist">藝人</a></li>
        <li id="celebrity_model"      class=""         rd="…/cele/b/*"><a href="#celebrity_model">模特兒</a></li>
        <li id="celebrity_athletes"   class=""         rd="…/cele/c/*"><a href="#celebrity_athletes">運動明星</a></li>
        <li id="celebrity_writer"     class=""         rd="…/cele/d/*"><a href="#celebrity_writer">作家</a></li>
        <li id="celebrity_politician" class=""         rd="…/cele/e/*"><a href="#celebrity_politician">政治名人</a></li>
      </ul>
    </div>
  </div>
  <div class="bd">
    <ul>
      <li class="first">
        <a target="_blank" href="…" class="thumbnail"><img src="…217x148.jpg"></a>
        <header><hgroup>
          <h4><a target="_blank" href="…">呂如中</a></h4>
          <h3><a class="skin-main-link" target="_blank" href="…">校園環保的傳承...</a></h3>
        </hgroup></header>
        <p>想當年垃圾分類做得很辛苦，現在變得習慣，想偷偷不做也變得有罪惡感，只要習慣成自然不辛苦也不困難…</p>
      </li>
      <li>       …90×90 縮圖（顯示 70×70）+ h4 名字 + h3 文章標題，無 p… </li>
      <li class="last"> …同上… </li>
    </ul>
  </div>
  <div class="ft"><p class="more"><a target="_blank" href="…">更多藝人</a></p></div>
  <div id="celebrity-corner-ad"></div>
  <input type="hidden" id="wfp-celebrity-token" value="">
</div>
```

### 6.12 無名官方部落格 `#wfp-blog-entry`【驗】

```html
<div id="wfp-blog-entry" class="clearfix mod">
  <h2>無名官方部落格</h2>
  <nav class="blog-navigation">
    <div class="emphatic">
      <ul class="first">
        <li><a class="skin-main-link" target="_blank" href="…/wretchoffice/">辦公室</a></li>
        <li><a … href="…/wretchbeauty/">愛正妹</a></li>
        <li><a … href="…/wretchfood/">美食王</a></li>
        <li><a … href="…/wretchphoto/">愛攝影</a></li>
        <li><a … href="…/wretchcomic/">圖文</a></li>
      </ul>
      <ul>
        <li><a … href="…/wretchmovie/">瘋電影</a></li>
        <li><a … href="…/wretchmstyle/">型男誌</a></li>
        <li><a … href="…/wretchsalon/">愛漂亮</a></li>
        <li><a … href="…/wretchlocal/">好地方</a></li>
        <li><a … href="…/supergoods/">好物誌</a></li>
      </ul>
    </div>
    <div class="normal">
      <ul class="first">
        <li><a target="_blank" href="…facebook.com/wretchoffice">無名粉絲團</a></li>
        <li><a target="_blank" href="…/wretchdesign/">無名ㄇㄞˋ點子</a></li>
      </ul>
      <ul>
        <li><a target="_blank" href="…/wretchreader/">愛讀書</a></li>
        <li><a target="_blank" href="…/wretch3c/">無名愛3C</a></li>
        <li><a target="_blank" href="…/wretchsound/">原創音樂</a></li>
      </ul>
    </div>
  </nav>
  <div id="blog-entry-corner-ad"></div>
</div>
```

### 6.13 投稿精選 `#wfp_top_daily_blogs`【驗】

```html
<div id="wfp_top_daily_blogs" class="mod">
  <div class="hd">
    <header class="header"><h2>投稿精選</h2></header>
    <ul class="nav skin-tab">
      <li class="top_daily_blogs-recommend on"><a href="#top_daily_blogs-recommend">推薦</a></li>
      <li class="top_daily_blogs-random">      <a href="#top_daily_blogs-random">隨機</a></li>
    </ul>
  </div>
  <div class="bd top_daily_blogs-recommend">
    <ol id="top_daily_blogs-recommend" class="top_daily_blogs-recommend skin-order">
      <li>            <article class="article">
          <header class="header"><h3 data-order="1"><a class="skin-side-title" target="_blank" href="…">超值划算戰利品</a></h3></header>
          <a class="thumbnail" target="_blank" href="…"><img src="…80x80.jpg"></a>
          <div class="content"><a target="_blank" href="…"><p class="description">…</p></a></div>
      </article></li>
      <li class="last"> …data-order="2"… </li>
    </ol>
    <ol id="top_daily_blogs-random" class="top_daily_blogs-random skin-order"> …兩則… </ol>
  </div>
  <div class="ft top_daily_blogs-recommend">
    <p class="more top_daily_blogs-recommend"><a target="_blank" href="…">更多推薦</a></p>
    <p class="more top_daily_blogs-random">   <a target="_blank" href="…">更多推薦</a></p>
  </div>
</div>
```
※ 2012-02 快照這個位置是 `#wfp-join`（揪團，標題「揪團」，分頁「推薦／隨機」，縮圖 `join_item_*.jpg`）。到 2012-06 已換成投稿精選，並維持到關站。【驗】

### 6.14 頁尾 `#wfp-footer`【驗】

```html
<div class="ft">
  <div id="wfp-footer">
    <div id="wfp-lang">
      <ul>
        <li class="on"><a class="zh-tw" href="./?date=2012-06-15">中文</a></li>
        <li>          <a class="en"    href="./?date=2012-06-15">English</a></li>
      </ul>
    </div>
    <footer>
      <nav>
        <ul class="nav">
          <li class="first"><a href="…/f/intro/*http://promo.wretch.cc/wretch_2010_tutorial/">新首頁介紹</a></li>
          <li><a href="…/f/tos/*http://tw.info.yahoo.com/legal/utos.html">服務條款</a></li>
          <li><a href="…/f/pri/*http://info.yahoo.com/privacy/tw/yahoo/">隱私權政策</a></li>
          <li><a href="…/f/press/*http://www.wretch.cc/blog/press&amp;list=1">新聞中心</a></li>
          <li><a href="…/f/contact/*http://tw.help.cc.yahoo.com/?product=wretch">聯絡我們</a></li>
          <li><a href="…/f/mkt/*http://tw.emarketing.yahoo.com/wretch/">網路行銷</a></li>
          <li><a href="…/f/hire/*http://tw.info.yahoo.com/careers">招賢納士</a></li>
        </ul>
      </nav>
      <div id="rss-bar">
        <div class="inner">
          <h5>RSS:</h5>
          <ul>
            <li><a href="http://www.wretch.cc/index/rss_cover_story.php">今日主題</a></li>
            <li><a href="http://www.wretch.cc/index/rss_featured_photo.php">熱門相簿</a></li>
            <li><a href="http://www.wretch.cc/index/rss_hybrid_ugc.php">熱門內容</a></li>
            <li><a href="http://www.wretch.cc/index/rss_celebrity.php">名家專欄</a></li>
            <li class="last"><a href="http://www.wretch.cc/index/rss_top1000article.php">熱門文章</a></li>
          </ul>
        </div>
      </div>
      <p><span><a href="…/f/cy/*http://tw.info.yahoo.com/copyright/">著作權侵權</a></span>本站設有管理員並依台灣網站內容分級規定處理</p>
      <p>雅虎資訊 版權所有 © 2011 Yahoo! Taiwan All Rights Reserved.</p>
    </footer>
    <input type="hidden" id="global-crumb" name="global-crumb" value="&.c=…&.t=…">
    <input type="hidden" id="today-date"   name="today-date"   value="2012-06-15">
    <input type="hidden" id="anchor"       name="anchor"       value="">
  </div>
</div>
```
> 版權年份：2012-06 快照寫 **© 2011**；2012-12 與 2013-12 快照都寫 **© 2012**。要做「最後版」請用 **© 2012**。【驗】
> head 裡另有 4 條 RSS `<link rel="alternate">`：今日主題RSS / 型男正妹RSS / 熱門文章RSS / 名家專欄RSS。【驗】

---

## 7. 逐字中文文案（一字不差）

### 7.1 頂部與導覽
- `Yahoo!奇摩`
- `服務說明`
- logo `alt`/`title`：`無名小站`
- 搜尋 label：`搜尋：`　placeholder：`搜尋`　按鈕文字/value：`搜尋網頁`　legend：`Yahoo! Search`
- 導覽：`網誌` `相簿` `影音` `揪團` `嘀咕` `手機` `(NEW)`
- 活動小字（每期不同）：2012-06『`足球雜誌募集足球美少女！`』；2013-12『`徵求各式職場美人！`』

### 7.2 日曆
- `今天`　`未來`　`過去`　`展開/收合`
- 月份 hidden 值：`一月` `二月` `三月` `四月` `五月` `六月` `七月` `八月` `九月` `十月` `十一月` `十二月`
- `todayTopic` hidden 值：`今日主題`
- 當日顯示：`<span class="month">六月</span><span class="day">15</span>`

### 7.3 今日主題
- 小標：`今日主題`

### 7.4 站內搜尋
- 隱藏輔助文字：`目前搜尋類別：`　`變更搜尋類別：`　`輸入搜尋字串：`　legend `Wretch Search`
- 類別：`文章搜尋`　`相簿搜尋`　`影音搜尋`
- 按鈕：`搜尋`
- placeholder 三態：`搜尋無名小站文章`／`搜尋無名小站相簿`／`搜尋無名小站影音`

### 7.5 熱門相簿
- 標題：`熱門相簿`
- 分頁（編輯每期換名）：2012-06『`無名優質正妹`』『`無名萌系女孩`』；2012-12『`無名小臉正妹`』『`無名學生情人`』
- 冠軍徽章（label，隨期換）：`本日最鄰家`（beauty）／`本日最清純`（selected）
- 加好友按鈕 title/文字：`加為朋友`
- 底部更多（隨分頁換）：`不夠！給你更多無名萌妹`／`更多無名完美女孩在這！`

### 7.6 我的
- `您還沒登入喔`
- `會員登入`
- `個人服務`（隱藏）　`個人設定`（隱藏）
- `加入VIP`　`加入會員`
- `我的`
- 服務清單：`網誌` `相簿` `影音` `揪團` `嘀咕` `好友` `留言` `名片` `加入VIP`
- BGM 提示（注意兩個「開」字用字不同）：
  - `背景音樂設定開啓`（status_on，用「啓」）
  - `背景音樂設定關閉`（status_off）
  - `點選圖示開啟`（tip_on，用「啟」）
  - `點選圖示關閉`（tip_off）
  - 初始 DOM：status = `背景音樂設定開啓`，tip = `點選圖示關閉`

### 7.7 公告
- `[公告]站長工具服務終止公告`
- `[公告]無名推出新功能無名相片牆`
- `[公告]無名小站行動版 行動相簿上線`
- `更多站方公告`

### 7.8 最新熱門活動
- 標題：`最新熱門活動`
- `更多最新活動`　`更多癮用王`　`我要投票`　`更多調查局`

### 7.9 熱門內容分頁（2012-06）
- `潮聖趣` / `必學！巧用穿搭瞬間有型`
- `大變身` / `甩開舊形象～煥然一新超改造`
- `玩透透` / `旅遊…發現體驗生活新鮮事`
- `嗑美食` / `帶路吃美食！尋覓真正好味道`
- 區塊標籤：`每日一推`　`變身日記`　`達人變身教學`　`變美麗分享`
- 更多連結：`更多`

### 7.10 名家專欄
- 標題：`名家專欄`
- 分頁：`藝人` `模特兒` `運動明星` `作家` `政治名人`
- 更多：`更多藝人`（隨分頁換）

### 7.11 無名官方部落格
- 標題：`無名官方部落格`
- 強調欄：`辦公室` `愛正妹` `美食王` `愛攝影` `圖文` `瘋電影` `型男誌` `愛漂亮` `好地方` `好物誌`
- 一般欄：`無名粉絲團` `無名ㄇㄞˋ點子` `愛讀書` `無名愛3C` `原創音樂`

### 7.12 投稿精選
- 標題：`投稿精選`　分頁：`推薦` `隨機`　更多：`更多推薦`
- （2012-02 版：標題 `揪團`，分頁 `推薦` `隨機`）

### 7.13 分享
- 泡泡：`分享至`
- FB 連結 title / data-title：`分享至臉書`
- 噗浪連結 title / data-title：`分享至噗浪`

### 7.14 頁尾（逐字）
- 語言：`中文`　`English`
- 連結列（依序）：`新首頁介紹`　`服務條款`　`隱私權政策`　`新聞中心`　`聯絡我們`　`網路行銷`　`招賢納士`
- RSS 標籤：`RSS:`
- RSS 項目（依序）：`今日主題`　`熱門相簿`　`熱門內容`　`名家專欄`　`熱門文章`
- `著作權侵權`
- `本站設有管理員並依台灣網站內容分級規定處理`
- `雅虎資訊 版權所有 © 2012 Yahoo! Taiwan All Rights Reserved.`

### 7.15 2013 關站公告（`div.mod.notification`，取代 `#wfp-cover`）【驗】
```
重要公告
Yahoo奇摩無名小站自即日起進入全站唯讀模式
全站進入唯讀模式後您將無法再新增、修改、刪除原本帳戶中的資料，訪客將無法留言。資料備份、資料下載、輕鬆搬家與回報新網址服務將持續提供至2013年12月26日止，之後不再提供相關服務。我們預期近來備份與搬家的需求數量將會大幅增加，我們建議您立即行動，以免耽誤您的時間來不及完成資料備份、下載與輕鬆搬家。
詳細公告內容        → http://www.wretch.cc/blog/WretchFAQ/13637135
開始備份/下載/搬家  → http://download.wretch.cc/eol/
```
樣式（2013 CSS 才有）：`.notification{width:630px;height:365px;background:#f8f8f8;border:5px solid #333}`、`h3{font-size:25px;font-weight:bold;margin:15px 0}`、`h3 .red{color:#f00}`、`legend{height:50px;line-height:50px;font-size:22px;color:#e00}`、`p{font-size:18px;text-indent:2em;line-height:1.5em}`、`.links li{display:inline-block;margin:0 60px;width:165px}`、`.links li a{border:1px solid #ccc;border-radius:3px;color:#333;gradient #E7E7E7→#FFF}`、hover `{color:#42873e;background:#f0f0f0}`。
（原始 HTML 是 `<em class="red">重要公告</em>`，CSS 選擇器寫的是 `h3 .red`。）

---

## 8. 素材清單

全部存放於 `assets_src2/img/index/`。尺寸皆用 **sharp** 實測（非推測）。

| 檔名 | 尺寸 | 有無透明 | 用途 | 取得時間戳 | 狀態 |
|---|---|---|---|---|---|
| `ico_sprite.png` | **900×700** | 有 | **主 sprite**，見 §9 | `20110919125212` | ✅ |
| `logo_wretch.png` | **130×36** | 有 | 無名小站綠色 logo | `20110112211809` | ✅ |
| `bg_nav_default.png` | **970×40** | 無 | 導覽列綠色漸層 fallback | `20111107172714` | ✅ |
| `bg_hd_trans.png` | **968×121** | 有 | header 半透明藍天／雲／兩隻小鳥；`y=84` 之後那段（37px 高的白→透明）給導覽列當高光 | `20110919125212` | ✅ |
| `img_fp_outline.png` | **970×280** | 有 | `#wrapper` 左右兩條 1px 外框線（`#cee2db` 起，280px 內淡出） | `20111002045629` | ✅ |
| `bg_wrapper.png` | **976×3** | 有 | IE 用的容器左右投影（`#000` a9/a18/a30） | `20111214215905` | ✅ |
| `bg_cs_stack.png` | **267×40** | 無 | 今日主題 `.title` 與 `h2` 的底紋 | `20110919125330` | ✅ |
| `bg_cs_stack_dark.png` | **67×67** | 無 | 今日主題暗版底紋 | `20110919125212` | ✅ |
| `bg_cs3_border.png` | **4×4** | 有 | `#919191` a90 小方塊（本版 CSS 未使用） | `20111214215821` | ✅ |
| `bg_hugc_gray.png` | **1×35** | 無 | hybrid 預設腰帶漸層（`#333→#3f3f3f→#333`） | `20110919125213` | ✅ |
| `bg_hugc_orange.png` | **1×35** | 無 | hybrid `.first`（`#333→#52452b→#333`） | `20111214215839` | ✅ |
| `bg_hugc_lime.png` | **1×35** | 無 | hybrid `.second`（`#333→#444b39→#333`） | `20111214215842` | ✅ |
| `bg_hugc_mint.png` | **1×35** | 無 | hybrid `.third`（`#333→#3a4a4a→#333`） | `20111214215844` | ✅ |
| `bg_hugc_violet.png` | **1×35** | 無 | hybrid `.fourth`（`#333→#3e454d→#333`） | `20111214215847` | ✅ |
| `bg_hugc_pink.png` | **1×35** | 無 | hybrid `.fifth`（`#333→#523c44→#333`） | `20111214215849` | ✅ |
| `img_fp_button_s.png` | **1×17** | 無 | 語言鈕 fallback（上 8px `#ffffff`，下 9px `#eaeaea`） | `20111120065409` | ✅ |
| `line_nav_border.png` | **2×36** | 有 | 導覽列各項之間的直線 | `20110919125212` | ✅ |
| `line_dot_vertical.png` | **2×2** | 無 | 直虛線（`#cac9c9` / `#f7f7f7`） | `20110919125212` | ✅ |
| `line_dot_horizontal.png` | **2×2** | 無 | 橫虛線（`#f2f2f2` / `#c9c8c8`） | `20111214215828` | ✅ |
| `ico_fp_dot.png` | **2×2** | 無 | `#b3b3b3` 小圓點（分頁籤分隔、我的服務清單） | `20110919125212` | ✅ |
| `ico_fp_addfriend.png` | **12×12** | 有 | 「加為朋友」小圖示 | `20110919125212` | ✅ |
| `ico_fp_musicon.png` | **12×12** | 有 | 背景音樂 **開** | `20110112211856` | ✅ |
| `ico_fp_musicoff.png` | **12×12** | 有 | 背景音樂 **關**（JS 切換時換 src） | `20120805104021` | ✅ ⚠️見下 |
| `ico_fp_playvideo.png` | **64×64** | 有 | hybrid 大播放鍵 | `20111214215837` | ✅ |
| `ico_fp_playvideo_s.png` | **23×23** | 有 | hybrid 小播放鍵 `span.play-icon` | `20111214215834` | ✅ |
| `ico_medal.png` | **125×48** | 有 | 熱門相簿冠軍緞帶徽章（金色皇冠＋緞帶） | `20110919125212` | ✅ |
| `ico_myservices.png` | **5×12** | 有 | `#wfp-my .ft h2 i`（「我的」標籤右側的小尖角） | `20120614173730` | ✅ |
| `ico_rss.png` | **12×12** | 有 | 頁尾 `RSS:` 前的橘色圖示 | `20110919125213` | ✅ |
| `ico_uh_search.png` | **12×12** | 有 | 頂部搜尋框放大鏡（實際被同一條規則後面的 sprite 覆蓋） | `20111212034936` | ✅ |

⚠️ **抓取陷阱記錄**：`ico_fp_musicoff.png` 用 `20111214215915id_` 抓到的是 **150,554 bytes 的 HTML**（Wayback 的錯誤頁），不是 PNG。改用 `20120805104021id_` 才拿到正確的 185 bytes PNG。復刻時請用 repo 裡這一份。

**內容區照片的實際尺寸**（我下載了樣本用 sharp 量測，用來確定卡片圖片該切多大）【驗】：

| 位置 | 實際圖尺寸 | CSS 顯示尺寸 |
|---|---|---|
| 今日主題堆疊照片 `cover_photo_*.jpg` | **418×274** | `.block` 420×275（含 6px 白邊） |
| 熱門相簿冠軍 `featured_*.jpg` | **298×298** | 298×298 |
| 熱門相簿一般 `featured_*.jpg` | **156×96** | 156×96 |
| hybrid 分頁縮圖 `hybrid_*_30xx.jpg` | **55×55** | 55×55 |
| hybrid 主圖 `hybrid_*_6083.jpg` | **217×217** | 原尺寸 |
| hybrid 副欄圖 `hybrid_*_6083.jpg` | **207×155** | 原尺寸（`.pic-text-2` 寬 208） |
| 名家專欄首則 `celebrity_*.jpg` | 未取得（連線失敗） | CSS 217×148 |
| 名家專欄小圖 `l.yimg.com/e/cover/<id>_90.jpg` | **90×90** | 顯示 70×70 |
| 最新熱門活動縮圖 `wretchtalk_new_1.jpg` / `vote_new_1.jpg` | **100×75** | 100×75 |
| 投稿精選縮圖 `blog_item_*.jpg` | **80×80** | 80×80 |
| 公告小廣告 `FPad/*85x60*.jpg` | 未量測 | CSS 85×60 |

**查無 / 沒抓到**：
- `celebrity_76b7wfs3p2g488wskckwggk04_3067.jpg`（名家專欄首則縮圖）連續 5 次連線失敗 → 尺寸只能引用 CSS 的 217×148。
- 換膚（chameleon）用的大背景圖：**這 5 份快照都沒有掛任何背景圖**（`#bg-wrapper` 沒有 inline style，chameleon.css 也只設 `background-repeat/position` 不設 `background-image`）→ 【查無】。
- 登入態 `#wfp-my` 的 HTML → 【查無】。
- `#push-down-ad`、`#nav-corner-ad`、`#featured-corner-ad`、`#today-corner-ad`、`#celebrity-corner-ad`、`#blog-entry-corner-ad` 這 6 個廣告位在存檔裡都是空的（只留 `<!-- SpaceID=0 robot -->`）→ 廣告素材【查無】。

---

## 9. `ico_sprite.png` 完整圖示地圖

**檔案：900×700，PNG-8 colormap + alpha。** 以下每一格都是我用程式掃描 alpha 通道求出的實際內容外框（非推測），並對上 CSS 使用者。

| # | 內容 | sprite 座標 (x,y) | 實際尺寸 | 使用它的 CSS |
|---|---|---|---|---|
| 1 | 導覽「網誌」文件圖示 | **0, 0** | 18×20 | `#wfp-navigation ul li.blog a{background-position:21px 9px}` |
| 2 | 導覽「相簿」相機 | **160, 0** | 22×15 | `li.album a{-141px 11px}` |
| 3 | 導覽「影音」播放鍵 | **319, 0** | 18×18 | `li.video a{-296px 9px}` |
| 4 | 導覽「揪團」大聲公 | **480, 0** | 22×16 | `li.join a{-462px 10px}` |
| 5 | 導覽「嘀咕」對話框 | **640, 0** | 18×15 | `li.digu a{-618px 11px}` |
| 6 | 導覽「手機」手機 | **798, 0** | 14×20 | `li.mobile a{-781px 9px}` |
| 7 | 小折線圖（帶斜線） | **1, 30** | 12×12 | 本版 CSS **查無**使用 |
| 8 | 小長條圖 | **40, 30** | 11×10 | 本版 CSS **查無**使用 |
| 9 | 「TODAY'S TOPIC」深字 | **0, 50** | **89×9** | `#wfp-cover .mess .title span{0 -50px; width:89px; height:9px}` |
| 10 | 「TODAY'S TOPIC」反白（深底） | **120, 50** | 89×9 | `#wfp-cover.dark .mess .title span{-120px -50px}` |
| 11 | 放大鏡 | **240, 50** | 12×12 | `#wfp-universal-header .bd div.search input{-235px -43px}` |
| 12 | Facebook 藍方塊 | **0, 70** | 16×16 | `.wfp-sharing .bd a.fb-sharing{left -70px}` |
| 13 | Plurk 橘方塊 | **40, 70** | 16×16 | `.wfp-sharing .bd a.plurk-sharing{-40px -70px}` |
| 14 | 上下箭頭圓角方鈕 | **80, 70** | 18×17 | `#wfp-inner-search dl dt{-80px -70px; 19×19px}` |
| 15 | 「+)」加好友 | **120, 70** | 12×12 | 本版 CSS **查無**（改用獨立檔 `ico_fp_addfriend.png`） |
| 16 | 彩色「NEW」徽章 | **160, 72** | **23×11** | `#wfp-navigation ul li.new span{-160px -60px; width:23px}` |
| 17 | 公告告示牌 | **280, 71** | 12×12 | `#wfp-announcement ul li{-278px -67px}` |
| 18 | 2×2 灰點（IE 項目符號） | **381, 71** | 2×2 | `-381px -67px`（footer/celebrity）、`-380px -64px`（hybrid） |
| 19 | 斜線紋長條（左深右淺） | **0, 110** | 267×40 | 本版 CSS **查無**使用（疑為舊版遺留） |
| 20 | 日曆便條紙（含兩個夾子） | **300, 110** | **56×73** | `#wfp-archive .hd div{-300px -110px; 56×73px}` |
| 21 | 灰白圓角小按鈕 | **381, 110** | 48×14 | `#wfp-archive #wfp-archive-switcher{-378px -110px; width:56px}` |
| 22 | Yahoo! 藍色小房子 | **0, 161** | 14×13 | `#wfp-universal-header .hd ul li.yahoo-home a{0 -160px}` |
| 23 | ▼ 實心小三角 | **0, 200** | 10×6 | `#wfp-my .ft span{0 -186px; 10×20px}`；`#wfp-archive-switcher span{24px -195px}` |
| 24 | ▲ 實心小三角 | **0, 220** | 10×6 | `#wfp-my .ft.expan span{0 -208px}`；`#wfp-archive.expand …span{24px -215px}` |
| 25 | ∨ 中灰雙線箭頭 | **0, 240** | 13×8 | `#wfp-archive-backward{12px -236px}`；`#wfp-cover .carousel span.down{17px -235px}` |
| 26 | ∨ 黑（hover） | **0, 260** | 13×8 | `#wfp-archive-backward:hover{12px -256px}` |
| 27 | ∨ 淺灰（disabled） | **0, 280** | 13×8 | `#wfp-archive-backward.unactived{12px -276px}` |
| 28 | ∧ 中灰 | **0, 300** | 13×8 | `#wfp-archive-forward{12px -296px}`；`#wfp-cover .carousel span.up{17px -295px}` |
| 29 | ∧ 黑（hover） | **0, 320** | 13×8 | `#wfp-archive-forward:hover{12px -316px}` |
| 30 | ∧ 淺灰（disabled） | **0, 340** | 13×8 | `#wfp-archive-forward.unactived{12px -336px}` |
| 31 | 灰色「›」 | **0, 360** | 6×9 | `#wfp-blog-entry ul{*background:0 -358px}` |
| 32 | 極小「›」（在最右上角） | **897, 380** | **3×5** | 所有「更多」連結：`no-repeat right -375px` / `right -377px`（featured / celebrity / today / announcement / hybrid / top_daily_blogs） |
| 33 | 拍立得相框（米白紙 + 白窗） | **0, 400** | **236×287** | `#wfp-cover .mess .block{0 -400px; background-size:174px 213px; 174×213px}` |
| 34 | 灰色圓角按鈕（搜尋鈕 fallback） | **280, 400** | 68×24 | `#wfp-inner-search .search-input button{-280px -400px}` |
| 35 | 白色圓角按鈕（登入鈕 normal） | **280, 440** | 83×38 | `.no-cssgradients #wfp-my .my-promotion li a{-280px -440px}` |
| 36 | 白色圓角按鈕（登入鈕 hover） | **280, 521** | 83×38 | `.no-cssgradients #wfp-my .my-promotion li a:hover{-280px -521px}` |

**空白但被引用的位置**：`-333px -63px`（`#wfp-join .hd li.join-recommend`、`#wfp_top_daily_blogs .hd li.top_daily_blogs-recommend`）——我掃描過 (330~345, 60~90) 全透明，**那裡沒有圖**。這兩條是 IE 專用 hack（`*background`），現代瀏覽器改用 `li:after{border:1px solid #B5B2B5; border-radius:1px}` 畫一個 1px 小方點當分隔。【驗】

---

## 10. 互動行為

以下全部【驗】自 `index_wfp-js_201205171100.js` 與 CSS。

### 10.1 今日主題（#wfp-cover，stack 版）
- **自動輪播**：`setInterval(…, 5000)`，每 **5 秒**把下一張 `.block` 換成 `first-block` 帶到最前。
- **換張過場**：先把目標塊改成 `stop-block block`，`setTimeout 200ms` 後再改成 `first-block`，同時把原本的 `first-block` 換成目標塊原本的 class。CSS transition 為 `left/top/transform/opacity`，時長 `.5s,.5s,1s,.25s`。
- **點擊非最前那張** → 把它帶到最前（不開連結）。**點擊最前那張** → `window.open()` 開該篇文章。
- **點分頁圓點** → 直接切到該張，圓點加 `on`。
- **hover 最前那張**：`.first-block:after` 顯示 `data-title` 半透明黑底說明條（`display:block`）。
- 暗版（`#wfp-cover.dark`）：JS 會 append 一個 `<div class="fakebg">`（100% × 116px）。

### 10.2 熱門相簿（#wfp-featured）
- **分頁切換**：`mouseenter` 延遲 **300ms** 觸發，或直接 `click`。
- 資料**預先內嵌**在 `featuredJSON`（不打 AJAX）；切換時把舊的 `.featured-photos` 加 `off`（`display:none`），第一次進入某分頁才用 JS 拼 HTML 插進 `.bd`。
- 同時切換 `#wfp-featured-sharing-<category>` 的 `tab-on`，並改寫 `a#featured-more` 的文字（`more_title`）與 `href`（`more_url`）。
- `five_photos:true` → 產出 `normal-four`（1 大 + 4 張 156×146）；`false` → `normal-six`（1 大 + 6 張 156×96）。
- **照片 hover**：`li:hover .panel{opacity:1}`（0.2s ease）浮出黑底 70% 的暱稱＋標題面板。IE 走 JS 加 `panel-on` class。
- **點一般照片**（點在非 `<a>` 的區域）→ `window.open()` 開 `p a` 的 href。

### 10.3 熱門內容（#wfp-hybrid）
- **分頁 click** 切換；`mouseover` 加 `tab-mouseon`（標題轉白），`mouseout` 移除。
- 切換時對 `.bd` 加 `anim`（`opacity:0`），`setTimeout 250ms` 後換內容並移除 `anim` → 0.25s 淡入。
- 內容用 **AJAX**：`POST http://www.wretch.cc/ajax/index/ajax_get_hybrids.php?t=<order>&crumb=<crumb>&d=<date>`，回傳 JSON，前端拼 HTML。抓過一次會存在 `f.hybrid.content[]` 快取，第二次直接用。
- 切換同時把 `#wfp-hybrid` 的 class 換成 `first`/`second`/`third`/`fourth`/`fifth` → 整條腰帶換主題色。
- 選中的分頁格：`li.tabs-cell.on:before` 出現主題色底塊（`box-shadow:2px 1px 1px #000`），`:after` 一個 4px 黑色折角（`top:-7px; right:-8px`），`div.tabs-content:after` 一個 8px 的主題色上箭頭指向內容區（`bottom:-33px; left:50%`）。
- 影片項目：`a.video:before` 一個 64×64 的圓形播放鍵；`a.video-mask:after` 全黑 `opacity:.3` 遮罩，hover 時消失。

### 10.4 名家專欄（#wfp-celebrity）
- 分頁 `mouseover`（有延遲）或 `click` 觸發。
- **AJAX**：`http://www.wretch.cc/ajax/index/ajax_get_celebrities.php?t=<celebrity_xxx>&crumb=…&d=<date>`；抓過的存進 `aRecordset` 快取。
- 前端用 JS 重建 `<ul><li class="first">…` 整段。

### 10.5 投稿精選（#wfp_top_daily_blogs）
- `推薦`／`隨機` 兩個分頁，純 CSS 切換：`.bd` 的 class 換成 `top_daily_blogs-recommend` 或 `-random`，靠
  `.top_daily_blogs-recommend .top_daily_blogs-recommend{display:block}` /
  `.top_daily_blogs-recommend .top_daily_blogs-random{display:none}` 這組規則決定顯示哪個 `<ol>`；`.ft` 也一起換。
- JS 綁 `click`（`Trigger` 內判斷 `c.type==="click"` 時 `halt()`），另有 hover 延遲觸發。

### 10.6 日曆（#wfp-archive）
- 載入時：`#wrapper > div.bd` 加 `archive-relative`；若頁上有 `#tool-wrapper` 則 `#wfp-archive` 加 `expand`，否則加 `collapse`。
- **展開／收合**：點 `#wfp-archive-switcher` 切換 `expand`；`.bd` 由 `height:0; opacity:0` 變成 `height:267px; opacity:1`，`transition:all .5s ease`。switcher 內的三角同步由 ▼ 換 ▲。
- **未來／過去**：`#wfp-archive-forward` / `-backward` 換一批日期（每次 `ITEM_NUMBER` 筆），到頭時加 `unactived`（箭頭轉淺灰、`cursor:default`）。跨月時清單中插入 `li.month`（灰底白字的月份標籤）。
- **日期 hover**：`li.date div.tip` 顯示白底浮層（`left:55px`，左側 8px 三角箭頭），含 `h5` 日期與 `p` 標題；由 `li.show` 控制。
- 選中日：`li.selected a{background:#91B93F; color:#FFF; border-radius:3px}`。
- 整個 `#wfp-archive` 初始 `opacity:0`，`transition:all 2s ease`，掛上 `archive-relative` 後才淡入。

### 10.7 背景音樂開關（#wfp-bgm）
- `mouseenter` → `.tooltip` 加 `on` 顯示；`mouseleave` 移除。
- 點擊 `<a>` → 在 `bgm-on` / `bgm-off` 之間切換 class，並把 `<img>` 的 `src` 換成 `ico_fp_musicon.png` / `ico_fp_musicoff.png`，同步改寫 `.status` 與 `.tip` 文字（見 §7.6）。
- 寫 cookie：`Y.Cookie.set("mf", autoPlay?"0":"1", {path:"/", domain:"wretch.cc", expires:+1 個月})`。

### 10.8 分享泡泡（.wfp-sharing，全站共用）
- 預設 `.wfp-sharing{visibility:hidden}`；`#wfp-cover` 與 `#wfp-featured` 內的永遠 `visible`。
- 滑到 `.mod` 上 → 該 `.mod` 加 `sharing-on`（`#wfp-today` 例外，改成滑到 `li` 上時該 `li` 加 `sharing-on`）→ 分享列現身。
- 滑到 FB／噗浪圖示上 → JS 計算 X 座標，把 `.bubble` 移到圖示正上方，移除 `off`，並把 `data-title`（`分享至臉書`／`分享至噗浪`）寫進泡泡；同時清掉 `title` 避免瀏覽器原生 tooltip。離開時加回 `off` 並移除 `zIndexSet`、`sharing-on`。
- 泡泡：白底、`1px solid #AAA`、`border-radius:5px`、`top:-13px`，底部一個 5px 的 `#AAA` 尖角 + 4px 的 `#FFF` 內尖角。

### 10.9 站內搜尋下拉（#wfp-inner-search）
- 點 `dl dt`（上下箭頭鈕）→ `dd` 加 `on`（`display:block`），出現 `文章搜尋 / 相簿搜尋 / 影音搜尋` 三選一（87px 寬白底清單）。
- 選定後改寫 `#inner-search-type` 文字，並把 `#inner-search-input` 的 placeholder 換成三個 hidden input 的對應值。
- `.suggestMenu` 為輸入建議層（458px 寬），項目 hover `#E0EDFE`，關鍵字高亮 `#1A84B7`。

### 10.10 「我的」服務列展開（#wfp-my .ft）
- 點右側的 ▼ `span` → `.ft` 加 `expan`：`.ft-service4` 變 `visibility:hidden`，`.ft-service8` 變 `display:block; position:absolute; top:0; left:55px`（把 9 個服務一次攤開），▼ 換成 ▲。

### 10.11 一般 hover
- 幾乎所有連結：`a:hover{text-decoration:underline}`（`#wfp-hybrid a.no-line:hover` 例外，強制不加底線）。
- 分頁籤 hover 沒有額外樣式（只有 `.on` 有綠底），hybrid 分頁例外（見 10.3）。

---

## 11. 復刻時要特別注意的陷阱

1. **`chameleon.css` 會大幅改動版面**【驗】。它總是被載入，並且：
   - `#wfp-footer{padding-top:300px}` → 頁尾上方留 300px 空白（原本要放整片換膚背景）。
   - `#push-down-ad{height:300px; left:-2px; text-align:left}` → 導覽下方留 300px 廣告位。
   - `#wfp-archive .hd{width:130px; padding-top:295px; position:absolute; top:-305px; right:0}` → **覆蓋** `wfp-css` 的 `width:56px; height:98px`，把日曆頭整個挪位。
   - 六個 corner-ad 的尺寸：nav 240×60、featured 200×56、today 140×45、celebrity 140×56、blog-entry 340×48（都 `position:absolute; top:-6px; right:0`，nav 是 `bottom:0`）。
   - `#wfp-hybrid` 的底色與 `belt-line` 也是 chameleon 設的（帶 `!important`）。
   > 若復刻版不放廣告，**建議把那兩個 300px 拿掉**，否則會出現兩大塊莫名空白。要 100% 忠實就照留。
2. **`#wfp-cover.mod{width:640px}` 加上 `1px` 邊框後是 642px**，比 `.main` 的 640px 寬 2px（原始碼就是這樣，會微微溢出）。
3. **`#wfp-navigation` 沒有 `overflow:hidden`**，`li.first:before` 用 `position:absolute` 掛在 `ul`（`position:relative`）上。
4. **`.belt` 與 `#lower-wrapper` 不在 `#wrapper` 內**，這是滿版腰帶能跨出白底容器的原因。
5. **兩套「更多」箭頭**：現代瀏覽器用 `:after` 的 CSS 三角（`border-width:3px; border-left-color:#B5B2B5`），IE 用 sprite 右上角那個 3×5 的小箭頭。復刻用 CSS 三角即可。
6. **`#wfp-my .bd h3.block-title` 是 `display:none`**，別誤以為畫面上會出現「個人服務／個人設定」。
7. **`ico_fp_musicoff.png` 有 Wayback 假檔陷阱**（見 §8 註記）。
8. **`#wfp-featured .hd ul li.on a` 的綠色是 `#91B93F`**，跟導覽列的綠、標題連結的 `#43883F` 是三個不同的綠，別混用。
9. 頂部搜尋列 `input` 那條規則寫了**兩次 background**（先 `ico_uh_search.png`，再被 `ico_sprite.png -235px -43px` 覆蓋），實際生效的是 sprite。
10. 大量 `*`／`_`／`\9` 前綴是 IE6/7/8 hack，復刻時可全部略過。
