# Live LaTeX Render 實作指南與問題解決紀錄

## 簡介
這份文件詳細記錄了專案中「即時 LaTeX 渲染 (Live LaTeX Render)」功能的架構與實作細節，以及在開發過程中遇到的關鍵問題與解決方案。

## 系統架構
即時渲染採用雙層策略 (Dual-strategy)：
1. **Primary Renderer (主要渲染器)**: QuickLaTeX API。透過後端代理伺服器 (Proxy Server) 傳送資料，支援完整的 CircuiTikZ 語法與複雜度。
2. **Fallback Renderer (備用渲染器)**: TikZJax (WASM)。當 QuickLaTeX 伺服器無法使用或網路連線失敗時，降級使用瀏覽器端在 iframe 中運行的 TikZJax 進行本地渲染 (但對極為複雜的電路支援度有限)。

## 實作流程

### 1. LaTeX 程式碼前處理 (Pre-processing)
在傳送給渲染引擎前，必須使用 `prepareLatexSource` 函數進行清理，以確保渲染引擎不會報錯：
- 自動 Unwrap 整個文件 (例如移除 `\begin{document}` 等標籤)。
- 移除 `\documentclass` 與 `\usepackage`。
- 移除註解 (`%`) 包含裡面的中文字元與 Unicode 字元。
- 移除字體修改標籤 (例如 `font=\large`)，避免 TikZJax 發生缺少 `.tfm` 字體檔案的錯誤。

### 2. 透過 QuickLaTeX 進行遠端渲染
呼叫 `renderViaQuickLaTeX`，將清理後的 LaTeX 程式碼透過本地端 Node.js Server (`server.js`) 的 `/api/latex` 代理轉發到 `quicklatex.com`。接收到字串後再動態生成 SVG 或 PNG 圖片顯示於畫面上。

### 3. TikZJax 本地備用方案
若 QuickLaTeX 回應錯誤，系統會觸發 Catch 區塊並呼叫 `renderViaTikZJax`，載入一個帶有 TikZJax 的 iframe 進行純前端的 WebAssembly (WASM) 渲染。同時設定了超時機制 (18 秒)，以處理過於複雜的電路導致瀏覽器長時間卡死的問題。

---

## 解決的核心問題 (Issues Solved)

### 1. 跨來源資源共用 (CORS) 阻擋問題
**問題描述**：前端直接發送 POST 請求至 `quicklatex.com` 會被瀏覽器的同源政策與 CORS 安全機制阻擋。
**解決方案**：在 Node.js 後端 (`server.js`) 建立了一個 Proxy API (`POST /api/latex`)。前端只與本機伺服器溝通，由後端發送 HTTP 請求到 QuickLaTeX 伺服器，再將獲得的資料回傳給前端，完美避開了瀏覽器的 CORS 限制。

### 2. 空白字元編碼 (URLSearchParams Encoding) 錯誤導致解析失敗
**問題描述**：一開始使用原生的 `URLSearchParams` 來建構 POST Body 時，空白字元會被預設編碼為 `+`。然而，QuickLaTeX 的伺服器無法正確解碼 `+`，導致回傳了 TikZ 座標解析錯誤 (例如將空白解讀成了 `\draw+(0,0)+to`)。
**解決方案**：放棄自動化的 `URLSearchParams`，改為手動使用 `encodeURIComponent()` 拼接所有的參數字串，確保空白字元一律被嚴格編碼為 `%20`，順利解決了 QuickLaTeX 伺服器端解析失敗的問題。

### 3. 非同步渲染導致的 Race Condition 與 UI 錯誤重疊
**問題描述**：由於使用者在編輯器中打字會觸發 Debounce 渲染，快速修改程式碼時可能同時有多個渲染 Request 在進行中。先發出的請求可能比後發出的晚完成，導致舊的渲染畫面覆蓋了新的畫面，或是產生了多個重複的錯誤提示畫面 (Error Overlay)。
**解決方案**：引入了全域渲染世代計數器 (`_renderGeneration`)。每次啟動新的渲染時，就將此計數器加一。當 API 請求或 Promise 解析完成準備更新 DOM 之前，先比對當前的計數器與啟動時是否一致。若有新的渲染已經啟動，就直接丟棄 (Abort) 該次的非同步結果，確保畫面上永遠只顯示最新一次的渲染。

### 4. WASM TeX 引擎的中文字元與字體缺失當機
**問題描述**：當降級使用 TikZJax 進行本地端渲染時，遇到非 ASCII 字元 (例如中文的標籤或註解) 或特定的字體修改參數時，WASM 引擎會拋出缺少字體檔 (`.tfm`) 的錯誤並直接失敗。
**解決方案**：在送到渲染管道前的 `prepareLatexSource` 函數中，實作了嚴格的正則表達式過濾器 (Regex Filter)，自動剃除所有註解、非 ASCII 字元以及 `font=` 修改器。

## 總結
我們透過結合強大的遠端 API (QuickLaTeX) 與本地端 WebAssembly 備用方案 (TikZJax)，加上 Proxy 伺服器繞過 CORS 限制、手動字串編碼、以及計數器機制防止 Race Condition，成功打造了一個穩定、流暢且支援完整 CircuiTikZ 複雜度語法的即時渲染 (Live Render) 環境。
