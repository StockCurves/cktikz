# 方案 B、分層計畫與推薦實作方式整理

更新基準：本文已同步到目前 `main` 的 runtime / tab / custom symbol 分層進度，包含 `CustomSymbolDrawerController`、`CustomSymbolSaveController`、`SymbolLibraryMenuController` 等最新切片。

本文整理三個主題：

- 方案 B 的定位與限制
- 專案分層方向與 Git 控管建議
- 推薦的實作方式與優先順序

目標是讓正式版可以持續穩定開發，同時保留一條低成本、可快速部署的 demo 路線。

## 1. 方案 B 是什麼

方案 B 指的是：

- 前端維持靜態網站部署
- 使用者作品改存瀏覽器本地
- LaTeX 預覽代理改成 Vercel Serverless Function
- 不依賴目前本機 `server.js` 的檔案系統 API

適合情境：

- 想先快速上線給人試用
- 想降低部署與維護成本
- 不需要伺服器集中儲存
- 不需要跨裝置同步

不適合情境：

- 需要帳號登入
- 需要多人協作
- 需要跨裝置同步
- 需要伺服器端持久化資料

## 2. 方案 B 的實際結構

建議結構如下：

- 前端：Parcel build 後部署到 Vercel
- 儲存：使用 `IndexedDB`
- 模板：當作靜態資產部署
- 模板清單：用 manifest 管理
- LaTeX proxy：放在 `api/latex.js`

這代表目前這些 API 不應再是前端核心依賴：

- `/api/files`
- `/api/file`
- `/api/save`
- `/api/delete`

只有 `/api/latex` 還適合保留，而且可以改成 serverless。

## 3. 方案 B 的主要限制

方案 B 的優點是部署快、成本低、維護簡單，但限制也要先講清楚：

- 使用者資料存在瀏覽器本機，不是雲端
- 清除瀏覽器資料後，作品可能消失
- 不保證跨瀏覽器、跨裝置可見
- 模板清單不能再依賴伺服器掃描目錄
- 後續若要回到雲端同步，仍需要正式後端

所以比較合理的產品定位是：

- 公開 demo 版
- 體驗版
- 線上展示版

不要把它當成最終完整雲端版。

## 4. Git 控管建議

建議把正式版與 demo 版當成同一個專案的兩種運作模式，而不是兩個完全分離的產品。

推薦分支策略：

- `main`：正式版主線
- `demo/b-local-storage-vercel`：方案 B demo 長期分支
- `feature/*`：正式版短期功能分支
- `demo/*`：demo 專用短期分支

推薦做法：

- 方案 B 的改動不要直接做在 `main`
- 正式版功能持續進 `main`
- demo 專屬改動先進 `demo/b-local-storage-vercel`
- 能共用的重構優先回收進 `main`

建議保留可回退點：

- 在重大分層前建立 tag
- 例如 `stable-v0.8.2-before-layering`

這樣可以明確保留第一版穩定版的可回復狀態。

## 5. 分層方向

第 5 點之後要以 `main` 現況為基準，不再用理想式藍圖描述。現在的重點不是「要不要分層」，而是「哪些切換點已經落地、哪些責任仍卡在 `MainController`」。

### 現況盤點

- UI / controller / service 已經有第一波拆分，但還不是完整分層
- `TemplateController` 已透過 `TemplateApplicationService` 與 `TemplateFileService` 抽出大部分模板流程
- `LiveRenderController` 已透過 `LatexRenderService` 吃 runtime render dependency
- custom symbol 目前已拆出：
  - `CustomSymbolRepository`
  - `CustomSymbolService`
  - `CustomSymbolApplicationService`
  - `CustomSymbolDomService`
  - `CustomSymbolDrawerController`
  - `CustomSymbolSaveController`
  - `SymbolLibraryService`
  - `SymbolLibraryMenuController`
- tab / lifecycle / modal 目前已拆出：
  - `TabSessionService`
  - `TabApplicationService`
  - `TabBroadcastService`
  - `TabLifecycleService`
  - `TabManagementController`
- `MainController` 已不再直接 `new IndexedDbService`、`TemplateFileService`、`LatexRenderService`
- `runtimeConfig` 已集中定義：
  - `storageMode = "server" | "indexeddb"`
  - `templateSource = "server" | "static-manifest"`
  - `latexMode = "server-proxy" | "serverless-proxy"`
- `appRuntime` 已負責建立：
  - template data source / application service
  - latex render service
  - IndexedDB service
  - tab application / broadcast / lifecycle services
  - custom symbol application service
  - symbol library service
