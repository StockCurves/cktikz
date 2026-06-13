# Implementation Plan - Custom Categories & Subcircuits

本計劃旨在為 CircuiTikZ-Designer 新增「自訂符號分類 (例如：我的最愛)」與「自訂 Cell Name 子電路 (Subcircuit)」功能。

## User Review Required

> [!IMPORTANT]
> - **儲存設計**：自訂分類與子電路將持久化儲存於 IndexedDB（資料庫版本升級為 2），確保跨頁面重新整理與跨 Tab 同步。
> - **TikZ 導出語法**：子電路在導出為 LaTeX TikZ 時，將在 preamble 區段生成 `\tikzset{SubcircuitName/.pic={...}}`，並在畫布元件位置生成 `\draw (x, y) pic {SubcircuitName};`。這與 TikZ 的標準相容性最高。
> - **雙向同步**：TikZ 編輯器與 GUI 畫布支援雙向解析 `pic` 及 `\tikzset`。

## Proposed Changes

### Database Layer

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)
- 將 IndexedDB 版本由 `1` 升級為 `2`。
- 在 `onupgradeneeded` 中新增兩個 object stores:
  - `customCategories`: 儲存自訂分類資訊。
  - `customSymbols`: 儲存自訂符號（包含我的最愛元件複本、自訂 Subcircuits 的內部 JSON 資料）。
- 初始化時從 DB 載入自訂分類，並動態生成 Symbols Drawer 的 Accordion 項。

---

### UI & UX Layer

#### [MODIFY] [index.html](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/pages/index.html)
- 在 Symbols drawer 頂部新增「新增分類 (Add Category)」按鈕與輸入框。
- 引入或支援彈出自訂右鍵選單以進行操作。

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)
- 在 Symbols drawer 的各個 symbol 元素上綁定 `contextmenu` 事件，彈出選單「加到自訂分類...」。
- 當選取多個元件時，在畫布上按右鍵提供「建立子電路 (Create Subcircuit)」選項，彈出提示框輸入自訂 Cell Name。

---

### Component Layer

#### [NEW] [subcircuitComponent.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/subcircuitComponent.ts)
- 繼承自 `GroupComponent`（或 `CircuitComponent`）。
- 實作 `toTikzString()` 輸出 `\draw (x, y) pic {DisplayName};`。
- 實作 `toSVG()` 與複製擺放邏輯。

---

### Parsing & Exporting Layer

#### [MODIFY] [tikzParser.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/utils/tikzParser.ts)
- 解析 `\tikzset{...}` 定義區塊，動態提取 pic 名稱與內部 TikZ 代碼，並遞迴解析儲存為自訂 Subcircuit。
- 解析 `\draw ... pic {Name};` 語法，並在對應座標生成該子電路元件。

#### [MODIFY] [exportController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/exportController.ts)
- 在導出 TikZ 時，收集畫布上所有使用的 `SubcircuitComponent`，並在 TikZ preamble 輸出對應的 `\tikzset{.../.pic={...}}` 定義。

#### [MODIFY] [tikzEditorController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/tikzEditorController.ts)
- 編輯器同步更新時，也包含 `\tikzset` 生成。

## Verification Plan

### Automated Tests / Manual Verification
1. **新增分類**：點擊 Symbols 頂部的「新增分類」，確認成功建立，且重新整理網頁後依然存在。
2. **加到我的最愛**：右鍵點擊某個標準 symbol，將其加入「我的最愛」，確認該 symbol 出現在新分類中，且可拖曳放置。
3. **建立子電路**：在畫布選取電阻、電容與導線，按右鍵選擇「建立子電路」，命名為 `LowPass`。確認它出現在自訂分類中。
4. **拖曳放置子電路**：將 `LowPass` 拖曳到畫布，確認能正常擺放與移動。
5. **TikZ 導出與編輯器同步**：開啟 TikZ 編輯器，確認能正確輸出 `\tikzset{LowPass/.pic={...}}` 與 `pic {LowPass}`。嘗試在編輯器修改並 Apply，確認畫布同步更新。
