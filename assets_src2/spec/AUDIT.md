# AUDIT — 無名小站 2011–2013 測繪成果總稽核

> 稽核對象：`assets_src2/` 全部內容（5 份規格書 ＋ 544 個圖檔 ＋ 71 份 CSS/JS ＋ 44 份 HTML ＋ 18 張截圖）
> 稽核方式：**不採信任何規格書的自述**。所有檔案數、尺寸、色碼、結構主張，一律用
> `find` / `md5sum` / `file` / PNG-IHDR·GIF-LSD·JPEG-SOFn 檔頭解析 / 對原始 CSS 與 HTML grep 重新驗證。
> 標記：**【核實】**＝本次獨立驗證通過；**【推翻】**＝規格書說法與實測不符；**【未決】**＝證據不足以判定。

---

## 0. 三句話結論

1. **五份規格書的尺寸數據品質極高。** blog.md 26 項、index.md 29 項資產尺寸，
   本次逐一重量，**55/55 全中，零誤差**。chrome.md 的 MD5 主張也逐字元吻合。
2. **但 `assets.md` 第 7 節「抓不到的清單」是錯的，而且錯得會誤導復刻。**
   它列為「archive.org 完全沒有存檔」的 4 個檔案，**其中 4 個都躺在同一個 repo 的 `img/album/` 與 `img/blog/` 裡**，
   包含它自己標為「唯一真正有影響」的 `ico_usercard.png`。
3. **最危險的一項不是缺料，是 `assets.md` 把 2011 年就被淘汰的元件寫成現役規格。**
   它花了整整一節詳述「全站底部固定列 `#bottom-footer`（26px）」——
   而 2012／2013 的頁面裡這個元件**一次都沒出現過**，現役的是 `#kukubar-lower`（25px）。
   照 assets.md 復刻底部工具列會做出錯的東西。

---

## 1. 素材實際盤點表

### 1.1 總量【核實】

| 項目 | 數字 | 說明 |
|---|---|---|
| `img/` 實體檔案總數 | **544** | — |
| 內容去重後（MD5） | **339** | 有 205 個檔是同內容的複本 |
| 損毀 / 0 byte / 誤存成 HTML | **0** | 544 個全數通過 `file` 檔頭驗證 |
| 空目錄 | 1 | `img/common/index2/`（建了沒放東西） |

**存在兩套並行的目錄命名法**，這是 544 vs 339 的成因：

| 體系 | 目錄 | 檔數 | 去重後 | 命名規則 |
|---|---|---|---|---|
| A（assets 代號建立） | `img/common/<來源前綴>/` | **337** | 325 | 依原始 URL 前綴分組，檔名保持原樣 |
| B（各頁代號各自建立） | `img/{album,blog,chrome,gb,index,skin117}/` | **207** | — | 依「哪個介面用得到」分組，部分加前綴（`idx3_`、`style117_`） |

> 【核實】A 體系的 337 與 `assets.md` §6.1 自述的 337 **完全吻合**。
> 【核實】B 體系的 207 個檔中，**189 個與 A 完全同 byte**，只有 **14 個是 A 沒有的獨有素材**（見 §3.1）。

### 1.2 逐目錄盤點【核實】

