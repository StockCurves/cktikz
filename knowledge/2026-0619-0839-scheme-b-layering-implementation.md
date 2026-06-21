# 方案 B、分層計畫與推薦實作方式整理

更新基準：本文已同步到目前 `main` 的 runtime / tab / custom symbol 分層進度，並納入目前工作樹中已接上入口的 `runtimeBootstrap` / demo runtime preset 狀態。

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

第 5 點之後要以目前工作狀況為基準，不再用理想式藍圖描述。現在的重點不是「要不要分層」，而是「哪些切換點已經落地、哪些責任仍卡在 `MainController`，以及 demo mode 現在已經做到哪一步、下一步要驗證什麼」。

### 現況盤點

- runtime / provider 骨架已經落地，`runtimeConfig` 已集中定義：
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
- `controllerRuntime` 已成為 `TemplateController` / `LiveRenderController` 的 runtime glue entry。
- `TemplateController` 已透過 `TemplateApplicationService` 與 `TemplateFileService` 抽出大部分模板流程。
- `LiveRenderController` 已透過 `LatexRenderService` 接 runtime render dependency。
- `server.js` 目前仍同時承擔 static serving 與 template/work filesystem API，但 QuickLaTeX proxy 已抽成 `server/latexProxy.js` 共用 handler。
- `api/latex.js` 已直接接入同一份 QuickLaTeX proxy，所以 `serverless-proxy` 的 provider 入口已存在。
- tab / lifecycle / modal 已拆出：
  - `TabSessionService`
  - `TabApplicationService`
  - `TabBroadcastService`
  - `TabLifecycleService`
  - `TabManagementController`
- custom symbol / component library 已拆出：
  - `CustomSymbolRepository`
  - `CustomSymbolService`
  - `CustomSymbolApplicationService`
  - `CustomSymbolDomService`
  - `CustomSymbolDrawerController`
  - `CustomSymbolWorkspaceController`
  - `CustomSymbolStateController`
  - `CustomSymbolSaveController`
  - `CustomSymbolSubcircuitSaveController`
  - `CustomSymbolCatalogController`
  - `CustomSymbolGraphicsController`
  - `CustomSymbolExportService`
  - `SymbolLibraryService`
  - `SymbolLibraryBootstrapController`
  - `SymbolLibraryMenuController`
  - `AddComponentOffcanvasController`
- `MainController` 已不再直接 `new IndexedDbService`、`TemplateFileService`、`LatexRenderService`，也不再直接處理大段 symbol DB bootstrap / category mutation / graphics symbol mutation / subcircuit save orchestration。

### 目前真正的核心問題

- `MainController` 已經比前一版薄很多，但仍保有 façade 型 public methods 與少量 UI glue。
- custom symbol 的 selection/save/category/graphics/bootstrap/offcanvas orchestration 已往專用 controller 收斂；剩餘工作應是小切片整理，不適合再做大規模重寫。
- `serverless-proxy` provider 入口已完成，而且 demo runtime preset 也已補上：
  - 新增 `src/scripts/config/runtimeBootstrap.ts`
  - 正式入口已收斂成 `meta[name="circuitikz-runtime"]`
  - `src/scripts/index.ts` 已在 app import 前先執行 `bootstrapRuntimeConfig()`
