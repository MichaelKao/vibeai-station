# 無名小站復刻：DOM 與 CSS 契約

這份文件是視覺復刻的**唯一權威**。`public/style.css` 與 `views/*.ejs` 都必須照這裡的
id / class 命名與巢狀關係寫，任何一邊自己發明名字都會讓另一邊失效。

結構來自 Internet Archive 的原始 HTML（`assets_src/html/`），色碼與尺寸來自原始 CSS
（`assets_src/newa.css` 相簿橘、`assets_src/newb.css` 網誌藍、`assets_src/index_new.css` 首頁綠）。
逐字文案見 `WRETCH_SPEC.md` 第 5 節。

---

## 0. 素材位置

素材放在 R2，透過 `res.locals.CDN` 取得前綴（`src/config.js` 匯出，預設回退到本機 `/img/wretch`）：

```
<%= CDN %>/album/bga_01.gif        相簿橘：body 底紋 40x768
<%= CDN %>/album/banner_clean.gif  相簿橘：去 logo 橫幅 750x100  ← 站方 logo 疊在這上面
<%= CDN %>/album/titlebg.gif       相簿橘：區塊標題條 320x50
<%= CDN %>/album/sidetitlebga2.gif 相簿橘：側欄標題條 160x30
<%= CDN %>/album/gridbg_01.gif     相簿橘：格子底 120x150
<%= CDN %>/album/gridbg_02.gif     相簿橘：格子底 120x60
<%= CDN %>/album/gridclassbg.gif   相簿橘：分類列底 230x40
<%= CDN %>/album/cycle01_0{1..4}.gif 相簿橘：四個圓角 20x20（01 左上 02 右上 03 左下 04 右下）

<%= CDN %>/blog/bgb_01.gif         網誌藍：body 底紋 40x768
<%= CDN %>/blog/banner_clean.gif   網誌藍：去 logo 橫幅 750x100
<%= CDN %>/blog/titlebgb.gif       網誌藍：區塊標題條 320x50
<%= CDN %>/blog/sidetitlebgb2.gif  網誌藍：側欄標題條 160x30
<%= CDN %>/blog/gridbgb_01.gif     網誌藍：格子底 120x120
<%= CDN %>/blog/gridbgb_02.gif     網誌藍：格子底 400x120
<%= CDN %>/blog/cycle02_0{1..4}.gif 網誌藍：四個圓角 20x20

<%= CDN %>/index/bga_01.gif        首頁綠：body 底紋 40x768
<%= CDN %>/index/banner_clean.gif  首頁綠：去 logo 橫幅 750x100
<%= CDN %>/index/album_title.gif   首頁綠：「熱門相簿」標題條 266x50
<%= CDN %>/index/blog_title.gif    首頁綠：「熱門網誌」標題條 266x50
<%= CDN %>/index/album_grid.gif    首頁綠：相簿格底 120x150
<%= CDN %>/index/album_grid1.gif   首頁綠：相簿格底（下半）120x60
<%= CDN %>/index/blog_grid.gif     首頁綠：網誌縮圖格底 120x120
<%= CDN %>/index/blog_grid1.gif    首頁綠：網誌文字格底 400x120
<%= CDN %>/index/sidetitle.gif     首頁綠：側欄標題條 160x30
<%= CDN %>/index/cycle01_0{1..4}.gif 首頁綠：四個圓角 20x20

<%= CDN %>/icon/key.gif            16x16 鑰匙（密碼相簿）
<%= CDN %>/icon/new_album.gif      21x11 NEW 標
<%= CDN %>/icon/isAuth_gold.gif    20x20 VIP 金卡
<%= CDN %>/icon/isAuth_silver.gif  20x20 VIP 銀卡
<%= CDN %>/icon/user_cover.gif     85x85 相簿封面缺圖
<%= CDN %>/icon/joinfree_index.gif 150x60 免費註冊圖（首頁右欄）
```

**站方自己的 logo**（唯一不照抄無名的東西）：`/img/logo.png`，疊在橫幅左上，`position:absolute; left:12px; top:14px`。

