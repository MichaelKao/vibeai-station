# 無名小站 (wretch.cc) 復刻規格書

資料來源：Internet Archive Wayback Machine 原始 HTML／CSS 快照（2005、2006、2008、2010–2013）。
標註「【驗】」＝直接讀自原始檔案；「【推】」＝推測或待查。

---

## 0. 快照網址清單（加 `id_` 取未改寫原始碼；`curl` 可抓，WebFetch 會被擋）

| 用途 | 網址 |
|---|---|
| 2005 原生中文首頁（table 版，最經典） | `https://web.archive.org/web/20050325091747id_/http://www.wretch.cc/` |
| 2006 首頁 | `https://web.archive.org/web/20060201000000id_/http://www.wretch.cc/` |
| 2008 Yahoo 版首頁 | `https://web.archive.org/web/20080301000000id_/http://www.wretch.cc/` |
| 2011 新版首頁（中文） | `https://web.archive.org/web/20110301000000id_/http://www.wretch.cc/` |
| 2012 首頁 | `https://web.archive.org/web/20120301000000id_/http://www.wretch.cc/` |
| **相簿預設主題 CSS（橘）** | `https://web.archive.org/web/20050117170057id_/http://pic.wretch.cc/css/album/newa.css` |
| **網誌預設主題 CSS（藍）** | `https://web.archive.org/web/20071017174323id_/http://pic.wretch.cc/css/blog/newb.css` |
| 字型 CSS | `https://web.archive.org/web/20090724161303id_/http://pic.wretch.cc/e/serv/album/css/font.css` |
| 2008 首頁 CSS | `https://web.archive.org/web/20080301000000id_/http://l.yimg.com/wretch.yimg.com/photos/serv/index/css/index.css` |
| 幻燈片樣式 | `https://web.archive.org/web/20130421124442id_/http://pic.wretch.cc/e/serv/album/css/display_angel.css` |
| 相簿列表頁 | `https://web.archive.org/web/20101123041333id_/http://www.wretch.cc/album/a000375` |
| 單本相簿（Photo Wall／音樂盒） | `https://web.archive.org/web/20121225174651id_/http://www.wretch.cc/album/album.php?id=leepeihsuam&` |
| 單張照片頁 | `https://web.archive.org/web/20120304075641id_/http://www.wretch.cc/album/show.php?i=meimeigirl&b=10&f=1477066932&p=9&sp=1` |
| 網誌首頁（完整側欄） | `https://web.archive.org/web/20080301000000id_/http://www.wretch.cc/blog/wretchtalk` |
| 網誌單篇＋迴響區 | `https://web.archive.org/web/20120415031503id_/http://www.wretch.cc/blog/%20boogier/16702046` |
| 留言板（悄悄話 Sealed） | `https://web.archive.org/web/20091223163035id_/http://www.wretch.cc/guestbook/a000000SS501` |
| 名片頁 | `https://web.archive.org/web/20120531223342id_/http://www.wretch.cc/user/a000000010` |
| 好友頁 | `https://web.archive.org/web/20110518114015id_/http://www.wretch.cc/friend/a00000415263` |
| 相簿總站（24 站內分類） | `https://web.archive.org/web/20110103115958id_/http://www.wretch.cc/album/` |
| 列舉更多（CDX API） | `https://web.archive.org/cdx/search/cdx?url=www.wretch.cc/album*&filter=statuscode:200&collapse=urlkey&limit=60&from=2007&to=2012` |

本機已下載檔案同目錄：`z_20050325091747.html`(2005首頁)、`newa.css`、`newb.css`、`alb1.html`、`bookpage.html`、`s2.html`、`art.html`、`gb.html`、`h_20080301.html`、`h_20110301.html`、`ai_20110103115958.html`。

---

## 1. 精確色碼【驗】

### 1-A. 相簿預設主題「橘色系」（`/css/album/newa.css`）— 復刻主視覺建議用這套

