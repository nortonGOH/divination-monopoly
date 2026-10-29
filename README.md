# 數術知識大挑戰 — 題庫分類管理與文昌星提示更新（v22）

## 功能

1. 「題庫類型與難度統計」表格：點擊每個數術類型名稱，可篩選該類型全部難度題目；原本點擊各數字可篩選類型與難度。
2. 「修改題目」表單：明確標示「數術類型（可人工重新歸類）」選單；儲存成功後重新載入管理員題庫、刷新題目清單與統計矩陣。資料更新依賴網站既有 Supabase 管理員儲存流程。
3. 會員登入視窗：將文昌星救援規則獨立成淡黃色底色區塊，保留原本文字與救援邏輯。

## 安裝

此補丁尚未自動部署至 GitHub。請將 `challenge-v22-bank-taxonomy-and-highlight.js` 放到 `nortonGOH/divination-monopoly` 專案根目錄，在 `index.html` 中找到：

```html
<script src="./challenge-v19-bank-stats.js"></script>
```

下一行加入：

```html
<script src="./challenge-v22-bank-taxonomy-and-highlight.js"></script>
```

或將兩個檔案和安裝程式放到 GitHub 專案根目錄，執行：

```bash
python apply_to_repo.py
```

安裝程式會備份 `index.html.pre_v22.bak`，重複執行不會新增重複 script 標籤。部署時請不要把 `index.html.pre_v22.bak` 上傳到公開網站。

最後提交 `index.html` 和 `challenge-v22-bank-taxonomy-and-highlight.js` 到 GitHub 主分支。無須執行 SQL；原有 `knowledge_type` 欄位、管理員寫入權限和分類驗證繼續使用。

## 驗證

* 管理員登入 → 數術題庫管理 → 點「命」名稱 → 題目清單只顯示命類型。
* 點一題「修改題目」→ 更改數術類型為「易學」→「儲存修改」→ 該題轉到易學清單，命、易學題數各減一、加一。
* 登入視窗中的「✦ 文昌星救援」說明應有淡黃色底色。

注意：不以修改題目來源類別 `category` 取代人工分類欄位 `knowledge_type`；其他原始題幹、答案及難度不變。