---

## 1. 三套主題

`<body>` 的 class 決定主題。三套只換色與底圖，**結構完全相同**。

| 主題 | body class | 用在 | body 底 | 內容區 | 標題條底 | 內文字 | 連結 |
|---|---|---|---|---|---|---|---|
| 首頁綠 | `t-index` | `/`、`/albums`、`/blogs`、`/rank`、`/search`、`/help`、登入註冊 | `#A1D344` + `index/bga_01.gif` | `#FFBBBB` | `#CB3939` | `#314B01` | `#774004` |
| 相簿橘 | `t-album` | `/:name/album*`、`/:name/photo/*` | `#E48A41` + `album/bga_01.gif` | `#FFD196` | `#DE750B` | `#894500` | `#774004` |
| 網誌藍 | `t-blog` | `/:name/blog*` | `#447AC4` + `blog/bgb_01.gif` | `#8AB9F4` | `#326EC8` | `#326EC8` | `#092D5E` |

底紋一律 `background: url(...) <底色> fixed 50% 0%`（**`fixed` 不可省**，這是無名捲動時底紋不動的關鍵手感）。

個人小站的其餘頁（MyPage / 留言板 / 名片 / 好友 / 設定）跟隨站主在「網誌樣式」選的
`users.theme`，沒選就用 `t-album`。使用者自選主題沿用既有的 `t-x-*` 八色，只換色不換結構。

### 全域規則（三套共用，照抄原始 CSS）

```css
body      { margin:0; font:12px Arial,"新細明體",PMingLiU,sans-serif; }
td        { font-size:12px; font-family:Arial; }
img       { border:0; }
a         { text-decoration:none; }
a:hover   { text-decoration:underline; }   /* 只加底線，不換色 */
input     { font-size:12px; color:#222; background:#fff; border:1px solid #222; }
.side     { font-size:10pt; line-height:140%; padding:10px; }
.side a   { text-decoration:underline; }
.side1, .side2 { background:#fff; }        /* 內容區左右各 5px 白邊 */
```

`<body>` 一律帶 `onDragStart="return false" onContextmenu="return false" onSelectStart="return false"`
（無名預設關閉右鍵／拖曳／選取，是很有辨識度的細節）。

---

## 2. 頂端工具列 kukubar（所有頁面，高 20px）

```html
<div id="Wretch-haha-spacer"></div>
<div id="Wretch-haha">
  <table align="right" cellpadding="0" cellspacing="0"><tr>
    <td>…站台連結…</td><td>|</td><td>…會員登入 / 免費註冊 或 帳號 + 登出…</td>
  </tr></table>
</div>
```

```css
#Wretch-haha-spacer { height:20px; }
#Wretch-haha { position:absolute; top:0; left:0; right:0; height:20px;
               line-height:20px !important; font:12px arial; background:#FFFFFF; }
#Wretch-haha a      { color:#000; }
#Wretch-haha a:hover{ text-decoration:underline; }
#Wretch-haha td     { color:#CCCCCC; font-size:12px; }
```

---

## 3. 個人小站頁：700px 置中 table

適用 MyPage / 相簿 / 照片 / 留言板 / 名片 / 好友 / 設定 / 收藏 / 好友動態 / 誰來我家。

