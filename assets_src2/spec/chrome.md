# chrome — 全站共用框架規格書（無名小站 2012 最後版）

代號：**chrome**
範圍：頂端工具列（kukubar-upper）、底部工具列（kukubar-lower）、首頁頁首/導覽/頁尾（wfp-universal-header / wfp-navigation / wfp-footer）、登入註冊流程、logo 素材。
目標年代：**2012**（主）；2013 差異另列；2011 為舊版（不同設計）僅作對照。

---

## 0. 一句話結論（先看這個）

【驗】**2012 年的無名小站沒有自己的登入頁，也沒有自己的註冊頁。**
`/login/` 在 2011 之後回 404。工具列上的 `Login` / `Register` 兩個連結都指向 `http://www.wretch.cc/IDintegration/`，
該網址 302 轉到 **Yahoo!奇摩 登入頁**（`https://login.yahoo.com/config/login?.intl=tw&.src=wrtch&...`）。
所以要 1:1 復刻的話，「登入頁」＝ Yahoo 登入頁（本文第 7 節有逐字表單），
或是自建一個外觀相同的頁面；**不要**去找無名自己的登入畫面，那是 2007 年以前的東西。

【驗】另一個結論：**內頁（網誌／相簿／留言板）沒有 wfp 頁首與頁尾**。
內頁的「頁首」就是 30px 高的 `#kukubar-upper`，「頁尾」就是固定在視窗底部 25px 高的 `#kukubar-lower`。
`#wfp-universal-header` / `#wfp-navigation` / `#wfp-footer` 只出現在 `http://www.wretch.cc/` 首頁。

---

## 1. 快照清單（我實際下載並打開過的）

| 用途 | 網址 | 落地檔案 |
|---|---|---|
| 2012 網誌內頁（logged-out kukubar 上下兩條，最完整） | http://web.archive.org/web/20120817013114id_/http://www.wretch.cc:80/blog/%20AndreaCorlen | `assets_src2/html/chrome_blog_20120817.html` |
| 2012-12 首頁（頁首/導覽/頁尾/我的無名模組，繁中） | http://web.archive.org/web/20121212103015id_/http://www.wretch.cc/ | `assets_src2/html/chrome_index_20121212.html` |
| 2013-07 網誌內頁（kukubar 仍與 2012 相同） | http://web.archive.org/web/20130727092926id_/http://www.wretch.cc:80/blog/%20treehouse16 | `assets_src2/html/chrome_blog_20130727.html` |
| 2013-12-26 網誌內頁（唯讀模式，下方工具列已消失） | http://web.archive.org/web/20131226223327id_/http://www.wretch.cc/blog/a000 | `assets_src2/html/chrome_blog_20131226_readonly.html` |
| 2011-05 網誌內頁（**舊版 Wretch-haha 表格工具列**，對照用） | http://web.archive.org/web/20110517063616id_/http://www.wretch.cc:80/blog/%20ninicat80 | `assets_src2/html/chrome_blog_20110517_hahabar.html` |
| Yahoo!奇摩 登入頁（`.src=wrtch`，即無名的登入頁） | http://web.archive.org/web/20110623040534id_/https://login.yahoo.com/config/login?.intl=tw&.src=wrtch&… | `assets_src2/html/chrome_yahoo_login_20110623.html` |
| kukubar CSS（2012 版，41,927 bytes） | http://web.archive.org/web/2012id_/http://l.yimg.com/e/serv/common/css/kukubar.css?201207262 | `assets_src2/css/chrome_kukubar.css` |
| kukubar JS（2012 版，39,110 bytes） | http://web.archive.org/web/2012id_/http://l.yimg.com/e/serv/common/js/kukubar.js?201207262 | `assets_src2/css/chrome_kukubar.js` |
| kukubar CSS（2013-09-03 版，42,111 bytes） | http://web.archive.org/web/2013id_/http://l.yimg.com/e/serv/common/css/kukubar.css?20130903 | `assets_src2/css/chrome_kukubar_20130903.css` |
| 社群分享列 CSS | http://web.archive.org/web/2012id_/http://l.yimg.com/e/serv/common/css/sharing.css?201207262 | `assets_src2/css/chrome_sharing.css` |
| 首頁 CSS（頁首/導覽/頁尾規則出處） | 由 index 代號同伴下載 | `assets_src2/css/index_wfp-css_201205171100.css` |
| IDintegration 轉址證據（302 → Yahoo 登入） | http://web.archive.org/web/20081217005917id_/http://www.wretch.cc/IDintegration/ | 只看 header，未落地 |

素材圖檔全部在 `assets_src2/img/chrome/`（第 8 節有完整清單與尺寸）。

**查無**（找過但存檔裡沒有）：
- `www.wretch.cc/login/` 2010 之後只有 404 快照（1,848–1,854 bytes）。
- `www.wretch.cc/register`、`/join`（`/join` 是「揪團」服務，不是註冊）。
- `www.wretch.cc/IDintegration/` 2011–2013 的內容快照（只有 2008 的 302）。
- Yahoo!奇摩 **繁中註冊頁**（`edit.yahoo.com/config/eval_register?.intl=tw&.src=wrtch`）—— CDX 只有 2011-04-23 的**英文版** `edit.yahoo.com/config/eval_register`，非繁中、非無名 partner，我沒有採用。
- `l.yimg.com/e/serv/common/img/ico_loading.gif`（CDX 零筆；載入動畫圖示抓不到）。
- **登入後**狀態的 kukubar HTML（archive 爬蟲永遠是登出狀態）→ 第 5 節該部分標【推】。

---

## 2. 精確色碼表

### 2.1 頂端工具列 `#kukubar-upper`（全部出自 `chrome_kukubar.css`，除非另註）

| 用途 | 色碼 | 出處規則 |
|---|---|---|
| 工具列底色（漸層上） | `#FFFFFF` | 頁面 inline `<style>` `.kukubar-customized{background:-moz-linear-gradient(top,#FFFFFF 0%,#EEEDDD 100%)}` |
| 工具列底色（漸層下＝舊瀏覽器 fallback 純色） | `#EEEDDD` | 同上 `background:#EEEDDD` |
| 工具列下緣分隔線 | `#bbbbbb` | `#kukubar-upper{border-bottom:1px solid #bbbbbb}` |
| 區塊之間的直分隔線 | `#C9C9C9` | `#kukubar-upper .bar-block{border-right:1px solid #C9C9C9}` |
| 一般連結文字（font-black 主題） | `#666666` | `#kukubar-upper.font-black .theme{color:#666666}`、`.kukubar-bar .bar-block-click a{color:#666666}` |
| 連結 hover 文字 | `#000000` | `.kukubar-bar .bar-block-click a:hover{color:#000000}` |
| 深底主題（font-white）連結文字 | `#FFFFFF` | `#kukubar-upper.font-white .theme{color:#FFFFFF}` |
| 深底主題 hover 底色（`#wretch-login`） | `#636363` | `#kukubar-upper.font-white .right-side #wretch-login:hover{background:#636363}` |
| 展開中的區塊底色 | `#FFFFFF` / 文字 `#000000` | `.expanded-btn{background:#FFFFFF;color:#000000}` |
| 下拉選單底色 | `#FFFFFF` | `#kukubar-upper .left-side ul.dropdown{background:#FFFFFF}` |
| 下拉選單外框 | `#BBBBBB`（上邊無框） | `#wretch-service ul{border:1px solid #BBBBBB;border-top:none}` |
| 下拉選單項目分隔線 | `#DDDDDD` | `#wretch-service ul li{border-bottom:1px solid #DDDDDD}` |
| 下拉選單項目 hover 底色 | `#D3ECF6` | `#kukubar-upper .left-side ul.dropdown li a:hover{background:#D3ECF6}` |
| `Login │ Register` 之間的分隔字 `\|` | `#ECECEC` | `#wretch-login ul li.first:after{content:'\|';color:#ECECEC}` |
| 搜尋框外框 | `#CBCBCB` | `#wretch-search form{border:1px solid #CBCBCB}` |
| 搜尋框底色 | `#FFFFFF` | 同上 |
| 搜尋框 placeholder（.blur） | `#C6C6C6` | `.search-field input.blur{color:#C6C6C6 !important}` |
| 搜尋輸入文字 | `#000000` | `.search-field input#wretch-search-text{color:#000000}` |
| 搜尋服務標籤 legend | `#666666` | `fieldset legend{color:#666666}` |
| 服務清單下拉 hover | `#EBEBEB` | `#wretch-search form label:hover{background:#EBEBEB}` |
| 通知鈴鐺展開時底色 | `#4D4D4D` | `#wretch-notice.expanded-btn{background-color:#4D4D4D}` |
| 通知浮層外框 | `#BCBCBC` | `#wretch-notice div.dropdown{border:1px solid #BCBCBC}` |
| 通知浮層標題列底 | `#4D4D4D` | `div.dropdown .notice-heading{background:#4D4D4D}` |
| 通知浮層標題文字 | `#FFFFFF` | `.notice-heading h4{color:#FFFFFF}` |
| 通知浮層標題左側色條 | `#FFD233`（5px） | `.notice-heading h4{border-left:5px solid #FFD233}` |
| 通知浮層標題列裡的連結 | `#cbbf82` | `.notice-heading h4 a{color:#cbbf82}` |
| 通知條目 hover | `#D3ECF6` | `#wretch-notice ul li.hover-on{background:#D3ECF6}` |
| 通知條目內連結（藍） | `#33A1FF` | `#wretch-notice ul li a{color:#33A1FF !important}` |

### 2.2 底部工具列 `#kukubar-lower`