| 用途 | 色碼 |
|---|---|
| 頁面底色 / body background | `#E48A41`（配 `img/bga_01.gif` 平鋪，`fixed 50% 0%`） |
| 內容區底色 `#content` / `#content1` | `#FFD196` |
| 頁首 banner 底色 `#banner1` | `#DE750B`（上蓋 `bannerbga2.gif`） |
| 內文文字 / `td` / `body` 文字 | `#894500` |
| 連結 `a` | `#774004`（`text-decoration:none`） |
| 連結 hover | 同色，`text-decoration:underline`（**只加底線，不換色**） |
| 側欄文字 `.side` | `#894500` |
| 側欄連結 `.side a` | `#774004` ＋ `underline` |
| 說明文字 `.font_desc` | `#A96B1A` |
| 標題文字 `.font_title` | `#555533` |
| 帳號文字 `.font_id` | `#FFFFFF`（bold） |
| 區塊標題 `.title` / `.sidetitle` 文字 | `#FFFFFF`（bold, `letter-spacing:3px`） |
| 區塊標題底 | `titlebg.gif` / `sidetitlebga2.gif`（橘漸層圖），純色近似 `#DE750B` |
| 分隔白邊 `.side1` `.side2` | `#FFFFFF` |
| 表單 `input` | 文字 `#222222`、底 `#FFFFFF`、框 `1px solid #222222` |
| 搜尋框 `.grid_search` | 底 `#DDDDDD`、框 `1px solid #333333` |
| 捲軸 face/highlight/shadow/track | `#E48A41` |
| 捲軸 3dlight / darkshadow | `#854300` |
| 捲軸 arrow | `#FFD196` |

### 1-B. 網誌預設主題「藍色系」（`/css/blog/newb.css`）

| 用途 | 色碼 |
|---|---|
| 頁面底色 | `#447AC4`（配 `img/bgb_01.gif`） |
| 內容區底色 `#content1` | `#8AB9F4` |
| banner 底 `#banner1` | `#326EC8`（上蓋 `bannerbgb2.gif`） |
| 內文文字 | `#326EC8` |
| 連結 `a` | `#092D5E`；hover 加底線 |
| 側欄文字 `.side` | `#222233` |
| 帳號 `.font_id` | `#8AB9F4`（large, bold） |
| 標題 `.font_title` | `#D9E7FA` |
| 說明 `.font_desc` | `#B6D3F7` |
| 文章標題連結 `.font_arttitle a` | `#092D5E`（bold, underline） |
| 得點／人氣數字 `.point_grade` | `#FF2222` |
| 分類帳號 `.class_font_id` | `#B6D3F7`（8pt） |
| 分類標題 `.class_font_title` | `#222233`（10pt） |
| 填色區 `.fillcolor_01/02`、`.fillcenter` | `#447AC4` |
| 圖片外框 `.fillcenter img` | `padding:3px; background:#FFF` |
| 搜尋 `.search_class` | 底 `#8AB9F4`、框 `1px solid #C6CBee` |
| 捲軸 face | `#838EB5`；highlight `#C6CBee`；shadow/3dlight `#01004F`；arrow `#FFFFFF`；track `#7F9EC1` |

### 1-C. 頂端工具列 kukubar / haha bar（2009–2013）

| 用途 | 色碼 |
|---|---|
| 列底色 `#Wretch-haha` | `#FFFFFF`（相簿頁）或 `#EEEDDD`（留言板／名片頁） |
| 列高 | `20px`，字 `12px arial` |
| 連結 | `#000000`，hover 底線；下拉選單內連結 `#0099CC` |
| 分隔／次要字 `td` | `#CCCCCC` |
| 下拉框 | 底 `#FFFFFF`，框 `1px solid #CCCCCC`（2011 版 `#DADADA`），寬 93px |
| 搜尋輸入 `.Wretch-haha-text` | 底 `#FFF`、字 `#666`、`font-size:11px`、寬 100px |
| 2011 kukubar 漸層 | `linear-gradient(#FFFFFF → #EEEDDD)`；粉色頁用 `#FFFFFF → #FDE7EE` |
| 好友動態未讀 | `#ECECEC`；hover／選取 `#D3ECF6`；內文字 `#333333`；時間字 `#999999`；連結 `#0099CC` |

### 1-D. 2008 Yahoo 版首頁點綴色（`index.css`）
`#CC3399`（主桃紅）、`#AE196D`、`#C11361`、`#FB76B8`、`#E36511`、`#DD7700`、`#0B73AE`、`#ACCEE?`（`#ACCE..` 系列淺藍）、`#BEDE91`（淺綠）、`#7A3636`、`#771111`、灰階 `#FAFAFA` `#EEEEEE` `#E7E7E7` `#CCCCCC` `#BBBBBB` `#AAAAAA` `#666666`。

> 備註：常被記成「綠色系」的其實是 **logo 與少數點綴**（`#BEDE91`）。介面主色是**相簿橘 / 網誌藍**。

---

## 2. 尺寸、字型、行高【驗】

