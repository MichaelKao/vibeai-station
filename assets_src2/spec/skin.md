# 各服務的預設版型（skin）

無名的個人頁版面不是官方 CSS 給的，是**版型 CSS** 給的。頁面實際載的是
`f<N>.wretch.yimg.com/<帳號>/files/{album,blog,guestbook,user,friend}.css`——
一個帳號一支，開帳號當下就把預設版型寫進去，使用者之後可以整支蓋掉。
官方那幾支（font / kukubar / newPanel / sharing / layout / fix …）只管字型、
工具列、面板、骨架，不管配色與版面寬度。

這份文件記錄：**哪一支是原廠預設**、怎麼確認的、版面尺寸、素材清單、
以及**哪些還沒找到**。

---

## 一、結論表

| 服務 | 預設版型 | 素材目錄 | 來源 CSS（本機） | 確定度 |
|---|---|---|---|---|
| 網誌 blog | **skin 1/117** | `img/skin117/`（6 檔） | `css/blog_default_skin117_afuuu_blog.css` | ★★★ 檔頭有「無名小站預設樣式」 |
| 相簿 album | **skin 1/189** | `img/skin189/`（3 檔） | `css/album_default_skin189.css` | ★★★ 檔頭有「無名小站預設相簿樣式」 |
| 相簿 album（灰色版） | skin 1/188 | `img/skin188/`（3 檔） | `css/album_default_skin188.css` | ★★★ 同樣有預設字樣，見 §5 |
| 留言板 guestbook | **skin 1/1911** | `img/skin1911/`（12 檔） | `css/gb_default_skin1911_guestbook.css` | ★★☆ 無字樣，靠出現率判定 |
| 好友 friend | **skin 5/577** | `img/skin577/`（3 檔） | `css/gb_default_skin577_friend.css` | ★★☆ 無字樣，靠出現率判定 |
| 名片 user | **無編號版型（純 CSS 無素材）** | 無 | `css/gb_default_user.css` | ★★☆ 無字樣，靠出現率＋筆跡判定 |

「★★★」＝原始檔自己寫著是預設；「★★☆」＝沒寫，但在隨機抽樣中出現率遠高於任何
使用者版型，且風格與已確認的預設一致。**沒有任何一個服務是只能拿使用者版型硬湊的。**

---

## 二、怎麼找到的（方法，之後要補別的版型照這個做）

1. 用 CDX **前綴切片**列出使用者版型檔。整個 host 掃會 504，切一小段字母就很快：

   ```
   curl -s "https://web.archive.org/cdx/search/cdx?url=f12.wretch.yimg.com/ap&matchType=prefix\
   &filter=original:.*files/user.css.*&collapse=urlkey&limit=20&fl=timestamp,original,length"
   ```

   注意兩件事：
   - 版型檔的網址**帶 query string**（`files/album.css?1347070052`），
     所以 `matchType=exact` 用原始網址一定查不到，只能用 prefix。
   - `f1`～`f12` 只是 CDN 別名，**同一個帳號用 f12 一律查得到**，不必試別的號碼。

2. 抓下來之後做兩件事：
   - `grep 預設` —— 網誌與相簿的原廠預設檔頭就寫著「無名小站預設(相簿)樣式, 使用者可以亂改」。
   - **md5 直方圖** —— 留言板／好友／名片的預設沒有字樣，但同一份檔案會在大量帳號間
     位元完全相同，取眾數就是預設。

3. 出現率的判讀基準（很重要，別被低比例騙了）：
   已知的原廠預設在隨機抽樣裡也只佔一到兩成，因為大多數人都換過版型。實測：

   | 服務 | 預設版型的 md5 | 出現率 |
   |---|---|---|
   | 網誌（已知是預設） | `03d672e0` / `6bf3e2dd` | 2 / 40 ≈ **5%** |
   | 相簿（已知是預設） | `9ac7a0b4`(189) + `d1369530`(188) | 10 / 58 ≈ **17%** |
   | 留言板 | `c34f727c` | 22 / 93 ≈ **24%** |
   | 好友 | `68802fde` | 10 / 40 ≈ **25%** |
   | 名片 | `c85ca0d4` | 5 / 78 ≈ **6%** |

   留言板與好友遠高於已確認的網誌預設，很安全；名片的 6% 和網誌的 5% 同一個量級，
   也在合理範圍（見 §6 的補充理由）。

4. **抽樣要避開機器人帳號**。`a0000000000x` / `j00000xxx` 這種連號帳號是同一批註冊的，
   四個服務的版型會一模一樣，會把直方圖帶偏。真實帳號名單是從
   `assets_src2/html/` 裡的好友頁、留言板頁撈出來的（458 個）。

