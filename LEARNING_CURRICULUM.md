# 數術知識學習地圖：會員制與獨立教材

## 存取等級

- **遊客**：僅可閱讀「數術文獻與歷史分類」「陰陽、五行與關聯思維」「干支、曆譜與歲時」，共 3 個入門單元。
- **已登入的正式會員**：可閱讀上述入門課程及其餘 8 個數術專題、28 個二十八宿單元，共 39 個單元。
- 其他 36 單元在未登入時僅公開「單元 ID、分組與標題」，正文不得放在靜態 JavaScript、HTML、JSON 或資產檔中。
- 會員制只影響此學習地圖；原本的公開二十八宿圖鑑與數術問答/試玩政策分開，不在此項變更中修改。

## 資料來源與安全

1. `learning-curriculum.js`：靜態公開的 3 個入門單元全文、全部 39 個單元的索引，以及可追溯來源字典。僅公開編輯性導讀，不含正式題庫答案。
2. `public.learning_curriculum_lessons`（Supabase PostgreSQL）：受 RLS 保護的獨立教材全文，與正式問答題庫 `quiz_questions` 完全分離。
3. `learning-map.js`：前端僅以既有 `window.quizMemberToken()` 取得會員登入憑證，再向 `/rest/v1/learning_curriculum_lessons` 請求會員課程。**前端是否隱藏卡片並非安全防線，最終以 RLS 判斷存取。**
4. 資料庫在 2026-10-30 已執行遷移 `create_rls_member_learning_curriculum`，設有 `learning_intro_public` 與 `learning_members_can_read` 兩項 SELECT 政策。匿名角色只讀入門；已驗證且非 anonymous Auth 使用者方可讀完整教材。所有角色均不授予新增、修改、刪除權限。
5. 登出或會員工作階段改變後，立即清除瀏覽器記憶體內的會員教材；舊請求回來時不能重新顯示。若 RLS 或網路驗證失敗，一律不開放會員正文。

## 本機閱讀進度

閱讀標記沿用鍵 `numerology-standalone-learning-reading-v1`，只記錄教材 ID，並非 Supabase 會員履歷或正式答題紀錄。未登入時只計算 3 篇公開入門教材的閱讀狀態，不顯示先前儲存的會員進階閱讀完成數。切換裝置或清除瀏覽器資料可能遺失記錄。

## 編輯教材

每個單元有穩定的 `id`、`group`、`title`、`lead`、`points`、`method`、`question`、`caution`、`sources`，以及選用的 `atlas_name`。

修改會員單元正文需更新受保護的資料庫，而不是直接把教材填回公開的 `learning-curriculum.js`。若新增單元，先設定 RLS 權限等級並同步維護公開索引，完整單元數量亦須更新驗證規則與測試。

史料摘要為編輯性研究提要，非經典逐字引文。修改學術內容時需先核實原始文獻與版本，不得虛構出處、頁碼、卷次或缺字。

## 安全與測試

- `node --check learning-curriculum.js`；`node --check learning-map.js`。
- `node --test tests/learning-map.test.cjs`：公開內容不得洩漏會員課文、會員 Bearer 驗證、登出清除、錯誤時拒絕存取及非同步競態測試。
- `tests/ux/learning-curriculum.spec.cjs`：瀏覽器互動、入門閱讀標記、會員解鎖、拒絕存取及登出測試。
- 資料庫角色測試已確認 `anon` 只可查到 3 筆，沒有登入識別的 `authenticated` 亦只能查到 3 筆；會員權限另由 RLS 保護。

## 歷史公開內容限制

上一版曾將所有 39 個單元的編輯性導讀放在公開 GitHub JavaScript 檔案。這些過去已發布的內容仍可能從 Git 歷史、快取或網頁封存取得。新版本可以限制日後新增或更新的會員教材，**無法追溯撤銷既往公開的文字**。若有未公開的增修教材，請只儲存在受控的 Supabase 表中，不再提交至 GitHub 公開分支。