```html
<div id="bigcontainer">

  <!-- 橫幅：站方 logo + 站名 + 副標 -->
  <table width="700" border="0" cellpadding="0" cellspacing="0" align="center"><tr>
    <td class="side1"></td>
    <td id="banner1">
      <div id="banner">
        <img id="sitelogo" src="/img/logo.png" alt="站名">
        <div id="pageheader"><h1><a href="/帳號">站名</a></h1>
          <span class="description">副標</span></div>
      </div>
    </td>
    <td class="side2"></td>
  </tr></table>

  <!-- 導覽行 + 分類下拉 + RSS -->
  <table width="700" border="0" cellpadding="0" cellspacing="0" align="center"><tr>
    <td class="side1"></td>
    <td id="content1">
      <div class="small-c" id="MySpace">
        [ <b>暱稱</b> 的 <a>MyPage</a> | <a>相簿</a> | <a>網誌</a> | <a>留言板</a> |
          <a>名片</a> | <a>好友</a> ]
      </div>
      <div id="rss" class="small-c" align="right">
        <div class="syndicate"><a href="…/blog/rss">RSS</a> ( <a href="/help#rss">RSS HOWTO</a> )</div>
      </div>
    </td>
    <td class="side2"></td>
  </tr></table>

  <!-- 主內容 -->
  <table width="700" border="0" cellpadding="0" cellspacing="0" align="center"><tr>
    <td class="side1"></td>
    <td id="content1">  …各頁內容…  </td>
    <td class="side2"></td>
  </tr></table>

  <!-- 頁尾：人氣兩行 + POWERED BY -->
  <table width="700" border="0" cellpadding="0" cellspacing="0" align="center"><tr>
    <td class="side1"></td>
    <td id="content1">
      <div class="side" align="center">
        今日人氣: <span class="point_grade">N</span>　累積人氣: <span class="point_grade">N</span>
      </div>
      <div class="powered" align="center">POWERED BY <a href="/">站名</a>
        | <a href="/login">登入</a> | <a href="/register">免費註冊</a></div>
    </td>
    <td class="side2"></td>
  </tr></table>

</div>
```

```css
#bigcontainer { width:700px; margin:0 auto; }
.side1, .side2 { width:5px; background:#fff; }
#banner1  { background: url(<CDN>/album/banner_clean.gif) #DE750B no-repeat 0% 0%; }
#banner   { height:100px; position:relative;
            border-left:5px solid #fff; border-right:5px solid #fff; border-bottom:20px solid #fff;
            font-family:georgia,verdana,arial,sans-serif; color:#FFF; }
#sitelogo { position:absolute; left:12px; top:14px; height:40px; }
#pageheader { position:absolute; left:12px; top:58px; }
#pageheader h1 { margin:0; font-size:20px; }
#pageheader h1 a { color:#fff; }
.description { color:#fff; font-size:12px; font-weight:bold; }
#content1 { background:#FFD196; }        /* 主題色，見第 1 節 */
.powered  { font-size:11px; }
.point_grade { color:#FF2222; }
```

---

## 4. 相簿頁

### 4-A. 相簿列表 `/:name/album`

```html
<td id="ad_word">…站方公告一行…</td>

<div class="side" align="center">共 <b>73</b> 本相簿</div>
<div class="side" align="center"><%- include('partials/pager') %></div>

<table id="ad_square" border="0" align="center" cellspacing="10">
  <tr>  <!-- 每列 5 格封面 -->
    <td class="side" width="120" height="120" align="center" valign="middle">
      <a href="…"><img src="封面" width="120" height="120"></a></td>
    …共 5 個…
  </tr>
  <tr>  <!-- 對應的說明格 -->
    <td height="40" width="120" valign="top" align="center">
      <img src="<CDN>/icon/key.gif">      <!-- 有密碼才出現 -->
      <a href="…" class="font_title">相簿名</a><br>
      <img src="<CDN>/icon/new_album.gif"><!-- 7 天內建立才出現 -->
      <span class="font_desc">510張照片</span></td>
    …共 5 個…
  </tr>
  …每 5 本重複一組 tr…
</table>
```

**一頁 20 本（5×4）**，`server.js` 已經是 `per=20`，不要改。
沒有封面時用 `<CDN>/icon/user_cover.gif`（85×85，置中放在 120×120 格內）。

```css
#ad_square td.side { background:url(<CDN>/album/gridbg_01.gif) no-repeat; }
.font_title { color:#555533; font-weight:bold; }
.font_desc  { color:#A96B1A; }
.font_id    { color:#FFFFFF; font-weight:bold; }
```

### 4-B. 單本相簿 `/:name/album/:id`