### 版面寬度
| 頁面 | 寬度 |
|---|---|
| 2005 原生首頁 | 總寬 `760px` 置中（`<table id="bigtab" width=760 align=center>`）；左右各 `5px` 白邊；**主欄 505px ＋ 隔 5px ＋ 右欄 160px**；banner 高 `100px`；主導覽列高 `30px` |
| 個人小站頁（相簿／網誌／留言板） | 內容表格固定 **`700px`** 置中 |
| 2008 Yahoo 版首頁 | `960px`（div 版面）；內部常用 `637px / 315px`、`432px`、`245px`、`197px`、`159px`、`144px`、`108px`、`106px`、`96px`、`86px` |
| 網誌三欄 | `#content` 浮左 `width:69.5%`，右側 `#links` 佔其餘；`#content` 左框 `5px solid #FFFFFF`、下框 `5px solid #FFFFFF`、`padding:15px 0`、`margin-bottom:20px` |
| 頂端工具列 | 高 `20px`，`position:absolute; top:0; right:0` |

### 格狀單元
- 相簿封面格：`<td width="120" height="120">`，**每列 5 格**，`cellspacing="10"`；下方文字格 `height="40" width="120" valign="top" align="center"`
- 一頁 **20 本相簿**（5×4）
- 2005 首頁熱門相簿：**每列 3 格** 120×120，格間 `width=10` 隔欄，文字格高 60px
- 2005 首頁熱門網誌：左縮圖 `120×120`，右文字表 `width=380`（總 500）
- 大頭貼 / 預設頭像：**90×90**（`No_Login_90.gif`）
- 好友動態頭像：`48×48`
- 音樂盒 Flash：`130×20`

### 廣告位（會影響版面，務必留位）
- `td#ad_banner` = **700×90**
- `td#ad_button` = **335×140**
- `#ad_square` 內 `div` = **120×120**
- `td#ad_word` = 黃金文字（單行文字連結）

### 字型與字級
```css
/* 中文（主力） */
.small-c  { font-family:"新細明體"; font-size:12px; }
.normal-c { font-family:"新細明體"; font-size:16px; }
.big-c    { font-family:"新細明體"; font-size:32px; }
.small-a  { font-family:"新細明體"; font-size:12px; }          /* a 版本連結加底線 */
.normal-a { font-family:"新細明體"; font-size:16px; }
.albumclass { font-family:"新細明體"; font-size:12px; }

/* 英數 */
.small-e  { font-family:Verdana,Arial,Helvetica,sans-serif; font-size:11px; }
.normal-e { font-family:Verdana,Arial,Helvetica,sans-serif; font-size:24px; }
.big-e    { font-family:Verdana,Arial,Helvetica,sans-serif; font-size:32px; }

/* 主題 CSS 全域 */
body, td { font-size:12px; font-family:Arial; }
input    { font-size:12px; font-family:Arial; }
.description { font-size:12px; font-weight:bold; }
#banner  { font-family:georgia,verdana,arial,sans-serif; }
.powered { font-size:11px; }

/* 2008 Yahoo 版首頁 */
body { font-family:verdana,arial,helvetica,clean,sans-serif; }
     /* 另見 font-size:15px / 1.25em / 11px; font:normal 1.1em/2em ... */
```

### 行高
- 側欄 `.side { line-height:140%; }`（相簿與網誌皆同）
- 分類文字 `.class_font_id / .class_font_title { line-height:140%; }`
- kukubar `line-height:20px !important`
- 2008 首頁部分區塊 `font:normal 1.1em/2em`（行高 2em）
- 其他未指定處＝瀏覽器預設（約 1.2）

### 其他版面常數
- `img { border:0 }`
- `body { margin:0 }`
- `.title` ：寬 320px、高 50px、`padding:19px`、`letter-spacing:3px`、置中、bold
- `.sidetitle`：高 24~30px、`padding-top:14px`（網誌）／`padding:9px`（相簿）、`letter-spacing:3px`、置中、bold、`margin-top:10px`
- `.grid_class`：寬 230px、高 40px、`float:left`、`margin-left:15px`
- 預設關閉右鍵／拖曳／選取：
  `<body onDragStart="return false" onContextmenu="return false" onSelectStart="return false">`

---

## 3. 首頁區塊（由上到下）