- `server.js` 目前仍同時承擔 static serving 與 template/work filesystem API，但 QuickLaTeX proxy 已抽成共用 handler，並可由 `api/latex.js` 直接接入
- `latexMode = "serverless-proxy"` 已有命名與 runtime 切換點，`api/latex.js` provider 已接好

### 目前真正的核心問題

- `MainController` 雖然比之前瘦很多，但仍保有過多 custom symbol orchestration
- `createSubcircuitFromSelection()` 已改走 `CustomSymbolSaveController`，但整條 custom symbol UI flow 還可再持續收斂成更薄的 app shell
- 方案 B 的 latex provider 切換點已完成，`server.js` 與 `api/latex.js` 共用同一份 proxy 行為

### 四層目標

#### UI / Interaction Layer

這一層只處理：

- DOM
- 事件
- modal
- toolbar / editor 切換
- drawer / panel 視圖狀態

目前已落地的代表：

- `TabManagementController`
- `CustomSymbolDrawerController`
- `CustomSymbolSaveController`
- `SymbolLibraryMenuController`

限制：

- controller 不直接決定資料來源
- controller 不直接拼 API path
- controller 不直接操作 IndexedDB record shape

#### Application / Use-case Layer

這一層負責 orchestration：

- tab session
- template open / save / delete
- custom symbol CRUD
- render request
- mode switching

目前已落地的代表：

- `TemplateApplicationService`
- `TabApplicationService`
- `TabBroadcastService`
- `TabLifecycleService`
- `CustomSymbolApplicationService`

目標：

- `MainController` 收斂成 app shell / orchestrator
- 不再承擔 persistence 細節
- 不再承擔大段 modal / menu 決策與 DOM 建立

#### Persistence Layer

這一層只負責 IndexedDB 或 server API 存取。

目前已落地的代表：

- `TabRepository`
- `CustomSymbolRepository`
- `WorkFileRepository`

目標：

- 不碰 UI
- 不碰 DOM
- custom symbol 的 DOM rebuild 邏輯維持在 `CustomSymbolDomService`

#### Integration Layer

這一層是方案 B 真正的切換點。

目前已落地的代表：

- `runtimeConfig`
- `appRuntime`
- `TemplateFileService`
- `IndexedDbTemplateDataSource`
- `StaticTemplateDataSource`
- `LatexRenderService`
- `SymbolLibraryService`
- generated `staticTemplateManifest`
- `server.js`

目標：

- `server` 與 `local/static` 從這一層切換
- `server.js` 與未來 `api/latex.js` 都屬於 integration layer，不屬於 controller

## 6. 推薦實作方式

第 6 點要視為「依現況排序的 rollout 狀態」，不是重新畫藍圖。

### 第一階段：收斂 `MainController` 依賴注入邊界

已完成：

- `runtimeConfig` 已建立
- `appRuntime` 已建立
- `TemplateController` / `LiveRenderController` / `MainController` 已改由 runtime 取依賴
- `getApiBase()` 不再是 controller 內自行判斷 server/local 的主要入口

結論：

- controller 內直接 `new repository/service` 的舊做法已經開始退場

### 第二階段：把 tab / work / template 流程抽成 application service

已完成：

- `TabApplicationService`
- `TabBroadcastService`
- `TabLifecycleService`
- `TabManagementController`
- `WorkFileRepository`
- `IndexedDbTemplateDataSource`
- `StaticTemplateDataSource`

結果：

- tab lifecycle、probe、broadcast、tab modal DOM 已大幅離開 `MainController`
- `workFiles` 已是獨立 store / repository，不再只依賴 `tabs`

### 第三階段：建立 provider 式 runtime mode

已完成：

- `storageMode = "server" | "indexeddb"`
- `templateSource = "server" | "static-manifest"`
- `latexMode = "server-proxy" | "serverless-proxy"`

已落地切換：

- `storageMode = "indexeddb"`
- `templateSource = "static-manifest"`

尚未完成：

- `latexMode = "serverless-proxy"` 的實際 provider / adapter

### 第四階段：接上 custom symbol / 方案 B 專用實作

custom symbol 這條線目前已完成大半：