麵包屑 → 分類行 → 工具列 → 照片格（同上 5 欄，但格內是照片縮圖）→ 分頁。

```html
<div class="side">帳號's Album &gt; <b>相簿名</b></div>
<div class="side">Topic: <a>站內分類</a>　Place: <a>地點</a></div>
<div class="albumtools">
  [ <a href="?all=1">一頁瀏覽</a> ] [ <a href="…/slide">幻燈片</a> ] [ <a>加入好友名單</a> ]
</div>
```

### 4-C. 單張照片 `/:name/photo/:pid`

```html
<div class="side">帳號's Album &gt; <a>相簿名</a></div>
<div class="side" align="center"><b>10</b> / 80</div>
<div class="photonav" align="center">
  <a>第一張</a> | <a>上一張</a> | <a>下一張</a> | <a>最後一張</a> | <a href="#top">回頂端</a>
</div>
<div class="bigphoto" align="center"><img id="DisplayImage" src="…"></div>
<div class="side" align="center">照片說明</div>
<div class="strip" align="center">…其他照片縮圖，目前這張加 class="cur"…</div>
```

快捷鍵 `c` = 下一張（原站行為，用一小段 inline JS 綁 keydown）。

---

## 5. 網誌頁 `/:name/blog`

**注意：網誌頁不用 700px table，用原始的 div 三層 + 浮動兩欄。**

```html
<div id="container1"><div id="container2">

  <div id="banner">
    <img id="sitelogo" src="/img/logo.png">
    <div id="pageheader"><h1><a>站名</a></h1><span class="description">副標</span>
      <div id="description2"><span class="description"></span></div></div>
  </div>

  <div id="main2">

    <div id="content">
      <div class="blog">
        <div class="date"><div class="datediv">November 1, 2007</div></div>
        <div class="blogbody"><div class="blogbody2">
          <div class="articletext">
            <a name="文章ID"></a>
            <h3 class="title">文章標題</h3>
            <div class="innertext">內文</div>
            <div class="extended"><a href="…">(繼續閱讀)</a></div>
          </div>
          <div class="posted">
            帳號 at 站名 at 03:00 PM post |
            <a>迴響(3)</a> | <a>引用(0)</a> | <a>收藏(2)</a> | <a>檢舉</a>
          </div>
        </div></div>
        …每篇重複 .date + .blogbody…
      </div>
    </div>

    <div id="links"><div id="links2">
      …側欄模組 1~5…
      <div id="divThird"><div id="divThird2">
        …側欄模組 6~11…
      </div></div>
    </div></div>

  </div>

  <div id="footer">…</div>
  <div id="extraDiv1"></div>…<div id="extraDiv6"></div>

</div></div>
```

```css
#container1, #container2 { }
#banner  { height:100px; position:relative;
           background:url(<CDN>/blog/banner_clean.gif) #326EC8;
           border-left:5px solid #fff; border-right:5px solid #fff; border-bottom:20px solid #fff; }
#main2   { }
#content { float:left; position:relative; background:#8AB9F4; width:69.5%;
           border-left:5px solid #fff; border-bottom:5px solid #fff;
           padding:15px 0; margin-bottom:20px; text-align:center; }
#links   { overflow:hidden; }
.datediv { font-weight:bold; }
h3.title { font-size:12px; font-weight:bold; }
.innertext { text-align:left; }
.posted  { font-size:11px; }
```

### 側欄模組：一律三層

```html
<div id="box<名稱>">
  <div class="box<名稱>0"><div class="sidetitle">標題文字</div></div>
  <div class="box<名稱>1"><div class="side">內容</div></div>
  <br />
</div>
```

`.sidetitle` 是那條 160×30 的圓角標題圖，`letter-spacing:3px`、置中、白字粗體。