### 3-A. 2005 原生版【驗】— 兩欄 760px
1. **頁首右上文字列**：`設為首頁 | 常見問題 | 新手上路 | 會員登入`
2. **主導覽列**（置中一行，高 30px）：`無名小站 | 無名相簿 | 無名網誌 | 無名BBS | 無名好慢???`
3. 左欄（505px）
   1. 區塊標題 **`無名熱門相簿`**（連 `/album`），右上角 `更多相簿..`
      - 3 欄 ×120×120 縮圖；每格下：帳號 → 相簿名 → `25張照片`
   2. 區塊標題 **`無名熱門網誌`**（連 `/blog`），右上角 `更多網誌..`
      - 每則：左 120×120 縮圖｜右：帳號 → 文章標題 → 摘要 → `(繼續閱讀)` → 右下 `得點: 133547`
      - 底部再一個 `更多網誌..`
4. 右欄（160px），依序：
   1. `無名小站`（站方連結區）
   2. 註冊圖 ＋ `一個帳號，多項功能` ＋ 條列 `個人相簿` / `個人網誌 (BLOG,部落格)` / `個人留言板`
   3. **登入表單**：`帳號:` `密碼:` [`登入`] `忘記密碼` ☐`記住我的帳號`
   4. `活動快訊`
   5. `無名電影`
   6. `無名小站`：`使用規定` / `視覺設計` / `新聞中心` / `聯絡我們` / `廣告刊登`

### 3-B. 2008 Yahoo 版【驗】— 960px
由上到下：
1. 頂列：`設為首頁` `服務說明` `Yahoo!奇摩` ／ 語言下拉 `-- 語言自動選擇 --` `中文(臺灣)` `中文(香港)` `中文(简体)` `English`
2. **搜尋列**：`搜尋` ＋ 分頁籤 `相簿` `網誌` `影音` `網頁`；下方 `熱門關鍵字:` ＋ 7 個關鍵字
3. **服務列**（`服務列表`）：`相簿` `網誌` `影音` `論壇` `活動` `Star3`
4. **熱門**（`Hot`）：`正妹` `攝影` `美食` `旅遊` `搞笑` `娛樂`
5. **站方公告**（`WRETCH Notice`）7 則 ＋ `more`
6. **活動**（`Activity`）＋ `more`
7. **熱門新聞**（`Hot News`）
8. **精選三分頁**：`無名精選網誌` / `無名精選相簿` / `無名精選影音`
   - 每頁 4 則：縮圖 ＋ 帳號 ＋ 標題 ＋ 一句摘要 ＋ `69articles` / `231pictures` / `1videos`
   - 各頁下方 `more 無名精選網誌`（相簿／影音同）
9. **話題頻道分頁**：`癮用` `美食` `3C` `流行` `電影`，每頁 5 則圖文 ＋ `更多癮用`（依頁變化）
10. **名人專欄分頁**：`藝人` `模特兒` `運動明星` `作家` `政治人物`
    - 每頁：一則主打（標題＋摘要＋`more`）＋ `更多無名藝人` ＋ 10 條標題清單
11. 右欄：`Hi !` → `會員登入` `免費註冊` → `Mypage` `My Album` `My Blog` `My GBook` `My Video` `My Friend` → `加入VIP` → `站方消息` → `活動調查`（3 則 ＋ `more`）→ **`熱門話題`** 清單（`【 相信命運 】…`、`【 會員升級 】想了解金卡、銀卡的差別?看這裡!`、`【 上傳幫手 】想要下載上傳小幫手?點這裡!` 等 10 則）
12. 頁尾：`新首頁介紹` `服務條款` `隱私權政策` `新聞中心` `聯絡我們` `網路行銷` `招賢納士` `著作權侵權` ＋ `[本站設有管理員]本網站已依台灣網站內容分級規定處理` ＋ `雅虎資訊 版權所有 © 2008 Yahoo! Taiwan All Rights Reserved.`

### 3-C. 2011 新版【驗】— div 版面
由上到下：
1. 頂列：`無名小站` `Yahoo!奇摩` `服務說明` `會員登入` `免費註冊`；搜尋分類 `搜尋網頁` `網誌` `相簿` `影音` `揪團` `嘀咕` `手機 (NEW)`
2. **日期時間軸**：`今天` `三月 01` `展開/收合` `未來` `過去`
3. **`今日主題`**：大圖＋標題＋導言＋3 則子項目＋`分享至`
4. **`Wretch Search`**：`目前搜尋類別： 文章搜尋`／`變更搜尋類別：`（`文章搜尋` `相簿搜尋` `影音搜尋`）／`輸入搜尋字串：` [`搜尋`]
5. **`熱門相簿` / `正妹相簿` / `元氣正妹` / `本日我最美`**
   - 卡片：頭像 ＋ 暱稱 ＋ `加為朋友` ＋ 一句心情（例：`有一種朋友，你會想要一生珍惜`）
   - 區塊尾 `更多的正妹在無名`