| 用途 | 色碼 | 出處規則 |
|---|---|---|
| 底列底色 | `#f0f0f0` | `#kukubar-lower{background:#f0f0f0}` |
| 底列上緣線 | `#BBBBBB` | `#kukubar-lower{border-top:1px solid #BBBBBB}` |
| 底列陰影 | `#a0a0a0`（`5px 0px 10px`） | `#kukubar-lower{-webkit-box-shadow:5px 0px 10px #a0a0a0}` |
| 底列文字 | `#666666` | `#kukubar-lower .bar-block{color:#666666}` |
| 分類好文/好友動態按鈕 hover 底色 | `#f0edb7` | `#footer-vitality a…:hover{background-color:#f0edb7}` |
| 好友動態「有新訊息」底色 | `#f9f0d2` | `#footer-vitality.new-msg{background:#f9f0d2}` |
| 橘色主要按鈕（登入 / 我要訂閱）漸層 | `#FF7804` → `#FCB400` | `#kukubar-lower .footer-ok-btn{background:-moz-linear-gradient(top,#FF7804 0%,#FCB400 100%)}` |
| 橘色按鈕外框 | `#FDA601` | `.footer-ok-btn{border:1px solid #FDA601}` |
| 橘色按鈕 hover 漸層 | `#FCCD00` → `#FFAB04`，框 `#FFE898` | `.footer-ok-btn:hover` |
| 橘色按鈕 active 漸層 | `#FEC24A` → `#F49038` | `.footer-ok-btn:active` |
| 停用按鈕漸層 | `#A1A1A1` → `#D3D3D3`，框 `#c0c0c0` | `button.deactivated` |
| 「登入才能看」浮層外框 | `#E06F00` | `.login-request .login-btn{border:1px solid #E06F00}` |
| 「登入才能看」提示文字 | `#666666` | `.login-request .login-msg{color:#666666}` |
| 好友動態浮層外框 | `#BCBCBC` | `#kukubar-lower div.dropdown{border:1px solid #BCBCBC}` |
| 好友動態標題列底 / 左色條 | `#4D4D4D` / `#FFD233` | `.vitality-heading` / `.vitality-heading h4` |
| 好友動態標題列連結 | `#F2D671` | `.vitality-heading a{color:#F2D671}` |
| 未讀動態底色 | `#EBEBEB` | `li.unread{background:#EBEBEB}` |
| 動態 hover | `#D3ECF6` | `li.hover-on{background:#D3ECF6}` |
| 動態內連結 | `#33A1FF` | `li.vitality-event div.content a{color:#33A1FF}` |
| 跑馬燈文字 / hover | `#666` / `#000` | `#text-carousel a{color:#666}` / `:hover{color:#000}` |
| 服務圖示區左分隔線 | `#C9C9C9` | `li.blog-service em{border-left:1px solid #C9C9C9}` |
| 開關按鈕 `#footer-switch` 底色 | `#F1F1F1` | `#footer-switch{background:#F1F1F1 …}` |
| 開關按鈕上緣線 | `#C9C9C9` | 同上 `border-top:#C9C9C9 solid 1px` |

### 2.3 訂閱面板 `#scrb-panel`（分類好文）

| 用途 | 色碼 | 出處 |
|---|---|---|
| 面板外框 | `#BBBBBB`（下緣無框） | `#kukubar-lower div#scrb-panel{border:1px solid #BBBBBB;border-bottom:none}` |
| 面板底 | `#FFFFFF` | `#scrb-panel .hd{background:#FFFFFF}` |
| 標題分隔線 | `#DDDDDD` | `#scrb-panel .heading{border-bottom:1px solid #DDDDDD}` |
| 分類標籤（未選）框/字 | `#70cdec` | `#scrb-panel .hd ul li{border:1px solid #70cdec;color:#70cdec}` |
| 分類標籤 hover | 底 `#48B2D5` 字 `#FFFFFF` | `.hd ul li.hover-on` |
| 分類標籤 selected | 底 `#70cdec` 字 `#FFFFFF` | `.hd ul li.selected` |
| 已訂閱後左側清單項底 | `#88CFEC` 字 `#FFFFFF` | `.after-subscribe .hd ul.sub-list li` |
| 已訂閱後左側 hover | `#37B7EC` | `.after-subscribe .hd ul li.hover-on` |
| 已訂閱後左側選中 | 底 `#FFFFFF` 字 `#000000` | `.after-subscribe .hd ul li.selected` |
| 已訂閱後面板底 | `#F9F9F9` | `#kukubar-lower div#scrb-panel.after-subscribe{background:#F9F9F9}` |
| 已訂閱後分隔線 | `#E4E4E4` | `.after-subscribe .hd{border-right:1px solid #E4E4E4}` |
| 標題列（已訂閱後） | 底 `#4D4D4D`、左條 `#FFD233`、字 `#FFFFFF` | `.after-subscribe .heading h5` |
| 文章清單標題列左條 | `#5EB03E` | `#scrb-panel .bd h5 em{border-left:5px solid #5EB03E}` |
| 文章列 hover | `#D3ECF6` | `#scrb-panel .bd ul li.hover-on` |
| 文章列連結 | `#33A1FF` | `#scrb-panel .bd ul li a{color:#33A1FF}` |
| 儲存遮罩底 | `rgba(255,255,255,0.5)` | `#scrb-panel-mask` |
| 儲存訊息方塊 | `#3A3A3A` 字 `#FFFFFF` | `#scrb-panel-mask div.msg-block` |
| 取消訂閱連結 | `#31A2FF` | `.after-subscribe .bd a.unsub{color:#31A2FF}` |

### 2.4 首頁頁首 / 導覽 / 頁尾（出自 `index_wfp-css_201205171100.css`）

| 用途 | 色碼 | 出處規則 |
|---|---|---|
| 版心底色 | `#FFF` | `#wrapper,#lower-wrapper{background-color:#FFF}` |
| 頁首右上小連結 | `#676767` | `#wfp-universal-header .hd ul li a{color:#676767}` |
| `Yahoo!奇摩` 右分隔線 | `#D9D9D9` | `li.yahoo-home{border-right:1px solid #D9D9D9}` |
| `服務說明` 左分隔線 | `#E9E9E9` | `li.service-guide{border-left:1px solid #E9E9E9}` |
| 搜尋框外殼底（漸層） | `#F1F1F4` → `#CACACA`，fallback `#DFDFE0` | `.bd div.search{background-color:#DFDFE0;background-image:-webkit-gradient(linear,0% 0,0% 100%,from(#F1F1F4),to(#CACACA))}` |
| 搜尋框外殼外框 | `#9F9F9F` | `.bd div.search{border:1px solid #9F9F9F}` |
| 搜尋輸入框框線（4 邊不同色） | 上左 `#7B797B`、下右 `#CECBCE` | `.bd div.search input{border-color:#7B797B #CECBCE #CECBCE #7B797B}` |
| 搜尋輸入文字 | `#333` | 同上 |
| 搜尋 placeholder | `#999` | `.bd div.search input.placeholder{color:#999}` |
| 「搜尋網頁」黃色按鈕漸層 | `#FFF39C` → `#FEE474`(40–50%) → `#FDD14C` → `#FCC42E`，fallback `#F8D44C` | `.bd div.search button` |
| 黃色按鈕外框 | `#878787` | 同上 |
| 綠色導覽列漸層（水平，右→左） | `#B2CD89` → `#C3D790`(20%) → `#92C067`(40%) → `#65B051`(60%) → `#5AB166`(70%) → `#56B27A` → `#56BA99` | `#wfp-navigation{background:-webkit-gradient(linear,100% 0,0% 0,…)}` |
| 導覽列上緣 | `rgba(90,182,132,0.1)` | `#wfp-navigation{border-top:1px solid rgba(90,182,132,0.1)}` |
| 導覽列覆蓋的白→綠透明層 | `rgba(255,255,255,0.25)` → `rgba(94,168,87,0.25)` | `#wfp-navigation .blog-nav` |
| 導覽文字 | `#000` | `#wfp-navigation ul li a{color:#000}` |
| 頁尾上緣線 | `#E5E5E5` | `#wfp-footer{border-top:1px solid #E5E5E5}` |
| 頁尾連結 | `#666` | `#wfp-footer a{color:#666}` |
| 頁尾點狀分隔（`:before` 方點） | `#B5B2B5` | `#wfp-footer ul.nav li:before{border-color:#B5B2B5}` |
| 頁尾版權灰字 | `#999` | `#wfp-footer p span{color:#999}` |
| RSS 條下緣虛線 | `#c6c6c6` | `#rss-bar{border-bottom:1px dotted #c6c6c6}` |
| RSS 條項目分隔虛線 | `#b3b3b3` | `#rss-bar .inner ul li{border-right:1px dotted #b3b3b3}` |
| RSS 標題字 | `#333` | `#rss-bar .inner h5{color:#333}` |
| 語言切換框 | `#ddd` | `#wfp-lang ul{border:1px solid #ddd}` |
| 語言鍵漸層 | `#fff`(50%) → `#efebef`(51%) | `#wfp-lang ul li` |
| 語言鍵選中底 | `#CECFCE`，字 `#000` | `#wfp-lang ul li.on` |
| 語言鍵未選字 | `#666` | `#wfp-lang ul li a{color:#666}` |

### 2.5 首頁「我的無名」模組 `#wfp-my`（登入入口）

| 用途 | 色碼 | 出處 |
|---|---|---|
| 模組底 | `#F7F7F7` | `#wfp-my{background-color:#F7F7F7}` |
| 模組框（上右下左） | `#F0F0F0` / transparent / `#E5E5E5` / `#EAEAEA` | `#wfp-my{border-color:#F0F0F0 transparent #E5E5E5 #EAEAEA}` |
| 一般連結 | `#666` | `#wfp-my a{color:#666}` |
| 綠色強調連結 / hover | `#43883F` | `#wfp-my .hd p a{color:#43883F}`、`.my-services li a:hover{color:#43883f}` |
| 「會員登入」按鈕漸層 | `#FFF` → `#E7E7E7`，框 `#CECBCE`，字 `#333` | `#wfp-my .my-promotion li a` |
| 「會員登入」hover 漸層 | `#FFF` → `#D6D7D6`，字 `#43883f` | `.my-promotion li a:hover` |
| 頁尾條漸層 | `#e7e7e7` → `#f8f8f8` | `#wfp-my .ft` |
| 「我的」灰標籤漸層 | `#a5a5a5` → `#bfbfbf`，右框 `#b1b1b1` 2px | `#wfp-my .ft h2` |
| 服務清單三角箭頭 | `#B5B5B5`（外）/ `#F7F7F7`（內） | `.my-services li:before` / `:after` |
| 頂端小連結（登出等） | `#999`，右分隔 `#636563` | `#wfp-my .hd ul li` |

