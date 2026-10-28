# 數術知識大挑戰：山類題庫與「文昌星救援」

## 本包內容

- `mountain-初階-60.json`、`mountain-中階-60.json`、`mountain-高階-60.json`：各 60 題（完整題幹／四選一／答案／解析／來源書目）。
- `mountain-180.json`：三份合併備份。
- `01_import_mountain_180.sql`：以原題文字去重，避免與既有「山」初階題庫重複。保留既有題號及會員成績，不會清空題庫。
- `02_wenchang_rescue.sql`：每 2 小時補 3 次、最高 10 次；每帳號初始 3 次；僅限答錯題目可解鎖；相同題只扣一次；伺服器保護並避免同時重複扣款。`nortonwu@gmail.com` 必須同時擁有 `quiz_admins` 權限才享直接揭示例外。
- `03_answer_access_hardening.sql`：取消直接讀取 Supabase 題目答案，改由公共題目 RPC 與管理員 RPC 讀取。請搭配**新版前端**使用。
- `challenge-v20-wenchang.js`：答錯後彈出「文昌星救援」；管理員例外不觸發救援。
- `04_apply_frontend_patch.py`：在最新網站原始碼複本上套用必要的前端修改。*不可*直接以本包的任何舊版網站覆蓋線上網站。
- `05_classify_fengshui_physionomy.sql`：僅重新分類資料庫中明確標成「風水／相術」等類別的既有題目；不會假裝匯入尚未取得內容的 Google 文件。

## 安裝順序（重要）

1. 在 Supabase SQL Editor **先執行 `01_import_mountain_180.sql`**。查看 `newly_imported`；若先前已匯入 60 題初階，可能少於 180 題，屬正常。
2. 執行 `02_wenchang_rescue.sql`。確認兩個新的 RPC 已存在。
3. 在一份**最新 GitHub main 原始碼複本**執行 `python 04_apply_frontend_patch.py /path/to/divination-monopoly`，檢視差異，將修改後的 `index.html`、`quiz-challenge-v7.js` 及新增的 `challenge-v20-wenchang.js` 上傳 GitHub。
4. **執行 `03_answer_access_hardening.sql`**，禁止會員直接查詢完整答案。此步若先於第 3 步執行，舊網站可能無法讀取題庫。
5. 強制重整網站，檢查普通會員答錯後不顯示答案、救援扣次、下次補充、正確作答後排除題目，以及管理員例外。

**風水／相術 Google 文件尚未取得內容，因此本包不包含該文件題目，也未匯入「相」類。** 請下載 Google 文件為 DOCX 並上傳，或授予可由連接器讀取的權限。

## 安全與相容性提醒

- 既有 **公開 GitHub JSON 備份與提交歷史**若包含正確答案，知道 GitHub 網址的人仍可能取得它們。後端計次只能限制正常網站操作；要真正保護題庫，應把完整答案從公開儲存庫遷移到私人位置，並檢查舊提交歷史。
- 這份安裝包只在本地對 DOCX 結構、JSON 筆數、JavaScript 語法進行了檢查；**沒有**在 Supabase／GitHub 正式環境執行升級，安裝前宜先備份資料庫並在測試環境驗證。
- 提交的錯誤答案仍按原規則增加參戰及答錯次數，五次錯誤仍鎖定四小時；救援不抹除當次答錯紀錄。
- 題庫的史學／醫學主張皆依使用者原始 DOCX 擷取，未逐一獨立查證；來源書目不是逐題校核的註腳。