6. 右欄上：`您還沒登入喔` → `會員登入` `免費註冊` → **`個人服務`**：`網誌` `相簿` `影音` `揪團` `嘀咕` `好友` `留言` `名片` `個人設定` → 背景音樂開關
7. **站方公告**：`[公告]新版無名首頁上線` 等 ＋ `更多站方公告`
8. **`今天你想做什麼?`**（最新活動）＋ `更多最新活動` ＋ `分享至`
9. **癮用王**：`邀你一起一路狂飆` ＋ `更多癮用王`
10. **`調查局`**（投票）：題目 ＋ `我要投票` ＋ `更多調查局`
11. **頻道四格**：`愛塗鴉` `好飛遜` `玩透透` `嗑美食`（各附一句 slogan）
12. **`每日推薦`** 圖文
13. 主題區：`巧克力控` / `在家動手做` / `非吃不可` 等圖文卡
14. **`名家專欄`** 分頁：`藝人` `模特兒` `運動明星` `作家` `政治名人` ＋ `更多藝人`
15. **`無名官方部落格`** 16 個：`辦公室` `愛正妹` `美食王` `校園事件簿` `瘋電影` `型男誌` `愛漂亮` `好地方` `好物誌` `愛攝影` `圖文` `Let's Lomo` `愛讀書` `癮用王` `原創音樂` `揪團報報`
16. **揪團**：分頁 `推薦` / `最近`；每則含標題、說明、`時間:` `地點:`；尾 `更多有趣揪團` `更多最近`
17. 頁尾：`中文` `English` ／ `新首頁介紹` `服務條款` `隱私權政策` `新聞中心` `聯絡我們` `網路行銷` `招賢納士` `著作權侵權` ＋ 分級聲明 ＋ `雅虎資訊 版權所有 © 2011 Yahoo! Taiwan All Rights Reserved.`

---

## 4. 個人小站頁：版面結構與側欄模組

### 4-A. 網誌頁 DOM 結構【驗】
```
#container1
 └ #container2
    ├ #banner
    │   └ #pageheader > h1 > a(站名)  +  span.description(副標)
    │       └ #description2 > span.description   ← 自訂 HTML／iframe 區
    ├ #main2
    │   ├ #content          （左，主欄，width:69.5%）
    │   │   └ .blog
    │   │      ├ .date > .datediv            ← 日期分隔（November 1, 2007）
    │   │      └ .blogbody > .blogbody2
    │   │           ├ .articletext
    │   │           │   ├ a[name=文章ID]
    │   │           │   ├ h3.title           ← 文章標題
    │   │           │   ├ .innertext         ← 內文
    │   │           │   └ .extended > a      ← 「(繼續閱讀)」
    │   │           └ .posted                ← 帳號 at 無名小站 at 03:00 PM post
    │   │                                       | 迴響(3) | 引用(0) | 收藏(2) | 檢舉
    │   └ #links > #links2   （右，側欄）
    │        └ …模組… ＋ #divThird > #divThird2 （側欄下半段）
    ├ #footer
    └ #extraDiv1 ~ #extraDiv6   ← 保留給自訂 CSS 的空 div（版型 hack 用）
```
每個側欄模組的標準三層結構：
```html
<div id="boxXxx">
  <div class="boxXxx0"><div class="sidetitle">標題文字</div></div>
  <div class="boxXxx1"><div class="side">內容</div></div>
  <br />
</div>
```