| 目錄 | 檔數 | png | gif | jpg | 其他 | 總 bytes | 內容 |
|---|---|---|---|---|---|---|---|
| `common/index3/` | 29 | 29 | – | – | – | 109,029 | 首頁 index3 全套（與 `index/` 同內容） |
| `index/` | 29 | 29 | – | – | – | 109,029 | 同上，index 代號的複本 |
| `common/pic_common/` | 45 | 37 | 6 | 1 | 1 | 185,262 | kukubar／底列／分享列 **生產版**圖示 |
| `chrome/` | 42 | 40 | 1 | – | 1 | 148,949 | 同上，chrome 代號版（部分為不同檔，見 §4.3） |
| `common/pic_album/` | 34 | 18 | 9 | 7 | – | 531,738 | 相簿頁；**含大量改版宣傳圖** |
| `album/` | 56 | 39 | 13 | 4 | – | 552,199 | 相簿頁，album 代號版 |
| `common/smiley_msn/` | 46 | – | 46 | – | – | 52,044 | MSN 表情全套（21 具名 ＋ y01–y25） |
| `common/index_album/` | 41 | 13 | 15 | 13 | – | 68,930 | 相簿**首頁**（非個人相簿） |
| `common/skin_style/` | 41 | 6 | 29 | 6 | – | 153,311 | 使用者自訂面板 5 套樣本（117/1911/1084/1220/1417） |
| `common/index_blog/` | 24 | 4 | 19 | 1 | – | 48,341 | 網誌**首頁**（非個人網誌） |
| `common/gb_smileys/` | 21 | – | 21 | – | – | 35,471 | 留言板表情 20 個 ＋ email.gif |
| `gb/Smileys/` | 20 | – | 20 | – | – | 34,264 | 同上（少 email.gif） |
| `blog/` | 26 | 6 | 18 | 2 | – | 28,290 | 網誌內頁官方圖示 ＋ 117 樣板 |
| `gb/` | 15 | 2 | 11 | 2 | – | 19,935 | 留言板 |
| `common/yserv_common/` | 14 | 3 | 11 | – | – | 26,705 | `l.yimg.com/e/serv/common/img/` |
| `gb/style_1417/` | 13 | 6 | 4 | 3 | – | 23,941 | 留言板面板 1417 |
| `common/yserv_blog/` | 12 | 3 | 7 | 2 | – | 11,638 | `l.yimg.com/e/serv/blog/img/` |
| `common/yserv_album/` | 9 | 9 | – | – | – | 17,218 | 相簿垂直 sprite 群 |
| `common/misc/` | 9 | 1 | 6 | 2 | – | 6,327 | 雜項（含拼錯的 `hgusetbook_001/btn1.gif`） |
| `common/friend/` | 7 | 2 | 5 | – | – | 14,933 | 好友頁 |
| `skin117/` | 6 | – | 6 | – | – | 3,066 | 網誌預設樣板 1/117 |
| `common/index_root/` | 3 | 2 | 1 | – | – | 20,594 | 首頁根目錄 |
| `common/pic_album_user/` | 2 | – | 2 | – | – | 1,775 | 幻燈片加減速鈕 |

### 1.3 關鍵素材尺寸（本次全部重量，非引用）【核實】

**全站框架**

| 檔案 | 尺寸 | 位置 |
|---|---|---|
| `ico_sprite.png`（**全站主 sprite**） | **900×700** | 5 份同 byte：`chrome/`、`index/`、`common/{index3,pic_common,yserv_common}/` |
| `ico_footer_sprite.png` | 75×300 | `common/pic_common/` **僅一份** |
| `ico_wretch_logo_24.png` / `ico_wretch_logo.png` | 75×20 / 72×20 | `chrome/`、`common/pic_common/` |
| `logo_wretch.png`（首頁大 logo） | 130×36 | `chrome/`、`index/`、`common/index3/` |
| `logo_new.png`（2014 過渡頁） | 128×36 | `chrome/` **僅一份** |
| `bg_pfooter.jpg` | **1×26** | `common/pic_common/`（`file` 會誤報 96×96，勿信） |
| `favicon.ico` | 16×16 4bpp | `chrome/`、`common/pic_common/` |

**首頁 index3**

| 檔案 | 尺寸 | 備註 |
|---|---|---|
| `bg_hd_trans.png` | 968×121 | 頁首天空＋導覽列高光，一張圖兩用 |
| `bg_nav_default.png` | 970×40 | 綠色導覽列 fallback（CSS 盒高 37px，圖高 40px） |
| `img_fp_outline.png` | 970×280 | `#wrapper` 外框 |
| `bg_wrapper.png` | 976×3 | IE 投影 |
| `bg_hugc_*.png` ×6 | 各 1×35 | gray/lime/mint/orange/pink/violet |
| `ico_medal.png` | 125×48 | 熱門相簿冠軍徽章 |

**相簿垂直 sprite（`common/yserv_album/`）**

| 檔案 | 尺寸 |
|---|---|
| `ico_switchver.png` | 80×581 |
| `ico_phototools.png` | 28×440 |
| `ico_carousels.png` | 49×300 |
| `ico_comments.png` | 16×200 |
| `bg_shadow_left.png` / `bg_shadow_right.png` | 各 25×420 |
| `ico_breadcrumb.png`（在 `pic_album/`） | 16×364 |

**網誌預設樣板 1/117**（`skin117/`、`blog/style117_*`、`common/skin_style/1_117_*` 三處同 byte）

`banner.gif` 750×120 ｜ `date.gif` 530×30 ｜ `blogbody.gif` 530×20 ｜ `box.gif` 200×30 ｜ `box1.gif` 200×20 ｜ `calendar.gif` 200×200

**表情符號**

- `smiley_msn/` 46 個，一律 19×19（`y06` 例外 20×20）
- `gb_smileys/` 20 個：`angry` 34×18、`bighug` 42×18、`waiting` 23×18、`crying`/`shameonyou` 22×18、`confused` 20×18，其餘 14 個 18×18；另 `email.gif` 25×25

