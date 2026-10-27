# 數術知識大挑戰 v4 — GitHub Pages + Supabase + 站內 EPUB 文獻庫

版本日期：2026-10-27。系統為互動學習示意，不應將現代抽宿機制誤認為已有古籍證明的占法。

## A. 此版介面

- 二十八宿圓盤固定**上南、下北、左東、右西**；改用傳統連續次序「東方角亢氐房心尾箕 → 北方斗牛女虛危室壁 → 西方奎婁胃昴畢觜參 → 南方井鬼柳星張翼軫」。**角木蛟置於原先箕水豹位置（左上），依序逆時針排到左下箕宿**；其餘三方也相應調整以保持 28 宿連續。
- 北極星（圓心）可滑鼠點擊或鍵盤 Tab 選取，再按 Enter/空白鍵啟動抽宿；一般「抽宿挑戰」按鈕仍可用。固定天極僅為示意，非精確歷史天球。
- 史料卡上的「站內查閱」或「文獻庫」開啟本頁的閱讀對話框，**不再開外部文獻網址**。可選書、選章及本章字詞查找。
- 若沒有上傳真正 EPUB 轉製的正文，閱讀器會明確告知「尚未匯入」，不會拿別部書替代。原版 HISTORIES 的既有短句因未對照使用者提供 EPUB，**一律顯示「既有文字摘錄（待與 EPUB 核對）」**。
- 題庫仍支援 56 題基本題及管理員透過 Supabase 登入，登入安全由伺服器端 Auth 和 RLS 保護。

## B. 逐步建立 Supabase 帳號與專案（一次性）

1. 在瀏覽器前往 https://supabase.com/dashboard ，按 **Sign up**（註冊），可選電子郵件或其支援的身份提供者。依頁面指引驗證帳號並登入。請使用自己管理的電子郵件；不要在公開程式碼提供任何密碼。
2. 選 **New project**（有些版面需先選 **New organization**），輸入專案名稱（例如 `divination-quiz`），設定**資料庫密碼**並安全留存。這個資料庫密碼 **不是** 網站管理員登入密碼。
3. 選擇離訪客較近的區域（台灣使用者可按現有供應區域比較 Tokyo / Singapore），按 **Create new project**。專案完成建立後就有 PostgreSQL 資料庫和 Supabase Auth。
4. 左側選 **SQL Editor → New query**。開啟本套件的 `setup.sql`，將全部內容貼上並 **Run**。這會建立 `quiz_admins` / `quiz_questions`、RLS 設定與 `replace_quiz_bank` RPC。**注意 SQL 腳本須一次核查後再執行，勿隨意在正式專案反覆覆蓋自訂政策。**
5. 另開 SQL Query，貼上 `seed.sql` 內容再按 **Run**，建立 56 題種子題庫。可到 **Table Editor → quiz_questions** 確認資料。
6. 左側 **Authentication → Users → Add user**（實際文字可能因平台版本而變）：新增一位具**電子郵件＋強密碼**的管理員，完成需要的 email confirmation。請到 **Authentication → Providers / Sign In** 關閉**不需要的訪客自助註冊**（只允許受邀或管理員建立的帳號）；如果需要郵件確認，請設定好郵件傳送。
7. 在 **Authentication → Users** 內複製管理員的 **User UID（UUID）**，回到私人 SQL Editor 執行下列 SQL，把 UUID 替換為真實值：

   ```sql
   insert into public.quiz_admins(user_id)
   values ('請替換成管理員的真實-UUID');
   ```

   **只在自己的 Supabase Dashboard 中執行。** 不要把含管理員 UID、個資、密碼的 SQL 提交到公開 GitHub。
8. 到 Supabase 專案右上角 **Connect**，查詢 **Project URL** 和 **Publishable key**；或在 **Settings → API Keys** 找 publishable key（形式 `sb_publishable_...`）。不要複製 `sb_secret_...`、舊式 `service_role`。參照官方：https://supabase.com/docs/guides/getting-started/api-keys
9. 修改 `config.js` 的**兩個公開設定**：

   ```javascript
   window.QUIZ_AUTH_CONFIG = {
     supabaseUrl: 'https://你的專案參照碼.supabase.co',
     publishableKey: 'sb_publishable_你的公開金鑰'
   };
   ```

   注意：這兩項是**刻意允許公開**的專案資訊，不是管理密碼。真正的安全邊界是 RLS。將網站管理員登入密碼或 Supabase secret key 寫入 JavaScript 將是不安全的。
10. 部署後以管理員帳密登入網站「管理題庫」。實測新增一題、重新整理頁面及另一瀏覽器能讀到更新；再以未登入／普通已登入使用者測試無法新增、編輯、刪除題目；也應確認 RPC 無權呼叫時會拒絕。**本套件無法替您的 Supabase 專案完成真實帳號、網路和 RLS 整合測試。**

