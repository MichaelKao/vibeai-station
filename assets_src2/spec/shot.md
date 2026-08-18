# shot — 無名小站（wretch.cc）最後版 真實截圖規格書

代號：**shot**
產出目錄：`D:\repos\vibeai-station\assets_src2\shots\`
截圖工具：系統 Chrome `--headless`（`C:\Program Files\Google\Chrome\Application\chrome.exe`），
viewport 固定寬 **1280px**，`--hide-scrollbars`，`--virtual-time-budget=30000~60000`。

標記約定：**【驗】**＝直接從下載的原始檔／截圖像素量到的；**【推】**＝推測。

---

## 0. 重要方法論筆記（給後續 agent 看，會省你兩小時）

【驗】以下都是這次實測出來的：

1. **不要用 `id_`（原始檔）網址截圖**，要用 Wayback 的**改寫版**網址（時間戳後面不加東西），
   圖片與 CSS 才會從存檔載入。
2. **Wayback 對子資源會 rate-limit / 連線重置**。第一次截圖常常整頁沒套 CSS（變成裸 HTML 直排連結）。
   解法：**先用 curl 把該頁的 `…cs_/…` CSS 網址逐一抓一次把 Wayback cache 熱起來，再截圖**。
   我寫了 `assets_src2/shots/_warm.sh <改寫版網址>`，它會印出每個 CSS 的 HTTP 狀態；
   全部 200 之後再跑 chrome 就會完整渲染。
3. **背景執行（run_in_background）的 bash 子行程連不上 archive.org**（一律 HTTP 000），
   前景執行才有網路。chrome 截圖必須在前景跑。
4. chrome 的 `--screenshot=` 在 bash 腳本裡要用 **Windows 反斜線絕對路徑**，
   而且不能寫成 `"…shots\\$OUT"`（`\\$` 會被 bash 轉義成字面 `$`）。
   用 `P="D:\\repos\\...\\shots\\"` 再 `"$P$OUT"`。
   另外在腳本裡呼叫 chrome 需要 `--user-data-dir=`，否則報 `Missing headless user data directory`。
5. 相片頁（`show.php`）會讓 chrome 卡住不結束，要加 `--timeout=45000~60000` 並用 `timeout 220` 包起來。

---

## 1. 快照清單（我實際下載並看過的）

### 1-1 首頁
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_01_home_20120610.png` (1280×3000) | https://web.archive.org/web/20120610082113/http://www.wretch.cc/ | 2012-06-10 | **★★★★★ 幾乎全滿**：CSS 全套、sprite、輪播照片、正妹照片、美食區照片、名人照片全部載入。只有少數廣告版位空白。Wayback 工具列在這張沒渲染出來（純無名畫面）。 |

### 1-2 個人相簿列表
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_02_albumlist_a0933936769_20131226.png` (1280×1600) | https://web.archive.org/web/20131226222028/http://www.wretch.cc/album/a0933936769 | 2013-12-26 | **★★★★★ 最佳**：20 本相簿封面縮圖**全部載入**，版型完整。缺點是頂端有「無名小站已進入全站唯讀模式，12/26服務終止」關站公告。 |
| `shot_02_albumlist_cccserene_20120820.png` (1280×1700) | https://web.archive.org/web/20120820082841/http://www.wretch.cc/album/cccserene | 2012-08-20 | ★★★☆☆ 使用者自訂粉紅皮膚（`album.css` 有存到）完整套用、背景插畫載入，但**所有封面縮圖破圖**（顯示 alt 文字 `Cover`）。 |
| `shot_02_albumlist_dearmoai_20120615.png` (1280×3000) | https://web.archive.org/web/20120615052359/http://www.wretch.cc/album/dearmoai | 2012-06-15 | ★★☆☆☆ 使用者黑紅皮膚，頭圖載入，但封面全破圖（顯示系統的「無封面資料夾」icon）。有 Wayback 黑色工具列。 |

### 1-3 單本相簿
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_03_album_toro81216_20131226.png` (1280×2000) | https://web.archive.org/web/20131226222408/http://www.wretch.cc/album/album.php?id=toro81216&book=5& | 2013-12-26 | **★★★★★ 最佳**：20 格縮圖中 19 格載入。有關站公告列。 |
| `shot_03_album_cccserene_20120106.png` (1280×2200) | https://web.archive.org/web/20120106053859/http://www.wretch.cc/album/album.php?id=cccserene&book=1&page=2 | 2012-01-06 | ★★★☆☆ 2012 年、皮膚完整（粉紅），但 20 格縮圖**全破**。文案／版型仍可讀。 |

### 1-4 單張照片頁
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_04_photo_cccserene_20120305.png` (1280×1800) | https://web.archive.org/web/20120305121539/http://www.wretch.cc/album/show.php?i=cccserene&b=5&f=1684437236&p=3&sp=1&.c=102Dn5uYXAS&.t=1326894109 | 2012-03-05 | ★★☆☆☆ **2012 英文版介面**（First/Previous/Next/Last/Top、Slide Show）。主圖與 5 張縮圖皆破圖。 |
| `shot_04_photo_kellyla_20131205.png` (1280×1800) | https://web.archive.org/web/20131205003124/http://www.wretch.cc/album/show.php?i=kellyla&b=40&f=1476957014&p=15&sp=1&.c=108mQQXuoCR&.t=1386143778 | 2013-12-05 | ★★★☆☆ **2013 中文版介面**（第一張/上一張/下一張/最後一張/回上一層）。版型與縮圖框完整，但圖片破圖。 |

> 【驗】**相片頁的主圖 100% 抓不到**。實測 `f8/f12.wretch.yimg.com/<user>/<book>/<id>.jpg?<簽章>`
> 在 Wayback 回 **403**（被排除），只有極少數使用者的 `thumbs/` 有被存到（例如 a0933936769、toro81216）。
> 復刻時主圖要自己準備素材。

### 1-5 網誌首頁
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_05_bloghome_cccserene_20120904.png` (1280×3600) | https://web.archive.org/web/20120904091645/http://www.wretch.cc/blog/cccserene | 2012-09-04 | **★★★★★**：使用者 `blog.css` 有存到 → **雙欄版型完整**（左文章、右側欄），側欄模組全部顯示，皮膚背景圖載入。 |
| `shot_05_bloghome_dearmoai_20120805.png` (1280×3400) | https://web.archive.org/web/20120805060535/http://www.wretch.cc/blog/dearmoai | 2012-08-05 | ★★☆☆☆ 使用者 `blog.css` **404** → 沒有版型，變成單欄裸文字。**但正因為裸的，可以清楚看到 DOM 的自然順序**，對復刻反而有參考價值。 |