### 1.4 體積分布提醒【核實】

`album/` ＋ `pic_album/` 佔全庫 1.08 MB（約 62%），但**前 9 大檔全部是改版宣傳／教學頁素材**，不是常態 UI：

`bg_promotion.png` 696×270 (98.8 KB)、`ico_musicill.png` 400×300 (90.9 KB)、`bg_promotion24.png` 570×429 (89.9 KB)、`switch_popup.png` 319×257 (76.2 KB)、`tutorial_h1-1.jpg` 540×60 (54.1 KB)、`tutorial_h1-2.jpg` 540×60 (48.2 KB)。

→ 真正的常態 UI 素材總量其實很小；復刻時這 6 個檔可以直接排除。

---

## 2. 復刻可行度評分

評分基準：100 ＝ 有原始 HTML＋原始 CSS＋全部素材＋逐字文案，可做到像素級 1:1。

| # | 介面 | 分數 | 規格書 | 主要扣分原因 |
|---|---|---|---|---|
| 1 | **首頁** `www.wretch.cc/` | **93** | index.md（1352 行） | −3 登入態 `#wfp-my` HTML 查無；−2 全部內容照片為使用者資料，需替代；−2 名家專欄縮圖下載失敗＋6 個廣告位存檔全空 |
| 2 | **全站頂/底工具列** kukubar | **85** | chrome.md（859 行） | −8 **登入態 DOM 全部是【推】**（爬蟲永遠登出，通知面板／好友動態／訂閱面板都只存在於登入後）；−4 圖示版本雙包（§4.3）；−3 `ico_loading.gif` |
| 3 | **網誌** blog | **80** | blog.md（1272 行） | −12 **中文語系模板字串完全查無**（12 個快照全是英文）；−5 官方樣板只抓到 5 套（實際數千套）；−3 `minus.gif`、零迴響空狀態、站長編輯視角查無 |
| 4 | **登入頁**（＝ Yahoo!奇摩） | **70** | chrome.md §7 | −15 只有 2011 快照，2012/2013 登入頁未取得；−10 `yklogo.gif` 等 Yahoo 素材未抓；−5 繁中註冊頁查無 |
| 5 | **相簿** album（列表／單本） | **55** | **無** | −25 **沒有規格書**：`album_wspp.css`（51.9 KB，全庫最大 UI 樣式表）已抓到卻無人拆解，DOM／色碼／尺寸表一張都沒有；−12 使用者照片全數 403；−8 預設皮膚未確認（抓到的使用者全套自訂 CSS） |
| 6 | **單張照片頁** show.php | **50** | **無** | −25 沒有規格書；−15 **主圖一張都沒抓到**；−10 2012 英文版與 2013 中文版差異未整理 |
| 7 | **好友頁** friend | **50** | **無**（僅 shot.md §3-3/§6-9） | −25 沒有規格書；−15 `gb_friend_fix.css` 未拆解；−10 只有量到的格線數據（卡片 112×155、欄距 124、列距 171） |
| 8 | **名片頁** user | **45** | **無**（僅 shot.md §6-8） | −25 沒有規格書；−20 `gb_namecard.css` 僅 1.6 KB，資訊量不足以還原版面 |
| 9 | **留言板** guestbook | **45** | **無**（僅 shot.md §6-7） | −25 沒有規格書；−15 **預設皮膚從未取得**（樣本全套自訂 CSS）；−10 **2012 全年零筆 200 快照**，只能靠 2011＋2013 內插，而這兩版設計不同（2011 是動態牆版） |
| 10 | **誰來我家** mypage（獨立頁） | **20** | **無** | −60 `www.wretch.cc/mypage*` prefix **查無任何 200 快照**，等於零素材。（註：網誌側欄的 `#boxWho` 模組另有完整記載於 blog.md §3-3，兩者不是同一個東西，勿混用） |

### 加權總評

- **可直接做 1:1 的**：首頁、kukubar 登出態、網誌版面骨架 → 這三塊佔全站視覺辨識度最高的部分，素材與規格都齊。
- **有料但沒人做功課的**：相簿、照片頁、好友、名片、留言板 → 原始 CSS/HTML 都在硬碟上，缺的是「有人去讀它」。這 5 項的分數**可以靠補寫規格書拉到 75–85，不需要再上網抓任何東西**。
- **真的救不回來的**：mypage 獨立頁、中文語系模板字串、登入態 DOM、所有使用者照片。

---

## 3. 缺口清單

### 3.1 「規格書說抓不到、實際上抓到了」——4 個【推翻】

