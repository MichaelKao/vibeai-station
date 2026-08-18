# 無名小站 2011–2013 最後版 — 圖片素材總盤點（代號 assets）

> 本文件只記錄「**我實際下載並用檔頭驗證過**」的檔案。
> 【驗】＝直接讀自原始檔案／CSS 原文；【推】＝依檔名、尺寸、CSS 選擇器推測。
> 所有尺寸皆以程式解析 PNG IHDR / GIF Logical Screen Descriptor / JPEG SOFn / ICO header 取得，
> **不是** `file` 指令的輸出（`file` 會把 JPEG 的 DPI density 誤報成尺寸，例如 `bg_pfooter.jpg` 會被報成 96x96，實際是 1x26）。

---

## 0. 一句話結論

共取得 **337 個介面素材檔**，全部通過檔頭驗證（無 0 byte、無誤存成 HTML 的假圖）。

CSS / HTML 明確引用但**存檔裡確實沒有**的，只剩 **8 個**（詳見第 7 節）：
CSS 引用 6 個（其中 2 個是 IE6 專用備援、3 個是某使用者自訂面板素材）＋ HTML 引用 2 個。
**真正會影響復刻的只有 1 個**：`ico_usercard.png`（相簿使用者名片卡圖示），無替代品，需自行重繪或省略。

---

## 1. 快照清單

### 1.1 CDX 前綴掃描結果【驗】

| 掃描前綴 | 結果 | 備註 |
|---|---|---|
| `l.yimg.com/e/serv/index/` | **228 筆** | 最有價值的一批：首頁 index3、blog 首頁、album 首頁的 css/js/img 全在這裡 |
| `pic.wretch.cc/e/serv` | **2185 筆** | 其中 image 僅 81 筆，其餘為 1627 個 swf（相簿播放器）＋ 254 個 js ＋ 198 個 css |
| `pic.wretch.cc/photos/icon/blog/smiley/` | **46 筆** | MSN 表情符號全套 |
| `l.yimg.com/e/serv/index/index3/img` | 29 筆 | 首頁改版後的專用圖 |
| `l.yimg.com/e/serv/guestbook/` | **0 筆** | 【驗】整個目錄前綴查無存檔，但個別檔案用精確 URL 抓得到（見 1.3） |
| `l.yimg.com/e/serv/kukubar` | **0 筆** | 【驗】此路徑不存在。kukubar 的 css/js/img 實際在 `pic.wretch.cc/e/serv/common/` |
| `l.yimg.com/e/icon/` | **0 筆** | 【驗】但 `l.yimg.com/e/icon/blog/*.gif` 用精確 URL 抓得到 |
| `l.yimg.com/e/serv/album/` | 逾時 | CDX 反覆回 504（試 4 次 × 290 秒） |
| `l.yimg.com/e/serv/blog/` | 逾時 | 同上 |
| `l.yimg.com/e/serv/common/` | 逾時 | 同上 |

### 1.2 重要方法論（給後續接手的人）

`l.yimg.com/e/serv/{album,blog,common}/` 這三個前綴在 archive.org CDX 上**永遠回 504**。
**這不代表沒有存檔**——我改用下面這條路徑，多救回 **89 個檔案**：

1. 先抓 CSS / HTML 原始檔
2. 從中抽出所有 `url(...)`、`<img src>`、`<link href>`
3. 對**每一個精確 URL**單獨查 CDX（`url=<精確網址>` 不加 `matchType=prefix`）——這種查詢很快、不會 504
4. 依 2012 → 2011 → 2013 → 其他 的順序逐一嘗試時間戳，直到檔頭驗證通過

### 1.3 主要 CSS 來源（全部已下載到 `assets_src2/css/assets_*.css`）【驗】

| 檔案 | 大小 | 快照網址 |
|---|---|---|
| kukubar.css（全站頂端橫條） | 41,927 B | https://web.archive.org/web/20121103105817id_/http://pic.wretch.cc/e/serv/common/css/kukubar.css?20121101 |
| persistent_footer.css（全站底部固定列） | 12,136 B | https://web.archive.org/web/20110416000553id_/http://pic.wretch.cc/e/serv/common/css/persistent_footer.css |
| wfp-css_201205171100.css（**2012 首頁**） | 92,241 B | https://web.archive.org/web/20120614173606id_/http://l.yimg.com/e/serv/index/index3/css/wfp-css_201205171100.css |
| wfp-css_201308261304.css（2013 首頁） | 93,360 B | https://web.archive.org/web/20130922210742id_/http://l.yimg.com/e/serv/index/index3/css/wfp-css_201308261304.css |
| chameleon.css（首頁換膚） | 3,334 B | https://web.archive.org/web/20110112211806id_/http://l.yimg.com/e/serv/index/index3/css/chameleon.css |
| blog/layout.css（部落格首頁版面） | 14,455 B | https://web.archive.org/web/20121218065917id_/http://l.yimg.com/e/serv/index/blog/css/layout.css?20121101 |
| blog/style.css | 1,351 B | https://web.archive.org/web/20121218065922id_/http://l.yimg.com/e/serv/index/blog/css/style.css?20121101 |
| album/index.css | 4,426 B | https://web.archive.org/web/20110510090833id_/http://l.yimg.com/e/serv/index/album/css/index.css |
| album/fix.css | 16,938 B | https://web.archive.org/web/20120222151934id_/http://l.yimg.com/e/serv/index/album/css/fix.css?20120222 |
| album/font.css | 6,408 B | https://web.archive.org/web/20121103105811id_/http://pic.wretch.cc/e/serv/album/css/font.css?20121101 |
| album/newButton.css | 4,907 B | https://web.archive.org/web/20121105204838id_/http://pic.wretch.cc/e/serv/album/css/newButton.css?20121101 |
| album/newPanel.css | 1,962 B | https://web.archive.org/web/20121105204858id_/http://pic.wretch.cc/e/serv/album/css/newPanel.css?20121101 |
| album/photowall_overlay.css | 3,609 B | https://web.archive.org/web/20121103105811id_/http://pic.wretch.cc/e/serv/album/css/photowall_overlay.css?20121101 |
| album/spp_promotion.css | 4,306 B | https://web.archive.org/web/20121105204905id_/http://pic.wretch.cc/e/serv/album/css/spp_promotion.css?20121101 |
| album/mod_ad.css | 828 B | https://web.archive.org/web/20121105204853id_/http://pic.wretch.cc/e/serv/album/css/mod_ad.css?20121101 |
| album/font_vip.css | 1,680 B | https://web.archive.org/web/20121110160900id_/http://pic.wretch.cc/e/serv/album/css/font_vip.css?20121101 |
| album/display_angel.css | 4,518 B | https://web.archive.org/web/20130421124442id_/http://pic.wretch.cc/e/serv/album/css/display_angel.css |
| album/user/slider.css | 2,835 B | https://web.archive.org/web/20121018044725id_/http://pic.wretch.cc/e/serv/album/user/css/slider.css |
| common/sharing.css | 4,339 B | https://web.archive.org/web/20121103105810id_/http://pic.wretch.cc/e/serv/common/css/sharing.css?20121101 |
| common/promotion.css | 2,714 B | https://web.archive.org/web/20111027225411id_/http://pic.wretch.cc/e/serv/common/css/promotion.css |
| album/promotion.css | 2,535 B | https://web.archive.org/web/20111028074948id_/http://pic.wretch.cc/e/serv/album/css/promotion.css?20110815 |
| www.wretch.cc/css/default.css（關站公告頁用） | 2,205 B | https://web.archive.org/web/20131226091631id_/http://www.wretch.cc/css/default.css |