### 1-6 網誌單篇
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_06_blogpost_cccserene_20131227.png` (1280×3000) | https://web.archive.org/web/20131227041751/http://www.wretch.cc/blog/cccserene/10997526 | 2013-12-27 | **★★★★★**：皮膚完整、留言區完整、**留言表單（Post A Comment）完整可見**。有關站公告列。 |
| `shot_06_blogpost_cccserene_20120118.png` (1280×3000) | https://web.archive.org/web/20120118040053/http://www.wretch.cc/blog/cccserene/26718717 | 2012-01-18 | ★★☆☆☆ 皮膚 404，裸版。優點：2012 年代、且**留言樓層（1樓…13樓）與文章 meta 列清楚**。 |

### 1-7 留言板
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_07_guestbook_dearmoai_20131226.png` (1280×2400) | https://web.archive.org/web/20131226201813/http://www.wretch.cc/guestbook/dearmoai | 2013-12-26 | **★★★★★**：皮膚、頭圖、分頁、留言條目、右側名片欄全部完整。有關站公告列。 |
| `shot_07b_guestbook_dearmoai_20110818_noskin.png` (1280×1800) | https://web.archive.org/web/20110818085425/http://www.wretch.cc/guestbook/dearmoai | 2011-08-18 | ★★★☆☆ 皮膚 404，但**這是 2011 年的「動態(Vitality)」版留言板**，跟 2013 版的頁籤不同（見 §8），值得對照。 |

> 【驗】**2012 年的留言板一張都沒有**。CDX 查 `www.wretch.cc/guestbook*` 只有
> 2004–2006 的舊版、2011 兩筆、2013-12 一批。2012 年整年查無 200 快照。

### 1-8 名片頁（User）
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_08_usercard_cccserene_20120709.png` (1280×1600) | https://web.archive.org/web/20120709134526/http://www.wretch.cc/user/cccserene | 2012-07-09 | **★★★★★**：皮膚背景圖（彩虹雲）載入、**10 個欄位標籤全部可讀**。 |
| `shot_08_usercard_dearmoai_20120414.png` (1280×1700) | https://web.archive.org/web/20120414235246/http://www.wretch.cc/user/dearmoai | 2012-04-14 | ★★☆☆☆ 該使用者資料幾乎空白，只剩導覽列與計數器。可當「空狀態」參考。 |

### 1-9 好友頁（Friend）
| 檔案 | 可點網址 | 年代 | 載入完整度 |
|---|---|---|---|
| `shot_09_friend_cccserene_20131227.png` (1280×1600) | https://web.archive.org/web/20131227041633/http://www.wretch.cc/friend/cccserene | 2013-12-27 | **★★★★★**：**25 個好友頭像全部載入**、四個頁籤、分頁、總數文案完整。有關站公告列。 |
| `shot_09b_friend_dearmoai_20110831_noskin.png` (1280×1600) | https://web.archive.org/web/20110831210708/http://www.wretch.cc/friend/dearmoai | 2011-08-31 | ★★☆☆☆ 皮膚 404、0 位好友。優點：**空狀態文案完整**、頁籤預設樣式看得到。 |

---

## 2. 精確色碼（全部從截圖像素直接取樣，【驗】）

### 2-1 全站頂端工具列「kukubar」（每個使用者頁面都有，不受皮膚影響）
取樣檔：`shot_02_albumlist_a0933936769_20131226.png`，x=700 垂直掃描。

| 用途 | 色碼 | 位置 |
|---|---|---|
| 列高 | **30px**（y=0…29） | — |
| 背景漸層（上） | `#FEFEFE` | y=0 |
| 背景漸層（中） | `#F6F6EE` | y=14 |
| 背景漸層（下） | `#EEEDDE` | y=29 |
| 下緣分隔線 | `#BBBBBB`（1px） | y=30 |
| 「無名小站」logo 綠 | `#336C16` ～ `#397824` | x=6…77 |
| 關站公告文字（紅） | 約 `#EE0000`～`#EF2686` | 2013 快照的 x=169…409 |
| 分隔豎線 | `#C9C9C9` | x=83 / 158 / 979 / 1020 |

### 2-2 首頁（`shot_01_home_20120610.png`）
| 用途 | 色碼 | 取樣位置 |
|---|---|---|
| 頁面底色 | `#FFFFFF` | x=1270,y=700 |
| 頁首天空底圖（淡青漸層） | `#D7F6F8` → `#ECFAFB` | x=300, y=4…82 |
| 主導覽列上緣線（左端） | `#57BA94` | x=170,y=83 |
| 主導覽列漸層（左端，上→下） | `#B9E2D3` → `#59B587` | x=170,y=84…119 |
| 主導覽列上緣線（中央） | `#78B85F` | x=640,y=83 |
| 主導覽列漸層（中央，上→下） | `#BADAAE` → `#75B45B` | x=640,y=84…119 |
| 主導覽列下緣線 | `#57BA97`(左)／`#7CB85C`(中) | y=120 |
| 主容器外框線 | `#929292`（1px） | x=154 與 x=1125 |
| 主容器外陰影（往外三階） | `#B6B6B6` → `#D4D4D4` → `#E9E9E9` | x=153/152/151 |
| 左欄模組底色 | `#F4F4F4` | x=200,y=440 |
| 右欄模組底色 | `#F7F7F7` | x=1000,y=440 |
| 美食（belt）深色區底 | `#333333` | x=200,y=1400 |

> **注意**：主導覽列的綠色是**左右也有漸層**的（左邊偏青綠 `#59B587`、中間偏黃綠 `#75B45B`），
> 不是單一線性漸層，應該是一張橫向 sprite。【驗，像素量到】

### 2-3 使用者頁面（皮膚色，**屬於該使用者自訂，不是無名預設**）
| 頁面 | 用途 | 色碼 |
|---|---|---|
| dearmoai 留言板 2013 | 頁面底色 | `#343434` |
| dearmoai 留言板 2013 | 留言區塊底色 | `#1A1A1A` |
| dearmoai 留言板 2013 | 區塊框線 | `#616161` |
| cccserene 好友頁 2013 | 外框方框線 | `#999999`（1px） |
| cccserene 好友頁 2013 | 好友卡片框線 | `#FFCCCC`（2px） |