5. 版型素材的網址是 `l.yimg.com/e/style/<目錄>/<版型編號>/<檔名>`。
   **這個前綴不能用 prefix 查，一定 504**，只能從 CSS 裡把完整網址挖出來後逐檔 exact 查。
   目錄號和版型編號沒有可靠的推導關係（1/117、1/189、1/1911 都在目錄 1，
   但 1/1119 和 11/1104 同時存在），照 CSS 寫的抄就好。

---

## 三、頁面實際的 CSS 載入順序（從存檔 HTML 逐頁抄的）

版型檔在中間，這決定了 cascade，串接時順序不能亂。

| 頁面 | 存檔檔名 | 順序 |
|---|---|---|
| 網誌 | `html/blog_2012_default_skin_afuuu.html` | `blog/css/top.css` → **版型 blog.css** → `common/css/sharing.css` → `blog/css/font.css` → `blog/css/antiPhishing.css` → `blog/css/trackback.css` → `common/css/kukubar.css` → `common/css/promotion.css` |
| 相簿 | `html/album_show_zh_kellyla.html` | **版型 album.css** → `album/css/font(_vip).css` → YUI container → `album/css/newButton.css` → `album/css/newPanel.css` → `album/css/spp_promotion.css` → `album/css/mod_ad.css` → `common/css/sharing.css` → `common/css/kukubar.css` → `common/css/promotion.css` |
| 留言板 | `html/gb_guestbook_a000000010_20131226.html` | `guestbook/css/layout.css` → `guestbook/css/namecard.css` → **版型 guestbook.css** → `guestbook/css/overwrite.css` → `common/css/kukubar.css` → `common/css/promotion.css` |
| 名片 | `html/gb_user_a014042_20120326.html` | **版型 user.css** → `user/css/font.css` → `common/css/kukubar.css` → `common/css/promotion.css` |
| 好友 | `html/gb_friend_a000001_20131226.html` | `friend/css/fix.css` → **版型 friend.css** → `friend/css/select.css` → `common/css/kukubar.css` → `common/css/promotion.css` |

相簿與名片**完全沒有官方版面 CSS**，整頁的寬度、欄位都靠 HTML `<table>` 加版型檔撐；
所以這兩頁的版型檔換掉，版面會整個變樣。留言板與好友則是官方骨架（layout / fix）
先把版面定好，版型只換配色與背景圖。

---

## 四、各服務的版面尺寸與素材

### 網誌 blog — skin 1/117

- 總寬 **750px**（`#container1`）＝ 主欄 `#content` **530** ＋ 側欄 `#links` **200** ＋ 間距 20
- `#banner` 高 120px；`.date` 高 25＋padding-top 5；側欄連結塊寬 173px
- `body { font: .8em Arial }`

| 檔名 | 尺寸 | 用途 |
|---|---|---|
| banner.gif | 750×120 | `#banner` 頁首橫幅 |
| date.gif | 530×30 | `.date` 日期列 |
| blogbody.gif | 530×20 | `.blogbody` 文章底部收邊 |
| box.gif | 200×30 | `.sidetitle` 側欄標題 |
| box1.gif | 200×20 | 側欄各 box 底部收邊 |
| calendar.gif | 200×200 | `.calendar` 月曆底圖 |

素材在 `assets_src2/img/skin117/`（`img/blog/style117_*.gif` 是同一批的舊命名副本）。

### 相簿 album — skin 1/189

- 頁面寬 **700px**（存檔 HTML 的 `<table width="700">`，CSS 的 `hr { width:700px }` 對得上）
- `.sidetitle` 寬 660 ＋ 左右 padding 20 ＝ 700
- 縮圖格 **120×120**（`<td width="120">`，`.side` 的 side_a.gif 正好 120×120）
- `body { background:#eee }`、內頁 `body#body_show { background:#fff }`

| 檔名 | 尺寸 | 用途 |
|---|---|---|
| banner_a.gif | 680×20 | `#banner` 頁首（底色 #FFE8E8） |
| side_a.gif | 120×120 | `.side` 縮圖格底圖 |
| sidetitle_a.gif | 690×230 | `.sidetitle` 標題列（貼齊底部） |

### 留言板 guestbook — skin 1/1911

官方 `gb_layout.css` 先定骨架（預設 900/600/300），版型把它加寬：

- 容器 `#bigcontainer` / `#container` **958px**
- 主欄 `#content` **612px**、`#mainSection` / `#msg_list` **604px**
- 側欄 `#sidebar` **330px**、`#action` **288px**
- `#header` min-height 80px，`h1` 從 left:300px 起、寬 658px
- 分頁籤 `#main_tab li` 高 39px（hover 55px）