`assets.md` §7.1／§7.2 宣告下列檔案「archive.org 完全沒有存檔」。實測：**全部存在且檔頭有效**。

| 檔案 | assets.md 說法 | 實際位置 | 實測尺寸 |
|---|---|---|---|
| **`ico_usercard.png`** | 「**有影響**。無替代品，需自行重繪或省略」 | `img/album/ico_usercard.png` | **19×110** PNG 4bpp, 311 B |
| `bg_shadow_left_ie6.png` | 「查無存檔」 | `img/album/` | 25×420, 1,360 B |
| `bg_shadow_right_ie6.png` | 「查無存檔」 | `img/album/` | 25×420, 1,245 B |
| `wretch_ch.gif` | 「查無存檔」 | `img/album/` | 129×35, 4,078 B |

> assets.md §0 寫「**真正會影響復刻的只有 1 個：`ico_usercard.png`**」。
> 那 1 個也在。**assets.md 的缺口清單淨值為零個真正有影響的檔案。**
> 成因：assets 代號只掃自己建的 `img/common/` 子樹，沒有看 album 代號同時間放進 `img/album/` 的東西。

### 3.2 CSS 有引用但確實沒抓到——3 個【核實】

把 71 份 CSS 的 `url()` 全部抽出（210 個唯一檔名），扣掉 `data:`、使用者上傳、第三方後，比對 `img/`：

| 檔案 | 引用它的 CSS | 影響 |
|---|---|---|
| `def.gif` | `album_userskin_leepeihsuam.css` | **無**。單一使用者自訂下拉選單素材 |
| `hover.gif` | 同上 | **無**。同上 |
| `selectItem.gif` | 同上 | **無**。同上 |

另有 2 個是**依政策刻意排除**，不算缺口：
`1188632694.jpg`（使用者相片）、`L6P2fymQtet.png`（`static.ak.fbcdn.net`，Facebook CDN）。

> 順帶更正：初步比對會多出 13 個「疑似缺件」（`header.gif`、`tab_l.gif`、`page_control.gif`、`1596523066.jpg` …），
> 那是 `common/skin_style/` 的**前綴改名**造成的假警報，實際都在（`1_1911_header.gif`、`12_1220_page_control.gif` …）。
> 復刻時 **CSS 內的路徑必須跟著改寫**，否則整套面板圖會全破。

### 3.3 HTML 有引用但沒抓到的 UI 圖——2 個【核實】

| 檔案 | 原始 URL | 出現在 | 影響 |
|---|---|---|---|
| `yklogo.gif` | `tw.yimg.com/i/tw/reg/purple/yklogo.gif` | `chrome_yahoo_login_20110623.html` | **中**。登入頁的 Yahoo!奇摩 logo，直接影響 §2 第 4 項評分 |
| `map_texticon.gif` | `tw.yimg.com/i/tw/lifestyle/map_texticon.gif` | 一份使用者網誌頁 | **無**。第三方模組 |

### 3.4 完全沒有測繪到的頁面【核實】

| 頁面 | 有 HTML？ | 有 CSS？ | 有截圖？ | 有規格書？ |
|---|---|---|---|---|
| 個人相簿列表 `album/<user>` | ✅ 8 份 | ✅ 143 KB / 16 份 | ✅ 3 張 | ❌ |
| 單本相簿 `album.php` | ✅ | ✅ | ✅ 2 張 | ❌ |
| 單張照片 `show.php` | ✅ 3 份 | ✅ | ✅ 2 張 | ❌ |
| 留言板 `guestbook/<user>` | ✅ 12 份 | ✅ 50 KB / 11 份 | ✅ 2 張 | ❌ |
| 名片頁 `user/<user>` | ✅ 2 份 | ✅ 1.6 KB | ✅ 2 張 | ❌ |
| 好友頁 `friend/<user>` | ✅ 3 份 | ✅ 8.7 KB | ✅ 2 張 | ❌ |
| **誰來我家 `mypage`** | ❌ | ❌ | ❌ | ❌ |
| 相簿首頁 `www.wretch.cc/album/` | ❌ | ✅ | ❌ | ❌（有 41 個素材躺在 `index_album/` 沒人用） |
| 網誌首頁 `www.wretch.cc/blog/` | ✅ 1 份 | ✅ | ❌ | ❌（同上，`index_blog/` 24 個素材） |
| 影音 / 揪團 / 嘀咕 | ❌ | ❌ | ❌ | ❌ |

> **最大浪費**：`common/index_album/`（41 檔）與 `common/index_blog/`（24 檔）共 65 個素材已下載完成，
> 但相簿首頁與網誌首頁**既無截圖也無規格書**，這 65 個檔目前無人知道該貼在哪裡。