> 【推】無名**預設**皮膚的色碼我這次沒有量到，因為抓得到的使用者都套了自訂 `album.css` /
> `blog.css` / `guestbook.css`。要拿預設色請去讀 `pic.wretch.cc/e/serv/*/css/*.css`（見 §7）。

---

## 3. 尺寸（像素量測，【驗】）

### 3-1 首頁
| 項目 | 尺寸 |
|---|---|
| viewport | 1280px（我固定的截圖寬度） |
| **主容器寬** | **970px**（x=155…1125），置中 → 左右各 155px |
| 容器內距 | 左右各約 10–11px（內容從 x=165/166 起） |
| **左主欄寬** | **約 640px**（x=166…806） |
| 欄間距 | 約 10px（x=807…815） |
| **右側欄寬** | **約 300px**（x=816…1114） |
| 頁首天空區高 | 83px（y=0…82） |
| **主導覽列高** | **38px**（y=83…120） |
| 頁首＋導覽總高 | 121px |
| 天空／導覽列橫向範圍 | x=149…1130（982px，比容器略寬，含陰影） |
| 深色美食區 | y=1275…1649（375px 高），橫跨整個 970px 容器 |

### 3-2 相簿列表（`shot_02_albumlist_a0933936769_20131226.png`）
| 項目 | 尺寸 |
|---|---|
| 封面縮圖框 | **90px 寬**，高度依原圖比例（量到 68px、60px 兩種） |
| 目前選取的第一格 | 94×75（含 2px 選取外框） |
| 欄距（column pitch） | **132px** |
| 列距（row pitch） | **200px** |
| 每頁格數 | 5 欄 × 4 列 = **20 本** |
| 縮圖網格橫向起點 | x≈329（第一格左緣） |

### 3-3 好友頁（`shot_09_friend_cccserene_20131227.png`）
| 項目 | 尺寸 |
|---|---|
| 外層方框 | x=205…1074 → **869px 寬**，1px `#999999` |
| 好友卡片 | **112px 寬 × 155px 高**（含 2px `#FFCCCC` 框） |
| 欄距 | **124px**（6 欄） |
| 列距 | **171px** |

### 3-4 留言板（`shot_07_guestbook_dearmoai_20131226.png`）
| 項目 | 尺寸 |
|---|---|
| 左側留言串欄 | x=165…774 → **610px 寬** |
| 右側名片欄起點 | x≈795 |

---

## 4. 字型與字級

【驗】我只驗證了「頁面實際渲染出來的樣子」，沒有把 CSS 逐條讀完（那是 css 代號 agent 的工作）。
從截圖可判讀的：

- 首頁英文 UI（Blog / Album / Video / Login / Web Search）→ 無襯線（sans-serif），字級小（約 12–13px）【推】。
- 使用者頁（相簿／名片／好友／網誌）**大量英文與數字是襯線體（Times/serif）**，
  這是因為它們沒有指定 `font-family` 而吃到瀏覽器預設。【驗，從截圖字形明顯看得出來】
  → 復刻時如果用現代 CSS reset 會「太乾淨」，要刻意保留這個 serif 味。
- 相簿列表的相簿名稱、`NNpictures` 計數 → 粗體小字（約 12px）【推】。
- 首頁「今日主題」大標（舊衣換新衣／簡單小改造）→ 綠色粗體、約 26–28px【推，由截圖比例估】。

> 精確的 `font-family` / `font-size` / `line-height` 請以
> `l.yimg.com/e/serv/index/index3/css/wfp-css_201205171100.css`（已驗證存檔可下載，97,564 bytes）
> 與 `pic.wretch.cc/e/serv/*/css/font.css` 為準。

---

## 5. DOM 結構（首頁，直接由原始 HTML 解析，【驗】）

來源：`https://web.archive.org/web/20120610082113id_/http://www.wretch.cc/`（UTF-8，76,720 字元）

```
body
  div#bg-wrapper
    div#wrapper.clearfix
      div#uh-wrapper.hd
        div#wfp-universal-header
          div.hd
          div.bd
        div#wfp-navigation
          nav.blog-nav
            ul                       ← Blog / Album / Video / Join / Digu / Mobile(NEW)
          div#nav-corner-ad
      div#push-down-ad
      div.bd.big-bd.clearfix
        div.main                     ← 左主欄（約 640px）
          div#wfp-archive            ← 左緣 Today / JUN 10 日期捲軸
            div.hd
            div.bd
          div#wfp-cover.mod.stack-layout.bright.bright-stack-layout
            div.bd.stack             ← 今日主題疊照輪播
          div#wfp-inner-search       ← Wretch Search
          div#wfp-featured.mod       ← Featured Photo
            div.hd
            div.bd
            div.ft
            div#featured-corner-ad
        div.side                     ← 右側欄（約 300px）
          div#wfp-my                 ← Ready to login? / Login
            div.wfp-my
          div#wfp-announcement       ← [公告]…
            div.annoad3
            ul
          div#wfp-today.mod          ← Hot Activities
            div.hd
            div.bd
    div.belt                          ← 深色美食帶（#333333）
      div#wfp-hybrid.mod.fifth
        div.hd
          div.tabs
            ul.tabs-list.clearfix     ← 宅在家/好飛遜/玩透透/嗑美食/分享吧
        div.belt-line
        div.bd.clearfix
          div.main-content.clearfix
            div.image-wrapper.ugc-block
            div.article-wrapper.ugc-block
          a.more-recommended.main-more
          div.sub-content.clearfix
            div.mix-wrapper.ugc-block.pic-text-2.clearfix
            div.mix-wrapper.ugc-block.pic-text-2.clearfix.last.normal
        div.hybrid-decoration-line
    div#lower-wrapper.clearfix
      div.bd.clearfix
        div.main
          div#wfp-celebrity          ← Celebrity / Artist / Model…
            div.hd
            div.bd
            div.ft
            div#celebrity-corner-ad
          div#wfp-blog-entry.clearfix.mod   ← Site blogs
            nav.blog-navigation
            div#blog-entry-corner-ad
        div.side
          div#wfp_top_daily_blogs.mod       ← Featured Blogs
            div.hd
            div.bd.top_daily_blogs-recommend
            div.ft.top_daily_blogs-recommend
      div.ft
        div#wfp-footer
          div#wfp-lang
            ul
            div#rss-bar
```

