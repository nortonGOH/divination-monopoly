# 管理員重置文昌星救援（待部署補丁）

## 功能

- 管理員登入「管理題庫」後，進入「會員帳號管理」。
- 顯示「重置會員文昌星救援」按鈕。
- 讀取現有安全 Edge Function 的會員清單，以暱稱與 Email 選擇目標帳號。
- 兩階段確認後，以管理員的會員 JWT 呼叫 `quiz_admin_reset_wenchang(p_user_id uuid)`。
- 將指定帳號救援額度設定為 3 次，補充時間由此刻重新起算，每 2 小時補 3 次，最多 10 次。
- **不改變** `quiz_wenchang_unlocked`、答題次數、成功率、錯誤次數、4 小時鎖定及任何會員密碼。

## 安裝

1. 在 Supabase SQL Editor（專案 `pqwuskgkkpsqkycmnxsp`）執行 `quiz_admin_reset_wenchang.sql`。執行時需要具備建立函式的資料庫擁有者權限。
2. 將 `challenge-v20-wenchang-admin-reset.js` 上傳到 GitHub `nortonGOH/divination-monopoly` 的根目錄。
3. 在 `index.html` 中既有的 `<script src="./challenge-v15-admin-users.js"></script>` **之後**加入：

   ```html
   <script src="./challenge-v20-wenchang-admin-reset.js"></script>
   ```

4. 網站重新部署後，以具備 `quiz_admins` 權限的管理員帳號登入，進入「管理題庫」>「會員帳號管理」並按「重置會員文昌星救援」。
5. 選一個測試會員（避免選用正式會員做測試），確認重置後剩餘次數為 3；資料庫可以用唯讀查詢確認 `credits=3`，`last_refill_at` 接近重置當下。

## 安全

- 重置是伺服器端管理員 RPC；前端按鈕本身不代表授權。
- `anon` 與 `PUBLIC` 不可執行此 RPC；`authenticated` 可以呼叫，但必須通過函式內的 `public.quiz_admins` 管理員判定。
- 不將 `service_role`／secret key 或會員密碼放入 GitHub。
- 未清除已解鎖的題目；先前解鎖同一題仍沿用既有規則，不會重複扣除額度。

**注意**：此補丁為已產生並通過 JS 語法檢查的本地部署包；GitHub/Supabase 連線未成功時，不代表已上線。請勿整份覆寫目前的 `index.html`，只新增上述一行。