### 4-B. 網誌側欄模組順序【驗，id 依原始碼順序】
| # | id | 標題（中文） | 內容 |
|---|---|---|---|
| 1 | `boxMySpace` | `帳號 的小站` | 90×90 大頭貼、VIP 金卡圖示 `isAuth_gold.gif`、`Topic:`＋站內分類連結、服務清單（`Mypage` `相簿` `網誌` `留言板` `名片` `好友` `影音`）、`加入好友名單`、`送禮物給 帳號`、`- 好友的網誌 -` 下拉 |
| 2 | `boxNewArticle` | `最新文章` | 4–5 篇標題連結 |
| 3 | `boxCategory` | `文章分類` | `關於癮用王/公告(2)` 形式，含篇數 |
| 4 | `boxDate` | `文章日曆` | 月曆表（`日 一 二 三 四 五 六`）＋ `- 月份彙整 -` 下拉（`October 2008(1)`）＋ `看地圖` |
| 5 | `boxSearch` | `搜尋這個網誌` | 文字框(size12/max12) ＋ [`搜尋`] ＋ ☑`標題` ☐`內容` |
| 6 | `boxNewComment` | `最新迴響` ＋ RSS 圖 | `Re: 標題, by 帳號 (Nov 3)` |
| 7 | `boxRssList` | `我的訂閱` | 訂閱來源名＋日期＋條目連結 |
| 8 | `boxNewTrackback` | `最新引用` | `Re: 標題, by 對方網誌名 (Nov 3)` |
| 9 | `boxFolder` | **自訂標題**（如 `＊大家一起來癮用＊`） | `<iframe src="js.wretch.yahoo.net/iframe.php?b=帳號&i=編號">`，**可有多個**；音樂盒／跑馬燈／計數器貼紙都放這裡 |
| 10 | `boxCounter` | `人氣指數` | `今日人氣: 2828` ／ `累積人氣: 9647` |
| 11 | `.syndicate` | — | RSS 圖示 ＋ `(RSS HOWTO)` |
| 12 | `.powered` | — | `POWERED BY` ＋ wretch logo ＋ `登入 | 免費註冊` |

> 側欄可分兩段：`#links2` 放 1–5，`#divThird/#divThird2` 放 6–12（有些版型會排成雙側欄）。

### 4-C. 相簿頁結構【驗】700px 置中 table
```
[頂端 kukubar 20px]
banner（自訂 CSS 背景區）
  └ 站名 / 副標
導覽行： [ 帳號 的  MyPage | 相簿 | 網誌 | 留言板 | 名片 | 好友 | 影音 ]
控制列： [- 好友的相簿 -▼]  [- 相簿分類 -▼(含各類本數)]        右側：RSS ( RSS HOWTO )
廣告：   <td id="ad_banner">  700×90
黃金文字：<td id="ad_word">
統計：   共 73 本相簿                 （置中）
分頁：   1 2 3 4 下一頁                （置中）
相簿格： <table id="ad_square"> 5 欄 × N 列
          封面 <td width=120 height=120>  ← 縮圖
          文字 <td height=40 width=120>   ← [🔑key.gif] 相簿名 / [new_album.gif] 510張照片
分頁（重複）
人氣：   今日人氣: 0 / 累積人氣: 142
音樂盒： <span id="automusic">  BGMusicPlayer.swf 130×20
```
單本相簿頁（`album.php?id=&book=`）額外有：
- 麵包屑 `帳號's Album > 相簿名`
- `Topic:`（站內分類）／`Place:`（地點）／`Category:`（使用者分類）
- `[ 一頁瀏覽 ]`、`[ 加入好友名單 ]`
- 分享列：`分享在我的Facebook` `分享在我的Plurk` `分享在我的即時通` `發文`
- `照片牆（VIP限定）： Mosaic ｜ Waterfall`

### 4-D. 照片頁 `show.php`【驗】
麵包屑 `帳號's Album > 相簿名` → `10 / 80` → `第一張 | 上一張 | 下一張 | 最後一張 | 回頂端` → `幻燈片` → 大圖 `#DisplayImage`（快捷鍵 `c`＝下一張）→ 照片說明文字 → 分享列 → `搜尋更多` `切割照片` `檢舉這張照片` → 下方其他照片縮圖列（含各自說明）→ 廣告 → 音樂盒。

### 4-E. 留言板頁【驗】
頁籤 `留言板` / `系統訊息` / `我要留言` → 表頭 `標題｜來自｜內容｜回覆` → 分頁 `1 2 3 4 下一頁` → 每則留言區塊：
```
暱稱：xxx
主題：xxx（無標題時顯示「無標題」）        [檢舉]
時間：2009-12-21 14:38:52
內容：……
通知：
```
悄悄話：作者／主題／內容三處全部替換為 `悄悄話`（英版 `Sealed`）。

### 4-F. 迴響區【驗】
- 樓層前綴 `1樓` `2樓` `3樓`（網友常自填「搶頭香」「坐沙發」）
- 板主回覆標記 `板主回覆`
- 未登入預設頭像 `No_Login_90.gif`（90×90）
- 表單欄位見第 5 節

---

## 5. 中文介面用語清單（逐字）