> 使用者頁（album/blog/guestbook/user/friend）的 DOM 我沒有逐一解析（那是 html 代號 agent 的範圍），
> 但**版面上的區塊順序**我在 §8 逐頁描述了。

---

## 6. 逐字中文／英文文案（從原始 HTML 抽出，一字不差，【驗】）

### 6-1 首頁 `http://www.wretch.cc/`（2012-06-10）

**頁面 title**：`Wretch.cc - the most popular blog and album service in Taiwan`

**頂端**：`We want football girl！` ／ `Yahoo!` ／ `Help` ／ `Yahoo! Search` ／ `Search：` ／ 按鈕 `Web Search`

**主導覽**：`Blog` `Album` `Video` `Join` `Digu` `Mobile` `(NEW)`

**左緣日期軸**：`Today` `JUN` `10` `expand/collapse` `Forward` `09 08 07 06 05 04 03 02 01` `MAY` `31` `Backward`

**今日主題區**：
- 區塊標題：`Today Topic`
- 大標：`舊衣換新衣` ／ `簡單小改造`
- 內文：
  ```
  衣櫃要爆炸啦...
  心愛舊衣服
  捨不得丟怎辦？
  別煩惱～多的是新花招
  動小手小小改造
  就變不一樣！
  ```
- 輪播圖說：
  ```
  不花大錢！快快換上雜誌單品流行風♥♥女孩必看
  捨不得丟？來個小花招～穿膩的舊衣起死回生啦
  蕾絲控發威～讓女孩尖叫的超神奇夢幻改造術！快來學
  ```
- 分享：`Share to`

**站內搜尋區**：
```
Wretch Search
Current content type：
Article
Switch your search type：      （單選：Article / Album / Video）
Search here：                  （輸入框 placeholder：Search Wretch Blog）
Search                         （按鈕）
```

**正妹區**：
```
Featured Photo
無名人氣美女      無名心動正妹      （兩個頁籤）
本日最鄰家                        （第一張的角標）
小乖      Add Friend      趕快帶我出去玩～到哪都可以
小瑀     C...             不用想這麼多啦！
村村                      太陽閃亮...心情也美麗
小白                      拍下這單純的感動…
nancy                     一到海邊玩～超開心
想看更多無名人氣正妹！
Background music ON  /  OFF
```

**右側欄 登入區**：
```
Ready to login?
Login                 （按鈕）
Personal Services
Join VIP    Join member
Setting
My  Friends  Guestbook  User          （頁籤：My / Blog / Album / Video）
my
```

**公告**：
```
[公告]請留意不法詐騙信件
[公告]無名推出新功能無名相片牆
[公告]無名小站行動版 行動相簿上線
More Announcement
```

**Hot Activities**：
```
Hot Activities
YES！我要上首頁
迎接2012的新年到來，小編準備了一個讓你/妳可以發光發熱的機會~
More Activity
秘密武器是？！
為了參加世界街舞大賽，最後使出的秘密武器是哪一種舞蹈?
More WretchTalk
哪個星座的求職者最適...
哪個星座的求職者最適合當業務？
Vote!
More Vote
```

**深色美食帶 頁籤與標語**：
```
宅在家     打造新生活，創意樂趣多
好飛遜     時尚一夏～好飛遜夏日裝扮
玩透透     旅遊…發現體驗生活新鮮事
嗑美食     帶路吃美食！尋覓真正好味道
分享吧     趁著好天氣，把書唸好再出去玩吧！
```
內容：
```
無名美食王
不賣雜貨吃台台熱炒
延續了老靈魂的生命..不過這邊不賣零食糖果..從之前開了20多年的甘仔店變身..成為新時代的[自立商店]..這家店其實我關注它好久..因為生活及工作的範圍都在這一帶
就是愛漂亮
夏日清透會呼吸的底妝是？
手殘少女的夏日超簡易編髮
自己彩繪樂趣多。夏季熱門指彩
更多
R小編精選     她的第一次
           快來跟大家分享一下超甜美黃溫妮同學的人生中首次外拍初體驗的花絮
小編精選      頂尖對尬 舞翻全世界
           艾許遇到了在英國街舞大賽中一枝獨秀博得滿堂喝采的阿弟仔
           人生的小確幸
           這次去看了很小品的【幸福的麵包】，不但上映的地方只在台北，廳數似乎也很少
```

**名人專欄**：
```
Celebrity   Artist  Model  Athelete  Writers  Politician      （頁籤）
呂如中   了解自己再行銷自己
        了解自己是一門功夫，有時無限可能出現在某個不經意的時空或危機裡，那時才發現自我潛能只是冰山一角…
林葉亭   這樣穿...寶貝們會顯得更有活力
陳櫻文   只有記憶去哪都擁有，別人奪不走
MoreArtist
```

**Site blogs**：
```
Site blogs
Office  Beauty  Food  Photo  Comic
Movie  Style  Salon  Local  Supergoods
Fanpage  Design
Reader  3C  Sound
```

**Featured Blogs**（右下）：
```
Featured Blogs
Recommend   Random      （頁籤）
超值划算戰利品
比小三更可怕的D3出現了
薰衣草森林系列的最新景點
充滿活力的城市
更多推薦
```

**頁尾**：
```
中文  |  English
Frontpage Intro · Terms of Service · Privacy Policy · eMarketing · Contact Us · Jobs
RSS:  Cover Story  Featured Photos  Hot Topics  Top Articles
Copyright/IP Policy   This website has managers, according to Taiwan Internet Content Rating Regulations.
Copyright © 2011 Yahoo! Taiwan All Rights Reserved.
```

### 6-2 kukubar（全站頂端列，2013 快照）
```
無名小站  |  Blog ▾  |  無名小站已進入全站唯讀模式，12/26服務終止   …   Yahoo!  Login  |  Article ▾ [Article Search] 🔍
```
2012 快照的中段是「今日主題」跑馬燈，例如：
`今日主題：無名塗鴉秀 逗趣一大堆`、`今日主題：畫試拼人氣 好感穿搭妝`、`今日主題：摩人親示範 冬日哈保養`、
`今日主題：歡迎光臨！ 特搜夢幻屋`、`今日主題：塗鴉爆笑秀 吃喝耍趣味`。
右下角固定列：`我有建議！` `分類好文` `好友動態`，右側跑馬燈：`首頁好文：…`。
（【驗】以上皆自截圖逐字讀出。）

