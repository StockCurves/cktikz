# Circuit3Tikz 雲端部署與分享方案筆記

本文件記錄了未來將本專案上傳至 GitHub 並部署至雲端平台（如 Vercel、Render、Railway）時的評估方案與實作調整方向。

## 平台方案評估

### 方案 A：使用 PaaS 平台掛載持久性硬碟 (推薦方案)
此方案最符合目前的專案架構，不需要大幅度改寫檔案讀寫的 API。

*   **推薦平台**：[Render.com](https://render.com/) 或 [Railway.app](https://railway.app/)。
*   **運作機制**：
    *   部署為一個標準的 Node.js Web 服務（直接執行 `node server.js`）。
    *   在平台後台為專案掛載一個 **Persistent Volume (持久性硬碟)**，將其掛載路徑設定為 `./work`（或同時包括 `./template`）。
*   **優點**：
    *   **程式碼零修改**：後端的 `fs.writeFileSync` 與 `fs.readFileSync` 可以直接正常運作。
    *   檔案在伺服器重啟或重構部署時不會丟失。

---

### 方案 B：純前端本地儲存 + Vercel Serverless (適合輕量分享)
此方案適合希望完全免費、快速部署於 Vercel 的場景，但會改變資料儲存的位置。

*   **推薦平台**：[Vercel](https://vercel.com/)。
*   **運作機制**：
    *   **檔案儲存**：取消後端的 `save` 與 `files` API，改在前端 `app.js` 使用瀏覽器的 **`localStorage`** 或 **`IndexedDB`** 來儲存使用者的 `work` 電路資料。
    *   **範本載入**：將 `template` 目錄下的 `.tex` 檔案直接作為靜態檔案部署，前端透過靜態 HTTP `fetch` 讀取範本清單與內容。
    *   **LaTeX 代理**：將 `server.js` 裡的 QuickLaTeX CORS 代理寫成一個 Vercel Serverless Function（放置於 `api/latex.js`）。
*   **優點**：
    *   部署在 Vercel 速度極快且完全免費。
    *   不需要管理伺服器端的儲存空間。
*   **缺點**：
    *   使用者的電路只存在於他們當下的瀏覽器中，換瀏覽器或清除快取後資料會遺失。

---

### 方案 C：Vercel Serverless + 雲端資料庫 (適合正式產品)
此方案適合需要跨裝置存取、高穩定度，且依然使用 Vercel 部署的正式產品。

*   **推薦平台**：Vercel + [Supabase](https://supabase.com/) / [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)。
*   **運作機制**：
    *   改寫後端的 API 為 Vercel Serverless Functions（放置於 `api/files.js`、`api/save.js` 等）。
    *   將儲存與讀取邏輯改為呼叫 Supabase Database (或 PostgreSQL) 或 Vercel KV/Blob 儲存 API，將 `.tex` 內容存在雲端資料庫。
*   **優點**：
    *   完美的跨裝置雲端儲存體驗。
    *   具備高擴充性。
*   **缺點**：
    *   需要額外整合與設定雲端資料庫，架構較為複雜。
