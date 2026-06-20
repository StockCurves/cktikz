# 範本 (Template) 與工作區系統實作指南

## 簡介
本文件記錄了 Circuit3Tikz 專案中關於「電路範本 (Templates)」與「使用者工作區 (Works)」的檔案系統架構設計與實作細節。

## 後端架構設計 (`server.js`)

### 1. 目錄結構與自動初始化
後端採用兩個不同的資料夾來區分唯讀範本與可編輯檔案：
- **`template/`**：存放系統預設的教學範本與常用電路圖，屬性為**唯讀 (Read-Only)**。
- **`work/`**：存放使用者自行建立、修改並存檔的電路圖，屬性為**可讀寫 (Editable)**。

在伺服器啟動時，若發現 `template/` 目錄內為空（沒有任何 `.tex` 檔案），系統會自動寫入以下預設的範本檔案以供初次使用：
- `rc-lowpass.tex` (RC 低通濾波器)
- `bridge-rectifier.tex` (橋式整流器)
- `opamp-amp.tex` (運算放大器)
- `sallen-key.tex` (Sallen-Key 濾波器)
- `user-complex.tex` (複雜的降壓轉換器範例)
- `empty.tex` (僅包含一顆電阻的空白起始檔案)

### 2. API 路由實作
伺服器端實作了三支專用的 API 路由來處理檔案層級的操作：

#### `GET /api/files`
- **功能**：同步掃描 `template` 與 `work` 目錄下的所有 `.tex` 檔案。
- **回傳**：一個 JSON 包含 `templates` 與 `works` 字串陣列，供前端選單渲染使用。

#### `GET /api/file?dir={dir}&name={name}`
- **功能**：讀取指定目錄 (`template` 或 `work`) 中的特定檔案內容。
- **安全防護**：透過 `path.basename(name)` 確保檔名不含目錄跳轉字元，並使用 `!filePath.startsWith(targetDir)` 防禦 Path Traversal 目錄遍歷攻擊，避免駭客讀取到專案以外的系統檔案。

#### `POST /api/save`
- **功能**：將使用者編輯的程式碼儲存成 `.tex` 檔案。
- **唯讀防護機制**：若發現前端要求儲存的目標路徑屬於 `template` (`dir === 'template'`) 且該檔案已經存在，伺服器會直接攔截並回傳 `400 Bad Request`，並附帶錯誤訊息：`Template files are read-only and cannot be modified.`。這強制使用者只能將修改的結果「另存」到 `work` 目錄中。

---

## 前端實作設計 (`app.js`)

### 1. 檔案列表載入與 UI 渲染
前端的 `fetchFiles()` 函數會呼叫 `/api/files`，並將取得的資料分類顯示於畫面上方的下拉式選單 (`templateSelect`) 中：
- 使用 `<optgroup label="Templates (Read-Only)">` HTML 標籤來視覺化包裝 `templates` 列表。
- 使用 `<optgroup label="Work (Editable)">` 來包裝 `works` 列表。
為了解析上的方便，`works` 內的 `<option>` 數值 (`value`) 會被加上 `work:` 前綴 (例如 `work:my_circuit`)，而範本則直接使用檔名。

### 2. 檔案讀取與編輯器同步機制
當使用者切換下拉選單時，前端會解析選項前綴來決定要向伺服器請求哪一個目錄的檔案：
- 透過 `loadRemoteFile(dir, name)` 呼叫 `/api/file` 非同步載入 `.tex` 原始碼。
- 載入成功後，系統會執行以下同步動作：
  1. 將原始碼寫入左側的 Code Editor。
  2. 呼叫 `parseCircuiTikZ()` 解析電路元件結構，並將所有節點與電晶體的座標設定為預設原始座標 (`origX`, `origY`)。
  3. 呼叫 `drawSVGCanvas()` 更新中央的視覺化編輯器。
  4. 重置視角與縮放比例 (`fitView(true)`)。
  5. 觸發 `triggerDebouncedRender()` 進行 QuickLaTeX 的即時 LaTeX 預覽渲染。

### 3. 起始預設畫面
為了提供良好的開箱體驗，當網頁完全載入後 (`window.onload`)，系統會自動請求載入 `rc-lowpass.tex` 作為起始的教學範例 (前提是不在 Symbol Editor 模式下)。

## 總結
這套範本與工作區架構透過物理上隔離的目錄設計以及後端 API 的權限卡控，確保了系統預設教學範本的完整性與不可修改性，同時也提供了乾淨、直覺的工作區讓使用者能安心儲存與修改自己的專案設計。