### 6-3 相簿列表（`album/<user>`）
```
<user>'s AlbumList
[ <user> 的  MyPage | album | blog | guestbook | User | Friend | Video ]
- Friends' Album -        （下拉）
- Category -              （下拉）
RSS  (RSS HOWTO)
NN Albums
1 2 3 下一頁
<相簿名稱>
NNpictures
Today's Visitors: N
Total Visitors: N
```
另在有新照片的相簿旁會出現紅色 `NEW` 小圖章，以及 `newAlbumUpdate` 標記。

### 6-4 單本相簿（`album/album.php?id=…&book=N`）
```
<user>'s Album  >  <相簿名稱>
<相簿描述>
[ <user> 的  MyPage | album | blog | guestbook | User | Friend | Video ]
- Friends' Album -
Topic:  <主題分類，例：展覽活動(車展、資訊展、書展…等各種展覽) / 照片日記(隨手拍拍,生活紀錄,圖像日記)>
Place:  <地點，例：香港-灣仔 / None>
Category:  <None>
[One Page]  [Add to Friend List]  [Report this Album]
上一頁 1 2 3 4 5 6 7 8 9 10 11 12 下一頁
Today's Visitors: N
Total Visitors: N
```
（2013 版的分頁列是 `1 2 下一頁`；封面照片下方會標 `封面照片`。）

### 6-5 單張照片頁（`album/show.php`）
**2012 英文版**：
```
<user>'s Album  >  <相簿名稱>
N / M
First | Previous | Next | Last | Top
Slide Show
搜尋更多     切割照片(NEW)     Report this Picture
下一張(Hotkey:c)          （主圖上的連結 alt）
Thumbnail  ×5             （底部縮圖列）
```
**2013 中文版**：
```
<user>的相簿  >  <相簿名稱>
N / M
第一張 | 上一張 | 下一張 | 最後一張 | 回上一層
自動播放 | 圖片資訊 | 相片牆:馬賽克 | 瀑布
<照片標題>
下一張(熱鍵:c)
搜尋更多   留言   (NEW) iZoom Revolution   檢舉這張相片
縮圖  ×5  ＋每張的檔名／標題
無名情報 / 封面照片
```

### 6-6 網誌（`blog/<user>` 與 `blog/<user>/<id>`）
文章下方 meta 列（逐字）：
```
Personal Category: <分類>     Topic: <feeling> / <personal> / <murmur>
Previous in This Category: <標題>      Next in This Category: <標題>
歷史上的今天:<標題>
<user> at 無名小站 at 02:53 PM post | Reply(22) | Trackback(0) | Collection(2) | prosecute
[Trackback URL]  [輸入框]  Copy Trackback Url
Reply
1樓 2樓 3樓 …
Post A Comment
Name:
Email:
URL:
Remember Me:  ⦿ Yes  ○ No
Comments ( MAX: 1000 characters )：
Please input the magic number:
（Prevent the annoy garbage messages）
Please input the magic number
Post      Cancel
```
文章列表的每筆下方：`(More......)`。
右側欄模組標題（逐字）：
```
About me
Topic:  Free Writing
Mypage / album / blog / guestbook / User / Friend / Video
Add to Friend List
- Friends' Blog -            （下拉）
Album
Pause  Prev  Next            （相簿輪播三個按鈕）
New Post
Category
My Collection Category
Uncategorized Articles(1)
All Collections
My Collections
More collections..
Archives
All Articles
- Monthly Archives -         （下拉）
Search
☑ Title  ☐ Contents          （核取方塊）
Search                        （按鈕）
Comments
TrackBack
Favorites
Counter
Today's Visitors: N
Total Visitors: N
```
文章分享列按鈕：Facebook、Plurk（橘）、黃色笑臉、`發文`（綠色）、`Tweet`，以及右下的
`推薦此文章 / 推 / 收` 小方塊。

### 6-7 留言板（`guestbook/<user>`）
**2013 版**：
```
<user>'s Guestbook
Messages | System Messages | ★ Leave a Message...      （三個頁籤）
[搜尋框]  [Title ▾]  Search
1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 下一頁
TITLE  <標題>
NAME   <暱稱>
DATE   <YYYY-MM-DD HH:MM:SS>   prosecute
Message：
<留言內容>
右欄名片：
  MyPage / album / blog / guestbook / User / Friend / Video
  make friend  |  message  |  RSS  RSS
  - Friends' Guestbook -        （下拉）
  Today's Visitors: 0
  Total Visitors: 15393
  Messages: 1908
  Hot Ranks: 6783
```
**2011 版（動態牆型）**：
```
<user>'s Guestbook
Vitality | Messages | System Messages | Leave a Message...
All | Photo | Article | Video          （篩選頁籤）
<user>  uploaded N photos to  <相簿名>
分類: <分類名>
9 hours ago  /  2 days ago
<user>  posted an article  <文章標題>  on  <網誌名>
More
右欄：make friend | contact | message | RSS
      - Friends' Guestbook -
      Today's Visitors: 9
      Total Visitors: 7767
      按鈕直欄：MyPage / Album / Blog / Guestbook / Mypage / Friend / Video
```

### 6-8 名片頁（`user/<user>`）
```
<user>
[ <user>的  MyPage | album | blog | guestbook | User | Friend | Video ]
- My Friends -        （下拉）
[Add to Friend List]
Nickname:
Gender:
Blood type:
Height:
Education:
Occupation:
Hobby:
Favorite:
Dislike:
Introduction:
Today's Visitors: N
Total Visitors: N
```

### 6-9 好友頁（`friend/<user>`）
```
<user>的好友列表
MyPage / album / blog / guestbook / User / Friend / Video
[Add to Friend List]  [Find Friend]  [找朋友]
[-All- ▾]  [搜尋框]  Search Friends
Now List: Category: -All-, Search:
You may have much friendship here, pleaseLoginfirst to see your friends of friends.
whose friends are also your friends, and some other people you could join with...
My Friends | I'm Friend Of | Friendship | Friend of Friend     （四個頁籤）
<好友帳號>  +頭像
1|2|»
There are 44 friends
（空狀態：There are 0 friends）
```
> 注意 `pleaseLoginfirst` 中間是**沒有空格**的（原始 HTML 就這樣，`Login` 是連結）。【驗】

---

## 7. 素材清單（每個 CSS 我都用 curl 實測過 HTTP 狀態）