| 順序 | id | 標題 | 放什麼（對應 `blogSide()` 已提供的資料） |
|---|---|---|---|
| 1 | `boxMySpace` | `暱稱 的小站` | 90×90 大頭貼、服務清單、加入好友、送禮物 |
| 2 | `boxNewArticle` | `最新文章` | `recent` |
| 3 | `boxCategory` | `文章分類` | `cats`，格式 `分類名(3)` |
| 4 | `boxDate` | `文章日曆` | `cal` 月曆表 + `months` 的「- 月份彙整 -」下拉 |
| 5 | `boxSearch` | `搜尋這個網誌` | 文字框 size12 + [搜尋] + ☑標題 ☐內容 |
| 6 | `boxNewComment` | `最新迴響` | `recentC`，格式 `Re: 標題, by 帳號 (Nov 3)` |
| 7 | `boxNewTrackback` | `最新引用` | 引用清單 |
| 8 | `boxCounter` | `人氣指數` | `今日人氣: N` / `累積人氣: N` |
| 9 | `.syndicate` | — | RSS 圖示 + `(RSS HOWTO)` |
| 10 | `.powered` | — | `POWERED BY` + 登入/免費註冊 |

1~5 放 `#links2`，6~10 放 `#divThird2`。

日曆表頭逐字：`日 一 二 三 四 五 六`。

### 迴響區（文章頁）

```html
<a name="comments"></a>
<div class="side"><b>1樓</b> 暱稱 …內容… </div>
<div class="side"><b>板主回覆</b>：…</div>
```

表單欄位逐字（見 `WRETCH_SPEC.md` 5-5）：
`暱稱：` `E-mail：` `個人網頁：` `記住我的資料 是 否` `迴響內容（最多1000字）：` `[ 送出 ]`

---

## 6. 留言板 `/:name/guestbook`

```html
<div class="tabs">
  <a class="on">留言板</a><a>系統訊息</a><a>我要留言</a>
</div>
<div class="side">
  <div class="gbitem">
    <div>暱稱：xxx</div>
    <div>主題：xxx</div>        <!-- 空的時候顯示「無標題」 -->
    <div>時間：2009-12-21 14:38:52</div>
    <div>內容：……</div>
    <div>通知：</div>
  </div>
</div>
```

悄悄話：非本人看時，**暱稱／主題／內容三處全部**顯示 `悄悄話`。

---

## 7. 首頁 `/`（2005 綠版，760px 兩欄）

```html
<table id="bigtab" width="760" border="0" cellspacing="0" cellpadding="0" align="center"><tr>
  <td class="side1"></td>

  <!-- 左欄 505px -->
  <td width="505" valign="top" class="album_content">
    <div class="album_title"><a href="/albums">熱門相簿</a></div>
    <table border="0" cellspacing="0" cellpadding="0"><tr>
      <td class="album_grid" width="120" height="150" align="center">
        <a><img width="120" height="120"></a></td>
      <td width="10"></td>
      …每列 3 格，格間 10px 隔欄…
    </tr><tr>
      <td class="album_grid1" width="120" height="60" align="center" valign="top">
        <span class="album_font_id"><a>帳號</a></span><br>
        <span class="album_font_title"><a>相簿名</a></span><br>
        <span class="album_font_desc">25張照片</span></td>
      …
    </tr></table>
    <div align="right"><span class="blog_font_desc"><a href="/albums">更多相簿..</a></span></div>

    <div class="blog_title"><a href="/blogs">熱門網誌</a></div>
    <table border="0" cellspacing="0" cellpadding="0"><tr>
      <td class="blog_grid" width="120" height="120"><a><img width="120" height="120"></a></td>
      <td class="blog_grid1" width="380" valign="top">
        <span class="blog_font_id"><a>帳號</a></span><br>
        <span class="blog_font_arttitle"><a>文章標題</a></span><br>
        <span class="blog_font_desc">摘要…<a>(繼續閱讀)</a></span>
        <div align="right"><span class="blog_point_title">得點: </span>
          <span class="blog_point_grade">133547</span></div></td>
    </tr></table>
    <div align="right"><span class="blog_font_desc"><a href="/blogs">更多網誌..</a></span></div>
  </td>

  <td width="5"></td>

  <!-- 右欄 160px -->
  <td width="160" valign="top">
    <div class="sidetitle">站名</div>
    <div class="side">…站方連結…</div>

    <div class="sidetitle">一個帳號，多項功能</div>
    <div class="side"><a href="/register"><img src="<CDN>/icon/joinfree_index.gif" width="150" height="60"></a>
      個人相簿<br>個人網誌 (BLOG,部落格)<br>個人留言板</div>

    <div class="sidetitle">會員登入</div>
    <div class="side"><form method="post" action="/login">
      帳號: <input name="name" size="10"><br>
      密碼: <input name="pass" type="password" size="10"><br>
      <input type="submit" value="登入"> <a>忘記密碼</a><br>
      <input type="checkbox" name="remember"> 記住我的帳號
    </form></div>

    <div class="sidetitle">活動快訊</div>  <div class="side">…站方公告…</div>
    <div class="sidetitle">人氣排行</div>  <div class="side">…</div>
  </td>

  <td class="side2"></td>
</tr></table>
```