### 1.4 圖片素材取用的時間戳分布【驗】

優先序照指示 **2012 > 2011 > 2013**，逐檔嘗試直到檔頭驗證通過。
實際落點大宗為 `2012xxxx`；少數只有 2011 或 2013 有存檔（例如 `friend/` 系列多為 `20130304`、`gb_smileys/` 多為 `201312xx`、`skin_style/` 多為 `201312xx`）。

**踩到的坑（已全部處理）**：

- 有 **19 個檔**第一次抓下來是 0 byte，或是 **150,554 B 的 Wayback「查無此檔」HTML 頁**，副檔名仍是 `.png` / `.gif`。全部換時間戳重抓成功。
- `-L` 一定要加，否則拿到 302 空檔。
- 驗證方式：檔頭必須是 `PNG image data` / `GIF image data` / `JPEG image data` / `MS Windows icon`，否則自動換下一個時間戳重試。
- `l.yimg.com/e/serv/guestbook/img/Smileys/surprise.gif` 大小寫敏感：`Smileys` 查無，改用小寫 `smileys` 才抓到【驗】。

---

## 2. 精確色碼表【驗】

### 2.1 全站頂端橫條 kukubar
出自 `pic.wretch.cc/e/serv/common/css/kukubar.css`

| 用途 | 色碼 | 出處規則（原文照抄） |
|---|---|---|
| 連結文字 | `#666666` | `.kukubar-bar .bar-block-click a { color:#666666; }` |
| 連結 hover 文字 | `#000000` | `.kukubar-bar .bar-block-click a:hover { color:#000000; }` |
| 分隔線（#cam 右框線） | `#C9C9C9` | `#kukubar-upper .right-side #cam { border-right:#C9C9C9 solid 1px; }` |

kukubar.css 全檔色碼出現次數前 20【驗】：

`#ffffff`×36、`#000000`×11、`#bbbbbb`×9、`#a0a0a0`×8、`#666666`×8、`#e4e4e4`×6、`#d3ecf6`×6、`#c9c9c9`×6、`#4d4d4d`×6、`#ff7804`×4、`#fec24a`×4、`#fccd00`×4、`#dddddd`×4、`#a1a1a1`×4、`#70cdec`×4、`#ffd233`×3、`#ffab04`×3、`#fcb400`×3、`#f49038`×3、`#33a1ff`×3

### 2.2 全站底部固定列 persistent_footer
出自 `pic.wretch.cc/e/serv/common/css/persistent_footer.css`

| 用途 | 色碼 | 出處規則（原文照抄） |
|---|---|---|
| 底列背景底色 | `#FFFFFF` | `#bottom-footer ul { background:#FFFFFF; }` |
| 底列漸層 起 → 迄 | `#FFFFFF` → `#D9D9D9` | `.toggle-block { background:-moz-linear-gradient(top, #FFFFFF 0%, #D9D9D9 100%); }` |
| 底列外框 | `#C5C5C5` | `.toggle-block { border:1px solid #C5C5C5; }` |
| 底列上緣陰影 | `#cccccc` | `.toggle-block { -webkit-box-shadow:0px -2px 2px #cccccc; }` |
| 連結文字 | `#666666` | `#bottom-footer a:visited, #bottom-footer a:link { color:#666666; }` |
| 連結 hover | `#000000` | `#bottom-footer a:visited:hover, #bottom-footer a:link:hover { color:#000000; }` |

### 2.3 2012 首頁 wfp-css_201205171100.css

全檔色碼出現次數前 25【驗】：

`#fff`×93、`#333`×53、`#000`×49、`#b3b3b3`×31、`#a0a0a0`×25、`#666`×20、`#dbdbdb`×18、`#e5e5e5`×17、`#999`×13、`#515151`×13、`#43883f`×13、`#c1c1c1`×11、`#b5b2b5`×11、`#eaeaea`×10、`#707070`×10、`#ffa800`×8、`#ff6fa5`×8、`#f7f7f7`×8、`#a5ce5d`×8、`#7daade`×8、`#60caca`×8、`#f4f4f4`×7、`#fdfdfd`×6、`#f0f0f0`×6、`#efebef`×6

【推】`#43883f`（綠）為無名主色調之一；`#ff6fa5`（粉）/ `#a5ce5d`（綠）/ `#7daade`（藍）/ `#60caca`（青）/ `#ffa800`（橘）為首頁分類色帶。此推測可與 `bg_hugc_*.png` 六色 1×35 色條交叉印證（見 2.4）。

### 2.4 首頁分類色條 `bg_hugc_*.png`

【驗】實體檔案存在、尺寸皆為 **1×35**，共 6 色：`gray` / `lime` / `mint` / `orange` / `pink` / `violet`。

> **我沒有逐像素取出這 6 個檔的 RGB 值，所以此處不給色碼。**
> 請直接把檔案當背景圖水平平鋪使用，或自行取樣。寧可留白也不編色碼。

---

## 3. 尺寸【驗】

| 項目 | 數值 | 依據 |
|---|---|---|
| 首頁版面總寬 | **970px** | `wfp-css` 中 `width:970px` 出現 5 次；且 `bg_nav_default.png` = 970×40、`img_fp_outline.png` = 970×280 交叉印證 |
| 首頁外框底圖 | 976×3 | `index3/bg_wrapper.png` |
| 首頁頂部半透明底 | 968×121 | `index3/bg_hd_trans.png` |
| 底部固定列高度 | **26px** | `#bottom-footer { height:26px; }` |
| 底部固定列內容區寬 | **970px** | `#bottom-footer .center-wrapper { width:970px; margin:0 auto; }` |
| 底部可收合區塊 | 938×27 | `.toggle-block { width:938px; height:27px; }` |
| kukubar 列高 | **30px** | `#kukubar-upper .right-side #cam { height:30px; line-height:30px; }` |
| kukubar 下方留白 | 13px | `html body #hugewrapper { padding:0 0 13px 0 !important; }` |
| 相簿首頁 header | 960×80 | `index_album/header.jpg` |
| 部落格首頁 header | 519×62 | `index_blog/header.jpg` |
| 無名 logo（首頁） | 130×36 | `index3/logo_wretch.png` |
| 部落格 logo | 223×36 | `index_blog/logo_newlogo.png` |
| 相簿 logo（中 / 英） | 188×80 / 193×80 | `index_album/logo_album_cn.png` / `logo_album_en.png` |
| 圓角半徑 | **5px 與 2px** | kukubar.css 中 `border-radius:5px` ×10、`border-radius:2px` ×10 |
| 常見格線寬 | 640 / 299 / 240 / 220 / 208 / 200px | wfp-css `width:` 統計 |

---

## 4. 字型與字級【驗】

