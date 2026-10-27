# 數術知識大挑戰 · 第三版

GitHub Pages 靜態站（`index.html` + `config.js` + `questions.json`），題庫管理員認證與跨訪客資料讀寫使用 **Supabase Auth + PostgreSQL Row Level Security (RLS)**。

## 這版修改

1. **安全管理員登入**：公開網頁不寫密碼、密碼雜湊、Supabase secret/service_role 密鑰。管理員登入憑證送往 Supabase Auth（HTTPS），經由資料庫 `quiz_admins` 及 RLS 確認有權新增、刪除、更新題目。
2. **史書天文資料輪播**：目前有《史記》《漢書》《後漢書》《晉書》《宋書》《宋史》《元史》《明史》共八部正史的短引文或明確標為「編者說明」的摘要。依星宿所屬方位優先抽選，亦有跨星宿通用資料。每則附卷次、原始文字網址。**不是二十四史全部都有天文志，也不是所有章節逐宿記錄。**
3. **北極星與北斗**：固定北極星於圓心，天璇—天樞—北極星成指極示意線，北斗繞圓心逆時針轉動，瑤光指針指向所選二十八宿。示意星距與圓盤扇區不是實測天象。

## 部署與初始管理員設定（必要）

> **注意：GitHub Pages 不提供後端密碼驗證。** 本站未設定安全後端時可公開答題與閱讀，但點「管理題庫」只會顯示設定提示，**不提供可繞過的前端管理密碼**。

1. 到 [Supabase](https://supabase.com/) 建立專案，記下 `Project URL` 與 **Publishable key**（舊專案可用 legacy `anon` key）。**不要用** `secret` 或 `service_role` key。
2. 在 Supabase **SQL Editor** 先執行 `setup.sql`，建立 `quiz_admins`、`quiz_questions` 兩表，四種操作的 RLS 規則及原子性題庫取代 RPC。
3. 在同一 SQL Editor 執行 `seed.sql`，匯入初始 56 題。此腳本只增修相同 ID 的題目。
4. 在 Supabase **Authentication → Users** 新增管理員電子郵件／密碼使用者（建議使用強密碼、電子郵件驗證及 MFA，並關閉對外自由註冊），複製該使用者 **UID**。**在私人的 SQL Editor** 執行：

   ```sql
   insert into public.quiz_admins(user_id)
   values ('此處替換為實際的管理員 UID');
   ```

   此 UID 不含密碼；請勿將實際帳號資訊或密鑰提交 GitHub。
5. 修改 `config.js`（只有兩項**可公開**的設定）：

   ```js
   window.QUIZ_AUTH_CONFIG = {
     supabaseUrl: 'https://你的專案.supabase.co',
     publishableKey: 'sb_publishable_你的公開金鑰'
   };
   ```

   Supabase 專案請保持正確的 API 權限及允許網站來源的設定。真正的資料修改權限由 SQL RLS 控制，**不是** `config.js` 隱藏。
6. 將 `index.html`、`config.js`、`questions.json` 放在 GitHub Pages 的網站根目錄。`setup.sql` 和 `seed.sql` 是方便部署的文件，不會在公開網站自動執行。可將 SQL 放入私人管理資料夾，不必公開上傳。
7. 打開 `https://nortongoh.github.io/divination-monopoly/`，按「管理題庫」以管理員信箱與密碼登入。登入後所有新增、編輯、刪除、匯入、恢復預設都透過 Supabase，對所有訪客立即生效（訪客若已打開頁面，須重新載入才能取得更新）。

## 安全邊界

- 後端帳密及密碼驗證由 Supabase Auth 提供；系統不把密碼或可逆密文寫進 GitHub。公開的 publishable key **不是**管理員祕密。
- 密碼**不能靠前端加密、混淆或「防 AI 反組譯」保護**：攻擊者永遠能看到公開 Javascript。伺服器端身分驗證和 RLS 才是保護資料修改的關鍵。
- 匿名使用者只具有題庫 `SELECT` 權限；已登入但未加入 `quiz_admins` 的使用者也不能寫入。`quiz_admins` 不允許前端自行加管理員。
- 網頁不把登入存到 localStorage/sessionStorage；重新整理後需重新登入。登入 Token 暫存在目前分頁的記憶體內，登出會呼叫 Supabase Auth 撤銷會話。
- 部署前請使用非管理員／未登入角色，**實際測試**資料庫拒絕 `POST`、`PATCH`、`DELETE` 與 `replace_quiz_bank`。本次交付未連接您的 Supabase 專案，因此**未能執行真實後端滲透或權限測試**。
- 課題、正確答案及原始文獻引用是**公開讀取內容**，不適用於要求隱藏正確答案的高風險測驗。

## 史料核對與史學注意

引文集中於 `index.html` 的 `HISTORIES` 陣列；每則標記書名、卷次、原文連結，`quote` 是核對過的短引文，`context` 是現代編者說明。留空 `quote` 只展示摘要，不充作直接引文。將來擴充史料，宜對照可靠影印底本並記錄版本資訊。`《後漢書》志` 實取自司馬彪《續漢書》，後經劉昭補注附於今本；史書正文、注、後人補述需區分。《宋史》對極與極星的記載也提醒我們：圖上把「極星」固定在天極，只是互動示意，不能當成跨時代不變的精確天文位置。

原始文本檢索連結：

- 《史記》卷二十七〈天官書〉：https://zh.wikisource.org/wiki/史記/卷027
- 《漢書》卷二十六〈天文志〉：https://zh.wikisource.org/wiki/漢書/卷026
- 《後漢書》志第十〈天文上〉：https://www.shidianguji.com/zh/book/LS0003/chapter/1j7lpp5enssv9_275
- 《晉書》卷十一〈天文上〉：https://zh.wikisource.org/wiki/晉書/卷011
- 《宋書》卷二十三〈天文一〉：https://zh.wikisource.org/zh-hant/宋書/卷23
- 《宋史》卷四十八〈天文一〉：https://zh.wikisource.org/zh-hant/宋史/卷048
- 《元史》卷四十八〈天文一〉：https://zh.wikisource.org/wiki/元史_(四庫全書本)/卷048
- 《明史》卷二十五〈天文〉：https://zh.wikisource.org/wiki/明史_(四庫全書本)/卷025

## 技術說明

- 客戶端只有原生 HTML/CSS/JS，不需建置工具或外部 JS CDN。
- 題庫仍保留 28 宿各兩題，共 56 題；題庫管理有搜尋、增刪改、JSON 匯入/匯出、恢復預設等。
- `seed.sql` 將原版 JSON 題庫投入後端；GitHub 根目錄 `questions.json` 為公開示範及「恢復網站預設」的基礎資料。
- **直接引文不是校勘定本**：已核查網路文字版篇章，但尚未逐字校對武英殿本、四庫本等影印原件；需要正式學術引用時仍應與版本底本比對。