| 檔名 | 尺寸 | 用途 |
|---|---|---|
| header.gif | 286×53 | `#header` 左上識別 |
| main.gif | 958×75 | `#main` 主區頂部 |
| footer.gif | 958×30 | `#footer` |
| tab_l.gif / tab_r.gif | 130×39 / 10×39 | 選中的分頁籤左右端 |
| tab2_l.gif / tab2_r.gif | 130×39 / 10×39 | 未選中的分頁籤左右端 |
| message.gif | 120×39 | 「留言」籤 |
| msg_body.gif | 604×20 | 留言框頂部 |
| msg_added_form.gif | 583×113 | 發言表單底圖 |
| mine.gif | 330×183 | 側欄「我的」區塊 |
| stats.gif | 217×40 | 側欄統計區塊 |

### 好友 friend — skin 5/577

好友頁是**流動寬度**（`gb_friend_fix.css` 只寫 `#container { margin: 0 20px }`），
版型用左右欄的固定值把版面定住：

- 左欄 `#header` float:left 寬 **360px**（＋padding-left 35 ＝ 佔 395）
- 右欄 `#friendListDiv` / `#pagelink` / `#num_friends` `margin-left: 375px`
- 好友卡 `#friendListDiv ol li` 高 155px（`gb_friend_fix.css` 裡單張寬 110/108）
- `html { border-left: 14px solid #BBAD8E }` —— 整頁左側那條色帶

| 檔名 | 尺寸 | 用途 |
|---|---|---|
| body_bg.gif | 80×2 | `body` 右側直向重複的底紋 |
| corner_top.gif | 80×26 | `#container` 右上角收邊 |
| header.gif | 433×154 | `#header` 左欄頁首 |

### 名片 user — 無編號預設版型

**這支完全沒有引用任何圖檔**，只有配色與字體，所以沒有素材目錄。

- 名片頁的寬度是 HTML `<table width="600">`（內層 `width="450"`）給的，CSS 不管寬度
- `body { margin:20px; background:#FFF }`、連結 `#336666` / hover `#669999`
- `#banner` 字級 x-large、色 `#CC9933`；`.sidetitle` 底線 1px dotted #666
- 寫法是 tab 縮排、每條規則分行——和網誌 / 相簿那兩支原廠預設同一種筆跡，
  和使用者版型（全大寫屬性、單行擠在一起、開頭有「作者：xxx」）明顯不同

---

## 五、相簿有兩支預設：188（灰）與 189（粉）

兩支的檔頭都寫著「無名小站預設相簿樣式, 使用者可以亂改」，差別只有配色與素材目錄：

| | skin 1/188 | skin 1/189 |
|---|---|---|
| body 底色 | `#999` | `#eee` |
| banner 底色 | `#ddd` | `#FFE8E8` |
| 連結 / hover | `#345689` / `#56a933` | `#A13636` / `#ff0000` |
| 素材檔名 | `banner.gif` / `side.gif` / `sidetitle.gif` | `banner_a.gif` / `side_a.gif` / `sidetitle_a.gif` |
| 尺寸 | 完全相同（680×20 / 120×120 / 690×230） | |
| 抽樣出現率 | 3 / 58 | 7 / 58 |

**採用 189**（真實帳號裡比較常見：apple9456、chooh0209、bao0920、customagents…；
188 只出現在連號機器人帳號那一群）。188 的 CSS 與素材也一併收好了
（`css/album_default_skin188.css`、`img/skin188/`），要換一行就好。

---

## 六、名片預設版型的判定理由（這支最沒把握，寫清楚）

候選有三支，都在多個不相關帳號間位元完全相同：

| md5 | 大小 | 出現 | 判斷 |
|---|---|---|---|
| `c85ca0d4` | 1677B | 5 | **採用**。無圖、tab 縮排、白底、配色克制，筆跡同 skin117／skin189 |
| `af212135` | 7558B | 9 | 排除。檔頭寫「作者：grayscale 網誌：{液視流}」，且引用 `e/style/4/41/*` —— 社群作品 |
| `f26a0462` | 4570B | 6 | 排除。`.descrxption` 打錯字、結尾疊了好幾組重複的 `BODY {}`，是「樣式編輯精靈」一路 append 出來的檔；被大量轉貼所以很常見 |

`af212135` 出現率最高卻不是預設，正好說明**光看眾數會選錯**——這是為什麼要另外看
筆跡和有沒有作者署名。採用的 `c85ca0d4` 出現在 afuuu（網誌是原廠預設 skin117）、
cutiefive、huoye 三個互不相關的帳號上，而這三個帳號的留言板版型各不相同
（10/1092、13/1393、10/1094），代表他們是「改了留言板但沒動名片」，剩下的名片就是原廠值。