| 項目 | 值 | 出處 |
|---|---|---|
| kukubar 字族 | `Arial` | `.kukubar-bar { font-family:Arial; }` |
| kukubar 字級 | `12px`（多處帶 `!important`） | `.kukubar-bar a { font-size:12px; }`、`.kukubar-bar h5, #kukubar-bar h6 { font-size:12px !important; }` |
| kukubar 字重 | `400`（強制不加粗） | `.kukubar-bar a { font-weight:400 !important; }` |
| kukubar 行高 | `1` ×11、`1.231` ×9、`30px` ×3 | kukubar.css 統計 |
| kukubar hover 字級 | `100% !important` | `.kukubar-bar a:hover, .kukubar-bar a:active { font-size:100%!important; }` |
| 底部固定列字級 | `12px` | `#bottom-footer { font-size:12px; }`，另 `a` 與 `a:hover` 各再宣告一次 `12px !important` |
| 底部固定列字重 | `400 !important` | `#bottom-footer a { font-weight:400 !important; }` |

> 【驗】整個全域 chrome（頂條＋底列）字級一律鎖死 **12px**、字重鎖死 **400**，且大量使用 `!important`。
> 原因是這兩條要疊在使用者自訂 CSS 的部落格版面之上。**復刻時務必照做**，否則套上使用者面板就會走樣。

---

## 5. DOM 結構【驗】

以下由 CSS 選擇器逐條還原，非猜測。括號內為該節點在原始 CSS 上的宣告。

### 5.1 全站底部固定列

```
#bottom-footer                      (height:26px; position:fixed; bottom:0px!important;
│                                    left:0px; width:100%; text-align:center;
│                                    font-size:12px; z-index:9999; overflow:visible;
│                                    _position:absolute  ← IE6)
└── .center-wrapper                 (width:970px; margin:0 auto; text-align:left;
    │                                vertical-align:top; position:relative; zoom:1)
    ├── .toggle-block               (width:938px; _width:937px; height:27px;
    │                                漸層 #FFFFFF→#D9D9D9;
    │                                background:#FFFFFF url(../img/bg_pfooter.jpg) repeat-x left 2px;
    │                                border:1px solid #C5C5C5; border-top-width:0px;
    │                                box-shadow:0px -2px 2px #cccccc; z-index:2)
    ├── .editor-block
    │   └── #footer-hot
    │       ├── .footer-expand      (float:right; cursor:pointer;
    │       │                        background:url(../img/ico_footer_sprite.png) right 0px no-repeat;
    │       │                        margin:5px 8px)
    │       └── .hover-on           (background:url(../img/ico_footer_sprite.png) right -25px no-repeat)
    ├── .fb-block
    │   └── #footer-compose
    │       ├── ul > li > a         (padding-left:20px;
    │       │                        background-image:url(../img/ico_footer_sprite.png);
    │       │                        background-position:5px -218px)
    │       ├── span.footer-expand  (background:url(../img/ico_footer_sprite.png) right 6px no-repeat)
    │       └── span.hover-on       (clear:both; float:left; width:20px; height:20px;
    │                                background:url(../img/ico_footer_sprite.png) right -19px no-repeat)
    └── ul > li                     (margin:0px; padding:0px; height:26px)
        └── a                       (width:auto; float:left; overflow:hidden; margin:0px)

#bottom-footer .off                 (display:none; transition:all 0.2s ease  ← 四家前綴都寫)
#bottom-footer span.hover-on        (background:url(../img/ico_footer_sprite.png) right -19px no-repeat)
```

### 5.2 全站頂端 kukubar

```
html > body > #hugewrapper          (margin:0!important; padding:0 0 13px 0!important;
                                     border:none!important; width:auto!important; height:auto!important)

.kukubar-bar                        (text-align:left!important; font-family:Arial;
│                                    padding-bottom:0px; cursor:text; letter-spacing:0px)
├── .kukubar-bar *                  (list-style-image:none; background-image:none; z-index:999999)
├── .kukubar-bar div                (background-image:none; padding:0px)
├── .kukubar-bar img                (position:static)
├── .kukubar-bar a                  (font-weight:400!important; background-color:transparent;
│                                    cursor:pointer!important; font-size:12px; margin:0px)
├── #kukubar-upper
│   ├── .dropdown                   (border-top-width:0px!important)
│   ├── .bar-block-click > a        (color:#666666 → hover #000000)
│   └── .right-side
│       ├── #cam                    (padding:0 8px 0 25px; height:30px; line-height:30px;
│       │                            vertical-align:middle; position:relative; z-index:9999;
│       │                            float:right; border-right:#C9C9C9 solid 1px;
│       │                            background:url(../img/ico_sprite.png) no-repeat scroll 5px -154px transparent;
│       │                           *background: … 5px -153px  ← IE7 差 1px)
│       └── #wretch-notice
│           ├── a.notice-list       (height:30px)
│           └── ul > li             (overflow:hidden; cursor:pointer;
│                                    padding:16px 10px; *padding:4px 0px  ← IE7)
└── #kukubar-lower
    └── .dropdown                   (border-bottom-width:0px!important)

.hidden                             (position:absolute;
                                     clip:rect(1px 1px 1px 1px)   ← IE6/7 無逗號版
                                     clip:rect(1px, 1px, 1px, 1px))
```

### 5.3 原始 CSS 的 IE hack 慣例【驗】

原檔大量使用瀏覽器 hack。復刻時可以不照抄，但要看得懂：

| 寫法 | 目標 | 實例 |
|---|---|---|
| `*property:` | IE7 及以下 | `*background:url(...) 5px -153px` |
| `_property:` | IE6 | `_width:937px`、`_position:absolute`、`_bottom:0px` |
| `value\9` | IE8 及以下 | `border-top-width:1px \9` |
| `clip:rect(a b c d)`（無逗號） | IE6/7 | `.hidden` |

注意 `#cam` 的 sprite 位移：IE7 用 `5px -153px`、現代瀏覽器用 `5px -154px`，**差 1px**。復刻只需採用 `-154px`。

---

## 6. 素材清單（總表）

存放位置：`assets_src2/img/common/<子目錄>/`，**檔名一律保持原始檔名**。

子目錄是我加的，用來避免跨來源同名檔互相覆蓋——例如 `ico_sprite.png` 同時存在於 3 個來源、`lock.gif` 存在於 4 個來源、`rss.gif` 存在於 4 個來源。

### 6.1 子目錄 → 原始 URL 前綴對照【驗】

| 子目錄 | 原始 URL 前綴 | 檔數 |
|---|---|---|
| `index3/` | `http://l.yimg.com/e/serv/index/index3/img/` | 29 |
| `index_root/` | `http://l.yimg.com/e/serv/index/img/`（＋ `index2/img/sprites.gif?20081002`） | 3 |
| `index_album/` | `http://l.yimg.com/e/serv/index/album/css/` | 41 |
| `index_blog/` | `http://l.yimg.com/e/serv/index/blog/img/` | 24 |
| `pic_album/` | `http://pic.wretch.cc/e/serv/album/img/` | 34 |
| `pic_album_user/` | `http://pic.wretch.cc/e/serv/album/user/img/` | 2 |
| `pic_common/` | `http://pic.wretch.cc/e/serv/common/img/`（＋ `common/favicon.ico`） | 45 |
| `yserv_common/` | `http://l.yimg.com/e/serv/common/img/` | 14 |
| `yserv_blog/` | `http://l.yimg.com/e/serv/blog/img/`（＋ `e/icon/blog/`、`e/serv/album/img/lock.gif`） | 12 |
| `yserv_album/` | `http://l.yimg.com/e/serv/album/img/` | 9 |
| `friend/` | `http://l.yimg.com/e/serv/friend/img/` | 7 |
| `smiley_msn/` | `http://pic.wretch.cc/photos/icon/blog/smiley/msn/` | 46 |
| `gb_smileys/` | `http://l.yimg.com/e/serv/guestbook/img/Smileys/`（＋ `img/email.gif`） | 21 |
| `misc/` | 雜項，見 6.2 | 9 |
| `skin_style/` | `http://l.yimg.com/e/style/<類別>/<面板編號>/`，檔名前綴即原路徑 | 41 |
| **合計** | | **337** |