- `CustomSymbolApplicationService` 已建立
- `SymbolLibraryService` 已建立
- `CustomSymbolDrawerController` 已建立
- `CustomSymbolWorkspaceController` 已建立，作為 custom symbol state + drawer actions 的 façade
- `CustomSymbolStateController` 已建立，負責 custom symbol state 與 drawer render 的中介
- `CustomSymbolSaveController` 已建立
- `CustomSymbolCatalogController` 已建立，接手 custom category / subcircuit mutation 與 reload orchestration
- `CustomSymbolGraphicsController` 已建立，接手 graphics symbol load / duplicate / rename / delete orchestration
- `SymbolLibraryBootstrapController` 已建立，接手 symbol DB loading 與 custom symbol hydration 的 startup bridge
- `SymbolLibraryMenuController` 已建立，且已接上 `openAndExecute()` 這種一站式 symbol menu 協調入口
- `customSymbolDrawerActionsFactory` 已把 drawer 的 placement / runtime callback 組裝從 `MainController` 抽出去
- `CustomSymbolSubcircuitSaveController` 已建立，接手 selection/group/save/restore/persist 這條 subcircuit save orchestration
- `MainController.renameCustomGraphicsSymbol()` / `duplicateSymbol()` / `deleteCustomGraphicsSymbol()` 已改走 application service
- base symbol DB 的 fetch / parse / append / runtime extract 已從 `MainController.initSymbolDB()` 移出

但這一階段還沒完全結束，因為：

- `MainController` 仍保有少量 custom symbol UI glue，但 selection/save orchestration、category mutation、graphics symbol mutation 已經再往專用 controller 收斂
- `serverless latex adapter` 已完成切換點，但 demo mode 的啟動/部署設定還需持續對齊
- `api/latex.js` 已成為可切換 provider

### 目前最合理的下一步

接下來建議順序：

1. 確認 demo mode 的實際部署設定會把 latex provider 指向 `api/latex.js`
2. 視需要再把 `MainController` 剩下的 custom symbol UI glue 繼續收斂
3. 讓 demo mode 真正移除對 `/api/files`、`/api/file`、`/api/save`、`/api/delete` 的依賴

## 7. 後續開發限制

後續 PR 應遵守：

- 不新增直接依賴 `localhost:3001` 的程式碼
- 不在 controller 內直接操作 `fetch("/api/...")`
- 不在 controller 內直接建立 IndexedDB transaction
- 不把 work file 存回 `tabs`
- 不把 template 清單建立邏輯綁死在 server filesystem
- 不把 custom symbol DOM 修補邏輯混進 repository
- 不新增只能在 `server.js` 存在時才成立的功能假設
- 不把已抽出的 runtime/provider 邊界再塞回 `MainController`

## 8. 測試策略

目前應維持以 targeted vitest 為主 gate，build 為輔助驗證。

### 主要回歸測試

- custom symbol load / rename / delete / category update
- tab persistence 與 tab lifecycle
- template open / save / delete application flow
- latex request shape 與 render client wiring
- custom symbol drawer / save modal / symbol library menu controller
- component library controller / filter wiring / toolbar binding

### 目前已補上的 targeted tests

- `apiServices.test.ts`
- `tabSessionService.test.ts`
- `tabApplicationService.test.ts`
- `tabBroadcastService.test.ts`
- `tabLifecycleService.test.ts`
- `tabManagementController.test.ts`
- `customSymbolServices.test.ts`
- `customSymbolApplicationService.test.ts`
- `customSymbolDrawerController.test.ts`
- `customSymbolSaveController.test.ts`
- `symbolLibraryMenuController.test.ts`
- `customSymbolSelectionController.test.ts`
- `componentLibraryController.test.ts`
- `mainController.renameCustomGraphicsSymbol.test.ts`
- `symbolLibraryService.test.ts`
- `indexedDbTemplateDataSource.test.ts`
- `staticTemplateDataSource.test.ts`
- `modalDialogService.test.ts`

### 驗證原則

- 以 targeted vitest 為主要 gate
- build 與完整 app 啟動可列為輔助驗證，但不是唯一 gate
- 如果 Parcel 在 Windows temp path 出現 `ENOENT unlink` 類型噪音，可改用隔離 cache / dist build 驗證
- 如果 graphify 結果與實際程式碼衝突，以當前 repo 程式碼為準

### 最近一次實際 gate

- targeted vitest：`9` 個 test files，`24` 個 tests，全數通過
- build：隔離的 Parcel build 成功
- `generate-template-manifest` 成功

## 9. 建議結論

現在不是先做 demo branch 特化，而是先把 `main` 的切換點抽乾淨。

目前已經完成的重點：

- runtime / provider 骨架已存在
- tab / session / work / template 已大幅離開 `MainController`
- custom symbol 已拆成 application service、drawer controller、save modal controller、menu controller
- component library 的群組渲染與 filter wiring 已從 `MainController` 抽出

接下來真正的成功條件不是「再重寫 UI」，而是：

- `MainController` 繼續從 persistence / runtime 判斷 / custom symbol orchestration 中鬆開
- demo mode 最後能靠 `indexeddb + static manifest + serverless latex` 正常運作
- 方案 B 最終已在架構上接近「切換 provider」，不是「維護第二套前端」