---

## 七、找不到 / 沒做的部分（誠實清單）

1. **好友頁下拉選單的三張圖沒有存檔。**
   `gb_friend_select.css` 引用
   `www.wretch.cc/icon/htcmi/other/script/javascript/select/{def,hover,selectItem}.gif`，
   三個網址在 Wayback 都**查無任何 capture**（不是 404，是根本沒收）。
   建置腳本會把它們列在缺檔清單裡。畫面上會是下拉選單少了背景圖，功能不受影響。

2. **名片預設版型沒有「無名小站預設」字樣可以直接證明**，是靠出現率＋筆跡判定的（§6）。
   如果之後找到官方的版型清單頁或 `serv/user/` 底下的原始檔，應該回頭覆核。

3. **留言板（1911）與好友（577）預設版型同樣沒有字樣**，但出現率是已確認預設的
   4～5 倍，風險低。

4. **`l.yimg.com/e/serv/{user,friend,guestbook,blog,common}/css/` 的目錄列表沒掃成功**——
   這幾個前綴查詢一直 504（試了多次、換過 limit）。所以「官方 CSS 是不是還有沒抓到的第幾支」
   目前是靠存檔 HTML 的 `<link>` 反推的，不是靠目錄列表窮舉的。
   已知從 HTML 反推出來的都抓齊了（見 §3）。

5. **`promotion.css` 沒有串進任何 bundle。** 那是關站前的推廣浮層（推 Yahoo 相簿搬家），
   對版面沒有貢獻，而且會蓋一層置底廣告條。檔案在 `css/album_promotion.css`、
   `css/index_promotion.css`，要用再串。

6. **相簿 bundle 沒有收 `spp_promotion.css` / `mod_ad.css` / `slider.css` / `wspp.css`。**
   前兩支是廣告與促銷，後兩支是投影片播放器與新版相簿（wspp）的樣式，等做到那些頁面再串。

7. **沒有找 VIP 版型。** `album_font_vip.css` 抓到了但沒用；VIP 相簿的版型編號沒查。

---

## 八、建置產物對照（`tools/build-css2012.mjs`）

| 產出 | 內容（依序） |
|---|---|
| `public/wretch2012.css` | 首頁：YUI reset+fonts → wfp-css → chameleon |
| `public/wretch2012-album.css` | **skin189** → album font → newButton → newPanel → photowall_overlay → sharing(pic 版) → kukubar |
| `public/wretch2012-blog.css` | blog top → **skin117** → sharing(l.yimg 版) → blog font → trackback → kukubar |
| `public/wretch2012-gb.css` | gb layout → namecard → overwrite → friend fix → friend select → user font → kukubar（**不含版型**） |
| `public/wretch2012-skin-guestbook.css` | **skin1911**，套在 gb bundle 的 namecard 之後、overwrite 之前 |
| `public/wretch2012-skin-user.css` | 名片預設版型，套在 user font 之前 |
| `public/wretch2012-skin-friend.css` | **skin577**，套在 friend fix 之後、friend select 之前 |

留言板／名片／好友的版型**故意不併進 `wretch2012-gb.css`**：三支都寫了 `html{}` 與
`body{}` 的背景，併成一支會互相蓋掉（名片的 `body{background:#FFF}` 會洗掉留言板的
`#eff8ff`、好友的 `html{border-left:14px}` 會跑到每一頁上）。原站本來就是一頁載一支，
照原樣分開出。

素材複製到 `public/img/wretch2012/<分組>/`，分組是
`index / chrome / album / blog / gb / skin117 / skin188 / skin189 / skin577 / skin1911`。
`assets_src2/img/common/**` 當備援索引用：平面目錄裡按檔名找不到的，會到 common 底下
（當年按來源主機分的目錄）撈，撈到就順手複製進該分組——`gb_friend_fix.css` 引用的
`addwhite.gif`、`logo.png` 那幾張就是這樣接上的。

改寫規則只有兩條，**不手抄任何 CSS**：
- `url(../img/xxx)` → `url(<BASE>/<分組>/xxx)`
- `url(http://l.yimg.com/e/style/<目錄>/<編號>/xxx)` → `url(<BASE>/skin<編號>/xxx)`
- 其餘絕對網址按**檔名**在所有分組＋備援索引裡找，找不到就進缺檔清單

首頁那支維持只改相對路徑（`absolute: false`），輸出的 CSS 內容與改版前逐位元相同，
只有註解行多了來源檔名。