### 6.2 `misc/` 各檔真實來源【驗】

| 檔名 | 原始 URL |
|---|---|
| `dotted_v1.gif` | `http://l.yimg.com/f/i/tw/hp/spirit/dotted_v1.gif` |
| `btn1.gif` | `http://l.yimg.com/f/i/tw/wretch/hgusetbook_001/btn1.gif` ← 留言板按鈕，注意原站把 guestbook **拼錯**成 hgusetbook |
| `btn_delete.jpg` | `http://l.yimg.com/f/i/tw/wretch/vitality/btn_delete.jpg` |
| `btn_social.jpg` | `http://l.yimg.com/f/i/tw/wretch/vitality/btn_social.jpg` |
| `border.png` | `http://tw.yimg.com/i/tw/wretch/blog/border.png` |
| `pull.gif` | `http://tw.yimg.com/i/tw/wretch/blog/pull.gif` |
| `push.gif` | `http://tw.yimg.com/i/tw/wretch/blog/push.gif` |
| `btn.gif` | `http://pic.wretch.cc/serv/album/user/img/btn.gif` ← 路徑**沒有** `/e/` |
| `refresh_16.gif` | `http://l.yimg.com/gu/static/5.3.9/graphics/refresh_16.gif` |

### 6.3 重點素材用途說明

尺寸【驗】、用途除註明外皆為【推】。

| 檔案 | 尺寸 | 用途 |
|---|---|---|
| `pic_common/ico_sprite.png` | 900×700 | **全站主 sprite**。kukubar 頂條圖示取自此檔（`#cam` 用 `5px -154px`）【驗】。同檔亦存在於 `index3/` 與 `yserv_common/`，三份位元組數均為 14,551 B ＝同一份檔案的三個 CDN 路徑【驗】 |
| `pic_common/ico_footer_sprite.png` | 75×300 | **底部固定列 sprite**。已知位移【驗】：`right 0px`（展開鈕）、`right -19px`（hover）、`right -25px`（hot hover）、`right 6px`、`-45px -70px`、`5px -218px`、`0 0`（20×20 圖示） |
| `index3/bg_nav_default.png` | 970×40 | 首頁導覽列底圖，寬度即版面寬 |
| `index3/bg_hd_trans.png` | 968×121 | 首頁頂部半透明底 |
| `index3/img_fp_outline.png` | 970×280 | 首頁主視覺外框 |
| `index3/bg_wrapper.png` | 976×3 | 首頁最外層容器底紋 |
| `index3/logo_wretch.png` | 130×36 | 無名小站 logo（最後版） |
| `index3/ico_medal.png` | 125×48 | 勳章圖示（多格 sprite） |
| `index3/bg_cs_stack.png` / `bg_cs_stack_dark.png` | 267×40 / 67×67 | 相片堆疊效果底圖 |
| `index3/bg_hugc_*.png` ×6 | 各 1×35 | 首頁分類色帶（gray/lime/mint/orange/pink/violet） |
| `index_blog/sprites.gif` | 440×270 | 部落格首頁 sprite。與 `index_root/sprites.gif_20081002` 位元組數同為 19,288 ＝同檔【驗】 |
| `index_blog/css-sprites.gif` | 220×218 | 部落格首頁第二組 sprite |
| `index_blog/hot_cate.png` | 651×79 | 熱門分類列 |
| `index_album/sprite_fplink.png` | 429×115 | 相簿首頁連結列 sprite |
| `index_album/header.jpg` | 960×80 | 相簿首頁頁首 |
| `index_album/taiwan_entire_map.gif` | 210×27 | 台灣地圖選單 |
| `pic_album/ico_breadcrumb.png` | 16×364 | 相簿麵包屑箭頭（垂直 sprite） |
| `pic_album/switch_popup.png` | 319×257 | 版本切換彈窗 |
| `pic_album/loading-1.gif` | 90×90 | 載入動畫 |
| `pic_album/ico_loading.gif` | 16×16 | 小型載入動畫 |
| `yserv_album/ico_switchver.png` | 80×581 | 相簿版本切換（垂直 sprite） |
| `yserv_album/ico_phototools.png` | 28×440 | 相片工具列（垂直 sprite） |
| `yserv_album/ico_carousels.png` | 49×300 | 輪播控制（垂直 sprite） |
| `yserv_album/ico_comments.png` | 16×200 | 留言圖示（垂直 sprite） |
| `yserv_album/bg_shadow_left.png` / `bg_shadow_right.png` | 各 25×420 | 相片檢視頁左右陰影 |
| `yserv_common/ico_haha_bar_sprite.png` | 16×193 | 哈哈條 sprite |
| `yserv_common/No_Login_60.gif` | 60×60 | **未登入預設頭像** |
| `friend/tpic5.jpg` | 90×90 | 預設縮圖。**注意副檔名是 .jpg 但實際位元組是 GIF**【驗】 |
| `friend/mini-t.gif` / `mini-b.gif` | 382×350 / 382×151 | 好友列表面板上下底圖 |
| `pic_common/isAuth_*.gif` | 各 20×20 | 認證等級徽章：`silver` / `gold` / `super_gold` / `platinum`；`yserv_common/isAuth.gif` 為通用版 |
| `pic_common/favicon.ico` | 16×16 | 站台 favicon（16 色 4bpp） |
| `smiley_msn/*` | 19×19（`y06` 為 20×20） | **MSN 表情符號全套 46 個**：21 個具名 ＋ `y01`–`y25` |
| `gb_smileys/*` | 見下 | **留言板表情符號全套 20 個** ＋ `email.gif` 25×25 |

`gb_smileys/` 尺寸不一致，逐檔列出【驗】：
`angry` 34×18、`bighug` 42×18、`waiting` 23×18、`crying` 22×18、`shameonyou` 22×18、`confused` 20×18，其餘 14 個皆 18×18。

### 6.4 完整檔案清單（337 檔）

見下方第 9 節逐目錄總表。

---

## 7. 抓不到的清單（誠實盤點）

這一節是判斷「復刻上限」的關鍵。以下是我**確認 CSS 或 HTML 有引用、但 archive.org 完全沒有存檔**的檔案。

我對每一個都做過：查精確 URL 的 CDX（回傳空）＋ 試過鏡像主機（`l.yimg.com` ↔ `pic.wretch.cc`）。

### 7.1 CSS 引用但查無存檔（6 個）