- `componentRuntime` / `propertyRuntime` / `namingRuntime` 的 wiring 已從 `MainController` 建構子中的三段 `configure...` 內聯初始化，收斂到 `src/scripts/controllers/mainControllerRuntime.ts`
- `tests/mainControllerRuntime.test.ts` 已補上這個 runtime seam 的 focused coverage，確認 property / naming / component 三組 callback 仍正確接回 `MainController` 依賴
- `SymbolEditorController.instance.configure(...)`、`configureTikzParserRuntime(...)`、`GroupComponent.setCreateSubcircuitHandler(...)` 也已從 `MainController` 內聯 wiring 收斂到 `src/scripts/controllers/mainControllerBootstrap.ts`
- `tests/mainControllerBootstrap.test.ts` 已補上 bootstrap seam coverage，確認 symbol editor runtime、tikz parser runtime、group subcircuit handler 注入仍成立
- export button / canvas context menu / dark-mode switch / symbol color preprocess 這段 post-init UI glue，已從 `MainController` 內聯流程收斂到 `src/scripts/controllers/mainControllerUiBootstrap.ts`
- `tests/mainControllerUiBootstrap.test.ts` 已補上 UI bootstrap coverage，確認 export/context menu/theme 綁定仍成立
- `addSaveStateManagement()` 內原本混在一起的 tab save-state / tab-management / broadcast startup wiring，已收斂到 `src/scripts/controllers/mainControllerTabBootstrap.ts`
- `tests/mainControllerTabBootstrap.test.ts` 已補上 tab bootstrap coverage，確認 database open、session initialize、broadcast reaction 仍成立
- `initShortcuts()` 內原本混在一起的 hotkey / undo-redo / component shortcut wiring，已收斂到 `src/scripts/controllers/mainControllerShortcutBootstrap.ts`
- `tests/mainControllerShortcutBootstrap.test.ts` 已補上 shortcut bootstrap coverage，確認 hotkey registration 與主要 callback 分支仍成立
- `initModeButtons()` 內原本混在一起的 mode button DOM binding，已收斂到 `src/scripts/controllers/mainControllerModeBootstrap.ts`
- `tests/mainControllerModeBootstrap.test.ts` 已補上 mode bootstrap coverage，確認 pan/draw-line/eraser 綁定仍成立
- 版本字串、初始 theme 狀態、`designName` 的 title / export filename / broadcast wiring，已收斂到 `src/scripts/controllers/mainControllerDocumentBootstrap.ts`
- `tests/mainControllerDocumentBootstrap.test.ts` 已補上 document bootstrap coverage，確認 default theme、version label、design name 變更行為仍成立
- `loadMathJax()` 這段 startup dependency 載入，已收斂到 `src/scripts/controllers/mainControllerMathJaxBootstrap.ts`
- `tests/mainControllerMathJaxBootstrap.test.ts` 已補上 MathJax bootstrap coverage，確認 script append / load resolve / 既有 `window.MathJax` 保留行為仍成立
- `Promise.all(...).then(...)` 內原本混在一起的 post-init app startup orchestration，已收斂到 `src/scripts/controllers/mainControllerAppBootstrap.ts`
- `tests/mainControllerAppBootstrap.test.ts` 已補上 app bootstrap coverage，確認 post-init 呼叫序、template init error handling、pending data / initDone 行為仍成立
- demo mode 的主要未完項已從「建立 preset 入口」轉成「驗證與收尾」：
  - 確認實際 demo 啟動路徑真的固定走 `indexeddb + static-manifest + serverless-proxy`
  - 確認 demo mode 不會再走 `/api/files`、`/api/file`、`/api/save`、`/api/delete`
  - 維持正式入口只用 deploy-time 注入的 `meta[name="circuitikz-runtime"]`，不要再恢復平行入口

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
- `AddComponentOffcanvasController`

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
- `CustomSymbolCatalogController`
- `CustomSymbolGraphicsController`
- `CustomSymbolSubcircuitSaveController`

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
- `controllerRuntime`
- `TemplateFileService`
- `IndexedDbTemplateDataSource`
- `StaticTemplateDataSource`
- `LatexRenderService`
- `SymbolLibraryService`
- generated `staticTemplateManifest`
- `server.js`
- `server/latexProxy.js`
- `api/latex.js`

目標：

- `server` 與 `local/static` 從這一層切換
- `server.js` 與 `api/latex.js` 都屬於 integration layer，不屬於 controller
- demo mode 已開始透過 runtime config injection 切換 provider，而不是維護第二套前端

## 6. 推薦實作方式

第 6 點要視為「依現況排序的 rollout 狀態」，不是重新畫藍圖。

### 第 6 點目前已完成哪些

截至目前工作樹，第 6 點已經完成的，不只是 runtime/provider 骨架，還包括一批直接從 `MainController` 抽出的 runtime/bootstrap seam。

可以直接視為已完成的項目：

- `runtimeConfig` / `appRuntime` / `controllerRuntime` 已建立，controller 不再自己決定 server/local provider。
- `TemplateController` / `LiveRenderController` 已改由 runtime 取依賴。
- tab / work / template 流程已經有 application service / repository 邊界。
- demo runtime preset 已正式接上，而且 deploy-time 入口已收斂成單一 `meta[name="circuitikz-runtime"]`。
- `build:demo` / `deploy:demo` 已存在，可產生 demo preset 產物。
- `MainController` 內 startup/runtime wiring 已抽成獨立 seam：
  - `mainControllerRuntime`
  - `mainControllerBootstrap`
  - `mainControllerUiBootstrap`
  - `mainControllerTabBootstrap`
  - `mainControllerShortcutBootstrap`
  - `mainControllerModeBootstrap`
  - `mainControllerDocumentBootstrap`
  - `mainControllerMathJaxBootstrap`
  - `mainControllerAppBootstrap`
