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
  - 支援從 `?runtime=demo`、`meta[name="circuitikz-runtime"]`、`data-runtime`、`window.__CIRCUITIKZ_DESIGNER_RUNTIME_PRESET__` 解析 preset
  - `src/scripts/index.ts` 已在 app import 前先執行 `bootstrapRuntimeConfig()`
- demo mode 的主要未完項已從「建立 preset 入口」轉成「驗證與收尾」：
  - 確認實際 demo 啟動路徑真的固定走 `indexeddb + static-manifest + serverless-proxy`
  - 確認 demo mode 不會再走 `/api/files`、`/api/file`、`/api/save`、`/api/delete`
  - 決定正式的 demo 啟動介面要用 query、HTML data/meta，還是 branch/deploy-time 注入

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

### 第一階段：收斂 `MainController` 依賴注入邊界

已完成：

- `runtimeConfig` 已建立
- `appRuntime` 已建立
- `controllerRuntime` 已建立
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
- `api/latex.js` 已接上 `server/latexProxy.js`
- `server.js` 與 `api/latex.js` 共用同一份 QuickLaTeX proxy 行為
- `src/scripts/config/runtimeBootstrap.ts` 已建立 demo preset bootstrap
- `src/scripts/index.ts` 已在動態 import `MainController` 前先套用 runtime preset
- `tests/runtimeBootstrap.test.ts` 已覆蓋 preset 解析與 override 合併行為
- `tests/apiServices.test.ts` 已補上 demo providers 不碰 server filesystem API 的回歸測試

尚未完成：

- 決定哪一種 preset 載入方式會成為正式 demo 部署慣例，目前 code 已同時支援 query / meta / dataset / window preset，但尚未收斂成單一路徑。
- 補一次實際 build / deploy 角度的驗證，確認 demo 啟動模式確實固定成 `indexeddb + static-manifest + serverless-proxy`。
- 若未來 demo branch 需要零手動切換，仍要補 deploy-time 或 HTML bootstrap 的明確約定。

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
- `customSymbolDrawerActionsFactory` 已把 drawer 的 placement / runtime callback 組裝從 `MainController` 抽出去
- `CustomSymbolSubcircuitSaveController` 已建立，接手 selection/group/save/restore/persist 這條 subcircuit save orchestration
- `MainController.renameCustomGraphicsSymbol()` / `duplicateSymbol()` / `deleteCustomGraphicsSymbol()` 已改走 application service
- base symbol DB 的 fetch / parse / append / runtime extract 已從 `MainController.initSymbolDB()` 移出

但這一階段還沒完全結束，因為：

- `MainController` 仍保有少量 custom symbol UI glue，但 selection/save orchestration、category mutation、graphics symbol mutation、add-component offcanvas orchestration 已經再往專用 controller 收斂
- `MainController` 仍保有 façade 型 public methods，供舊呼叫點和 controller 間 callback 使用
- demo mode 的啟動/部署設定還需持續對齊
- `api/latex.js` 已成為 serverless provider 入口，但 runtime 預設仍是正式版 server-backed mode

### 目前最合理的下一步

接下來建議順序：

1. 把 demo preset 的啟動約定收斂成單一路徑。
2. 用 targeted tests + build 驗證 demo runtime 不再依賴 `/api/files`、`/api/file`、`/api/save`、`/api/delete`。
3. 繼續把 `MainController` 剩下的 façade / custom symbol UI glue 用小切片收斂，避免一次大改。
4. 依照目前工作樹的新切片方向，評估是否把 component / property / naming 這類 runtime callback 也正式整理成下一輪分層 seam。

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
- 若採用 preset bootstrap，應避免讓 query / meta / dataset / window 四種入口長期並存卻沒有正式優先順序說明

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
- 如果下一輪開始處理 component / property / naming runtime seam，再加跑對應 focused tests。
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

- demo mode 有明確且固定的 preset 載入方式，能靠 `indexeddb + static manifest + serverless latex` 正常運作
- demo mode 不再走 server filesystem API
- `MainController` 繼續從 persistence / runtime 判斷 / custom symbol orchestration 中鬆開，但只做小切片
- 如果目前工作樹中的 component / property / naming runtime 抽離成熟，就把它視為下一輪 seam；否則不要跟 demo preset 收尾混成同一個大改動
- 方案 B 最終已在架構上接近「切換 provider」，不是「維護第二套前端」


