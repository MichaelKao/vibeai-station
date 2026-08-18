# 無名小站 2012 最後版復刻：決策與契約

> 這份取代 `WRETCH_DOM.md`（那份是 2005 綠色 table 版的契約，已隨該版成果移入 `attic/wretch-2005/`）。
> 測繪成果在 `assets_src2/`，各介面規格書在 `assets_src2/spec/`。

---

## 0. 目標版本

**2011–2013 年、關站前的最後版無名小站**，年代優先序 **2012 > 2013 > 2011**。

實測基準（用 Playwright 量的，不是目測）：

| 項目 | 實測值 | 來源 |
|---|---|---|
| 版面總寬 | **970px 置中** | `.hd` = 970×121 @x=155（視窗 1280） |
| 基礎字級 | **13px / line-height 16px** | `body` computed style |
| 基礎字體 | **Arial** | `body` computed style |
| 頁面底色 | 白 | `body` |

原版可點網址（隨時可自行核對）：

- 首頁 https://web.archive.org/web/20120301000000/http://www.wretch.cc/
- 單本相簿 https://web.archive.org/web/20121225174651/http://www.wretch.cc/album/album.php?id=leepeihsuam
- 單張照片 https://web.archive.org/web/20120304075641/http://www.wretch.cc/album/show.php?i=meimeigirl&b=10&f=1477066932&p=9&sp=1
- 網誌單篇 https://web.archive.org/web/20120415031503/http://www.wretch.cc/blog/boogier/16702046
- 名片頁 https://web.archive.org/web/20120531223342/http://www.wretch.cc/user/a000000010

---

## 1. 兩個已定案的方針

### 1-A. 版面全留，內容接站上真實資料

原站首頁那些區塊是編輯團隊每天人工上稿的，本站沒有這種內容來源。
**版面、尺寸、樣式 1:1 照抄；內容改接本站資料**，所以看起來 100% 像無名，但是活的。

| 原站區塊 | 接什麼資料 | 對應 server.js |
|---|---|---|
| Today Topic 輪播 | 站方公告（後台可編輯） | `notices` |
| Featured Photo（大圖＋4 小圖正妹牆） | 熱門相簿的照片 | `hotAlbums` / `newPhotos` |
| 美食頻道深色區 | 站長精選網誌 | `featPosts` |
| Celebrity 分頁（藝人／模特兒／…） | 人氣排行榜，分頁改成站內分類 | `rank` / `BLOG_TOPICS` |
| Featured Join（揪團） | 最新加入的站友 / 最新相簿 | `newUsers` / `hotAlbums` |
| Site blogs（16 個官方部落格） | 站內分類連結 | `ALBUM_TOPICS` / `BLOG_TOPICS` |
| Hot Activities | 站方公告第 2 則以後 | `notices` |
| 右欄 Ready to login? | 登入卡（未登入）／My 服務清單（已登入） | `me` |

**不做假資料。** 沒有資料時走空狀態，不要塞原站的照片或文章。

### 1-B. 整站統一 2012

首頁、相簿、網誌、留言板、名片、好友全部用最後版設計，不與 2005 的橘／藍混搭。

---

## 2. 已落地的素材（`assets_src2/`）

| 目錄 | 內容 |
|---|---|
| `css/` | 43 支原始 CSS／JS（相簿的 photowall、slider、sharing、kukubar，網誌的 top/trackback，全站的 kukubar） |
| `img/index/` | 首頁素材 29 張，含 `bg_hd_trans.png`（天空小鳥頁首 970×121）、`bg_nav_default.png`（綠色漸層導覽）、`ico_sprite.png`（全套導覽圖示）、`logo_wretch.png` |
| `img/album/` | 相簿素材 56 張 |
| `img/blog/` | 網誌素材 26 張 |
| `img/chrome/` | 全站框架素材 42 張（工具列、分享、通知圖示） |
| `img/gb/` | 留言板素材 17 張（含表情圖與悄悄話鎖頭） |
| `html/` | 44 份原始頁面 HTML |
| `shots/` | 原版截圖，供肉眼比對 |
| `spec/` | 各介面規格書（`index.md` 83KB、`blog.md` 73KB、`chrome.md` 63KB…） |

---

## 3. 驗證方式：量出來，不是看出來

`tools/shot.mjs`（Playwright 驅動系統 Chrome）：

```bash
# 原版 vs 我們，算像素差異百分比並產生 diff 圖
node tools/shot.mjs pair home \
  "https://web.archive.org/web/20120301000000/http://www.wretch.cc/" \
  "http://localhost:3000/"

# 把原版每個元素的位置/尺寸/顏色/字級整棵倒出來當藍圖
node tools/shot.mjs tree "<原版網址>" assets_src2/blueprint/xxx.md

# 量特定元素的實際數值
node tools/shot.mjs measure "<網址>" ".hd" "#bd" ".ft"
```

archive.org 併發一高會直接拒連，工具已內建辨識錯誤頁 + 退避重試。
**抓存檔時不要多支同時跑**，會互相打架。

---

## 4. 不可違反

1. 站名與 logo 是**最後**才換的，先做到 100% 還原（含原版 logo）再替換。
2. 版面尺寸以實測值為準，不憑印象。
3. 所有表單 action / method / 欄位 name 不得更動，否則後端會壞。
4. 使用者輸入一律 `<%= %>`；只有 `render()` 過的內容用 `<%- %>`。
5. 使用者自訂 CSS 仍放 `<head>` 最後 —— 這是無名的靈魂功能。
6. 素材路徑走 `<%= CDN %>`（R2），本機自動回退 `public/img/wretch2012/`。
