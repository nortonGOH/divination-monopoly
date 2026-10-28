# 數術知識大挑戰 v7：會員、五錯四小時、32 格轉盤、曆法篇 80 題

## 已製作／尚未執行

- 靜態網站更新：`index.html`、`quiz-open-qa.js`、`quiz-challenge-v7.js`。
- PostgreSQL migration：`01_player_lock.sql`，為會員建立錯題次數及鎖定狀態，並新增 3 個 API RPC。
- 曆法篇 80 題：`calendar-questions-80.json`；另提供 8 份每份 10 題的 `seed/calendar_01.sql` ... `calendar_08.sql`。
- 驗證指令：`02_verify.sql`。
- 本套件**不包含帳密、secret/service_role key，也不會覆寫**史料表及既有問答題；SQL 未在您的實際 Supabase 專案執行。

## 部署順序（切勿顛倒）

1. 備份 Supabase 題庫：在 SQL Editor 先查總筆數，或在管理題庫中匯出 JSON。
2. 先確認第六版的 `quiz_questions.difficulty` 與 `quiz_open_questions` 都存在。若尚未執行第六版升級 SQL，先執行舊版 `01_upgrade_difficulty.sql`。
3. 在 Supabase **SQL Editor** 貼入並執行 `01_player_lock.sql`（這份不長）。檢查成功後再做下一步。
4. **80 題匯入二選一：**最簡單是已部署 v6 的網站以授權管理員登入「管理題庫」→「匯入四選一 JSON」→ 模式選**合併** → 選 `calendar-questions-80.json`；此方式會直接寫入 Supabase。若不使用管理介面，則在 SQL Editor 依序執行 `seed/calendar_01.sql` 至 `seed/calendar_08.sql`（每份 10 題）。**不要把兩種方式都當作必須操作**。SQL 版 `ON CONFLICT DO NOTHING` 不覆蓋同 ID。
5. 無論選哪一種匯入方式，執行 `02_verify.sql`，預期有 80 題 `calendar-2026-%`，且難度均是「初階」。
6. Supabase Dashboard → **Authentication → Sign In / Providers → Email**：開啟 Email provider 和新增使用者註冊。建議保留 `Confirm email` 開啟；設定 Email rate limits、CAPTCHA、必要時自訂 SMTP。**Authentication → URL Configuration** 的 Site URL 設為 `https://nortongoh.github.io/divination-monopoly/`。
7. GitHub 專案根目錄：上傳/覆蓋 `index.html`、`quiz-open-qa.js`，新增 `quiz-challenge-v7.js`。請保留現有 `config.js` 與 `history-supabase-reader.js`，不要公開任何金鑰以外的 Supabase Secret。
8. 開啟網站（Ctrl+F5）註冊 → 驗證 Email → 登入 → 抽宿 → 連續答錯五次 → 顯示鎖定四小時。用瀏覽器重新整理並再次登入，次數應維持。四小時期滿下次查詢狀態會歸零。

## 三個 RPC

- `quiz_player_status()`：原子查詢/過期重設 `wrong_count`, `locked_until`。
- `quiz_submit_choice(p_question_id,p_answer_index)`：伺服器核對四選一答案並更新答錯次數。
- `quiz_review_open(p_question_id,p_mastered)`：開放問答依使用者自評「待複習」計錯一次；這**不是客觀閱卷**。

四小時鎖定從該帳號的第 5 次錯誤開始；答對不消除先前累計錯誤。按正常流程，鎖定中無法抽宿或答題。會員認證由 Supabase Auth 管理，密碼絕不寫在 GitHub。前端不將 access token 存於 localStorage；重新整理後請重新登入同帳號，伺服器次數會保留。

### 實際安全限制

目前舊版 `quiz_questions` 會把正確答案透過公開 API 回傳以供讀取。因此**伺服器能可靠地限制已註冊帳號透過新版 RPC 進行的測驗提交，但不能宣稱整套系統已具備反作弊安全性**：知道 API 的人能自行查詢現有題庫答案，也可以另創新帳號。若要正式競賽，應再將正確答案移出公開讀取 API、把題目發放與答題綁定一次性伺服器試次，並對註冊加入 CAPTCHA、電子郵件驗證與風控。

## 四個特殊格

星盤維持東、北、西、南連續序列，共 **7 宿＋特殊格** ×4＝32格，每格等角、隨機抽取。

- 機會 I：重新抽宿；不計答題／答錯。
- 命運 I：允許調整難度再抽宿；不計答題。
- 機會 II：可自行點選任何一宿練習，或再抽宿。
- 命運 II：保持難度再抽宿；不計答題。

這是遊戲設計，不是古代星占技法。特殊格指向的是該格，不會假裝落在二十八宿內。

## 80 題來源與學術校核

題目根據上傳 DOCX《數術入門研究知識問答八十題：曆法篇（選擇題版）》逐題保留題幹、A–D 選項、原文件指定答案與解析。依來源順序在 28 宿輪流配置每宿 2–3 題；全部暫定 **初階**，方便在網站難度選擇後抽中每一宿都有題。來源中個別歷史與天文論述可能存在應修正之處，本次**沒有將模型推測補成史料事實**，所有新題解析均標示「待考」。應在管理題庫中逐條核對後，再將內容視為已審校題目。

## 不破壞既有功能

- 第六版初／中／高階、四選一與開放問答共用介面保留。
- `history-supabase-reader.js` 的站內閱讀/隱藏史料卡片沿用原版，不受此更新影響。
- 管理員依原有 `quiz_admins` 授權；會員註冊不能自動獲得管理員權限。