## C. 如何提供 EPUB 原始文獻（不使用外部連結）

### 方法 1：上傳 EPUB 至此對話以利轉製

把合法取得、可以公開展示的 `*.epub` 上傳到 ChatGPT 對話，並註明：

- 書名與篇／卷名；例如《史記》卷二十七〈天官書〉。
- EPUB 來源、編校者、出版者、版本及已知異文（能查到才填）。
- 是否有公開放上 GitHub Pages 的重製與散布授權；**僅個人持有 EPUB 不代表可以公開轉發全文**。

之後可製作 `library/books/*.json` 及 `library/catalog.json`，供右側「站內查閱」開啟；**本次 ZIP 尚無任何使用者提供的史書 EPUB，因此不含史書全文**。

### 方法 2：在本機自行轉換（離線、無須額外 Python 套件）

1. 安裝 Python 3.10+，下載本套件並解壓縮；在包含 `index.html` 的根資料夾打開 PowerShell。
2. 將合法可公開的 EPUB 存入 `epub_input` 資料夾。範例：

   ```powershell
   python .\tools\epub_to_library.py .\epub_input\shiji.epub --id shiji --title "《史記》" --edition "請填真實版本資料"
   ```

   若用 Windows，請在 PowerShell 上使用上述指令。macOS/Linux 可將路徑分隔符 `\` 改為 `/`。
3. 轉換器會讀取 EPUB 的 OPF 書脊（spine）閱讀順序與 XHTML 文字，產出或更新：

   ```text
   library/
     catalog.json
     books/
       shiji.json
   ```

   其他史書可以改 `--id hanshu`、`--id houhanshu`、`--id jinshu` 等，一書一個 JSON，不會覆寫其他 ID 的書。
4. 打開 `library/books/shiji.json`，校對書名、章節順序、文字、缺漏和異體字。文字段落有 EPUB 原始內部路徑 `source_path`、書脊順序 `spine_index` 與閱讀器內的段序。**EPUB 未必有固定紙本頁碼，不能用網頁段序冒充原書頁碼。** 有掃描圖、圖片正文或 DRM 時，工具不會猜字或跳過授權限制。
5. 把更新的 `library/catalog.json` 與 `library/books/*.json` 上傳到同一 GitHub Pages repo。以後讀者按「文獻庫」即可**在網站內**閱讀，不跳轉外站。

**限制**：本工具只轉出可擷取的 EPUB XHTML 文字，保留原字而不自動校勘；不擷取圖片文字、不做 OCR、不用 AI 猜測缺字，不繞過 DRM。如有複雜註腳或特殊排版，需另行人工核對。公開託管全文必須遵守授權及法規；若無散布權，可改只放獲授權節錄，或建置需要授權登入的**私有後端文獻服務**，不要把私密資料提交公開 repo。

### 目前史料摘錄的嚴格定位

`HISTORIES` 是第三版延續的演示摘錄與編者說明，不等同已用 EPUB 原始文件逐頁對校。正式論文引用時，請在讀到提供的 EPUB 後逐條對照正文、注疏、版本差異與可核的卷篇／葉次。網站**不會宣稱**尚未提供的 EPUB 已經匯入。

## D. GitHub Pages 部署

將以下檔案與目錄放在 `nortonGOH/divination-monopoly` 儲存庫 **根目錄**：

```text
index.html
config.js
questions.json
library/
  catalog.json
  books/
    （有 EPUB 且經授權轉製後才加入 *.json）
tools/
  epub_to_library.py
```

`setup.sql` / `seed.sql` 用於 **Supabase SQL Editor**，並非瀏覽器會自動執行的 SQL，也不必放入公開網站。更新並 commit 之後進入 `https://nortongoh.github.io/divination-monopoly/`。如 GitHub Pages 尚未啟用：儲存庫 **Settings → Pages**，選 **Deploy from a branch**，選主分支與 `/ (root)`。此站只使用原生 HTML、CSS 與 JavaScript，無 CDN 套件與外部文獻閱覽連結。

## E. 測試紀錄與限制

- JavaScript 語法檢查：通過。
- Playwright 無網路模擬：檢查 28 宿順序及四象方位、北極星滑鼠觸發、停止指向誤差、原有抽宿按鈕、登入未設定時鎖定、EPUB 段落保留、站內查閱與檢索、未匯入對應史書不會替代、手機版無橫向溢出：通過。
- 模擬測試使用**合成的假 EPUB**，只為測試轉換功能，未混入交付的史料庫；`catalog.json` 預設為空。
- **未驗證**：真實 Supabase 帳號註冊與驗證（需使用者建立專案）；任何真實史書 EPUB 的全文正確性、版本、排版與著作權狀態（尚未提供原檔）；真實 GitHub Pages 部署。

開發工具和平台依目前檢索到的 Supabase 官方文件整理，實際管理介面名稱可變動。