- 上述 seam 都已補 focused tests，且目前這一輪已可視為 runtime/provider/bootstrap 類切塊的主要 checkpoint。

換句話說，第 6 點前半段「把切換點與 wiring 從 `MainController` 內聯流程抽出」這件事，已經不是計畫，而是現在進行式中的既成事實。

### 第一階段：收斂 `MainController` 依賴注入邊界

已完成：

- `runtimeConfig` 已建立
- `appRuntime` 已建立
- `controllerRuntime` 已建立
- `TemplateController` / `LiveRenderController` / `MainController` 已改由 runtime 取依賴
- `getApiBase()` 不再是 controller 內自行判斷 server/local 的主要入口

結論：

- controller 內直接 `new repository/service` 的舊做法已經開始退場
- 這一階段現在可再往前補一句：`MainController` 內原本分散的 runtime/configure wiring，已被 `mainControllerRuntime` / `mainControllerBootstrap` / `mainControllerUiBootstrap` / `mainControllerTabBootstrap` / `mainControllerShortcutBootstrap` / `mainControllerModeBootstrap` / `mainControllerDocumentBootstrap` / `mainControllerMathJaxBootstrap` / `mainControllerAppBootstrap` 吸走

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
- `api/latex.js` 已接上 `server/latexProxy.js`
- `server.js` 與 `api/latex.js` 共用同一份 QuickLaTeX proxy 行為
- `src/scripts/config/runtimeBootstrap.ts` 已建立 demo preset bootstrap
- `src/scripts/index.ts` 已在動態 import `MainController` 前先套用 runtime preset
- `tests/runtimeBootstrap.test.ts` 已覆蓋 preset 解析與 override 合併行為
- `tests/apiServices.test.ts` 已補上 demo providers 不碰 server filesystem API 的回歸測試
- `package.json` 已有 `build:demo` / `deploy:demo`
- `scripts/set-runtime-preset.js` 已可在 build 後把 `dist/index.html` 的 runtime meta 改成 `demo`

尚未完成：

- demo branch / hosting 平台是否已長期固定採用 `npm run build:demo`，仍要持續維護。
- 若之後 hosting 設定調整，仍要再驗一次最終 deploy 出去的 artifact 是否確實固定成 `indexeddb + static-manifest + serverless-proxy`。

### 第四階段：接上 custom symbol / 方案 B 專用實作

custom symbol / component library 這條線目前已完成大半：

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
- `AddComponentOffcanvasController` 已建立，接手 initAddComponentOffcanvas() 的 toolbar / shape / component-library orchestration
- `controllerRuntime` 已建立，專門收斂 `TemplateController` / `LiveRenderController` 的 runtime wiring
- `mainControllerRuntime` 已建立，先接住 `componentRuntime` / `propertyRuntime` / `namingRuntime` 三條 `MainController` callback wiring
- `mainControllerBootstrap` 已建立，接住 `SymbolEditorController` / `tikzParserRuntime` / `GroupComponent` 的 bootstrap wiring
- `mainControllerUiBootstrap` 已建立，接住 export/context menu/theme/symbol-color 這段 DOM startup wiring
- `mainControllerTabBootstrap` 已建立，接住 tab save-state / tab-management / broadcast 這段 startup wiring
- `mainControllerShortcutBootstrap` 已建立，接住 hotkey / undo-redo / component shortcut 這段 startup wiring
- `mainControllerModeBootstrap` 已建立，接住 mode button 這段 DOM startup wiring
- `mainControllerDocumentBootstrap` 已建立，接住 version/theme/design-name 這段 document startup wiring
- `mainControllerMathJaxBootstrap` 已建立，接住 MathJax startup dependency 載入
- `mainControllerAppBootstrap` 已建立，接住 post-init app startup orchestration
- `customSymbolDrawerActionsFactory` 已把 drawer 的 placement / runtime callback 組裝從 `MainController` 抽出去
- `CustomSymbolSubcircuitSaveController` 已建立，接手 selection/group/save/restore/persist 這條 subcircuit save orchestration
- `MainController.renameCustomGraphicsSymbol()` / `duplicateSymbol()` / `deleteCustomGraphicsSymbol()` 已改走 application service
- base symbol DB 的 fetch / parse / append / runtime extract 已從 `MainController.initSymbolDB()` 移出

