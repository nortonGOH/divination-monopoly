# Cloudflare Turnstile / Supabase CAPTCHA 整合補丁（測試版）

這個版本針對「數術知識大挑戰」三個登入流程：會員註冊/登入、題庫管理員登入、文獻庫登入。

## 重要安全原則
- 不要上傳 Cloudflare Secret Key。Secret Key 只在 Supabase Auth > CAPTCHA 設定中保存。
- 只需在現有 `config.js` 的 `window.QUIZ_AUTH_CONFIG` 物件中增加：`turnstileSiteKey: '您的公開 Site Key'`（記得在前一行值的結尾補逗號）。
- 本包故意不含 `config.js`，以免覆蓋您現有 Supabase 專案 URL / Publishable Key。
- 登入驗證 token 由 Cloudflare 產生、從每個表單讀取後傳給 Supabase Auth；使用後即清除並重新驗證。

## 部署順序
1. 在 Cloudflare Turnstile 確認允許 `nortongoh.github.io` 網域。
2. 在您的 GitHub `config.js` 加入公開 Site Key：

```javascript
window.QUIZ_AUTH_CONFIG = {
  supabaseUrl: '您的 Supabase Project URL',
  publishableKey: '您的 Supabase Publishable Key',
  turnstileSiteKey: '您的 Cloudflare 公開 Site Key'
};
```

3. 建議在 GitHub 建新分支備份，再更新本包中 `index.html`、`quiz-challenge-v7.js`、`history-supabase-reader.js`，並新增 `captcha-integration.js`。
4. 請勿覆蓋原有 `quiz-open-qa.js`、`questions.json`、`calendar-questions-80.json`、`setup.sql`、`history` 資料庫等檔案。
5. 先在可測試的 GitHub Pages 分支或 staging 網站驗證三種登入；完成後再發佈正式站。

## 注意現有網站版本
本包的 `index.html` 與 `quiz-challenge-v7.js` 是以先前產生的 v7 程式為底本；若 GitHub 上有後續修改，請比對差異後再替換，避免覆蓋新的功能。`history-supabase-reader.js` 對應已核對的目前 GitHub 版本。

## 測試
- 會員註冊：Turnstile 完成才能送出確認信（SMTP 仍須正常配置）。
- 會員登入：通過 Turnstile，登入成功，原有答錯 5 次/鎖定 4 小時不變。
- 題庫管理員登入：受 `quiz_admins` 權限保護，CAPTCHA 通過後仍需管理員授權。
- 文獻庫登入：同樣必須先通過 CAPTCHA，再檢查管理員權限。
- 錯誤與重試：任何登入/註冊請求之後，Turnstile 驗證均被重設。

## 未驗證事項
此為本地整合補丁。未有您的真實 Cloudflare Site Key，故無法在您的正式 Supabase / Cloudflare 帳號做端對端登入驗證。