### 5-1 導覽列 / 全站
```
無名小站   無名相簿   無名網誌   無名影音   無名BBS   無名好慢???
相簿  網誌  影音  嘀咕  揪團  名片  好友  留言  個人設定
Yahoo!奇摩   服務說明   常見問題   新手上路   設為首頁
會員登入   免費註冊   加入VIP   登出
帳號:   密碼:   登入   忘記密碼   記住我的帳號   記住我的資料
您還沒登入喔
[ 帳號 的  MyPage | 相簿 | 網誌 | 留言板 | 名片 | 好友 | 影音 ]
```

### 5-2 搜尋
```
搜尋        搜尋網頁   網誌   相簿   影音   揪團   手機 (NEW)
熱門關鍵字:
目前搜尋類別： 文章搜尋
變更搜尋類別：   文章搜尋   相簿搜尋   影音搜尋
輸入搜尋字串：
搜尋框 placeholder：找相簿 / 找文章 / 找影音 / 找朋友 / 找揪團
```

### 5-3 相簿
```
共 N 本相簿          N張照片          更多相簿..
一頁瀏覽             加入好友名單      加為朋友
幻燈片               照片牆（VIP限定）  Mosaic   Waterfall
切割照片             搜尋更多          檢舉這張照片
第一張 | 上一張 | 下一張 | 最後一張 | 回頂端
今日人氣：           累積人氣：
相簿人氣   隨機推薦   無名精選   手機上傳
所有分類   相簿站內分類   各地相簿   無名的名人
分享在我的Facebook   分享在我的Plurk   分享在我的即時通   發文
提示：僅相簿主人為VIP會員時才有此功能喔！
```
相簿站內分類 24 類（逐字）：
`國內旅遊 國外旅遊 美食記錄 流行時尚 圖像創作 美學設計 專業攝影 蒐集收藏 電腦通訊 電玩動漫 交通工具 心肝寵物 展覽活動 自然觀察 運動體育 影視娛樂 拍賣市集 特定節日 學園生活 朋友團體 家庭親情 情侶合照 女生個人 男生個人`
名人分類：`藝人 模特兒 運動明星 作家 政治名人`
地區：`台灣 香港與澳門 中國 世界各地`

### 5-4 網誌
```
迴響   引用   收藏   檢舉        (繼續閱讀)
最新文章   文章分類   文章日曆   月份彙整   最新迴響   最新引用   我的訂閱
搜尋這個網誌   標題   內容   人氣指數   看地圖
今日人氣：   累積人氣：
發表文章   網誌樣式   網誌設定
推薦   (推:386)
無名優格   名家專欄   分類好文   首頁好文：
POWERED BY
```
網誌站內分類 12 類：`創作 旅遊 生活 運動 娛樂 流行 科技 學習 財經 社會 心情 團體`

### 5-5 迴響表單（逐字）
```
發表迴響
暱稱：
E-mail：
個人網頁：
記住我的資料    是   否
迴響內容（最多1000字）：
請輸入右方數字：
（防止惱人的垃圾留言）
（看不到數字怎麼辦?）
[ 送出 ]
1樓   2樓   3樓        板主回覆
```

### 5-6 留言板
```
留言板   系統訊息   我要留言
標題 | 來自 | 內容 | 回覆
暱稱：   主題：   時間：   內容：   通知：
無標題        悄悄話        檢舉
下一頁
```

### 5-7 工具列 / 系統訊息（逐字原句）
```
今日主題：xxx
登入無名小站瀏覽分類好文
我有建議
關閉工具列
好友動態    展開    收合
分類好文    展開
載入中
更多站方公告
背景音樂設定開啓
背景音樂設定關閉
點選圖示開啟
點選圖示關閉
立即體驗
一週後提醒我
很抱歉! 您沒辦法看到這個網頁的 Flash! 請啟用 javascript
僅相簿主人為VIP會員時才有此功能喔！
新增[發表回應/回覆網友]功能，讓網友互動更緊密。
強化社群分享功能，迅速提升相簿人氣。
全新界面，照片呈現更加美觀明顯，好看又方便。
```

### 5-8 上傳／設定選單（kukubar 下方工具列）
```
網誌：發表文章   網誌樣式   網誌設定
相簿：上傳照片   相簿樣式   相簿設定
影音：上傳影片   影音樣式   影音設定
```

### 5-9 首頁區塊標題（逐字）
```
無名熱門相簿   無名熱門網誌   更多相簿..   更多網誌..   得點:
一個帳號，多項功能    個人相簿   個人網誌 (BLOG,部落格)   個人留言板
活動快訊   無名電影   使用規定   視覺設計   新聞中心   聯絡我們   廣告刊登
服務列表   站方公告   熱門話題   活動調查
無名精選網誌   無名精選相簿   無名精選影音
熱門相簿   正妹相簿   元氣正妹   本日我最美   更多的正妹在無名
今天你想做什麼?   更多最新活動   癮用王   更多癮用王
調查局   我要投票   更多調查局
每日推薦   名家專欄   無名官方部落格
愛塗鴉   好飛遜   玩透透   嗑美食
更多有趣揪團   時間:   地點:
```