但這一階段已接近收口，目前剩下的比較像是刻意保留在 `MainController` 的範圍，而不是還沒拆到的 bootstrap 漏洞。現況是：

- `MainController` 仍保有少量 custom symbol UI glue，但 selection/save orchestration、category mutation、graphics symbol mutation、add-component offcanvas orchestration 已經收斂到專用 controller
- `MainController` 仍保有 façade 型 public methods，供舊呼叫點和 controller 間 callback 使用
- `switchMode()`、`updateTheme()`、`saveCurrentState()` 這類直接代表 app shell 行為的核心方法，現階段不建議為了切塊再硬拆成 bootstrap/module
- `initCanvas()`、`initSymbolDB()`、`initAddComponentOffcanvas()` 這類已經很薄的 wrapper，除非未來責任再次膨脹，否則不值得再拆
- demo mode 的啟動/部署設定還需持續對齊
- `api/latex.js` 已成為 serverless provider 入口，但 runtime 預設仍是正式版 server-backed mode

### 目前最合理的下一步

接下來建議順序：

1. 在 demo branch / hosting 流程固定使用 `npm run build:demo`。
2. 用 targeted tests + build 驗證 demo runtime 不再依賴 `/api/files`、`/api/file`、`/api/save`、`/api/delete`。
3. 把這一批 runtime/bootstrap seam 以 commit checkpoint 固定下來，避免後續 demo 收尾或功能改動又把 wiring 塞回 `MainController`。
4. 如果之後還要繼續動 `MainController`，只再碰兩種東西：
   - 真的還在 inline startup glue 的區塊
   - 已經證明會持續膨脹的 façade/wrapper
5. 不再把 `switchMode()`、`updateTheme()`、`saveCurrentState()` 這類 app shell 核心方法當成優先拆分對象。

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
- demo 專用差異優先放在 runtime config injection 或 demo branch bootstrap，不改 service method shape
- `api/latex.js` / `server/latexProxy.js` 應保持共用 proxy 行為，避免 server 與 serverless 兩套實作漂移
- runtime preset 的 deploy 入口應維持單一來源，不再恢復 query / dataset / window 這類平行入口

## 8. 測試策略

目前應維持以 targeted vitest 為主 gate，build 為輔助驗證。

### 主要回歸測試

- custom symbol load / rename / delete / category update
- tab persistence 與 tab lifecycle
- template open / save / delete application flow
- latex request shape 與 render client wiring
- custom symbol drawer / save modal / symbol library menu controller
- component library controller / filter wiring / toolbar binding
- demo runtime config override 不碰 server file API

### 目前已補上的 targeted tests

- `apiServices.test.ts`
- `runtimeBootstrap.test.ts`
- `controllerRuntime.test.ts`
- `templateController.test.ts`
- `tabSessionService.test.ts`
- `tabApplicationService.test.ts`
- `tabBroadcastService.test.ts`
- `tabLifecycleService.test.ts`
- `tabManagementController.test.ts`
- `customSymbolServices.test.ts`
- `customSymbolApplicationService.test.ts`
- `customSymbolDrawerController.test.ts`
- `customSymbolSaveController.test.ts`
- `customSymbolStateController.test.ts`
- `customSymbolSubcircuitSaveController.test.ts`
- `customSymbolCatalogController.test.ts`
- `customSymbolGraphicsController.test.ts`
- `customSymbolDrawerActionsFactory.test.ts`
- `customSymbolExportService.test.ts`
- `symbolLibraryMenuController.test.ts`
- `symbolLibraryBootstrapController.test.ts`
- `customSymbolSelectionController.test.ts`
- `componentLibraryController.test.ts`
- `mainController.renameCustomGraphicsSymbol.test.ts`
- `mainControllerRuntime.test.ts`
- `mainControllerBootstrap.test.ts`
- `mainControllerUiBootstrap.test.ts`
- `mainControllerTabBootstrap.test.ts`
- `mainControllerShortcutBootstrap.test.ts`
- `mainControllerModeBootstrap.test.ts`
- `mainControllerDocumentBootstrap.test.ts`
- `mainControllerMathJaxBootstrap.test.ts`
- `mainControllerAppBootstrap.test.ts`
- `symbolLibraryService.test.ts`
- `indexedDbTemplateDataSource.test.ts`
- `staticTemplateDataSource.test.ts`
- `modalDialogService.test.ts`
- `latexProxy.test.ts`