### 2.6 社群分享列（`chrome_sharing.css`）

| 用途 | 色碼 | 出處 |
|---|---|---|
| 分享鈕外框 / 底 | `#e3e3e3` / `#fff` | `.social-widget .bd a` |
| 分享鈕 hover 外框 / 底 | `#bfbfbf` / `#f8f8f8` | `.social-widget .bd a:hover` |
| 「發文」鈕文字 | `#666` | `.wretch-reblog .bd a.wretch{color:#666!important}` |
| 泡泡外框 | `#a3a0a1` | `.wretch-reblog .bd span.bubble` |
| 泡泡漸層 | `#ffffff` → `#f7eff7` | `.bubble-gradient` |

---

## 3. 尺寸

### 3.1 頂端工具列
- 高度 **30px**（`#kukubar-upper{height:30px}`），下邊框 1px → 佔位 31px。`position:static`，在 `<body>` 最上方正常流。
- 每個 `.bar-block` 高 30px、`line-height:30px`、右邊 1px 分隔線。
- logo：`h1 a` **73 × 28px**，`margin:0 5px`，背景 `ico_wretch_logo_24.png`（實際圖 **75×20**）置中不重覆；IE6 fallback 用 `ico_wretch_logo.png`（**72×20**）。
- 服務名稱 `a.current-service` 與展開箭頭 `span`：`margin:0 8px`，`display:inline-block`。
- 展開箭頭 `span.bar-block-btn`：**13 × 13px**，`margin:-2px 8px 0 0`。
- 服務下拉 `#wretch-service ul`：`top:28px`，IE `*width:88px`，項目 `a{padding:8px 5px;line-height:1}`。
- `#infozone`（今日主題跑馬）：**200 × 30px**，`margin-left:8px`，`overflow:hidden`，`li{line-height:30px}`。→ 2013 改成 **350px**。
- 搜尋列 `form`：高 **18px**，圓角 **5px**，`margin:5px 0 0 8px`，1px 框。
  - `fieldset` 高 18px、`line-height:18px`。
  - `legend` `margin-top:2px;margin-left:5px`，右側箭頭 `span` 寬 10px（`ico_search_arrow.png` **5×4**，`right 5px`）。
  - 服務清單 `.service-list`：`position:absolute;top:26px;width:200px`，圓角 5px，1px `#CBCBCB` 框。
  - 文字框 `input#wretch-search-text` 高 16px、`line-height:18px`、`font-size:12px`、左右 1px 框。
  - 送出鈕 `#wretch-search-btn` **29 × 18px**，背景 `ico_search.png`（**13×14**）置中。
- 登入區 `#wretch-login`：`ul.dropdown{position:absolute;top:30px;right:0}`，IE `*width:65px`，項目 `a{padding:8px 5px}`。
- 通知鈴鐺 `#wretch-notice a.notice-list span`：**35 × 30px**（圖 `ico_noti.png` **12×12** 置中）。
- 通知浮層 `#wretch-notice div.dropdown`：**寬 270px**，`position:absolute;top:30px;right:-1px`，1px `#BCBCBC` 框。
  - 標題列 `.notice-heading` 高 **22px** + `padding:4px 0`，`h4` 左色條 5px、`margin:5px 0 5px 8px`、`padding-left:5px`。
  - 條目 `li{padding:16px 10px}`（IE `4px 0`）；頭像 `img{width:30px;height:30px;margin:0 10px}`；`div.content{width:180px}`。
- 右上 `#cam`（Yahoo! 連結）：`padding:0 8px 0 25px`，高 30px，背景 `ico_sprite.png` 位移 `5px -154px`（藍色小房子圖示）。

### 3.2 底部工具列
- 高度 **25px**，`position:fixed;left:0;bottom:0;width:100%`，上邊框 1px。
  IE6 改為 `position:absolute;right:17px`。
- 收合動畫：`transition:all 0.2s ease`；收合時 `.hidden-footer{bottom:-25px}`。
- `.bar-block` 高 25px、`line-height:25px`。
- 「我有建議」`#footer-feedback a`：**100 × 25px**，圖 `suggestion.png` / hover `suggestion_hover.png`（皆 **100×25**）。
- 「分類好文」按鈕：`padding-left:25px`，高 25px，左側 `ico_subscription.png`（**13×16**）在 `5px center`。
  展開箭頭 `span`：**13 × 13px**，`margin:-2px 8px 0 8px`。
- 好友動態按鈕 `#footer-vitality a`：`padding-left:25px`，左側 `ico_wretch_vitality.png`（**12×12**）在 `5px center`。
- 一般浮層 `#kukubar-lower div.dropdown`：**寬 270px**，`position:absolute;bottom:25px;left:0`，1px `#BCBCBC` 框。
  - 好友動態浮層另外 `left:100px`。
  - 條目 `li.vitality-event{padding:8px 10px}`；頭像 30×30、`margin:10px`；`div.content{width:185px}`；私密鎖頭 `span.vitality-private` **21 × 16px**（`lock.gif` **21×16**）。
- 訂閱面板 `#scrb-panel`：**寬 478px**（未訂閱狀態）；
  - `.hd ul{width:370px;padding-left:10px}`，分類標籤 `li{width:65px;padding:5px;margin:5px;border-radius:2px}`。
  - 關閉鈕 `span.close-panel` **14 × 14px**（`ico_close.png` **14×13**），`right:10px;top:5px`。
  - 已訂閱狀態 `.after-subscribe`：左欄 `.hd{width:115px;height:386px}`，右欄 `.bd{width:362px;padding-bottom:30px}`；左欄項目 `li{width:105px;padding:10px 0 10px 10px}`，選中 `width:114px`。
  - 文章列：類型欄 `span.article-type{width:55px;padding:10px}`；頭像 30×30；時間 `span.article-time{position:absolute;right:10px;bottom:10px}`。
- 跑馬燈 `#text-carousel`：**240 × 25px**，`padding-right:5px`，`li{height:25px;line-height:25px}`。
- 服務圖示 `ul#footer-ugc-compose`：`margin-right:35px`（讓開開關鈕），`li em{width:26px}` 高 25px。
  子選單 `ul.dropdown{position:absolute;bottom:25px;width:60px}`，`li a{padding:5px 5px}`。
- 開關鈕 `#footer-switch`：**35 × 25px**，`position:fixed;right:0;bottom:0`；圖 `ico_footer_close.png` / `ico_footer_open.png`（皆 **11×7**）置中。
- `<body>` 補償：`html, html body, html body #hugewrapper{padding:0 0 13px 0!important}`（2012）；2013 改成 `padding:0`。

### 3.3 首頁頁首 / 導覽 / 頁尾
- 版心 `#wrapper`：**寬 970px**，`margin:0 auto`，`padding-bottom:20px`。
- `#wfp-universal-header`：**寬 950px** + `padding:0 10px 15px`（＝總 970px），背景 `bg_hd_trans.png`（**968×121**）`no-repeat 1px 0`。
- 頁首上排 `.hd`：高 **34px**；右側 `ul{margin-top:9px}`；連結 `padding:0 9px;font-size:85%`；
  `li.yahoo-home a{padding-left:22px}` 帶 sprite `0 -160px`（小房子）。
- logo `h1.logo a`：**130 × 36px**，`position:absolute;left:0;margin-top:-2px` → 圖 `logo_wretch.png` 實際 **130×36**。
- 搜尋 `div.search`：`float:right;width:56.8%;margin-left:40px;padding:3px`。
  - 輸入框 `width:72.6%;height:24px;padding-left:20px`，sprite 放大鏡 `-235px -43px`。
  - 按鈕 **122 × 24px**，`padding:2px 20px 3px`，圓角 **2px**。
- `#wfp-navigation`：**970 × 37px**（IE `*height:38px`），`margin-bottom:1px`；
  `ul{padding:0 10px}` + `bg_hd_trans.png` `0 -84px`；
  `li` 右側 `line_nav_border.png`（**2×36**）；
  `li a{font-size:116%;line-height:2.4;padding:0 20px 0 50px}`；
  各服務圖示 sprite 位移：blog `21px 9px`(padding-left 48)、album `-141px 11px`(50)、video `-296px 9px`(49)、join `-462px 10px`(50)、digu `-618px 11px`(49)、mobile `-781px 9px`(40)。
  `li.new span`：**寬 23px**，sprite `-160px -60px`（粉紅 NEW 標）。
- `#wfp-footer`：**寬 970px**，`margin-top:10px;padding-top:14px`，上邊框 1px，`line-height:1.8;font-size:93%`。
  - `ul.nav li{display:inline;padding-left:12px;padding-right:5px}`，方點 `:before{border-width:1px;top:7px;left:0}`。
  - `#wfp-lang{position:absolute;top:13px;right:14px}`，`ul{height:17px;border-radius:2px}`，`li{padding:0 7px;height:17px}`。
  - `#rss-bar{padding-bottom:5px;margin-bottom:10px}`，`.inner{width:500px}`，`li{padding:0 10px}`，`h5{padding-left:15px}` 帶 `ico_rss.png`（**12×12**）。
- `#wfp-my`：**299 × 123px**，`font-size:93%`，左/上/下 1px 邊框（右無框）。
  - `.hd{padding:10px 10px 7px}`；`.bd{padding:0 15px 2px 10px}`。
  - 「會員登入」`li{width:83px}`、`a{height:36px;line-height:2.4em;font-size:123.1%;font-weight:bold;border-radius:3px}`。
  - 大頭照 `.my-coverPic a{width:70px;height:70px}`，外框 `padding:3px`，圓角 3px，`rotate(-3deg)`，陰影 `rgba(0,0,0,0.4) 1px 1px 5px`。
  - `.ft{height:30px}`；`h2{width:50px;line-height:30px}`；`.my-services{width:220px;padding:5px 0 5px 5px}`；`li{font-size:108%;line-height:1.7;padding:0 20px 0 15px}`。