| 檔名 | 引用它的 CSS | 原始 URL | 影響 |
|---|---|---|---|
| `bg_shadow_left_ie6.png` | `album_wspp.css` | `l.yimg.com/e/serv/album/img/bg_shadow_left_ie6.png` | **無影響**。IE6 專用備援，現代瀏覽器走 `bg_shadow_left.png`（25×420，已取得） |
| `bg_shadow_right_ie6.png` | `album_wspp.css` | `l.yimg.com/e/serv/album/img/bg_shadow_right_ie6.png` | **無影響**。同上，對應 `bg_shadow_right.png`（25×420，已取得） |
| `ico_usercard.png` | `album_wspp.css` | `l.yimg.com/e/serv/album/img/ico_usercard.png` | **有影響**。相簿頁使用者名片卡的圖示 sprite，無替代品。需自行重繪或省略 |
| `def.gif` | `album_userskin_leepeihsuam.css` | `www.wretch.cc/icon/htcmi/other/script/javascript/select/def.gif` | **無影響**。單一使用者自訂面板的素材，非官方 chrome |
| `hover.gif` | 同上 | `www.wretch.cc/icon/htcmi/other/script/javascript/select/hover.gif` | **無影響**。同上 |
| `selectItem.gif` | 同上 | `www.wretch.cc/icon/htcmi/other/script/javascript/select/selectItem.gif` | **無影響**。同上 |

### 7.2 HTML 引用但查無存檔（2 個）

| 檔名 | 原始 URL | 影響 |
|---|---|---|
| `logo.png` | `l.yimg.com/e/serv/index/blog/img/logo.png` | **低**。同目錄下已取得 `logo_newlogo.png`（223×36），後者才是最後版採用的 logo【推】 |
| `wretch_ch.gif` | `pic.wretch.cc/serv/album/user/img/wretch_ch.gif` | **低**。相簿使用者頁的中文 logo；同目錄 `btn.gif`（47×25）已取得 |

### 7.3 整個目錄前綴查無存檔（但不代表檔案抓不到）

| 前綴 | CDX 結果 | 實際處理 |
|---|---|---|
| `l.yimg.com/e/serv/guestbook/` | 0 筆 | 靠精確 URL **救回 21 個**（20 個表情 ＋ email.gif） |
| `l.yimg.com/e/icon/` | 0 筆 | 靠精確 URL **救回 3 個**（`e/icon/blog/{email,lock,webpage}.gif`） |
| `l.yimg.com/e/serv/kukubar` | 0 筆 | **此路徑本來就不存在**。kukubar 資源實際在 `pic.wretch.cc/e/serv/common/`，已完整取得 |

### 7.4 沒有抓、且是刻意不抓的

以下都是**使用者上傳內容或第三方廣告**，依指示排除：

- `f9~f12.wretch.yimg.com/<帳號>/<相簿>/thumbs/*` — 使用者相片縮圖
- `l.yimg.com/e/cover/<帳號>_60.jpg` / `_90.jpg` — 使用者大頭貼（本次 HTML 中出現逾 150 個帳號）
- `cover.wretch.cc/<帳號>*.jpg` — 同上，另一個 CDN 路徑
- `www.wretch.cc/album/show.php?i=…` — 使用者相片原圖
- `l.yimg.com/e/serv/dynamic/**` — 首頁編輯精選／人氣看板等**每日更換的動態內容**（HTML 中共 116 個引用）。這些不是 UI 素材，是當時的營運內容
- `l.yimg.com/f/i/tw/wretch/FPad/*`、`tw.yimg.com/i/tw/wretch/FPad/*` — 首頁廣告
- `static.ak.fbcdn.net`、`whos.amung.us`、`pbase.com`、`flickr`、`photobucket`、`imageshack` 等第三方

### 7.5 有抓、但要提醒的

- `skin_style/` 41 個檔是**使用者部落格／留言板的自訂面板**素材（面板編號 117、1911、1084、1220、1417），不是官方 chrome。抓下來是因為本次取得的 HTML 樣本剛好用到這幾套。**若要做面板系統，這 5 套只是全站數千套中的樣本**，絕大多數面板沒有存檔。
- `pic_album/bg_promotion.png`（696×270）、`ico_musicill.png`（400×300）、`tutorial_*.jpg` 系列是**相簿改版宣傳頁**素材，不是常態 UI。
- `index_root/sprites.gif_20081002` 檔名中的 `_20081002` 是我把 query string `?20081002` 轉存的結果（`?` 不能當 Windows 檔名）。原始 URL 為 `http://l.yimg.com/e/serv/index2/img/sprites.gif?20081002`。

---

## 8. 互動行為【驗】

以下全部讀自原始 CSS，非推測。

### 8.1 底部固定列（persistent_footer）

- **收合／展開**：`.off { display:none; transition:all 0.2s ease; }` — 收合是切 `display`，但同時宣告了 0.2 秒的 transition（`display` 不會過渡，此為原站寫法，照抄即可）。四家前綴 `-webkit- -moz- -o- -ms-` 都寫了。
- **展開鈕 hover**：`.footer-expand` 平時 `ico_footer_sprite.png right 0px`，hover 時整個換 class 成 `.hover-on` → `right -25px`。**是換 class，不是 CSS `:hover`**。
- **另一組 hover**：`span.hover-on` → `right -19px`。
- **固定定位**：`position:fixed; bottom:0px !important; z-index:9999`，IE6 退回 `_position:absolute`。

### 8.2 頂端 kukubar

- **下拉選單**：`.dropdown` 在 `#kukubar-upper` 內 `border-top-width:0px!important`，在 `#kukubar-lower` 內 `border-bottom-width:0px!important` — 即**上方橫條的下拉往下開、下方橫條的下拉往上開**，靠去掉貼合邊的框線做出「與橫條連成一體」的視覺。
- **下拉層級**：`.kukubar-bar ul.dropdown, .kukubar-bar .dropdown ul { z-index:100000; left:auto; padding-left:0px; margin:0px; }`，而 `.kukubar-bar *` 是 `z-index:999999`。
- **連結 hover**：只變色（`#666666` → `#000000`），**字級與字重強制不變**（`font-size:100%!important; font-weight:400!important; border:none; position:static`）。這是為了防止使用者自訂 CSS 讓橫條在 hover 時跳動。
- **通知清單** `#wretch-notice ul li`：`cursor:pointer; overflow:hidden; padding:16px 10px`（IE7 `*padding:4px 0px`）。
- **相機鈕 `#cam`**：`float:right`，右側有 1px `#C9C9C9` 分隔線，30px 高垂直置中。

### 8.3 無障礙隱藏

`.hidden` 用 `clip:rect(...)` 而非 `display:none`（保留螢幕閱讀器可讀性），且寫了 IE6/7 的無逗號版本。

### 8.4 分頁籤 / 彈窗

【推】`index_album/` 內有 `blue_tab_static.png`（300×28）、`service_tab_current.png`（300×28）、`search_tab_static.png`（48×24）與 `select-{album,blog,video,web}.png`（各 48×24），
形狀上是「300px 寬的頁籤底圖 ＋ 48×24 的搜尋範圍切換鈕」。
`collapse_button{,_hover,_open,_open_hover}.gif` 各 40×13，是**四態**收合鈕（收合／收合hover／展開／展開hover）。
`rollprev{a,ahover}.gif` / `rollnext{a,ahover}.gif` 各 12×12，是輪播左右鈕的兩態。
**我沒有讀到對應的 CSS 規則來確認觸發方式**，故標【推】。

---

## 9. 完整檔案總表

