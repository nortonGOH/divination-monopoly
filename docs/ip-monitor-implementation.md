# IP 監控、手動鎖定與異常流量警示：部署與驗收規格

## 功能範圍
- 網站首頁與二十八宿圖鑑：記錄頁面開啟與按鈕／連結點擊事件，僅使用允許的控制項代碼；不記錄表單內容、連結 URL、電子郵件、答題選項或密碼。
- Supabase Edge Function 從受信任的邊緣來源識別 IP，前端不傳送來源 IP。部署前須驗證平台會覆寫 `cf-connecting-ip`；若未能驗證，維持 fail-closed，不採用使用者可偽造的 X-Forwarded-For。
- 後台「IP 流量監控」列出 24 小時來源 IP、最近 100 筆事件、鎖定清單，並每分鐘檢查警示（僅管理員登入期間）。
- 同一 IP 五分鐘內活動 >=80 或點擊 >=40 顯示異常警示；**不自動封鎖**。管理員確認後可鎖定 60、1440、10080 分鐘，亦可提前解鎖。後端保存稽核紀錄，過期自動失效。
- 伺服器端封鎖只涵蓋 `quiz-guest-trial` 試玩狀態／答題與新的 `quiz-ip-monitor` 事件請求。**GitHub Pages 公開頁面、既有其他 RPC、會員登入及救援卡不會由此封鎖**；如需全站 HTTP 封鎖，須另外部署 CDN/WAF 代理。
- IP 地址不代表個人，NAT、學校網路、行動網路與 VPN 可能共用或變更來源。僅提供人工判斷和解除封鎖機制。

## 資料安全
- `quiz_ip_monitor_events`、`quiz_ip_monitor_blocks`、`quiz_ip_monitor_audit` 皆啟用 RLS 並禁止 anon/authenticated 直接讀取。
- 管理員報表與鎖定 RPC 必須同時驗證 Supabase Auth 身分、非匿名 JWT 與 `quiz_admins` 資格。
- Edge Function 使用服務端環境變數，不得將 `service_role` 金鑰放到 GitHub Pages。
- 每 IP 每分鐘記錄最多 150 筆活動，限制資料庫負載；超限暫拒該 IP 監測／試玩請求。
- 事件資料目標保存 30 天；目前由下一次流量寫入觸發每日最多一次的過期清除。若需要空站期間亦準時刪除，正式部署須另設定可信任的定期清理工作。
- 正式啟用前需在網站增加個資告知（蒐集目的、資料項目、存續期間、申訴與聯絡方式），並進行隱私法規審查。

## 程式部署順序（**不可跳步**）
1. 在獨立 PostgreSQL 測試環境執行四個 SQL：`ip-monitor-schema.sql`、`ip-monitor-admin.sql`、`ip-monitor-report.sql`、`ip-monitor-intake.sql`；跑 `tests/ip-monitor/integration.sql`。
2. 確認資料庫 RLS、測試非管理員不得存取原始 IP、人工鎖定與解鎖、到期行為、80/40 門檻；執行 Supabase Security Advisor。
3. 在隔離 Supabase 專案部署 `quiz-ip-monitor`（verify_jwt=false；API 在函式內驗證來源、輸入和邊緣 IP）與變更後的 `quiz-guest-trial`（verify_jwt=false），以 Mock 與真實 HTTP 測試 200/403/429。
4. 驗證現有 5 次試玩計數、每日流量彙總及會員系統未回歸；對不同 IP、共享 IP、無法辨識 IP、頻繁請求作邊界測試。
5. 測試成功後才依序安裝正式 SQL → Edge Functions → 合併／部署前端。**未驗證切勿先部署新版試玩 Edge Function，否則因缺少新 RPC 會導致所有試玩故障。**

## 測試範圍限制
GitHub Actions 的 PostgreSQL 17 使用自建的 auth 介面模擬 Supabase 身分規則。通過代表資料庫邏輯在隔離環境可運作，**不等於已確認正式 Supabase Edge 網關、真實來源 IP 標頭與正式使用者路徑**。