### 3.4 社群分享列
- `.social-wrapper{height:32px;margin-bottom:5px}`
- `.social-widget{height:30px}`；每個分享鈕 `a{width:30px;height:28px;border:1px solid #e3e3e3;background-position:7px 6px;margin-left:-1px}`；第一顆 `border-radius:3px 0 0 3px`。
- 「發文」鈕 `a.wretch{height:28px;line-height:28px;padding-left:24px;font:12px arial;border-radius:0 3px 3px 0}`，圖示 `7px 8px`。
- 知識+ `.kplizer{width:82px}`，`a.kplizer-btn{width:82px;height:27px}`。

---

## 4. 字型與字級

- **kukubar 全域**：`.kukubar-bar{font-family:Arial;letter-spacing:0px;text-align:left!important;cursor:text}`
  - `#kukubar-upper{font-size:12px;font-weight:400!important}`；`#kukubar-lower{font-size:12px;font-weight:400!important}`
  - 所有 `a{font-size:12px;font-weight:400!important}`；`a:hover{font-size:12px!important;text-decoration:underline}`
  - `h5,h6{font-size:12px!important}`；`p{font-size:12px}`
  - 下拉項目 `.dropdown li a{font-size:12px!important}`
  - 通知/動態內文 `div.content{line-height:1.231}`；`div.content *{line-height:1}`
  - `.notice-heading h4{line-height:1.231;font-weight:400;font-size:12px}`
  - `#scrb-panel .hd ul li{line-height:1}`；`.bd h5 em{line-height:25px;font-style:normal;font-weight:400}`
  - 搜尋輸入框 `font-size:12px`；`.search-field input{font-size:10px}`（僅套用在其他 input）
- **首頁（index3）**：base 來自 YUI 3.2.0 `cssfonts/fonts-min.css` →
  `body{font:13px/1.231 arial,helvetica,clean,sans-serif}`；`select,input,button,textarea{font:99% arial,helvetica,clean,sans-serif}`
  - `#wfp-footer{font-size:93%}` ≈ 12px，`line-height:1.8`
  - 頁首右上小連結 `font-size:85%` ≈ 11px
  - 導覽列 `font-size:116%` ≈ 15px，`line-height:2.4`
  - `#wfp-my{font-size:93%}`；`.my-services li{font-size:108%}`；`.my-promotion li a{font-size:123.1%;font-weight:bold}`
  - 首頁 CSS 內唯一出現的 font-family 是 `verdana,arial,helvetica,clean,sans-serif`（局部使用）
- **Yahoo 登入頁頁尾**：`#mem_ft{font-size:10px;font-family:arial,helvetica,clean,sans-serif;text-align:center}`

---

## 5. DOM 結構

### 5.1 頂端工具列 `#kukubar-upper`（**未登入**，2012-08-17 網誌頁逐字）【驗】

```
body
└ div#hugewrapper
  ├ input#wretch-crumb[type=hidden][value="&.c=…&.t=…"]
  ├ input#static-path[type=hidden][value="http://l.yimg.com/e/serv/common/"]
  ├ link[rel=stylesheet][href=".../common/css/kukubar.css?201207262"]
  ├ style  →  .kukubar-customized{ 白→#EEEDDD 漸層 }
  ├ div#kukubar-upper.font-black.kukubar-customized.kukubar-bar
  │ ├ div.left-side
  │ │ ├ div#wretch-logo.bar-block.bar-block-click
  │ │ │ └ h1 > a.bar-link[tabindex=1][href=".../kk/u/haha/logo/*http://www.wretch.cc/"]  「無名小站」
  │ │ ├ div#wretch-service.bar-block.bar-block-click
  │ │ │ ├ a.current-service.bar-link.theme[tabindex=2][href=".../kk/u/haha/B_FP/*http://www.wretch.cc/blog"]  「Blog」
  │ │ │ ├ span.bar-block-btn[tabindex=3]  「展開」
  │ │ │ └ ul.dropdown.blog-service
  │ │ │   ├ li.album-index > a.bar-link  「Album」
  │ │ │   ├ li.blog-index  > a.bar-link  「Blog」   ← 目前服務會被 CSS display:none
  │ │ │   ├ li.video-index > a.bar-link  「Video」
  │ │ │   ├ li.digu-index  > a.bar-link  「Digu」
  │ │ │   ├ li.join-index  > a.bar-link  「Join」
  │ │ │   ├ li            > a.bar-link  「Yahoo!」
  │ │ │   ├ li            > a.bar-link  「Help」
  │ │ │   └ li            > a.bar-link  「Premium」
  │ │ └ div#infozone
  │ │   └ ul > li × N > a.theme  「今日主題：…」
  │ └ div.right-side
  │   ├ div#wretch-search.bar-block
  │   │ └ form[method=get][action="http://tw.blog.search.yahoo.com/search"][name=searchForm]
  │   │   └ fieldset
  │   │     ├ legend  「Article」 + span「選擇服務」
  │   │     ├ div.service-list.dropdown
  │   │     │ ├ input#srch-blog[type=radio][name=type][value=article][checked][data=checked]
  │   │     │ ├ label[for=srch-blog][_target="Article Search"]  「Article」
  │   │     │ ├ input#srch-album[type=radio][name=type][value=photo][data=false]
  │   │     │ ├ label[for=srch-album][_target="Album Search"]  「Album」
  │   │     │ ├ input#srch-video[type=radio][name=type][value=video][data=false]
  │   │     │ └ label[for=srch-video][_target="Video Search"]  「Video」
  │   │     └ div.search-field
  │   │       ├ label.hidden[for=wretch-search-text]  「搜尋」
  │   │       ├ input#wretch-search-text.blur[type=text][name=p][title="Article Search"][value="Article Search"]
  │   │       ├ input[type=hidden][name=provider][value=wretch]
  │   │       ├ input[type=hidden][name=fr][value=cb-wretch]
  │   │       └ input#wretch-search-btn[type=submit][value="送出"]
  │   ├ div#wretch-login.bar-block.bar-block-click.bar-link.no-hover
  │   │ └ ul.login-links
  │   │   ├ li.link-item.first > a.bar-link.theme[href=".../kk/u/haha/login/*http://www.wretch.cc/IDintegration/?ref=…"]  「Login」
  │   │   └ li.link-item       > a.bar-link.theme[href=".../kk/u/haha/activate/*http://www.wretch.cc/IDintegration/"]      「Register」
  │   └ div#cam
  │     └ a.theme[href=".../index/head/yahoo/*http://tw.yahoo.com"]  「Yahoo!」
  └ div#bigcontainer[style="position: relative !important; zoom:1 !important;"]
    └ …（各服務自己的版面）
```

### 5.2 底部工具列 `#kukubar-lower`（**未登入**，逐字）【驗】

```
（在 #hugewrapper 之後、</body> 之前）
div#kukubar-lower.kukubar-bar
├ div.login-request.dropdown              ← 未登入時點「分類好文」/「好友動態」跳出的小浮層
│ ├ div.login-btn
│ │ └ a.footer-ok-btn[href=".../kk/u/PF/V_C/login/*http://www.wretch.cc/IDintegration/?ref=…"]  「登入」
│ └ div.login-msg.login-msg-subscription  「登入無名小站瀏覽分類好文」
├ div.left-side
│ ├ div#footer-feedback.bar-block
│ │ └ a[href="https://help.cc.tw.yahoo.com/feedback.html?id=7154"][target=_blank]  「我有建議」（文字被圖片蓋掉）
│ └ div#footer-subscription.bar-block.bar-block-click
│   ├ a.footer-subscription-btn[href="#"]  「分類好文」 + span.bar-block-btn「展開」
│   └ div#scrb-panel.dropdown
│     ├ div.hd.panel-block   （空，JS 填）
│     └ div.bd.panel-block   （空，JS 填）
└ div.right-side
  ├ div#text-carousel
  │ └ ul > li × 6 > a  「首頁好文：…」
  └ ul#footer-ugc-compose
    ├ li.bar-block.bar-block-click.blog-service > em「網誌」
    │ └ ul.dropdown
    │   ├ li      > a.bar-link  「Post Article」   → /blog/post.php?blog_id=
    │   ├ li      > a.bar-link  「Blog Style」     → /admin/style/?func=template_new&source=B
    │   └ li.last > a.bar-link  「Blog Setting」   → /admin/blog/
    ├ li.bar-block.bar-block-click.album-service > em「相簿」
    │ └ ul.dropdown
    │   ├ li      > a.bar-link  「Upload Photo」   → /album/yuiuploader.php
    │   ├ li      > a.bar-link  「Album Style」    → /admin/style/?func=template_new&source=A
    │   └ li.last > a.bar-link  「Album Setting」  → /admin/album/
    └ li.bar-block.bar-block-click.video-service > em「影音」
      └ ul.dropdown
        ├ li      > a.bar-link  「Upload Video」   → /video/yuiuploader.php
        ├ li      > a.bar-link  「Video Style」    → /admin/style/?func=template_new&source=V
        └ li.last > a.bar-link  「Video Setting」  → /video/_manage/?func=set

div#footer-switch
└ button  「關閉工具列」（text-indent:-9999px，只看到圖示）

script[src="http://yui.yahooapis.com/3.4.0/build/yui/yui-min.js"]
script[src=".../common/js/kukubar.js?201207262"]
link[rel=stylesheet][href=".../common/css/promotion.css"]
script[src=".../common/js/promotion.js"]
```

### 5.3 **登入後**的差異【推】（依 `chrome_kukubar.css` / `chrome_kukubar.js` 的選擇器與邏輯反推，未取得原始 HTML）