格式：檔名 ｜ 尺寸 ｜ 檔案大小。來源網址＝第 6.1 節該子目錄的前綴 ＋ 檔名。

#### `friend/`  (7 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `addwhite.gif` | 41x24 | 286 B |
| `arrow.png` | 8x9 | 208 B |
| `emptywhite.gif` | 41x24 | 173 B |
| `logo.png` | 82x23 | 5,239 B |
| `mini-b.gif` | 382x151 | 2,205 B |
| `mini-t.gif` | 382x350 | 1,662 B |
| `tpic5.jpg` | 90x90 | 5,160 B |

#### `gb_smileys/`  (21 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `angry.gif` | 34x18 | 4,770 B |
| `biggrin.gif` | 18x18 | 536 B |
| `bighug.gif` | 42x18 | 3,488 B |
| `blushing.gif` | 18x18 | 1,641 B |
| `broken_heart.gif` | 18x18 | 2,318 B |
| `confused.gif` | 20x18 | 2,728 B |
| `crying.gif` | 22x18 | 2,304 B |
| `email.gif` | 25x25 | 1,207 B |
| `happy.gif` | 18x18 | 1,197 B |
| `laughing.gif` | 18x18 | 646 B |
| `lovestruck.gif` | 18x18 | 2,323 B |
| `notalking.gif` | 18x18 | 1,014 B |
| `phbbbbt.gif` | 18x18 | 781 B |
| `sad.gif` | 18x18 | 1,001 B |
| `shameonyou.gif` | 22x18 | 2,538 B |
| `straightface.gif` | 18x18 | 613 B |
| `surprise.gif` | 18x18 | 1,668 B |
| `tongue.gif` | 18x18 | 845 B |
| `waiting.gif` | 23x18 | 1,649 B |
| `winking.gif` | 18x18 | 1,001 B |
| `worried.gif` | 18x18 | 1,203 B |

#### `index3/`  (29 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `bg_cs3_border.png` | 4x4 | 128 B |
| `bg_cs_stack.png` | 267x40 | 652 B |
| `bg_cs_stack_dark.png` | 67x67 | 3,025 B |
| `bg_hd_trans.png` | 968x121 | 48,961 B |
| `bg_hugc_gray.png` | 1x35 | 134 B |
| `bg_hugc_lime.png` | 1x35 | 159 B |
| `bg_hugc_mint.png` | 1x35 | 157 B |
| `bg_hugc_orange.png` | 1x35 | 157 B |
| `bg_hugc_pink.png` | 1x35 | 160 B |
| `bg_hugc_violet.png` | 1x35 | 164 B |
| `bg_nav_default.png` | 970x40 | 18,337 B |
| `bg_wrapper.png` | 976x3 | 165 B |
| `ico_fp_addfriend.png` | 12x12 | 188 B |
| `ico_fp_dot.png` | 2x2 | 126 B |
| `ico_fp_musicoff.png` | 12x12 | 185 B |
| `ico_fp_musicon.png` | 12x12 | 161 B |
| `ico_fp_playvideo.png` | 64x64 | 2,390 B |
| `ico_fp_playvideo_s.png` | 23x23 | 1,012 B |
| `ico_medal.png` | 125x48 | 6,270 B |
| `ico_myservices.png` | 5x12 | 2,911 B |
| `ico_rss.png` | 12x12 | 441 B |
| `ico_sprite.png` | 900x700 | 14,551 B |
| `ico_uh_search.png` | 12x12 | 219 B |
| `img_fp_button_s.png` | 1x17 | 121 B |
| `img_fp_outline.png` | 970x280 | 2,171 B |
| `line_dot_horizontal.png` | 2x2 | 131 B |
| `line_dot_vertical.png` | 2x2 | 131 B |
| `line_nav_border.png` | 2x36 | 121 B |
| `logo_wretch.png` | 130x36 | 5,701 B |

#### `index_album/`  (41 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `album_list.jpg` | 484x28 | 3,144 B |
| `album_list_mode_list.jpg` | 484x28 | 3,214 B |
| `aqua_button.png` | 81x22 | 472 B |
| `arrow.gif` | 7x5 | 59 B |
| `banner_under_bg.gif` | 1x12 | 52 B |
| `bar-album.png` | 357x22 | 1,207 B |
| `blue_tab_static.png` | 300x28 | 627 B |
| `category_hover.jpg` | 143x18 | 1,086 B |
| `category_static.gif` | 143x18 | 372 B |
| `collapse_button.gif` | 40x13 | 182 B |
| `collapse_button_hover.gif` | 40x13 | 182 B |
| `collapse_button_open.gif` | 40x13 | 183 B |
| `collapse_button_open_hover.gif` | 40x13 | 183 B |
| `condition_hover.jpg` | 143x22 | 818 B |
| `condition_static.jpg` | 143x22 | 1,001 B |
| `cyan.jpg` | 143x25 | 1,285 B |
| `cyan_hover.jpg` | 143x22 | 952 B |
| `cyan_static.jpg` | 143x22 | 794 B |
| `grid.jpg` | 108x160 | 1,531 B |
| `h4_bg.jpg` | 143x25 | 1,165 B |
| `h4_bg_green.jpg` | 143x25 | 997 B |
| `header.jpg` | 960x80 | 9,984 B |
| `logo_album.png` | 193x80 | 5,049 B |
| `logo_album_cn.png` | 188x80 | 4,953 B |
| `logo_album_en.png` | 193x80 | 4,865 B |
| `rollnexta.gif` | 12x12 | 184 B |
| `rollnextahover.gif` | 12x12 | 184 B |
| `rollpreva.gif` | 12x12 | 183 B |
| `rollprevahover.gif` | 12x12 | 183 B |
| `search_tab_static.png` | 48x24 | 216 B |
| `select-album.png` | 48x24 | 266 B |
| `select-blog.png` | 48x24 | 270 B |
| `select-video.png` | 48x24 | 278 B |
| `select-web.png` | 48x24 | 266 B |
| `service_tab_current.png` | 300x28 | 761 B |
| `sidebar.jpg` | 315x25 | 1,163 B |
| `sliderrollingh3.gif` | 315x24 | 482 B |
| `sliderrollingslidernavi.gif` | 315x27 | 383 B |
| `sliderrollingsliderpic.gif` | 315x1 | 58 B |
| `sprite_fplink.png` | 429x115 | 18,369 B |
| `taiwan_entire_map.gif` | 210x27 | 1,327 B |

#### `index_blog/`  (24 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `arrow.gif` | 15x15 | 176 B |
| `block.gif` | 15x15 | 71 B |
| `close.gif` | 21x21 | 1,126 B |
| `css-sprites.gif` | 220x218 | 3,175 B |
| `desc.gif` | 3x3 | 44 B |
| `dotted.gif` | 1x13 | 46 B |
| `focus.png` | 13x13 | 540 B |
| `gap.gif` | 1x16 | 95 B |
| `grid_hot.gif` | 5x88 | 169 B |
| `h2.png` | 300x24 | 536 B |
| `header.jpg` | 519x62 | 9,610 B |
| `highlight.gif` | 111x15 | 1,225 B |
| `hot_cate.png` | 651x79 | 856 B |
| `logo_newlogo.png` | 223x36 | 6,174 B |
| `more.gif` | 12x8 | 82 B |
| `nav.gif` | 5x28 | 199 B |
| `nav_s.gif` | 5x28 | 62 B |
| `search.gif` | 5x1 | 43 B |
| `sprites.gif` | 440x270 | 19,288 B |
| `subnav.gif` | 5x22 | 180 B |
| `time.gif` | 5x16 | 116 B |
| `time_on.gif` | 5x16 | 114 B |
| `txt.gif` | 300x20 | 860 B |
| `wretch.gif` | 121x34 | 3,554 B |