### 驗證原則

- 以 targeted vitest 為主要 gate
- build 與完整 app 啟動可列為輔助驗證，但不是唯一 gate
- 如果 Parcel 在 Windows temp path 出現 `ENOENT unlink` 類型噪音，可改用隔離 cache / dist build 驗證
- 如果 graphify 結果與實際程式碼衝突，以當前 repo 程式碼為準

### 下一階段建議 gate

- 文件更新本身不用跑測試，但要重新檢查第 5-9 點沒有互相矛盾。
- demo preset / runtime bootstrap 這一輪完成後，先跑：
  - `npm.cmd test -- tests/runtimeBootstrap.test.ts tests/apiServices.test.ts tests/controllerRuntime.test.ts tests/templateController.test.ts tests/latexProxy.test.ts`
- component / property / naming runtime seam 已抽成 `mainControllerRuntime`，且 parser/editor/group wiring 已抽成 `mainControllerBootstrap` 後，至少加跑：
  - `npm.cmd test -- tests/mainControllerRuntime.test.ts tests/mainControllerBootstrap.test.ts tests/tikzParser.test.ts tests/groupComponent.test.ts`
- 如果再動到 export/context menu/theme/symbol-color 這段 UI bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerUiBootstrap.test.ts tests/mainControllerBootstrap.test.ts tests/mainControllerRuntime.test.ts`
- 如果再動到 tab save-state / tab-management / broadcast startup bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerTabBootstrap.test.ts tests/tabApplicationService.test.ts tests/tabBroadcastService.test.ts tests/tabLifecycleService.test.ts tests/tabManagementController.test.ts`
- 如果再動到 shortcut / undo-redo / component shortcut bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerShortcutBootstrap.test.ts tests/mainControllerTabBootstrap.test.ts tests/mainControllerUiBootstrap.test.ts`
- 如果再動到 mode button bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerModeBootstrap.test.ts tests/mainControllerShortcutBootstrap.test.ts tests/mainControllerUiBootstrap.test.ts`
- 如果再動到 version/theme/design-name 這段 document bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerDocumentBootstrap.test.ts tests/mainControllerUiBootstrap.test.ts tests/mainControllerTabBootstrap.test.ts`
- 如果再動到 MathJax startup bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerMathJaxBootstrap.test.ts tests/mainControllerDocumentBootstrap.test.ts tests/mainControllerUiBootstrap.test.ts`
- 如果再動到 post-init app startup bootstrap，至少加跑：
  - `npm.cmd test -- tests/mainControllerAppBootstrap.test.ts tests/mainControllerMathJaxBootstrap.test.ts tests/mainControllerUiBootstrap.test.ts tests/mainControllerTabBootstrap.test.ts`
- 如果碰到 custom symbol callback / façade cleanup，再加跑相關 custom-symbol focused tests。
- 最後跑 `npm.cmd run build`；若遇到 Windows / Parcel temp path `ENOENT unlink`，改用 isolated cache / dist build 作輔助驗證。

## 9. 建議結論

現在不是先做第二套 demo UI，而是先把 `main` 的切換點抽乾淨，並把 demo preset 的啟動方式正式定案。

目前已經完成的重點：

- runtime / provider 骨架已存在
- demo runtime preset bootstrap 已存在，且已接進 `src/scripts/index.ts`
- tab / session / work / template 已大幅離開 `MainController`
- `TemplateController` / `LiveRenderController` 已透過 `controllerRuntime` 接 runtime services
- `api/latex.js` 與 `server.js` 已共用 `server/latexProxy.js`
- custom symbol 已拆成 application service、workspace/state/drawer/save/catalog/graphics/bootstrap/subcircuit controllers
- component library 的群組渲染與 filter wiring 已從 `MainController` 抽出
- demo providers 不碰 server filesystem API 的回歸測試已補上

接下來真正的成功條件不是「再重寫 UI」，而是：

- demo mode 有明確且固定的 preset 載入方式，並可透過 `npm run build:demo` 產生 `indexeddb + static manifest + serverless latex` 的部署產物
- demo mode 不再走 server filesystem API
- `MainController` 繼續從 persistence / runtime 判斷 / custom symbol orchestration 中鬆開，但只做小切片
- runtime/provider/bootstrap 類切塊到這一輪已基本收口，後續若再動 `MainController`，優先做小範圍 cleanup，不再為切塊而切塊
- 方案 B 最終已在架構上接近「切換 provider」，不是「維護第二套前端」