### 7-1 首頁（2012-06-10）
| 檔案 | 狀態 | 大小 |
|---|---|---|
| `http://yui.yahooapis.com/combo?3.2.0/build/cssreset/reset-min.css&3.2.0/build/cssfonts/fonts-min.css` | 有存檔 | — |
| `http://l.yimg.com/e/serv/index/index3/css/wfp-css_201205171100.css` | **200** | **97,564 bytes** |
| `http://l.yimg.com/e/serv/index/index3/css/chameleon.css` | **200** | 4,019 bytes |
| `http://l.yimg.com/e/serv/common/css/promotion.css` | **200** | 4,058 bytes |

### 7-2 相簿列表／單本相簿
| 檔案 | 狀態 |
|---|---|
| `http://f<N>.wretch.yimg.com/<user>/files/album.css?<ts>` | **使用者自訂皮膚**，有的有存有的沒有。cccserene=200(5,012B)、a0933936769=200、toro81216=200、dearmoai=**404** |
| `http://pic.wretch.cc/e/serv/album/css/font_vip.css` | 200 |
| `http://pic.wretch.cc/e/serv/album/css/photowall_overlay.css` | 200（2013） |
| `http://pic.wretch.cc/e/serv/common/css/kukubar.css` | 200 |
| `http://pic.wretch.cc/e/serv/common/css/promotion.css` | 200 |
| `http://pic.wretch.cc/e/serv/common/css/sharing.css` | 200 |
| `http://pic.wretch.cc/e/serv/*/css/font.css` | 200 |

### 7-3 照片頁（show.php）
`album.css`(使用者) / `font_vip.css` / `mod_ad.css` / `newButton.css` / `newPanel.css` /
`spp_promotion.css` / `kukubar.css` / `promotion.css` / `sharing.css` / `container.css` /
`fonts-min.css` — **全部 200**。

### 7-4 網誌
| 檔案 | 狀態 |
|---|---|
| `http://f<N>.wretch.yimg.com/<user>/files/blog.css?<ts>` | 使用者皮膚。cccserene 在 2012-09 / 2013-12 的時間戳=200，在 2012-01 的時間戳=**404** |
| `pic.wretch.cc/e/serv/blog/css/container.css` | 200（**這是網誌版面主檔**） |
| `…/top.css` `…/button.css` `…/font.css` `…/trackback.css` `…/sharing.css` `…/antiPhishing.css` `…/friend_picker.css` | 全部 200 |

### 7-5 留言板
`guestbook.css`(使用者，dearmoai 2013=200 / 2011=404) ＋ `layout.css?28888`、`namecard.css?15957`、
`overwrite.css?17612`、`kukubar.css`、`promotion.css` — 皆 200。

### 7-6 名片頁
`user.css`(使用者，200) ＋ `kukubar.css`、`promotion.css`、`font.css` — 皆 200。

### 7-7 好友頁
`friend.css`(使用者，cccserene 2013=200 / dearmoai 2011=404) ＋ `fix.css?17303`、`select.css?17139`、
`kukubar.css`、`promotion.css` — 皆 200。

### 7-8 **抓不到的東西（明講）**
- ❌ **所有使用者照片**：`f8/f12.wretch.yimg.com/<user>/<book>/<id>.jpg?<簽章>` → Wayback 回 **403**。
  只有極少數帳號的 `thumbs/` 被存下（a0933936769、toro81216、a0929025171、a0933936769、a09780987）。
- ❌ **2012 年的留言板頁面**：整年查無 200 快照。
- ❌ **`mypage`（誰來我家）**：`www.wretch.cc/mypage*` prefix 查無任何 200 快照。
- ❌ **相片頁主圖**：一張都沒有（見上）。

---

## 8. 每張截圖「肉眼看到什麼」＋ 互動行為

> **Wayback 黑色工具列不算無名的一部分**，以下描述一律已排除。
> **有** Wayback 工具列的檔（8 張）：`shot_02_albumlist_cccserene`、`shot_02_albumlist_dearmoai`、
> `shot_04_photo_cccserene`、`shot_05_bloghome_cccserene`、`shot_05_bloghome_dearmoai`、
> `shot_06_blogpost_cccserene_20131227`、`shot_07b_guestbook`、`shot_08_usercard_dearmoai`、`shot_09b_friend`。
> **沒有**工具列（畫面第一行就是無名自己的 kukubar，可直接肉眼比對）的檔：
> `shot_01_home`、`shot_02_albumlist_a0933936769`、`shot_03_album_cccserene`、`shot_03_album_toro81216`、
> `shot_04_photo_kellyla`、`shot_06_blogpost_cccserene_20120118`、`shot_07_guestbook_dearmoai_20131226`、
> `shot_08_usercard_cccserene`、`shot_09_friend_cccserene`。

### `shot_01_home_20120610.png` — 首頁
- **主色**：白底 + 淡青天空頁首 + **草綠漸層導覽列**；中段一條 **#333333 深色美食帶**；點綴色是螢光粉紅（分享吧）與橘（更多）。
- **版面**：頁首（天空插畫 + 左上綠色「無名小站」logo + 右上 Yahoo!/Help + 搜尋框 + 金色 `Web Search` 按鈕）
  → 綠色主導覽（6 個項目，各附 icon，`Mobile` 帶紅色 NEW 角標）
  → **兩欄區**（左 640 / 右 300）
    - 左：日期軸（垂直，貼在容器左外緣）／今日主題**疊照輪播**（三張照片斜疊，白框拍立得感，下面三顆圓點指示器）／`Wretch Search` 灰底方框／`Featured Photo` 正妹九宮格（1 大 + 5 小，大圖左上有金色皇冠「本日最鄰家」角標）
    - 右：`Ready to login?` + 綠色 `Login` 按鈕 + `Join VIP / Join member`／四個頁籤 `My Blog Album Video` + 三張小圖／公告清單／`Hot Activities` 編號 1-3 的圖文列
  → **深色美食帶**（5 個頁籤，最右邊「分享吧」是**亮粉紅色 active 樣式**，下面 1 大 2 小的圖文卡）
  → **兩欄下段**：左 `Celebrity` 頁籤區（1 大 2 小人物）＋ `Site blogs` 三欄連結；右 `Featured Blogs`（Recommend/Random 頁籤，編號 1-2 圖文）
  → 頁尾（連結列、RSS 列、中文/English 切換、版權兩行）