- `#wretch-login` 由 `ul.login-links` 換成：暱稱文字 + `span.bar-block-btn-login`（展開箭頭，13×13）+ `ul.dropdown`（絕對定位 `top:30px;right:0`，白底、1px `#BBBBBB` 框、`border-top:none`、項目 `li{border-bottom:1px solid #DDDDDD}`、hover `#D3ECF6`）。
  → CSS 有 `#wretch-login span{margin:0 8px}`、`#wretch-login ul.dropdown li a{padding:8px 5px;display:block}`，
    以及 `#wretch-login:hover{background:#636363}`（font-white 主題）→ 登出狀態才會加 `.no-hover` 關掉這個 hover。
- 右側新增 `div#wretch-notice.bar-block.bar-block-click`（通知鈴鐺）：
  ```
  div#wretch-notice.bar-block.bar-block-click[.unread][.updated][.expanded-btn]
  ├ a.notice-list > span            ← 35×30，ico_noti.png / .unread→ico_noti_new.png / .expanded-btn→ico_noti_clicked.png
  └ div.dropdown                    ← 270px
    ├ (div|h4 包在) .notice-heading > h4 [+ a] [+ span]
    └ ul                            ← 由 /ajax/common/ajax_get_notifications.php 回傳的 innerHTML 直接填入
      └ li[_href="…"]
        ├ a > img (30×30 頭像)
        └ div.content > p … a … 
  ```
- 底列新增 `div#footer-vitality.bar-block.bar-block-click`（好友動態）：
  ```
  div#footer-vitality[.new-msg]
  ├ a.footer-vitality-btn > (文字) + span   ← 左側 ico_wretch_vitality.png
  └ div.dropdown                            ← 270px，left:100px
    ├ div.vitality-heading > h4 + a         ← 深灰底、黃色左條、右上「看更多」類連結
    └ ul.vitality-list
      └ li.vitality-event[.unread][.hover-on]
        ├ a > img (30×30)
        └ div.content
          ├ p …
          ├ span.time
          └ span.vitality-private           ← 21×16 lock.gif（私密內容才有）
  ```
  資料來源 `/ajax/common/ajax_get_vitality_updates.php`；未讀輪詢 `/ajax/common/ajax_has_new_vitality.php`（回 JSON `{result:true}` 就加 `.new-msg`）。
- 底列另有 `div#footer-fb`（Facebook）：`a.footer-fb-btn`（左側 `ico_fb.png` 14×14）+ 一個 `iframe`（`display:none`，`.expanded` 時顯示，絕對定位 `bottom:25px;left:0`）。
  → 2012/2013 的未登入快照裡都沒有這個節點，只有 CSS 存在。
- 未登入時 `#footer-vitality` / `#footer-subscription` 被點 → JS `requestToLogIn()` 把 `.login-request` 浮層移到按鈕的 X 座標，並依按鈕加上 `.vitality` 或 `.subscription` class，切換要顯示哪一句提示（見第 6 節）。

### 5.4 首頁頁首 / 導覽 / 頁尾（2012-12-12 逐字）【驗】

```
body
└ div#bg-wrapper
  └ div#wrapper.clearfix
    ├ div.hd#uh-wrapper
    │ ├ div#wfp-universal-header
    │ │ └ header
    │ │   ├ div.hd
    │ │   │ ├ ul > li > a[target=_blank][style="position:absolute;top:10px;left:45%;…color:#8080BF;"]   ← campaign 文字連結
    │ │   │ └ ul.nav
    │ │   │   ├ li.yahoo-home    > a  「Yahoo!奇摩」
    │ │   │   └ li.service-guide > a  「服務說明」
    │ │   └ div.bd
    │ │     ├ h1.logo > a[href="http://www.wretch.cc/"][title="無名小站"] > img[src=".../index3/img/logo_wretch.png"][alt="無名小站"]
    │ │     └ div.search > form[action="http://tw.blog.search.yahoo.com/search"][method=GET]
    │ │       ├ input[type=hidden][name=fr][value=cb-wretch]
    │ │       ├ input[type=hidden][name=type][value=web]
    │ │       ├ input[type=hidden][name=provider][value=wretch]
    │ │       └ fieldset
    │ │         ├ legend  「Yahoo! Search」
    │ │         ├ label[for=search-input]  「搜尋：」
    │ │         ├ input#search-input[type=text][name=p][placeholder="搜尋"][autocomplete=off]
    │ │         └ button[type=submit][value="搜尋網頁"]  「搜尋網頁」
    │ └ div#wfp-navigation
    │   ├ nav.blog-nav > ul
    │   │ ├ li.blog.first  > a  「網誌」  → /blog/
    │   │ ├ li.album       > a  「相簿」  → /album/
    │   │ ├ li.video       > a  「影音」  → /video/
    │   │ ├ li.join        > a  「揪團」  → /join/
    │   │ └ li.digu.last   > a  「嘀咕」  → /digu/
    │   └ div#nav-corner-ad
    ├ div#push-down-ad
    ├ div.bd.big-bd.clearfix
    │ ├ div.main   …（各模組）
    │ └ div.side   …（含 div#wfp-my、div#wfp-announcement）
    └ div.ft
      └ div#wfp-footer
        ├ div#wfp-lang > ul
        │ ├ li.on > a.zh-tw  「中文」
        │ └ li    > a.en     「English」
        ├ footer
        │ ├ nav > ul.nav  （7 個連結，見第 6 節）
        │ ├ div#rss-bar > div.inner > h5「RSS:」 + ul（5 個連結）
        │ ├ p > span > a「著作權侵權」 + 「本站設有管理員並依台灣網站內容分級規定處理」
        │ └ p  「雅虎資訊 版權所有 © 2012 Yahoo! Taiwan All Rights Reserved.」
        ├ input#global-crumb[type=hidden]
        ├ input#today-date[type=hidden][value="2012-12-12"]
        └ input#anchor[type=hidden][value=""]
```

### 5.5 首頁「我的無名」`#wfp-my`（未登入，逐字）【驗】

```
div#wfp-my
└ div.wfp-my
  ├ div.my-setting
  │ └ div#wfp-bgm
  │   ├ div.tooltip
  │   │ ├ p.status  「背景音樂設定開啓」
  │   │ └ p.tip     「點選圖示關閉」
  │   └ a.bgm-on > img[src=".../index3/img/ico_fp_musicon.png"]
  ├ div.hd
  │ └ p  「您還沒登入喔」
  ├ div.bd
  │ ├ ul.my-promotion > li > a.skin-main-link-hover  「會員登入」  → /IDintegration/?ref=%2525252F
  │ ├ h3.block-title  「個人服務」（CSS display:none）
  │ ├ div.my-messages
  │ │ ├ p > a.skin-main-link[target=_blank]（空）
  │ │ └ ul
  │ │   ├ li.join-vip > a  「加入VIP」   → http://bill.wretch.cc/order.php
  │ │   └ li.join-in  > a  「加入會員」  → /IDintegration/?ref=%2525252F
  │ └ h3.block-title  「個人設定」（CSS display:none）
  └ div.ft
    ├ h2  「我的」 + i
    ├ ul.my-services.ft-service4   ← 9 個 li（見文案）
    ├ ul.my-services.ft-service8   ← 同樣 9 個（展開時才顯示，預設 display:none）
    └ span  「my」（text-indent:-9999px，其實是 ▼ 展開箭頭 sprite）
```

---

## 6. 逐字中文/英文文案

### 6.1 頂端工具列（2012）
| 位置 | 文案 |
|---|---|
| logo 連結文字（被圖蓋掉） | `無名小站` |
| 目前服務（依頁面而異） | `Blog` / `Album` / `Video` / `Digu` / `Join` |
| 展開箭頭（text-indent 隱藏） | `展開` |
| 服務下拉 | `Album`、`Blog`、`Video`、`Digu`、`Join`、`Yahoo!`、`Help`、`Premium` |
| 跑馬連結 | `今日主題：無名塗鴉秀  鬼畫連篇…`、`今日主題：一日小旅行  輕便玩耍去`（範例，每日更換；前綴固定為「今日主題：」） |
| 搜尋 legend | `Article` + `選擇服務` |
| 搜尋服務選項 | `Article` / `Album` / `Video`（`_target` 屬性分別為 `Article Search` / `Album Search` / `Video Search`） |
| 搜尋輸入框隱藏 label | `搜尋` |
| 搜尋輸入框預設值 | `Article Search`（切換服務後改成該服務的 `_target`） |
| 送出鈕 value | `送出` |
| 未登入右側 | `Login` ／ `Register` |
| 最右 | `Yahoo!` |

### 6.2 底部工具列（2012）
| 位置 | 文案 |
|---|---|
| 我有建議（圖片鈕，alt 文字） | `我有建議` |
| 分類好文按鈕 | `分類好文` + `展開` |
| 未登入浮層按鈕 | `登入` |
| 未登入浮層提示（訂閱） | `登入無名小站瀏覽分類好文` |
| 未登入浮層提示（好友動態，class `login-msg-vitality`） | **查無**（未登入快照裡只輸出 subscription 那一句；CSS 有 `.login-msg-vitality` 但頁面沒印出文字） |
| 跑馬燈 | `首頁好文：清涼趁現在！夏日私服小穿搭` …（前綴固定為「首頁好文：」） |
| 服務圖示（text-indent 隱藏） | `網誌` / `相簿` / `影音` |
| 網誌子選單 | `Post Article` / `Blog Style` / `Blog Setting` |
| 相簿子選單 | `Upload Photo` / `Album Style` / `Album Setting` |
| 影音子選單 | `Upload Video` / `Video Style` / `Video Setting` |
| 開關鈕 | `關閉工具列` |