#### `index_root/`  (3 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `login_en.png` | 90x43 | 578 B |
| `sign_en.png` | 90x43 | 728 B |
| `sprites.gif_20081002` | 440x270 | 19,288 B |

#### `misc/`  (9 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `border.png` | 81x59 | 364 B |
| `btn.gif` | 47x25 | 197 B |
| `btn1.gif` | 267x36 | 4,008 B |
| `btn_delete.jpg` | 34x22 | 451 B |
| `btn_social.jpg` | 60x25 | 468 B |
| `dotted_v1.gif` | 1x4 | 50 B |
| `pull.gif` | 36x19 | 387 B |
| `push.gif` | 36x19 | 261 B |
| `refresh_16.gif` | 16x16 | 141 B |

#### `pic_album/`  (34 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `bg_display_bar.png` | 1x1 | 70 B |
| `bg_promotion.png` | 696x270 | 98,801 B |
| `btn_trynow.png` | 96x33 | 208 B |
| `btn_trynow_hover.png` | 96x33 | 201 B |
| `cover.gif` | 80x80 | 5,408 B |
| `friend.gif` | 16x16 | 457 B |
| `ico_breadcrumb.png` | 16x364 | 4,140 B |
| `ico_commen.png` | 58x33 | 885 B |
| `ico_interf.png` | 46x34 | 834 B |
| `ico_loading.gif` | 16x16 | 764 B |
| `ico_monad.png` | 10x9 | 2,748 B |
| `ico_musicill.png` | 400x300 | 90,851 B |
| `ico_promtitl.png` | 252x14 | 2,123 B |
| `ico_promtxt.png` | 291x154 | 21,503 B |
| `ico_social.png` | 40x34 | 868 B |
| `icon30.png` | 120x30 | 6,304 B |
| `icon_comments.png` | 80x80 | 5,000 B |
| `icon_interface.png` | 80x80 | 5,519 B |
| `icon_social.png` | 80x80 | 7,046 B |
| `key.gif` | 16x16 | 570 B |
| `loading-1.gif` | 90x90 | 4,660 B |
| `m-1.gif` | 16x16 | 571 B |
| `mosazic.jpg` | 550x400 | 11,878 B |
| `music-2.gif` | 120x120 | 4,142 B |
| `music_thumbnail.png` | 90x90 | 897 B |
| `new_album.gif` | 21x11 | 159 B |
| `switch_popup.png` | 319x257 | 76,214 B |
| `tutorial_bg.jpg` | 590x420 | 33,234 B |
| `tutorial_btn.jpg` | 180x70 | 16,120 B |
| `tutorial_h1-1.jpg` | 540x60 | 54,108 B |
| `tutorial_h1-2.jpg` | 540x60 | 48,216 B |
| `tutorial_indicator.jpg` | 120x30 | 15,609 B |
| `v-1.gif` | 16x14 | 564 B |
| `waterfall.jpg` | 550x400 | 11,066 B |

#### `pic_album_user/`  (2 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `slideshowminus_on.gif` | 14x13 | 884 B |
| `slideshowplus_on.gif` | 14x13 | 891 B |

#### `pic_common/`  (45 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `bg_pfooter.jpg` | 1x26 | 674 B |
| `bg_promotion24.png` | 570x429 | 89,850 B |
| `bg_promotion8.png` | 570x429 | 35,022 B |
| `button_hover_img.png` | 223x28 | 192 B |
| `favicon.ico` | 16x16 | 318 B |
| `footer_left.png` | 100x25 | 2,423 B |
| `ico_close.png` | 14x13 | 212 B |
| `ico_expanded.png` | 13x13 | 196 B |
| `ico_facebook.png` | 16x16 | 3,076 B |
| `ico_fb.png` | 14x14 | 286 B |
| `ico_footer_album.png` | 16x12 | 426 B |
| `ico_footer_blog.png` | 13x13 | 556 B |
| `ico_footer_close.png` | 11x7 | 173 B |
| `ico_footer_open.png` | 11x7 | 175 B |
| `ico_footer_sprite.png` | 75x300 | 811 B |
| `ico_footer_video.png` | 13x13 | 391 B |
| `ico_kplizer.png` | 82x27 | 1,934 B |
| `ico_kplizer_hover.png` | 82x22 | 4,833 B |
| `ico_not_expanded.png` | 13x13 | 222 B |
| `ico_not_expanded_hover.png` | 13x13 | 222 B |
| `ico_noti.png` | 19x13 | 265 B |
| `ico_noti_clicked.png` | 19x13 | 269 B |
| `ico_noti_new.png` | 19x13 | 273 B |
| `ico_plurk.png` | 16x16 | 288 B |
| `ico_reblog_arrow.png` | 3x5 | 153 B |
| `ico_saved_msg.png` | 14x14 | 527 B |
| `ico_search.png` | 13x14 | 195 B |
| `ico_search_arrow.png` | 5x4 | 145 B |
| `ico_sprite.png` | 900x700 | 14,551 B |
| `ico_subscription.png` | 13x16 | 709 B |
| `ico_wretch.png` | 12x12 | 480 B |
| `ico_wretch_logo.png` | 72x20 | 2,164 B |
| `ico_wretch_logo_24.png` | 75x20 | 3,968 B |
| `ico_wretch_vitality.png` | 12x12 | 361 B |
| `ico_yim_png8.png` | 18x18 | 1,196 B |
| `icon_cam24.png` | 20x20 | 1,368 B |
| `icon_cam8.png` | 20x20 | 1,576 B |
| `isAuth_gold.gif` | 20x20 | 1,039 B |
| `isAuth_platinum.gif` | 20x20 | 990 B |
| `isAuth_silver.gif` | 20x20 | 1,049 B |
| `isAuth_super_gold.gif` | 20x20 | 1,080 B |
| `lock.gif` | 21x16 | 161 B |
| `rss.gif` | 36x14 | 322 B |
| `suggestion.png` | 100x25 | 4,641 B |
| `suggestion_hover.png` | 100x25 | 5,500 B |