```css
#bigtab { }
.album_title, .album_title a { background:url(<CDN>/index/album_title.gif) no-repeat 50% 0%;
  width:320px; height:40px; padding-top:19px; color:#fff; font-size:12px; font-weight:bolder;
  font-family:Arial; letter-spacing:3px; text-align:center; }
.blog_title, .blog_title a { background:url(<CDN>/index/blog_title.gif) no-repeat 50% 0%;
  /* 其餘同 .album_title */ }
.album_grid  { background:url(<CDN>/index/album_grid.gif) no-repeat; text-align:center; }
.album_grid1 { background:url(<CDN>/index/album_grid1.gif) no-repeat; }
.blog_grid   { background:url(<CDN>/index/blog_grid.gif) no-repeat; text-align:center; }
.blog_grid1  { background:url(<CDN>/index/blog_grid1.gif) no-repeat 100% 0%;
               text-align:left; padding-right:10px; }
.album_font_id    { color:#fff; font-weight:bold; font-family:Arial; }
.album_font_desc  { color:#BBBBFF; font-family:Arial; }
.album_font_title { color:#FFBBBB; font-weight:bold; font-family:Arial; }
.blog_font_id     { font:bold large Arial; color:#fff; }
.blog_font_title  { font-weight:bold; font-size:small; color:#D9E7FA; font-family:Arial; }
.blog_font_desc   { font-size:12px; color:#FFBBBB; font-family:Arial; }
.blog_font_desc a { color:#BBBBFF; }
.blog_font_arttitle a { font-weight:bold; color:#EF7676; text-decoration:underline; }
.blog_point_title { color:#FFBBBB; font-family:Arial; }
.blog_point_grade { color:#BBBBFF; font-family:Arial; }
.sidetitle { background:url(<CDN>/index/sidetitle.gif) no-repeat 50% 0%;
  color:#fff; font-size:12px; font-weight:bold; font-family:Arial; letter-spacing:3px;
  padding-top:11px; padding-bottom:9px; margin-bottom:0; text-align:center; }
#content1 { background:#FFBBBB; }
```

---

## 8. 不可違反的細節

1. 連結預設**無底線**，`:hover` **只加底線、不換色**。
2. 全站字級 **12px**，側欄 `10pt`、`line-height:140%`。
3. `img { border:0 }` —— 圖片連結不能出現藍框。
4. 個人頁固定 **700px**、首頁固定 **760px**，都置中，**不做 RWD**（原站沒有）。
5. 底紋一律 `fixed`。
6. 相簿一頁 **20 本（5×4）**，首頁熱門相簿 **每列 3 格**。
7. 密碼相簿掛 `key.gif`、7 天內新相簿掛 `new_album.gif`。
8. `<body>` 帶 `onContextmenu/onSelectStart/onDragStart="return false"`。
9. 站方 logo 與站名是**唯一**不照抄無名的東西，其餘一律照原樣。
10. 使用者自訂 CSS（`users.css`）仍然放在 `<head>` 最後，蓋得過主題 —— 這是無名的靈魂功能。