### 3.5 結構性、抓不回來的空白【核實】

| 項目 | 狀態 | 為什麼救不回來 |
|---|---|---|
| **中文語系網誌模板字串** | 查無 | IA 爬蟲無語系 cookie，2007–2013 共 12 個快照全回英文表 |
| **登入態 kukubar / `#wfp-my` DOM** | 查無 | 爬蟲永遠是登出狀態。通知面板、好友動態、訂閱面板的 CSS 都在，但沒有任何一份 HTML 證實其結構 |
| **2012 年留言板** | 查無 | 整年零筆 200 快照 |
| **所有使用者照片** | 403 | `f8~f12.wretch.yimg.com` 一律 403，只有 5 個帳號的 `thumbs/` 倖存 |
| **官方換造型樣板庫** | 查無 | `l.yimg.com/e/style/` 的 CDX prefix 查詢永遠 504；現有 5 套是數千套中的樣本 |

---

## 4. 矛盾清單

### 4.1 【推翻】assets.md 把 2011 年淘汰的元件寫成現役規格 —— 最高風險

| | assets.md §3／§5.1 | chrome.md §3.2 |
|---|---|---|
| 元件 | `#bottom-footer`（persistent_footer.css） | `#kukubar-lower`（kukubar.css） |
| 高度 | **26px** | **25px** |
| 定位 | `position:fixed`＋`.center-wrapper` 970px | `position:fixed; width:100%` |
| 內部 | `.toggle-block` 938×27、`ico_footer_sprite.png` | `.bar-block` 25px、`#footer-switch` 35×25 |
| assets.md 稱它為 | 「**全站**底部固定列」 | — |

**實測裁決（grep 全部 44 份 HTML）：**

```
chrome_blog_20110517_hahabar.html   persistent_footer=1   kukubar-lower=0   bottom-footer=0
chrome_blog_20120817.html           persistent_footer=0   kukubar-lower=2   bottom-footer=0
chrome_blog_20130727.html           persistent_footer=0   kukubar-lower=2   bottom-footer=0
chrome_blog_20131226_readonly.html  persistent_footer=0   kukubar-lower=2   bottom-footer=0
album_show_zh_kellyla.html          persistent_footer=0   kukubar-lower=1   bottom-footer=0
gb_guestbook_a000000010_20131226.html persistent_footer=0 kukubar-lower=1   bottom-footer=0
```

- `persistent_footer.css` **只出現在 2011-05 那一份**（同一份也是唯一掛舊版 haha-bar 的頁面）。
- `#bottom-footer` 這個 id 在**全部 44 份 HTML 裡出現 0 次**，連 2011 那份都沒有。
- assets.md 引用的 `persistent_footer.css` 快照時間戳是 `20110416000553`——**2011 年 4 月**。

> **裁決：chrome.md 正確，assets.md §3「底部固定列高度 26px」與 §5.1 整段 DOM 是 2011 年以前的舊版，不適用於 2011–2013 最後版。**
> 復刻底部工具列**一律以 chrome.md §3.2／§5.2 為準**（25px、`#kukubar-lower`）。
> assets.md 的 `ico_footer_sprite.png`（75×300）與 `bg_pfooter.jpg`（1×26）也一併降級為舊版素材。

### 4.2 【推翻】assets.md 稱 kukubar 為「全站」，但首頁沒有 kukubar

| | 說法 |
|---|---|
| assets.md §2.1／§5.2 | 「**全站**頂端橫條 kukubar」 |
| index.md §0 | 「**首頁沒有 kukubar。**我 grep 過 5 份原始 HTML，全文都沒有 `kukubar` 這個字串」 |
| chrome.md §0 | 「`#wfp-universal-header`／`#wfp-navigation`／`#wfp-footer` **只出現在首頁**」 |

**實測裁決（grep 6 份首頁 HTML）：** `kukubar` 出現 **0 次**，`wfp-universal-header` 出現 **2 次**，全部 6 份一致。

> **裁決：index.md 與 chrome.md 正確。** kukubar 是**內頁**（網誌／相簿／留言板／名片／好友）元件，首頁用自己的一套頁首。
> assets.md 的「全站」二字會讓人在首頁上多貼一條工具列。

### 4.3 【未決】同名不同檔：兩批來源不同的圖示混在 repo 裡

13 組同檔名、不同內容。逐一驗 PNG chunk 後發現是**乾淨的兩批**：

