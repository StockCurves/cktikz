# 實作計畫：自訂 CircuiTikZ 符號複製、更名與 Symbol Editor

我們將實作一個像是 Microsoft Visio 的 Symbol Editor，讓使用者能夠將現有的標準 CircuiTikZ 符號（如 `nmos`）複製到自訂的類別並重新命名（如 `hvnmos`），且雙點擊該符號後即可在 Symbol Editor 中編輯其內部的 SVG 圖形（如將 gate 加粗，或新增、刪除、調整線條），同時在編輯時保有與調整連接點（anchors / pins）。

## User Review Required

> [!IMPORTANT]
> 1. **資料持久化**：自訂符號的 SVG 代碼、連接點與類別映射關係將儲存在 IndexedDB 之中，重新整理網頁後依然有效。
> 2. **連線自動更新**：若使用者在 Symbol Editor 中調整了連接點 (pins) 的位置，畫布上已連接該點的 Wires 會在儲存後自動吸附至最新位置。
> 3. **Visio 繪圖體驗**：Symbol Editor 提供線條 (Line)、圓形 (Circle)、矩形 (Rect) 三種工具供使用者自訂圖形，並提供對齊與微調的選取工具。

## Open Questions

> [!NOTE]
> 目前沒有懸而未決的核心問題，此設計可直接套用至現有的 `symbols.svg` 結構與 `MainController` / `ComponentSymbol` 的架構中。

## Proposed Changes

### 1. 介面 (UI) 變更

#### [MODIFY] [index.html](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/pages/index.html)
- 新增 `symbolEditorModal` 結構，包含編輯畫布 (Grid SVG)、左側編輯工具列（選取、直線、圓形、矩形、刪除）以及右側屬性面板（線條粗細、線條顏色、填滿顏色、選取元素資訊與 pin 位置調整）。

---

### 2. 邏輯與資料流變更

#### [NEW] [symbolEditorController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/symbolEditorController.ts)
- 實作 `SymbolEditorController` 類別，負責控制整個 Symbol Editor 畫布與屬性面板的操作。
- 支援功能：
  - **載入/顯示**：接收要編輯的自訂符號定義，將其第一個 variant 的 `<symbol>` 內容以 DOM 元素載入畫布，並將 pins 渲染為可選取與拖拉的紅色控制點。
  - **圖形編輯**：
    - 點選並移動 (拖曳) 形狀、使用方向鍵微調。
    - 點選形狀後在右側屬性欄修改 `stroke-width`, `stroke`, `fill` 屬性。
    - 使用直線 (Line)、圓形 (Circle)、矩形 (Rect) 工具畫新形狀。
    - 按下 `Delete` 或點擊垃圾桶刪除所選形狀/連線點。
  - **連接點編輯**：點選紅色控制點後可修改名稱、拖曳修改其 x/y 座標位置。
  - **儲存與套用**：將最新的形狀與 pins 座標序列化，存回 IndexedDB，更新 DOM 中 `#symbolDB` 對應節點，並通知畫布上的實例進行更新。

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)
- 在 `initPromise` 決議 (resolve) 時、載入 offcanvas 之前，新增 `loadCustomSymbolsIntoSymbolDB()` 函數：
  - 讀取 IndexedDB 的 `customSymbols`，解析其定義，將 `<symbol>` 節點加入 `#symbolDB`，並在 `this.symbols` 中實例化 `ComponentSymbol`，實現透明支援。
- 擴充 Symbols Drawer 的 contextmenu：
  - **標準符號選單**：新增「複製符號並自訂 (Duplicate to Custom Symbol)...」選項。點選後提示新名字與分類，將 XML 與 symbol 複製並存入 IndexedDB。
  - **自訂符號選單**：如果是在自訂分類中的自訂符號，右鍵選單提供「編輯符號 (Edit)」、「更名符號」、「從此分類移除」與「刪除符號定義」。
- 新增雙擊事件：雙擊自訂分類中的自訂符號，會直接開啟 `SymbolEditorController`。
- 支援自訂符號更名與刪除的同步。

#### [MODIFY] [internal.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/internal.ts)
- 導出新加入的 `SymbolEditorController`。

---

### 3. 元件更新同步變更

#### [MODIFY] [nodeSymbolComponent.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/nodeSymbolComponent.ts) 與 [pathSymbolComponent.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/pathSymbolComponent.ts)
- 當自訂符號定義在 Symbol Editor 中更新後，更新其記憶體中的 pins 屬性與 references。
- 當 `updateOptions` 或 `update` 被呼叫時，重新獲取連接點的 `SnapPoint` 列表，使 Wires 吸附至新位置。

---

## Verification Plan

### Automated Tests
- 無 (本專案主要為互動型 GUI 元件)。

### Manual Verification
1. **複製符號**：
   - 打開 Symbols Drawer (按 `+` 或 `Q`)，在標準 MOSFET 中的 `nmos` 點右鍵，點擊「複製符號並自訂...」。
   - 輸入新名稱 `hvnmos`，選擇自訂類別。
   - 確認自訂類別與 `hvnmos` 被新增在 Offcanvas 最上方。
2. **Symbol Editor 圖形編輯**：
   - 雙擊自訂類別中的 `hvnmos` 或右鍵點擊「編輯符號」。
   - 在 Symbol Editor 中選中 gate 線條，在右側將 `stroke-width` 拉粗。
   - 用直線工具，在上方加畫一條輔助小線段。
   - 選中其中一個 pin 並拖拉其位置。
   - 點擊「儲存符號」。
3. **畫布實例套用與 Anchor 保有**：
   - 將編輯好的 `hvnmos` 拖曳到畫布上。
   - 確認 gate 線條確實變粗，且有新畫的輔助小線段。
   - 使用 Wire 工具，確認依然能成功接上 gate, drain, source 的 anchors。
   - 再次進入 Symbol Editor 編輯 `hvnmos`，並拖拉 gate pin 的位置，確認儲存後，畫布上連接 gate 的 Wire 也會自動連到最新的位置。