### 5-10 頁尾（逐字）
```
新首頁介紹   服務條款   隱私權政策   新聞中心   聯絡我們   網路行銷   招賢納士   著作權侵權
[本站設有管理員]本網站已依台灣網站內容分級規定處理
雅虎資訊 版權所有 © 2011 Yahoo! Taiwan All Rights Reserved.
```

### 5-11 空狀態／預設文案
- 未登入頭像：`No_Login_90.gif`（90×90 灰底人像）— **不是文字**
- 相簿封面缺圖：`user_cover.gif`
- 留言主題留空 → 顯示 `無標題`
- 悄悄話遮蔽 → 三處皆顯示 `悄悄話`
- 好友下拉預設項 → `- 好友的相簿 -` / `- 好友的網誌 -`
- 分類下拉預設項 → `- 相簿分類 -` / `- 全部 -`
- 月份下拉預設項 → `- 月份彙整 -`
- **【推｜不建議使用】** `這個人很懶，什麼都沒留下` — 在所有無名快照中**查無此字串**，較可能來自 QQ／新浪。復刻時若要用，請視為原創。

---

## 6. 網址規則（樣板 routing 用）【驗】

```
/                                首頁
/mypage/帳號                     個人首頁（2009/05/26 下架）
/user/帳號                       名片（個人資料）
/album/                          相簿總站
/album/帳號                      個人相簿；&page=2 分頁；&cid=3 分類
/album/album.php?id=帳號&book=16 單本相簿
/album/show.php?i=帳號&b=1&f=1823781401&p=8&sp=1   單張照片
/album/display.php?style=angel&id=帳號&book=1      幻燈片（另有 style=taylor）
/album/album_rss.php?id=帳號     相簿 RSS
/album/addfriend.php?uid=帳號    加好友
/blog/                           網誌總站
/blog/帳號                       個人網誌
/blog/帳號&article_id=9136839    單篇（舊）
/blog/帳號/16702046              單篇（2011 後）
/blog/帳號&category_id=10897447  分類
/blog/帳號&schedule=1&year=2008&month=10   月彙整
/blog/blog.php?id=帳號&search=xx&search_title=1&search_content=1
/blog/帳號&rss20=1  /  &commentsRss20=1
/guestbook/帳號                  留言板；&page=3；&rss20=1
/friend/帳號                     好友
/video/帳號                      影音
/digu/                           嘀咕
/join/                           揪團
/svcs/wretch_girl/               無名愛正妹
/hala/viewtopic.php?t=65131      哈啦論壇
http://bill.wretch.cc/           付費／VIP
http://bill.wretch.cc/gift.php?to=帳號   送禮物
/IDintegration/?ref=...          登入
telnet://bbs.wretch.cc           無名BBS
```
圖床：早期 `http://c1.pic.wretch.cc/photos/1/c/帳號/相簿號/thumbs/tXXXX.jpg`；Yahoo 後 `http://f10.wretch.yimg.com/帳號/相簿號/XXXX.jpg`（縮圖同路徑 `/thumbs/tXXXX.jpg`，帶簽章 query）。
自訂 CSS：`http://f10.wretch.yimg.com/帳號/files/album.css?時間戳`、`blog.css?時間戳`。

---

## 7. 復刻要點速記
1. 個人頁一律 **700px 置中 table**；頂 20px kukubar；底 `POWERED BY` ＋人氣兩行。
2. 兩套預設主題：**相簿橘 `#E48A41 / #FFD196 / #894500 / #774004`**、**網誌藍 `#447AC4 / #8AB9F4 / #326EC8 / #092D5E`**。
3. 全站 **12px 新細明體**，連結無底線、hover 才加底線，`img{border:0}`。
4. 網址中間用 `&` 串參數（`/blog/user&article_id=123`）是最有辨識度的細節，務必保留。
5. 密碼相簿掛 `key.gif` 鑰匙、新相簿掛 `new_album.gif`、VIP 掛 `isAuth_gold.gif`。
6. 預設關閉右鍵／選取／拖曳。
7. 廣告位留 700×90、335×140、120×120 三種尺寸（可放假廣告或站方公告以還原氛圍）。