| 檔名 | `img/album/`、`img/chrome/` 版 | `img/common/pic_common/` 版 | CSS 要求 |
|---|---|---|---|
| **`ico_kplizer.png`** | **82×23**, 4,842 B, 含 iCCP | **82×27**, 1,934 B, PNG-8 | **`height:27px`** ← pic_common 勝 |
| `ico_noti.png` | 12×12, 2,992 B, 含 iCCP | 19×13, 265 B, PNG-8 | `center center` 於 35×30 盒，兩者皆可 |
| `ico_noti_new.png` | 12×12, 3,061 B | 19×13, 273 B | 同上 |
| `ico_noti_clicked.png` | 12×12, 3,016 B | 19×13, 269 B | 同上 |
| `ico_wretch.png` | 12×12, 3,181 B | 12×12, 480 B | 尺寸相同 |
| `ico_plurk.png` | 16×16, 2,913 B | 16×16, 288 B | 尺寸相同 |
| `ico_yim_png8.png` | 18×18, 3,170 B | 18×18, 1,196 B | 尺寸相同 |

**規律【核實】：`album/`、`chrome/` 那批**全部**帶 2,637 B 的 iCCP（Photoshop 匯出原檔）；`pic_common/` 那批**全部**是 PNG-8 palette＋tRNS（上線前壓過的生產版）。**

決定性證據：`album_wspp.css` 原文

```css
.kplizer a.kplizer-btn{background:url(../img/ico_kplizer.png) no-repeat!important;width:82px;height:27px}
```

**82×27 只有 `pic_common/` 那份對得上。** `chrome.md` §8.2 記載的「`ico_kplizer.png` 82×23」與 `blog.md` §7-4
「社群列圖示在 `assets_src2/img/album/`」都會指向填不滿按鈕的那一份。

> **建議裁決：一律採用 `img/common/pic_common/` 版。** 但 `ico_kplizer_hover.png` 三份同 byte 且是 **82×22**，
> 與 27px 的盒仍差 5px——這一點原站可能本來就有瑕疵，標【未決】。

其餘 6 組同名不同檔是**本來就不同用途**，非矛盾，但務必別選錯：

| 檔名 | 兩個都要留 |
|---|---|
| `ico_close.png` | `blog/` 9×9（外連警告彈窗） ≠ `chrome/` 14×13（訂閱面板） |
| `ico_warning.png` | `blog/` 39×35（外連警告） ≠ `album/` 12×12（相簿提示） |
| `close.gif` | `blog/` 15×15 ≠ `index_blog/` 21×21 |
| `arrow.gif` | `index_album/` 7×5 ≠ `index_blog/` 15×15 |
| `header.jpg` | `index_album/` 960×80 ≠ `index_blog/` 519×62 |
| `broken_heart.gif` | `gb_smileys/` 18×18 ≠ `smiley_msn/` 19×19 |

### 4.4 【推翻】index.md 把導覽列漸層方向標反了（與它自己的量測數據互相矛盾）

| 來源 | 說法 |
|---|---|
| index.md §4.2 | 「導覽列綠色漸層（**左→右**）`#B2CD89 → … → #56BA99`」 |
| chrome.md §2.4 | 「綠色導覽列漸層（水平，**右→左**）`#B2CD89 → … → #56BA99`」 |

**原始 CSS【核實】：**

```css
#wfp-navigation{background:-webkit-gradient(linear,100% 0,0% 0,from(#B2CD89),to(#56BA99),…)}
```

起點 `100% 0` ＝ **右**，所以 `from(#B2CD89)`（黃綠）在右、`to(#56BA99)`（青綠）在左。

**index.md 自己在兩行後的量測也證明它標反了**：
`bg_nav_default.png` y=18 由左至右取樣 → `#58af87`（青綠）… `#b7d089`（黃綠）。
shot.md §2-2 的像素取樣也一致：x=170（偏左）`#59B587` 青綠、x=640（中）`#75B45B` 黃綠。

> **裁決：chrome.md 正確。** 色碼清單本身無誤，只有方向標籤要反過來讀。

### 4.5 【未決】shot.md 把 CSS 漸層誤判為 sprite

shot.md §2-2 註記：「主導覽列的綠色是左右也有漸層的……**應該是一張橫向 sprite**。【驗，像素量到】」

實際上是**兩層疊加**：CSS 水平漸層（§4.4）＋ `bg_hd_trans.png` 的 `0 -84px` 那一段當白色半透明覆蓋（chrome.md §3.3、index.md §8 都記載）。
shot.md 量到的「垂直方向也有漸層」來自覆蓋層，不是 sprite。

> 量測數據無誤，機制推論錯誤。標【推】的部分請以 chrome.md／index.md 的 CSS 原文為準。

### 4.6 【核實】可互相補位、看似矛盾其實不是的兩處