#### `skin_style/`  (41 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `10_1084_1596523066.jpg` | 120x145 | 13,905 B |
| `10_1084_1596523068.jpg` | 154x107 | 5,437 B |
| `12_1220_body.jpg` | 1100x500 | 39,829 B |
| `12_1220_main.gif` | 1900x6000 | 32,069 B |
| `12_1220_mine.gif` | 300x170 | 4,931 B |
| `12_1220_msg_added.jpg` | 605x87 | 5,307 B |
| `12_1220_msg_content.jpg` | 605x87 | 6,944 B |
| `12_1220_msg_control.gif` | 70x21 | 176 B |
| `12_1220_page_control.gif` | 605x10 | 234 B |
| `12_1220_stats.gif` | 300x85 | 5,217 B |
| `14_1417_body.jpg` | 62x62 | 2,893 B |
| `14_1417_footer.gif` | 950x10 | 200 B |
| `14_1417_hr.gif` | 606x2 | 91 B |
| `14_1417_main.gif` | 950x9990 | 7,658 B |
| `14_1417_main_tab1.gif` | 119x36 | 1,044 B |
| `14_1417_main_tab2.gif` | 119x36 | 1,139 B |
| `14_1417_main_tab3.gif` | 119x36 | 1,179 B |
| `14_1417_mine.gif` | 300x170 | 1,015 B |
| `14_1417_msg_added.jpg` | 612x96 | 2,405 B |
| `14_1417_msg_content.jpg` | 612x96 | 3,724 B |
| `14_1417_msg_control.gif` | 70x21 | 145 B |
| `14_1417_myService.gif` | 23x2 | 58 B |
| `14_1417_stats.gif` | 170x29 | 2,390 B |
| `1_117_banner.gif` | 750x120 | 926 B |
| `1_117_blogbody.gif` | 530x20 | 194 B |
| `1_117_box.gif` | 200x30 | 326 B |
| `1_117_box1.gif` | 200x20 | 281 B |
| `1_117_calendar.gif` | 200x200 | 906 B |
| `1_117_date.gif` | 530x30 | 433 B |
| `1_1911_footer.gif` | 958x30 | 630 B |
| `1_1911_header.gif` | 286x53 | 4,389 B |
| `1_1911_main.gif` | 958x75 | 844 B |
| `1_1911_message.gif` | 120x39 | 755 B |
| `1_1911_mine.gif` | 330x183 | 599 B |
| `1_1911_msg_added_form.gif` | 583x113 | 393 B |
| `1_1911_msg_body.gif` | 604x20 | 277 B |
| `1_1911_stats.gif` | 217x40 | 3,725 B |
| `1_1911_tab2_l.gif` | 130x39 | 193 B |
| `1_1911_tab2_r.gif` | 10x39 | 129 B |
| `1_1911_tab_l.gif` | 130x39 | 194 B |
| `1_1911_tab_r.gif` | 10x39 | 127 B |

#### `smiley_msn/`  (46 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `angel_smile.gif` | 19x19 | 445 B |
| `angry_smile.gif` | 19x19 | 453 B |
| `broken_heart.gif` | 19x19 | 423 B |
| `confused_smile.gif` | 19x19 | 322 B |
| `cry_smile.gif` | 19x19 | 473 B |
| `devil_smile.gif` | 19x19 | 444 B |
| `embaressed_smile.gif` | 19x19 | 1,077 B |
| `envelope.gif` | 19x19 | 1,030 B |
| `heart.gif` | 19x19 | 1,012 B |
| `kiss.gif` | 19x19 | 978 B |
| `lightbulb.gif` | 19x19 | 303 B |
| `omg_smile.gif` | 19x19 | 342 B |
| `regular_smile.gif` | 19x19 | 1,036 B |
| `sad_smile.gif` | 19x19 | 1,039 B |
| `shades_smile.gif` | 19x19 | 1,059 B |
| `teeth_smile.gif` | 19x19 | 1,064 B |
| `thumbs_down.gif` | 19x19 | 992 B |
| `thumbs_up.gif` | 19x19 | 989 B |
| `tounge_smile.gif` | 19x19 | 1,055 B |
| `whatchutalkingabout_smile.gif` | 19x19 | 1,034 B |
| `wink_smile.gif` | 19x19 | 1,041 B |
| `y01.gif` | 19x19 | 1,140 B |
| `y02.gif` | 19x19 | 387 B |
| `y03.gif` | 19x19 | 377 B |
| `y04.gif` | 19x19 | 369 B |
| `y05.gif` | 19x19 | 572 B |
| `y06.gif` | 20x20 | 513 B |
| `y07.gif` | 19x19 | 583 B |
| `y08.gif` | 19x19 | 438 B |
| `y09.gif` | 19x19 | 1,674 B |
| `y10.gif` | 19x19 | 1,537 B |
| `y11.gif` | 19x19 | 2,703 B |
| `y12.gif` | 19x19 | 1,197 B |
| `y13.gif` | 19x19 | 1,761 B |
| `y14.gif` | 19x19 | 1,717 B |
| `y15.gif` | 19x19 | 1,241 B |
| `y16.gif` | 19x19 | 1,363 B |
| `y17.gif` | 19x19 | 3,644 B |
| `y18.gif` | 19x19 | 2,215 B |
| `y19.gif` | 19x19 | 1,542 B |
| `y20.gif` | 19x19 | 3,641 B |
| `y21.gif` | 19x19 | 1,540 B |
| `y22.gif` | 19x19 | 1,620 B |
| `y23.gif` | 19x19 | 1,324 B |
| `y24.gif` | 19x19 | 1,476 B |
| `y25.gif` | 19x19 | 859 B |

#### `yserv_album/`  (9 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `bg_phototools.png` | 1x29 | 232 B |
| `bg_shadow_left.png` | 25x420 | 1,532 B |
| `bg_shadow_right.png` | 25x420 | 1,458 B |
| `ico_carousels.png` | 49x300 | 3,183 B |
| `ico_comments.png` | 16x200 | 3,867 B |
| `ico_phototools.png` | 28x440 | 3,478 B |
| `ico_reply_collapse.png` | 5x10 | 126 B |
| `ico_switchver.png` | 80x581 | 3,125 B |
| `ico_warning.png` | 12x12 | 217 B |

#### `yserv_blog/`  (12 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `button-r-b.png` | 145x36 | 694 B |
| `close.gif` | 15x15 | 145 B |
| `email.gif` | 25x25 | 1,207 B |
| `ico_info.png` | 43x36 | 1,766 B |
| `ico_trackback_expand.jpg` | 13x13 | 959 B |
| `ico_trackback_hide.jpg` | 13x13 | 944 B |
| `ico_warning.png` | 39x35 | 1,742 B |
| `lock.gif` | 21x16 | 161 B |
| `plus.gif` | 11x11 | 843 B |
| `rss.gif` | 36x14 | 322 B |
| `user_cover.gif` | 85x85 | 1,634 B |
| `webpage.gif` | 25x25 | 1,221 B |

#### `yserv_common/`  (14 files)

| �ɦW | �ؤo | �ɮפj�p |
|---|---|---|
| `No_Login_60.gif` | 60x60 | 2,739 B |
| `button_admin.gif` | 2x25 | 165 B |
| `hot.png` | 93x18 | 2,002 B |
| `ico_haha_bar_sprite.png` | 16x193 | 353 B |
| `ico_spinner_16.gif` | 16x16 | 620 B |
| `ico_sprite.png` | 900x700 | 14,551 B |
| `isAuth.gif` | 20x20 | 1,165 B |
| `isAuth_gold.gif` | 20x20 | 1,039 B |
| `isAuth_platinum.gif` | 20x20 | 990 B |
| `isAuth_super_gold.gif` | 20x20 | 1,080 B |
| `key.gif` | 16x16 | 570 B |
| `lock.gif` | 21x16 | 161 B |
| `rss.gif` | 36x14 | 322 B |
| `zoom.gif` | 16x16 | 948 B |


---

*盤點完成：337 個素材檔，全數通過檔頭驗證。CSS/HTML 引用但查無存檔者共 8 個，已於第 7 節逐一列出。*