### 6.3 kukubar.js 內建字串（全部逐字）【驗】
| 用途 | 文案 |
|---|---|
| 載入中 | `載入中` |
| 儲存中 | `正在儲存設定` |
| 儲存完成 | `設定已儲存` |
| Ajax 失敗 alert | `喔喔！系統出現錯誤，請稍後再試！` |
| 訂閱面板標題（未訂閱） | `請選擇你有興趣的分類` |
| 訂閱面板副標 | `選擇你有興趣的分類，無名將每天提供你最新的優質內容！` |
| 訂閱送出鈕 | `我要訂閱` |
| 已訂閱後標題 | `最新分類好文` |
| 已訂閱後左欄「加更多」 | `訂閱更多分類` / `訂閱其他分類` |
| 取消訂閱連結 | `取消訂閱這個分類` |
| 文章清單標題 | `精選文章` |
| 關閉鈕 title | `關閉` |
| 搜尋相關（註解掉的舊碼） | `搜尋` + `關鍵字`、`選擇服務` |

### 6.4 首頁頁首 / 導覽 / 頁尾（2012-12-12）
- 頁首右上：`Yahoo!奇摩`、`服務說明`
- logo `title`/`alt`：`無名小站`
- 搜尋：`Yahoo! Search`（legend）、`搜尋：`（label）、`搜尋`（placeholder）、`搜尋網頁`（按鈕）
- 導覽列：`網誌`、`相簿`、`影音`、`揪團`、`嘀咕`
- 頁尾語言：`中文`、`English`
- **頁尾連結（逐字，按順序）**：
  1. `新首頁介紹` → `http://promo.wretch.cc/wretch_2010_tutorial/`
  2. `服務條款` → `http://tw.info.yahoo.com/legal/utos.html`
  3. `隱私權政策` → `http://info.yahoo.com/privacy/tw/yahoo/`
  4. `新聞中心` → `http://www.wretch.cc/blog/press&list=1`
  5. `聯絡我們` → `http://tw.help.cc.yahoo.com/?product=wretch`　（2013 改成 `http://help.yahoo.com/kb/index?page=product&y=PROD_WRETCH&locale=zh_TW`）
  6. `網路行銷` → `http://tw.marketing.campaign.yahoo.net/emarketing/`
  7. `招賢納士` → `http://tw.info.yahoo.com/careers`
  （全部都包在 `http://tw.rd.yahoo.com/referurl/wretch/index/f/<key>/*` 追蹤前綴後面，key 依序為 intro/tos/pri/press/contact/mkt/hire）
- **RSS 條**：標題 `RSS:`，連結依序 `今日主題`、`熱門相簿`、`熱門內容`、`名家專欄`、`熱門文章`
  （`/index/rss_cover_story.php`、`rss_featured_photo.php`、`rss_hybrid_ugc.php`、`rss_celebrity.php`、`rss_top1000article.php`）
- **版權兩行**：
  1. `著作權侵權`（連結，→ `http://tw.info.yahoo.com/copyright/`）＋ `本站設有管理員並依台灣網站內容分級規定處理`
  2. `雅虎資訊 版權所有 © 2012 Yahoo! Taiwan All Rights Reserved.`
     ※【驗】2013-12-01 的快照裡這一行**仍然寫 2012**，沒有更新。

### 6.5 首頁「我的無名」模組（未登入）
- 空狀態標題：`您還沒登入喔`
- 主按鈕：`會員登入`
- 隱藏小標：`個人服務`、`個人設定`
- 右側連結：`加入VIP`、`加入會員`
- 底部服務列（`我的` + 9 項）：`網誌`、`相簿`、`影音`、`揪團`、`嘀咕`、`好友`、`留言`、`名片`、`加入VIP`
- 背景音樂 tooltip：`背景音樂設定開啓` / `背景音樂設定關閉` / `點選圖示開啟` / `點選圖示關閉`

### 6.6 2013 唯讀公告（2013-12-26 快照）【驗】
`#infozone` 內多一行：
```html
<p class="announcement"><a href="http://www.wretch.cc/blog/WretchFAQ/13637135">無名小站已進入全站唯讀模式，12/26服務終止</a></p>
```
CSS（`kukubar.css?20130903`）：`#kukubar-upper #infozone .announcement{line-height:30px;margin:0}`、`.announcement a{color:#e00}`，同時 `#infozone ul{display:none}`（今日主題跑馬被關掉）。

### 6.7 社群分享列（每篇文章下方）
- `分享在我的Facebook`（`a.fb`，title 與文字相同）
- `分享在我的Plurk`（`a.plurk`）
- `分享在我的即時通`（`a.yim`，`href="ymsgr:customstatus?…"`）
- `發文`（`a.wretch`，→ `/blog/post.php?rtype=article&…`）

---

## 7. 登入 / 註冊

### 7.1 入口與轉址鏈【驗】
```
工具列 Login   → http://tw.rd.yahoo.com/referurl/wretch/kk/u/haha/login/*http://www.wretch.cc/IDintegration/?ref=<雙重 urlencode 的回跳路徑>
工具列 Register→ http://tw.rd.yahoo.com/referurl/wretch/kk/u/haha/activate/*http://www.wretch.cc/IDintegration/
底列 登入      → http://tw.rd.yahoo.com/referurl/wretch/kk/u/PF/V_C/login/*http://www.wretch.cc/IDintegration/?ref=<同上>
首頁 會員登入  → http://tw.rd.yahoo.com/referurl/wretch/index/turf/login/*http://www.wretch.cc/IDintegration/?ref=%2525252F
首頁 我的○○  → http://www.wretch.cc/IDintegration/?refdest=/blog/  等等

http://www.wretch.cc/IDintegration/            （HTTP 302）
   ↓ Location:
https://login.yahoo.com/config/login?.intl=tw&.partner=&.last=&.src=wrtch&.scrumb=0
        &.pd=c%3D…&pkg=&stepid=i
        &.done=https://login.yahoo.com/config/validate?.src=wrtch&.pc=1164&.scrumb=0
               &.done=http://www.wretch.cc/IDintegration/?ref=/
```
`ref` 參數是**四重 urlencode** 的（例：`%2525252Fblog%2525252F%2525252520AndreaCorlen` → `/blog/%20AndreaCorlen`）。

### 7.2 登入頁（＝ Yahoo!奇摩登入頁，`.src=wrtch`）逐字表單【驗】
檔案：`assets_src2/html/chrome_yahoo_login_20110623.html`，`<title>登入 - Yahoo!奇摩</title>`

版面：`#hdBg > #mem_hd`（Yahoo 頁首）／`#mainBox > #loginHolder`（`#leftContent` 廣告文案 + `#loginBox`）／`#footer > #mem_ft`。

```
div#loginBox > div#yreglg > div.top.yregbx > div.yregbxi
├ div#ylbpix
├ div#yregdsilu
│ ├ h3   「從未申請過 Yahoo! 奇摩帳號？」
│ ├ a#signUpBtn.primaryCta[tabindex=1][href="https://edit.yahoo.com/config/eval_register?.intl=tw&…&.src=wrtch&…"]
│ │        「建立新帳戶」
│ └ div#idp
│   ├ div.center > span.lthru + span.or「或者」 + span.lthru
│   └ div#idpBtns
│     ├ p        「登入時使用﹕」
│     ├ div#fBtn > a#fBtnLnk.secondaryCta[target=_blank]  「Facebook」
│     └ div#gBtn > a#gBtnLnk.secondaryCta[target=_blank]  「Google」
└ div#yregmain
  ├ h2  「登入Yahoo!奇摩」
  └ fieldset#fsLogin.clear
    ├ legend  「Login Form」
    └ form[method=post][action="https://login.yahoo.com/config/login?"][name=login_form][onsubmit="return hash2(this)"]
      ├ 15 個 hidden：.tries=1 / .src=wrtch / .md5 / .hash / .js / .last / promo /
      │              .intl=tw / .bypass / .partner / .u / .v=0 / .challenge / .yplus /
      │              .emailCode / pkg / stepid=i / .ev / hasMsgr=0 / .chkP=Y / .done / .pd
      ├ input#pad[type=hidden][name=pad][value=1]
      ├ input#aad[type=hidden][name=aad][value=1]
      ├ div#inputs
      │ ├ label[for=username]  「Yahoo!奇摩帳號」
      │ ├ input#username[name=login][maxlength=96][tabindex=1]
      │ ├ p#ex  「(範例:free2rhyme@yahoo.com)」
      │ ├ label[for=passwd]  「密碼」
      │ └ input#passwd[name=passwd][type=password][maxlength=64][tabindex=2]
      ├ div#fun（空）
      ├ div#persistency
      │ ├ input#persistent[type=checkbox][name=.persistent][value=y][tabindex=4]
      │ └ p
      │   ├ label[for=persistent]  「保持我的登入狀態」
      │   └ span#uncheck  「(公用或共用電腦請勿勾選)」
      └ div#submit
        └ button#.save[type=submit][name=.save].secondaryCta[tabindex=5]  「登入」
```
其他文案：
- CAPS LOCK 提示浮層（`#fcue1`）：標題 `CAPS LOCK 鍵未關閉`，內文 `你的 Yahoo! 密碼須區分大小寫`
- 底部說明列 `#help`：`無法登入`（→ `edit.yahoo.com/config/eval_forgot_pw`）` | `` 登入說明`
- 左側行銷文案 `.lofb`：
  - h2 `Yahoo!奇摩 讓你生活在網路最中心`
  - h3 `想玩的 想看的 想分享的 輕輕鬆鬆一次搞定`
  - li `拍賣讓你想得到，就買得到` / `搜尋讓你想知道，立刻就搜到` / `手機上網讓天下事隨你走遍天下` / `無名小站讓你和朋友無時無刻在一起`
- 頁首：`Yahoo!奇摩`（`li.me1`）、`說明`（`li.me2`，`a#ygmahelp`）、logo `https://tw.yimg.com/i/tw/reg/purple/yklogo.gif`
- 頁尾：`雅虎資訊 版權所有 © 2011 Yahoo! Taiwan All Rights Reserved`
- 外部樣式：`https://s.yimg.com/lq/lib/uh/15/css/uh_slim_ssl-1.0.5.css`
- 按鈕 sprite：`https://s.yimg.com/lq/i/reg/login/loginsprite_2_18_2010.png`；FB/Google 圖示 `https://s.yimg.com/lq/i/reg/fb-goog.gif`
- 按鈕樣式：`#idpBtns .primaryCta{border:1px solid #f6b22b;background:#fbe26e url(loginsprite…) repeat-x 0 0}`；`.secondaryCta{border:1px solid #bdbdbd;background:#E5E6E1 url(loginsprite…) repeat-x 0 -90px}`；`#idpBtns a{padding:4px 12px 3px;font-weight:bold;color:#313131}`