| 議題 | A 說法 | B 說法 | 裁決 |
|---|---|---|---|
| `ico_loading.gif` | chrome.md §8.1：「❌ 查無（CDX 零筆）」 | assets.md：`pic_album/ico_loading.gif` **16×16 已取得** | **兩者都對**，是不同 URL（`l.yimg.com/e/serv/common/img/` vs `pic.wretch.cc/e/serv/album/img/`）。→ **缺口可用 pic_album 那份補上**，chrome.md 的 ❌ 應改為「已由 album 來源補齊」 |
| 導覽列高度 | chrome.md／index.md：CSS `height:37px`（IE `*38px`） | shot.md §3-1：像素量到 **38px** | **兩者都對**：37px 盒 ＋ 1px `border-top` ＝ 38px。非矛盾 |

### 4.7 【核實】方法論自相矛盾（低風險，但要記一筆）

- `assets.md` 開頭警告：「所有尺寸皆以程式解析檔頭取得，**不是** `file` 指令的輸出（`file` 會把 JPEG 的 DPI density 誤報成尺寸）」。
- `chrome.md` §8 開頭卻寫：「尺寸皆為 **`file` 實測**」。

本次重驗結果：chrome.md 列的全是 PNG/GIF，`file` 在這兩種格式上不會誤報，所以**數字全對**。
但若有人沿用 chrome.md 的方法去量 JPEG，就會踩到 assets.md 警告的坑。

- `assets.md` 宣稱用「ICO header」驗證了 `favicon.ico` 16×16，但 repo 內附的 `imgsize.cjs` **並不支援 ICO**（實跑回 `? 0x0`）。
  該尺寸最後是靠 `file` 佐證為真（16×16, 16 色）。結論無誤，但佐證方式與自述不符。

### 4.8 【核實】assets.md 第 9 節整段表頭是亂碼

`assets.md` 內有 **15 處 U+FFFD**，全部集中在第 9 節的表頭：

```
| �ɦW | �ؤo | �ɮפj�p |     ← 應為  | 檔名 | 尺寸 | 檔案大小 |
```

Big5 位元組被當成 UTF-8 寫入。其他 4 份規格書皆為 0 處。**檔案總表的資料列是好的，只有表頭壞掉**，需修復。

---

## 5. 建議

### 5.1 可以做到 1:1（像素級）

| 部位 | 依據 | 附註 |
|---|---|---|
| **首頁全頁** | index.md §6 逐字 DOM ＋ `wfp-css`（92 KB）＋ 29/29 素材 ＋ `wfp-js`（58 KB） | 用 **2012 版 CSS** 即可涵蓋到關站——index.md 已 diff 過，2013 版只多 `.notification` 13 條規則 |
| **kukubar 上下條（登出態）** | chrome.md §5.1/§5.2 逐字 DOM ＋ `kukubar.css`（41.9 KB）＋ `kukubar.js`（39 KB） | 12px／`font-weight:400` 的 `!important` 鎖死**務必照抄**，否則疊上使用者面板會走樣 |
| **網誌版面骨架＋預設樣板 1/117** | blog.md §8 逐字 DOM ＋ 樣板 6 張圖全在（尺寸 6/6 核實） | 750/530/200 三欄、`.date` 30px、`.sidetitle` 30px 全部可精確重現 |
| **網誌官方模組**（推文鈕、迴響、引用、誰來我家、外連警告） | `font.css`／`trackback.css`／`antiPhishing.css`／`friend_picker.css` 全在，22 個圖示尺寸 22/22 核實 | 推文鈕 81×59＋`push/pull.gif` 36×19 可 1:1 |
| **表情符號系統** | MSN 46 個 ＋ 留言板 20 個，全部原檔 | 兩套尺寸不同，勿混用 |
| **社群分享列** | `sharing.css` ＋ 圖示全在 | 前提：採 `pic_common/` 版圖示（見 §4.3） |
| **全站 sprite 定位** | `ico_sprite.png` 900×700 ＋ chrome.md §8.4／index.md §9 兩份獨立圖塊地圖 | 兩份地圖互相印證，可信度高 |

### 5.2 只能近似