- **互動【推】**：今日主題是自動輪播（三顆圓點）；`Featured Photo`、`Hot Activities` 美食帶、`Celebrity`、
  `Featured Blogs` 都是**頁籤切換**；`Background music ON/OFF` 是開關；`Add Friend` 是 hover 才出現的按鈕【推】。

### `shot_02_albumlist_a0933936769_20131226.png` — 相簿列表（最完整）
- **主色**：白底、黑字、粉紅／藍色連結；使用者自訂頁首橫幅（螢光綠楓葉 + `ENJOY YOUR LIFE`），頁尾自訂城市插畫。
- **版面**：單欄置中。標題 `a0933936769's AlbumList` → 導覽 `[ … 的 MyPage | album | blog | guestbook | User | Friend | Video ]`
  → 兩個下拉（`- Friends' Album -` / `- Category -`）→ `28 Albums` 與分頁 `1 2 下一頁`
  → **5 欄 × 4 列的封面網格**（縮圖 90px 寬，帶細相框），每格下方是相簿名（兩行會換行）與粗體 `NNpictures`
  → 再一次分頁 → 右下 `Today's Visitors: 0 / Total Visitors: 2280`。
- 頂端有紅字關站公告列。
- **互動【推】**：`- Friends' Album -` 選好友跳頁；`- Category -` 篩選分類；封面 hover 無特效，直接連到 album.php。

### `shot_02_albumlist_cccserene_20120820.png` — 相簿列表（2012、粉紅皮膚）
- **主色**：粉紅 `#F8D0DC` 系底 + 深粉字 + 頁尾滿版粉紅插畫（曬衣繩、麵包店）。
- 版面同上，但導覽做成**七顆有框的小按鈕**（`MyPage` `album` `blog` `guestbook` `User` `Friend` `Video`），
  中央內容區是一塊**白色半透明卡片**。封面全部破圖。

### `shot_02_albumlist_dearmoai_20120615.png` — 相簿列表（2012、黑紅皮膚）
- **主色**：純黑底、紅字、頁首黑色浪花插畫（帶紅色圓角外框的橫幅）。
- 版面同上；封面破圖時顯示的是**系統預設「資料夾」圖示**（藍色資料夾＋相機），
  而非 alt 文字 — 這代表當使用者沒有封面時會用這張預設圖。**復刻要準備這張 icon。**

### `shot_03_album_toro81216_20131226.png` — 單本相簿（最完整）
- **主色**：白底、灰藍字、橘紅色相簿名。
- **版面**：麵包屑 `toro81216's Album > 曼都盃威:D` → 導覽列 → `- Friends' Album -` 下拉
  → `Topic: / Place: / Category:` 三個中繼資料 → `[One Page] [Add to Friend List]`
  → 四顆分享按鈕（FB、Plurk、笑臉、綠色`發文`）→ 分頁 `↓ 2 下一頁`
  → **5 欄 × 4 列的照片縮圖網格**（第一格有選取黑框），有標題的照片會在下面顯示標題（例：`什屍Ma的偶像`、`痘波大飯店噢`）
  → 分頁 → 右下訪客計數。

### `shot_03_album_cccserene_20120106.png` — 單本相簿（2012）
- 同上結構，粉紅皮膚，20 格全破圖（顯示 alt `Cover`）。可看到 2012 年多了 `[Report this Album]` 連結。

### `shot_04_photo_cccserene_20120305.png` — 照片頁（2012 英文版）
- **版面（由上而下）**：kukubar → 麵包屑 `cccserene's Album > 99／0729-0802 HK動漫展`
  → 右邊一組 `N / M` 計數 + `First | Previous | Next | Last | Top` + `Slide Show`
  → 一條水平分隔線 → 四顆分享按鈕 → **主圖**（此處破圖，alt `Next(Hotkey:c)`；主圖本身是「按一下跳下一張」的連結）
  → 分隔線 → 右對齊工具列 `搜尋更多  切割照片(NEW)  Report this Picture`
  → **5 張縮圖橫排**（居中）→ 分隔線。
- **互動【驗】**：主圖是可點的「下一張」連結，快捷鍵 `c`。

### `shot_04_photo_kellyla_20131205.png` — 照片頁（2013 中文版）
- 同結構但介面全中文，且多出 `自動播放 | 圖片資訊 | 相片牆:馬賽克 | 瀑布`、
  `留言`、`iZoom Revolution`（帶紅色 NEW 章）、`檢舉這張相片`。
- 縮圖列每張是**白底方框**（約 120×125）＋下方檔名（`970316-014` 這類）。

### `shot_05_bloghome_cccserene_20120904.png` — 網誌首頁（最完整）
- **主色**：桃紅 `#FF2E63` 系滿版底 + 深灰 `#333` 內容板 + 白字；
  中央有一條**直式拉鍊／蕾絲分隔帶**把左右欄隔開。
- **版面**：kukubar → 使用者頁首（粉紅圓圈圖樣 + `:: わたしは みやこです ::` + FB 粉絲頁嵌入框）
  → **兩欄**：左＝文章串（每篇：粉紅圓點 + 標題 + 日期 + 五顆分享鈕 + 內文 + `(More......)` + 作者/時間/`Reply(n)`/`Trackback(n)`/`prosecute`）
  右＝側欄（`TUE` 大字日曆磚 → `About me`（頭像＋Topic＋連結清單＋`- Friends' Blog -` 下拉）→ `Album`（輪播 + `Pause/Prev/Next`）→ `New Post` → `Category` → `My Collection Category` → `My Collections` → `Archives` → `Search` → `Comments` → `TrackBack` → `Favorites`（一張大圖）→ `About me`（好友頭像九宮格）→ `Counter`）。

### `shot_05_bloghome_dearmoai_20120805.png` — 網誌首頁（無皮膚，看骨架用）
- 全白單欄裸 HTML。可以清楚看到 DOM 的先後：站台標題 → 徵稿信箱 → `Digu` → 一則噗浪動態 → 日期 → 標題 → 分享列 → 圖 → `(More......)` → meta 列。

### `shot_06_blogpost_cccserene_20131227.png` — 網誌單篇（最完整）
- 同 5-1 的皮膚與雙欄，左欄改成**單篇全文**：標題＋日期 → 分享列 → 全文 → 分享列 → `推薦此文章/推/收` 方塊
  → 計數 → `Personal Category:` `Topic:` → `Previous / Next in This Category` → `歷史上的今天:`
  → 作者 meta 列 → `[Trackback URL]` 輸入框 + `Copy Trackback Url` 按鈕
  → **`Reply` 區**（每則留言一個粉紅色卡片，右上角 `1樓`/`2樓`）
  → **`Post A Comment` 表單**（Name / Email / URL / Remember Me(Yes|No) / Comments 大文字框 / 驗證碼 / `Post` `Cancel`）。

