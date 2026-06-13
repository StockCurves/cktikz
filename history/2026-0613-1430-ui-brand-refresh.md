# 實作計畫：CircuiTikZ Designer 介面美化與品牌引導重構

為了改善新增多項功能後造成的介面雜亂、視覺干擾以及與 `brand-guidelines.md` 定義的 **Premium Academic Light Theme (高級學術亮色主題)** 差異，我們將對網頁進行整體的樣式與配置優化。

## User Review Required

> [!IMPORTANT]
> 1. **主題與配色調整**：引入 `brand-guidelines.md` 規範的 HSL 配色系統與 `Outfit`、`JetBrains Mono` 字型。
> 2. **頂部導覽列 (Navbar) 去雜與整頓**：
>    - 簡化右上角緊密排列的按鈕，將低頻操作（About 資訊、Tab group 管理、Help 說明）整合為更乾淨的選單或分類按鈕。
>    - 將 Dark Mode 的開關重新設計為符合 Premium 主題、美觀的 HSL 自訂開關，而非 Bootstrap 預設的陽春 checkbox switch。
> 3. **工具列 (Toolbar) 質感化**：
>    - 使用 HSL border-radius 與微懸停（Hover & Active translateY 物理反饋）使工具列按鈕看起來像精巧的懸浮微型卡片。
>    - 區分「工具類（Drag/Pan, Wires, Eraser）」與「歷史動作類（Undo, Redo）」，以視覺間距或微細分隔線呈現，使介面不雜亂。
> 4. **側欄/抽屜 (Offcanvas & Side Panel) 精緻化**：
>    - 讓左側 Symbols 面板與右側 Properties 面板使用柔和的背景、精準的 Z-axis 陰影階層 (`--shadow-lg`) 以及毛玻璃質感 (`backdrop-filter`)。
>    - 屬性面板內部的 Bootstrap Primary 亮藍色按鈕會替換為 HSL 設計的低調學術藍 Primary 顏色。

## Proposed Changes

### 1. 視覺基礎與全域樣式

#### [MODIFY] [styles.scss](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/styles/styles.scss)
- 載入 Google Fonts: `Outfit` (300, 400, 500, 600, 700) 與 `JetBrains Mono` (400, 500, 600)。
- 在 `:root` 中加入 `brand-guidelines.md` 的色彩與陰影 CSS 變數，並依照主題切換 (Light / Dark) 覆寫對應的顏色。
- 重構全域字型、按鈕樣式與捲軸樣式。
- 將原本的預設藍色 `#2f586e`（及 Bootstrap `$primary` 變數）調整為符合 HSL 規範的調和藍色。

### 2. 結構簡化與 UI 佈局優化

#### [MODIFY] [index.html](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/pages/index.html)
- 引入 Google Fonts 的 `<link>` 標籤。
- 重構 `<header class="navbar">` 結構：
  - 合併或整理 icon 按鈕，將操作區塊以優雅的 icon 與合適的 spacing 分隔開。
  - 將 Dark Mode switch 換成客製化樣式。
- 優化畫布工具列 `#controlsContainer` 的排版與分組，提升操作直覺性。
- 修改 `#propertiesTitle`、側欄與彈窗，使其使用規範定義的字型級別 (`font-family: var(--font-sans)`)。

### 3. 組件樣式細化

#### [MODIFY] [symbolDB.scss](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/styles/symbolDB.scss)
- 修改 `#leftOffcanvas` 的樣式，加上毛玻璃與邊框設計。
- 調整符號分類折疊面板 (Accordion) 的樣式，Hover 時呈現微互動底色，Active 時字體著色並微調 Chevron 動態。

#### [MODIFY] [toolbarButtons.scss](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/styles/toolbarButtons.scss)
- 去除老舊的 `text-shadow`，改用高級的微縮放或 translateY 與精確的 shadow。
- 為 Toolbar 按鈕加入選取狀態與 Hover 呼吸動畫。

#### [MODIFY] [properties.scss](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/styles/properties.scss)
- 優化屬性面板內部控制項（如 input-range, select, input）的 spacing，使其看起來不過於擁擠。
- 採用 HSL Focus 呼吸環。

## Verification Plan

### Manual Verification
- 啟動瀏覽器測試頁面，確認載入後的 **Light Theme** 符合 Premium Academic 規格（米白紙張質感背景、深碳色文字、Oxford Navy 風格的按鈕）。
- 切換 **Dark Theme**，確認文字與按鈕亦呈現高級暗色階層，不會顯得刺眼。
- 確認頂部導覽列按鈕分佈均勻，沒有以前堆疊緊密的混亂感。
- 確認滑鼠 Hover 在按鈕與工具列上時，有平滑的 3D 微浮動與過場動畫。
- 驗證畫布編輯與屬性微調功能依然運作順暢。