### 7.3 註冊頁
【驗】無名**沒有**自己的註冊頁；`Register` 直接進 `/IDintegration/` → Yahoo 登入頁 → 按「建立新帳戶」→
`https://edit.yahoo.com/config/eval_register?.intl=tw&.pd=wrtch_ver%3D0…&new=1&.done=…&.src=wrtch&.v=0&.u=…&stepid=i`。
**查無**：這個繁中註冊頁在 Wayback 沒有存檔（只找到 2011-04-23 的英文版 `edit.yahoo.com/config/eval_register`，非 `.intl=tw`、非 `.src=wrtch`，我沒有採用，也不打算據此編造欄位）。
→ 復刻時建議把「註冊」做成與登入頁同版型的表單，文案沿用登入頁的 `建立新帳戶` 入口即可。

---

## 8. 素材清單（`assets_src2/img/chrome/`）

全部來源：`http://web.archive.org/web/2012id_/http://l.yimg.com/e/serv/common/img/<檔名>`（`idx3_` 開頭者來自 `.../index/index3/img/`）。
尺寸皆為 `file` 實測。

### 8.1 kukubar 素材（common/img）
| 檔名 | 尺寸 | 用途 | 抓到？ |
|---|---|---|---|
| `ico_wretch_logo_24.png` | 75 × 20 PNG RGBA | 頂列 logo（現代瀏覽器） | ✅ |
| `ico_wretch_logo.png` | 72 × 20 PNG 索引色 | 頂列 logo（IE6 fallback） | ✅ |
| `ico_not_expanded.png` | 13 × 13 | 下拉箭頭（收合） | ✅（2011 快照，2012 那筆是壞檔） |
| `ico_not_expanded_hover.png` | 13 × 13 | 下拉箭頭 hover；也用在訂閱面板 `a.add-sub` | ✅（20120607 快照） |
| `ico_expanded.png` | 13 × 13 | 下拉箭頭（展開中） | ✅ |
| `ico_search.png` | 13 × 14 | 頂列搜尋送出鈕 | ✅ |
| `ico_search_arrow.png` | 5 × 4 | 搜尋 legend 右側小三角 | ✅ |
| `ico_noti.png` | 12 × 12 RGBA | 通知鈴鐺（一般） | ✅ |
| `ico_noti_new.png` | 12 × 12 RGBA | 通知鈴鐺（有未讀） | ✅ |
| `ico_noti_clicked.png` | 12 × 12 RGBA | 通知鈴鐺（展開中） | ✅ |
| `ico_sprite.png` | 900 × 700 索引色 | 共用 sprite（`#cam` 用 `5px -154px` 的藍色小房子）；與 `index3/img/ico_sprite.png` **MD5 完全相同**（`0cad1f0237d05d47949ece0e068d9f55`） | ✅ |
| `suggestion.png` | 100 × 25 RGB | 底列「我有建議」按鈕（圖上有文字「我有建議」＋人像圖示） | ✅ |
| `suggestion_hover.png` | 100 × 25 RGB | 同上 hover | ✅ |
| `ico_subscription.png` | 13 × 16 | 底列「分類好文」圖示 | ✅ |
| `ico_wretch_vitality.png` | 12 × 12 | 底列「好友動態」圖示 | ✅ |
| `ico_fb.png` | 14 × 14 | 底列 Facebook 圖示 | ✅ |
| `ico_footer_blog.png` | 13 × 13 | 底列「網誌」服務圖示 | ✅ |
| `ico_footer_album.png` | 16 × 12 | 底列「相簿」服務圖示 | ✅ |
| `ico_footer_video.png` | 13 × 13 | 底列「影音」服務圖示 | ✅ |
| `ico_footer_close.png` | 11 × 7 | `#footer-switch` 關閉圖示 | ✅ |
| `ico_footer_open.png` | 11 × 7 | `#footer-switch` 展開圖示 | ✅ |
| `ico_close.png` | 14 × 13 | 訂閱面板關閉鈕 / 取消訂閱連結圖示 | ✅ |
| `ico_saved_msg.png` | 14 × 14 | 「設定已儲存」勾勾 | ✅ |
| `lock.gif` | 21 × 16 GIF89a | 好友動態「私密」鎖頭 | ✅ |
| `ico_loading.gif` | — | 「載入中」轉圈動畫 | ❌ **查無**（CDX 零筆） |
| `favicon.ico` | 16 × 16, 16 色 ICO | 全站 favicon（`l.yimg.com/e/serv/common/favicon.ico`） | ✅ |

### 8.2 社群分享列素材（common/img）
| 檔名 | 尺寸 | 用途 | 抓到？ |
|---|---|---|---|
| `ico_facebook.png` | 16 × 16 RGBA | 分享到 FB | ✅ |
| `ico_plurk.png` | 16 × 16 RGBA | 分享到 Plurk | ✅ |
| `ico_yim_png8.png` | 18 × 18 RGBA | 分享到即時通 | ✅ |
| `ico_wretch.png` | 12 × 12 RGBA | 「發文」鈕圖示 | ✅ |
| `ico_reblog_arrow.png` | 3 × 5 | 泡泡小箭頭（IE） | ✅ |
| `ico_kplizer.png` | 82 × 23 RGBA | 知識+ 按鈕 | ✅ |
| `ico_kplizer_hover.png` | 82 × 22 RGBA | 知識+ 按鈕 hover | ✅ |
| `hot.png` | 93 × 18 索引色 | 熱門文章標記（文章標題旁） | ✅ |

### 8.3 首頁頁首/導覽/頁尾素材（index3/img，檔名前綴 `idx3_`）
| 檔名 | 尺寸 | 用途 | 抓到？ |
|---|---|---|---|
| `logo_wretch.png` | **130 × 36** PNG RGBA | 首頁大 logo（綠白「無名小站」字樣） | ✅ |
| `logo_new.png` | **128 × 36** PNG 索引色 | 2014 版 logo（`common/img/logo_new.png`，關站後過渡頁用） | ✅ |
| `idx3_bg_hd_trans.png` | 968 × 121 RGBA | 頁首背景（淡藍天空＋雲＋兩隻小鳥）；`0 -84px` 那一段當導覽列的白色半透明覆蓋 | ✅ |
| `idx3_bg_nav_default.png` | 970 × 40 RGB | 綠色導覽列漸層底（左青綠→右黃綠），無 CSS 漸層時的 fallback | ✅ |
| `idx3_line_nav_border.png` | 2 × 36 RGBA | 導覽列項目之間的直線 | ✅ |
| `idx3_img_fp_outline.png` | 970 × 280 RGBA | `#wrapper` 外框裝飾 | ✅ |
| `idx3_ico_uh_search.png` | 12 × 12 | 頁首搜尋框放大鏡（另有 sprite 版本 `-235px -43px`） | ✅ |
| `idx3_ico_rss.png` | 12 × 12 | 頁尾 RSS 條圖示 | ✅ |
| `idx3_img_fp_button_s.png` | 1 × 17 RGB | 語言切換鍵漸層（無 CSS 漸層時） | ✅ |

### 8.4 `ico_sprite.png`（900×700）我實際看到的圖塊位置
（用來對照 CSS 的 `background-position`，座標為圖內像素）
- x≈0–20, y≈0–20：**網誌**圖示（一張紙/文章）
- x≈160–182, y≈0–20：**相簿**圖示（相機）
- x≈318–340, y≈0–20：**影音**圖示（黑圓＋播放三角）
- x≈475–500, y≈0–20：**揪團**圖示（喇叭）
- x≈640–660, y≈0–20：**嘀咕**圖示（對話泡泡）
- x≈798–815, y≈0–22：**行動版**圖示（手機）
- x≈0–20, y≈27–42：小圖表圖示
- y≈45–62：`TODAY'S TOPIC` 文字（白底/黑底兩款）＋放大鏡（x≈240–255）
- y≈68–88：Facebook `f`、Plurk `P`、上下箭頭、`NEW` 粉紅標（x≈160–182）
- y≈105–145：斜線紋條（x 0–265）＋便條紙（x≈300–355）＋灰色小按鈕（x≈380–430）
- x≈0–15, y≈160–176：**藍色小房子**（`#cam` 與頁首 `li.yahoo-home` 都用這個）
- x≈0–12, y≈195–215：▼ / ▲ 展開收合小箭頭（`#wfp-my .ft span` 用 `0 -186px` 與 `0 -208px`）
- x≈0–235, y≈395–690：拍立得相框大圖
- x≈280–360, y≈400–560：三組灰/白漸層按鈕底（`#wfp-my .my-promotion` 的 no-gradient fallback，`-280px -440px` / `-280px -521px`）

---

## 9. 互動行為

### 9.1 共用（`chrome_kukubar.js`，YUI 3，`use('node','node-event-simulate','io','event-hover','json')`）
- **前置條件**：頁面必須有 `#static-path`，否則整段 JS 直接 return。
  另需 `#wretch-crumb`（CSRF token）供所有 ajax 使用。
- **點擊委派**：所有 `.bar-block-click` 綁 `click`。
  - 點到 `.bar-link` → `e.halt()` 後 `location.href = 該 a 的 href`（所以整塊都可點）。
  - 點到有 `__href` / `_href` 屬性的元素、或 `.content` / `.contentp`（浮層條目內文）→ 導到 `li` 的 `_href`。
  - 點到 `img` → 導到最近的祖先 `a` 的 href。