### `shot_06_blogpost_cccserene_20120118.png` — 網誌單篇（2012、無皮膚）
- 裸版，但**留言樓層編號（1樓～13樓）**與每則的 `<帳號> at <時間> comment | prosecute` 格式看得最清楚。
- 有些留言者後面帶 email / Homepage 連結，以及兩個小圖示（禮物、盒子）。

### `shot_07_guestbook_dearmoai_20131226.png` — 留言板（最完整）
- **主色**：`#343434` 頁底、`#1A1A1A` 留言區、`#616161` 框線；橘色 `Message：` 標籤；頁首是黑玫瑰 `Guest ★ Book` 大插畫。
- **版面**：kukubar（紅字關站公告）→ 頁首插畫 → `dearmoai's Guestbook`
  → **左欄（610px）**：三個頁籤 `Messages` / `System Messages` / `★ Leave a Message...`（右側那顆是深色膠囊按鈕）
    → 搜尋列（輸入框 + `Title` 下拉 + `Search` 按鈕）→ 分頁 `1…15 下一頁`
    → 留言條目（左邊 60px 方形頭像；右邊三行 `TITLE` / `NAME` / `DATE` 標籤 + `prosecute`；下面 `Message：` 與內容）
  → **右欄**：頭像＋暱稱＋簽名檔＋時間 → 直排按鈕 `MyPage album blog guestbook User Friend Video`
    → `make friend | message | RSS` → `- Friends' Guestbook -` 下拉 → 計數（`Today's / Total Visitors`、`Messages:`、`Hot Ranks:`）。
- **互動【推】**：三個頁籤切換；`Title` 下拉可切換搜尋欄位（Title/Name/Content 之類）。

### `shot_07b_guestbook_dearmoai_20110818_noskin.png` — 留言板 2011（動態牆版）
- 白底裸版。**重點：2011 年的留言板第一個頁籤是 `Vitality`（動態）**，
  底下有 `All / Photo / Article / Video` 四個灰色膠囊篩選鈕，
  內容是**動態串**：`dearmoai uploaded 29 photos to 2011.0801-0831` + 縮圖列 + `分類: 美食記錄` + 右邊 `2 days ago`；
  也會有 `dearmoai posted an article <標題> on <網誌名>` + 摘要。最底是 `More`。
- 右欄名片：cover 圖 + 簽名 + 時間戳 + 右側直排按鈕（`MyPage / Album / Blog / Guestbook / Mypage / Friend / Video`，
  **當前頁 `Guestbook` 是反白 active 樣式**）+ `make friend | contact | message | RSS`。

### `shot_08_usercard_cccserene_20120709.png` — 名片頁（最完整）
- **主色**：珊瑚橘→奶黃的滿版彩虹雲背景，橘色細虛線做欄位底線。
- **版面**：kukubar → 導覽列（一行 `[ cccserene的 MyPage| album| blog| guestbook| User| Friend| Video ]`）
  → `- My Friends -` 下拉（橘色實心） → `[Add to Friend List]`
  → **右對齊標籤 + 左對齊值的十個欄位**（Nickname / Gender / Blood type / Height / Education / Occupation / Hobby / Favorite / Dislike / Introduction），每列一條**橘色虛線**延伸到右邊
  → 右下 `Today's Visitors: 5` / `Total Visitors: 1915`。
- 這頁沒有側欄，是單欄置中的窄表格（約 460px 寬的標籤+值區塊）。

### `shot_08_usercard_dearmoai_20120414.png` — 名片頁（空狀態）
- 幾乎全空：只有粉紅漸層左側帶、`dearmoai` 標題、導覽列、`- My Friends -`、`[Add to Friend List]`、
  一條空的粉紅框（頭像破圖）、計數。可當「使用者沒填資料」的畫面參考。

### `shot_09_friend_cccserene_20131227.png` — 好友頁（最完整）
- **主色**：白底、粉紅字（`#FF9999` 系）、卡片框 `#FFCCCC`。
- **版面**：kukubar → 左邊一個粉紅框的大頭像位（破圖）＋右邊 `cccserene的好友列表` 標題與**直排七個連結**
  → `[Add to Friend List] [找朋友]` → 右邊紅字 `Search Friends`
  → `Now List: Category: -All-, Search:`
  → 兩行說明字 → **四個頁籤**（`My Friends` 為 active＝白底無下框線；其餘三個是有框的未選頁籤）
  → **869px 寬的外框方框**內是 **6 欄 × N 列的好友卡片**（每張 112×155，上方帳號名、下方頭像置中）
  → 底部 `1|2|»` 與 `There are 44 friends`。
- **互動【驗】**：四個頁籤是切換不同好友關係清單；分頁 `1|2|»`。

### `shot_09b_friend_dearmoai_20110831_noskin.png` — 好友頁（空狀態、裸版）
- 白底裸版，看得到**未套皮膚時的頁籤預設樣式**（灰色 `#CCC` 方框、active 是白底底線斷開）。
- 空狀態文案：`There are 0 friends`。另外多了 `[Find Friend]` 與 `Friend Setting` 這兩個
  在 2013 版沒看到的項目。

---

## 9. 給復刻者的三個提醒

1. **無名的個人頁 = 一層系統版型 + 一層使用者皮膚**。系統層來自 `pic.wretch.cc/e/serv/*/css/*`
   （container.css / layout.css / top.css / button.css …），皮膚層是 `f<N>.wretch.yimg.com/<user>/files/<page>.css`。
   我抓到的每個真人頁面都套了自訂皮膚，所以**截圖裡的顏色多半不是「無名預設」**——
   要復刻「預設」外觀，請去讀系統層 CSS，不要照抄我截圖的粉紅／黑紅配色。
2. **2012 與 2013 的相片頁介面語言不同**（英文 vs 中文），2013 還多了 `iZoom Revolution`、`相片牆`。
   目標年代優先序是 2012 > 2013，所以照片頁應以 `shot_04_photo_cccserene_20120305.png` 的英文版為準，
   中文版當補充。
3. **2013-12 的快照頂端都有紅字關站公告** `無名小站已進入全站唯讀模式，12/26服務終止`，
   復刻時**不要**把它做進去。