| 部位 | 為什麼 | 建議做法 |
|---|---|---|
| **網誌／留言板的中文介面文字** | 所有存檔都是英文語系表 | 用 blog.md §6-B 已確認的寫死中文（推薦此文章／1樓搶頭香／歷史上的今天…）打底，其餘依當年慣用語重寫，並在 UI 上**標註為推測**。不要假裝是原文 |
| **登入態的通知面板／好友動態／訂閱面板** | 只有 CSS 沒有 HTML | 依 chrome.md §5.3 的選擇器反推結構。視覺可近 1:1（色碼尺寸都是【驗】），DOM 命名只能推測 |
| **相簿／留言板的預設皮膚** | 抓到的使用者全套自訂 CSS | 從 `album_wspp.css`／`gb_layout.css` 的**未被覆寫**規則反推預設值；或明確採用某一位使用者的皮膚並註明出處 |
| **所有使用者照片與大頭貼** | 403 / 依政策排除 | 用自製佔位圖，尺寸照 index.md §8 的實測表（418×274、298×298、156×96、55×55、217×217、207×155、100×75、80×80、90×90、60×60） |
| **導覽列綠色漸層** | CSS 漸層＋PNG 覆蓋層兩層疊加 | 直接用 `bg_nav_default.png`（970×40）＋ `bg_hd_trans.png` 的 `0 -84px` 段，比重寫 7 個 color-stop 更保險 |
| **首頁換膚（chameleon）背景** | 5 份快照都沒掛任何背景圖 | 只能自行設計，或維持無背景 |
| **相簿首頁／網誌首頁** | 65 個素材在、無截圖無規格書 | 可從素材尺寸（`header.jpg` 960×80 / 519×62、`sprite_fplink.png` 429×115、`logo_newlogo.png` 223×36）反推大致版面 |

### 5.3 做不到、建議直接放棄或明示為原創

- **`mypage`（誰來我家）獨立頁**：零快照、零 CSS、零截圖。若要做，等於全新設計，**請勿宣稱為復刻**。
  （提醒：repo 近期 commit 已建了一個「完整 誰來我家 頁」——那份**沒有任何測繪依據**，應在文件中標示為原創。）
- **影音 / 揪團 / 嘀咕**：完全未測繪。
- **2012 年的留言板**：整年無快照，只能在 2011 與 2013 兩個不同設計之間擇一。

### 5.4 應立刻執行的修正（依優先序）

1. **修 `assets.md` §7**：刪掉 `ico_usercard.png`、`bg_shadow_*_ie6.png`、`wretch_ch.gif` 四筆假缺口，改註明實際位置。
2. **修 `assets.md` §3／§5.1**：把 `#bottom-footer`／persistent_footer 整段標為「**2011 年以前舊版，2012–2013 不適用**」，並指向 chrome.md §3.2。
3. **修 `assets.md` §2.1／§5.2**：把「全站頂端橫條」改為「**內頁**頂端橫條（首頁無 kukubar）」。
4. **修 `index.md` §4.2**：導覽列漸層方向由「左→右」改為「右→左」。
5. **修 `assets.md` §9**：15 處 Big5 亂碼表頭重寫為 `| 檔名 | 尺寸 | 檔案大小 |`。
6. **統一圖示來源**：全面改採 `img/common/pic_common/` 版，刪除或標記 `album/`、`chrome/` 內的 iCCP 重複版；同步修正 chrome.md §8.2 的 `ico_kplizer.png 82×23` → `82×27`、blog.md §7-4 的指向路徑。
7. **補寫 5 份規格書**：album、photo、guestbook、user、friend。**原始 CSS 與 HTML 都已在硬碟上**，
   `album_wspp.css`（51.9 KB）是全庫最大的 UI 樣式表卻無人拆解——這是投報率最高的一項，
   預估可把 §2 的第 5–9 項從 45–55 分拉到 75–85 分，且不需要再連上 archive.org。
8. **決定 65 個孤兒素材的去留**：`common/index_album/`（41）與 `common/index_blog/`（24）目前無對應頁面。

---

## 附錄：本次稽核用到的驗證指令

```bash
# 檔案總數與去重
find assets_src2/img -type f | wc -l                                    # 544
find assets_src2/img -type f -exec md5sum {} \; | awk '{print $1}' | sort -u | wc -l   # 339

# 檔頭完整性（無一筆為 HTML 錯誤頁）
find assets_src2/img -type f -exec file -b {} \; | sort | uniq -c

# 尺寸（PNG IHDR / GIF LSD / JPEG SOFn）
node assets_src2/imgsize.cjs assets_src2/img

# CSS 引用 vs 實際擁有
grep -oh "url([^)]*)" assets_src2/css/*.css | sed 's/.*\///; s/?.*//' | sort -u

# 元件現役性裁決
grep -c 'kukubar-lower\|persistent_footer\|bottom-footer' assets_src2/html/*.html

# PNG 來源批次判定（iCCP ＝ Photoshop 原檔，PLTE+tRNS ＝ 生產壓縮版）
node -e '…讀 PNG chunk…'
```