- **開合**：`closeAllMenu()` 先移除全部 `.expanded` / `.expanded-btn`，再 `openMenu(eT)` 給該區塊內的 `.dropdown` 加 `.expanded`，並在 1ms 後給區塊加 `.expanded-btn`。
  - `.dropdown` 平時 `visibility:hidden`，`.expanded` 時 `visibility:visible`。
  - 開選單時 `#bigcontainer` 的 `z-index` 被設為 `0`（避免頁面內容蓋住浮層）。
  - IE6 會把所有 `<select>` 設 `visibility:hidden`（防止 select 穿透），關閉後還原。
- **hover**：`#wretch-notice ul li` 與 `#footer-vitality div.dropdown ul li` 綁 `hover`，切換 `.hover-on`（底色 `#D3ECF6`）。

### 9.2 頂列
- **服務下拉**：點 `#wretch-service` 展開 `ul.dropdown.<現在服務>-service`；CSS 會把「目前所在服務」那一個 `li` 隱藏（例如在 Blog 頁時 `li.blog-index{display:none}`）。
- **搜尋服務切換**：點 `legend` → toggle `.service-list.expanded`（`display:block`）。
  點 `label` → 移除其他 `label.on`、給自己加 `.on`，把 `legend` 內容換成 `<選項文字><span>選擇服務</span>`，勾選對應 radio；
  若輸入框仍是預設值，把 `title` 與 `value` 一起換成新的 `_target`（`Article Search` / `Album Search` / `Video Search`）。
  radio 本身被加 `.hidden`（`clip:rect(1px,1px,1px,1px)`）；IE≤8 走 clone + `simulate('click')` 的修補路徑。
- **通知鈴鐺 `#wretch-notice`**：
  第一次點 → 展開 + 加 `.updated` + `GET /ajax/common/ajax_get_notifications.php`（timeout 3000ms），把回應**整段 innerHTML** 塞進 `ul`；載入中先顯示 loading icon + `載入中`。
  之後再點 → 只展開不重新抓；已展開再點 → 收合。
  `.unread` 時鈴鐺換 `ico_noti_new.png`，展開時整塊底色變 `#4D4D4D` 且鈴鐺換 `ico_noti_clicked.png`。

### 9.3 底列
- **跑馬燈 `#text-carousel`**（純 CSS 高度 25px + JS 位移）：
  `START_DELAY = 500ms` 首次延遲 → `STOP_DELAY = 1000ms` 每則停留 → `SPEED = 150ms` 動畫節拍，
  每格把第一個 `li` 的 `marginTop` 遞減 `STEP`，滑到 `ITEMHEIGHT`（25px）時把該 `li` 移到隊尾（無限循環）。
  滑鼠移入 → `scrollingTimer.cancel()` 暫停；移出 → 1 秒後恢復。
- **工具列開關 `#footer-switch`**：
  按下 → `#kukubar-lower` 加 `.hidden-footer`（`bottom:-25px`，0.2s transition），`#footer-switch` 加 `.off`（換 `ico_footer_open.png` 並補左邊框與陰影），
  同時 `GET /ajax/common/ajax_persistent_footer_setting.php?display=0|1&crumb=…` 把偏好存回伺服器。
  IE6 走 `fixIE6Position()`：監聽 `scroll` / `resize`，把 bar 與 switch 手動定位到 `docScrollY + winHeight - 22`。
- **好友動態 `#footer-vitality`**（登入才有）：
  頁面載入時 `checkNewVitality()` → `GET /ajax/common/ajax_has_new_vitality.php`，回 `{"result":true}` 就加 `.new-msg`（底色 `#f9f0d2`）。
  點擊 → 清掉 `.new-msg`、展開浮層、`GET /ajax/common/ajax_get_vitality_updates.php` 填入 `ul`。
- **分類好文 `#footer-subscription`**：
  - 已登入 → 展開 `#scrb-panel` 並跑 `subscribeHandler()`：
    - **沒訂閱過**：`GET ajax_featured_topic_subscription.php` 拿全部分類 → 面板寬 478px，標題「請選擇你有興趣的分類」+ 副標「選擇你有興趣的分類，無名將每天提供你最新的優質內容！」，
      分類做成可 toggle 的圓角小標籤（`li.topic`，`+`/`−` 用 `span.add`/`span.del` 切換），至少選一個才會把「我要訂閱」鈕的 `.deactivated` 移除。
    - **已訂閱**：面板加 `.after-subscribe`（左欄 115px 分類清單 + 右欄 362px 文章清單），點左欄項目 → `getArticles(data-content)` 換右欄；
      右上 `a.unsub`「取消訂閱這個分類」；左下「訂閱更多分類 / 訂閱其他分類」展開未訂閱清單，點 `+` 直接訂閱。
    - 送出時整塊蓋 `#scrb-panel-mask`（半透明白）＋ 深灰訊息塊：先「正在儲存設定」（含 loading icon），成功換「設定已儲存」後 10ms 開始收掉；失敗 `alert('喔喔！系統出現錯誤，請稍後再試！')`。
    - 面板內點 `.panel-block` 會 `e.halt()`（點面板不會關閉）。
  - **未登入** → 不打 ajax，改跑 `requestToLogIn()`：`.login-request` 浮層加 `.expanded`，
    用 `loginBtn.setX(按鈕的 X)` 對齊被點的按鈕，並依按鈕 id 切 `.vitality` / `.subscription` 決定顯示哪一句提示（見 6.2）。
    再點一次同一個按鈕會關掉。
- **服務快速選單 `#footer-ugc-compose`**：hover/click 展開 `ul.dropdown`（`bottom:25px`，寬 60px），項目 hover 底色 `#D3ECF6`。

### 9.4 首頁
- `#wfp-lang`：`中文` / `English` 兩顆，選中的加 `li.on`（底 `#CECFCE`）；兩顆的 href 其實都是 `./?date=YYYY-MM-DD`（語言靠 cookie）。
- `#wfp-my .ft`：點 `span`（▼）→ `.ft` 加 `.expan`，`ft-service4` 變 `visibility:hidden`、`ft-service8` 變 `display:block` 並絕對定位到 `left:55px`，箭頭圖換成 `0 -208px`（▲）。
- `#wfp-bgm`：`a.bgm-on` 切換背景音樂，tooltip 文案由 inline JS 的 `bgm_module_msg` 提供四句。
- 頁首搜尋 `input#search-input` 用原生 `placeholder`，另有 `.placeholder` class 作舊瀏覽器 polyfill（`color:#999`）。

---

## 10. 版本差異速查

| 項目 | 2011（`#Wretch-haha`） | 2012（`#kukubar-*`，**復刻目標**） | 2013-12（唯讀） |
|---|---|---|---|
| 頂列實作 | `<table>` 版，高 **20px**，`background:#EEEDDD` 純色，`font-family:arial;font-size:12px` | `<div>` 版，高 **30px**，白→`#EEEDDD` 漸層 | 同 2012 |
| CSS 檔 | `common/css/persistent_footer.css` + inline `<style>` | `common/css/kukubar.css?201207262` | `common/css/kukubar.css?20130903` |
| Sprite | `common/img/ico_haha_bar_sprite.png` | 拆成獨立小 PNG + `ico_sprite.png` | 同 2012 |
| 服務選單 | `Blog`／`Album`／`Video`／`Digu`／`Join FP`／`Wretch`／`Yahoo!Kimo`／`Help Page`／`Join VIP` | `Album`/`Blog`/`Video`/`Digu`/`Join`/`Yahoo!`/`Help`/`Premium` | 拿掉 `Premium`，`Help` 換新網址 |
| 登入區 | `Login` ／ `Free Sign Up` | `Login` ／ `Register` | **只剩 `Login`** |
| 底列 | 無（`#Wretch-haha-vitality-list` 從頂列往下掉） | `#kukubar-lower` 固定 25px + `#footer-switch` | **`display:none`**（CSS 直接關掉，HTML 也不輸出） |
| 搜尋 | 單一輸入框，預設值 `找文章`/`找相簿`/`找影音`/`找朋友`/`找揪團` | 三選一 radio + `Article Search` 等英文預設值 | 同 2012 |
| infozone | 無 | 寬 200px，只有「今日主題」跑馬 | 寬 350px，多一行紅字公告，跑馬 `display:none` |
| body padding | — | `padding:0 0 13px 0!important` | `padding:0 !important` |

---

## 11. 復刻注意事項

1. **`.kukubar-customized` 是頁面 inline 的**，不在 kukubar.css 裡。每個服務頁自己輸出這段 `<style>`，所以不同服務理論上可換色；2012 的網誌/相簿/留言板實測都是同一組（白→`#EEEDDD`）。
2. `#kukubar-upper` 有 `font-black` / `font-white` 兩套主題 class，決定文字是 `#666666` 還是 `#FFFFFF`。2012 內頁一律 `font-black`。
3. kukubar.css 第一行會**強制覆寫** `html / body / #hugewrapper` 的 margin/padding/border/width/height，用 `!important`。這是為了對抗使用者自訂 CSS，復刻時要保留。
4. `.kukubar-bar *{ background-image:none; z-index:999999 }` 與 `.kukubar-bar a{ font-weight:400!important; font-size:12px }` 也是同樣目的（使用者自訂樣式常常會污染工具列）。
5. 所有站內連結都包了 `http://tw.rd.yahoo.com/referurl/wretch/<section>/<key>/*<真正網址>` 的追蹤前綴。復刻時直接用後半段真正網址即可，但如果要 1:1 對照 DOM，`href` 全文要照抄。
6. 每頁末端有 RAPID 追蹤：`tracked_mods: ['kukubar-upper','kukubar-lower','service','social-wrapper','rapid_ov_status','rapid_ytalent']`，
   以及 `<span id="rapid_ov_status"><a>unlog_VPO</a></span>`（未登入標記，2013 是 `unlog_NVPO`）。這是判斷登入狀態的旁證。
7. `#kukubar-lower` 用 `position:fixed`，所以頁面內容要留 25px 底部空間；2012 用 `body{padding-bottom:13px}` + bar 自己的 25px 疊出來。
