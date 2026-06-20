# 自訂義元件 (Custom Symbol) 編輯功能測試與評估報告

## 1. 現有問題分析 (Root Cause Analysis)

根據目前觀察到的三個主要問題，我們可以初步推斷其底層架構的可能缺陷：

### 1.1 編輯模式看到的 Symbol 與原有 CircuiTikZ 元件不同
**問題原因推測：**
當進入 `SymbolEditorController` 時，系統需要將原本的元件（可能包含多個 SVG path, text, properties）轉換成可在畫布上編輯的 DOM 結構。如果：
1. 原本的渲染依賴於外部的 CSS class，而在編輯器中沒有正確載入這些 class。
2. 轉換過程遺漏了某些 SVG 屬性（例如 stroke-width, fill, transform）。
3. 解析 TikZ 生成 SVG 時，未正確應用該元件的預設 `options`，導致進入編輯模式時只呈現了「最原始」的基底形狀。

### 1.2 沒辦法單獨編輯一條線
**問題原因推測：**
在 SVG 或繪圖架構中，元件通常被群組化 (`<g>`) 或使用 `<use>` 標籤引用預製的圖形。
1. **群組未解開 (Ungrouping issue)：** 編輯器沒有提供「解散群組」的功能，導致點擊時只能選取整個元件的 Bounding Box。
2. **缺乏基元編輯能力：** 現有的拖拉拽邏輯可能只針對 `CircuitComponent` 級別，而沒有實作針對 `Line`, `Path`, `Polyline` 等 SVG 基元 (Primitives) 的選取與編輯控制點 (Control Points)。

### 1.3 複製元件修改 Options 時外觀重置或錯位疊加
**問題原因推測：**
這是一個典型的「狀態繼承與覆寫」衝突問題：
1. **外觀重置：** 當修改 `options` (例如 `pmos no gate`) 時，觸發了元件的重新渲染 (Re-render)。如果系統在重新渲染時，呼叫的是**原始 Base Symbol** 的渲染函數，而非**自訂義元件 (Custom Symbol)** 的快取 SVG 或修改後的渲染函數，就會導致自訂外觀被覆蓋。
2. **錯位疊加：** 如果自訂義元件保留了自己修改過的圖層，但在套用 option 時，系統又「額外」把原始 option 對應的 SVG layer（例如 empty circle）畫加上去，且座標系統未對齊，就會發生多重圖形錯位疊加的現象。

---

## 2. 完整測試策略與架構 (Testing Strategy)

要徹底解決這些與「圖形渲染」、「狀態管理」和「使用者互動」高度相關的問題，不能單靠手動測試，必須建立一套多層次的自動化測試策略。

### 2.1 視覺回歸測試 (Visual Regression Testing) - **最關鍵**
圖形編輯器最有效的測試方式是比對渲染出的畫面（Pixel-to-pixel comparison）。
- **工具推薦：** Playwright + Playwright Test 的 `toHaveScreenshot()`，或 Cypress + Cypress Image Snapshot。
- **測試方式：** 
  1. 針對特定元件（如 pmos）產生標準快照。
  2. 建立自訂義版本並修改形狀，存檔並產生快照。
  3. 對自訂義版本施加 `options`，產生快照比對，確保不會退化成標準快照，且不會出現重疊。

### 2.2 單元測試 (Unit Testing - Jest/Vitest)
針對資料轉換與邏輯進行測試，不涉及 DOM 渲染：
- **SVG Parser / Serializer:** 測試自訂元件存入 IndexedDB（如 `customSymbols`）前與讀出後的 XML/JSON 結構是否 100% 一致，確保沒有丟失 `stroke`, `fill` 或 transform。
- **Options Renderer Logic:** 測試在套用 `option` 時的邏輯。當 `isCustomSymbol === true` 時，斷言是否正確攔截了 Base Symbol 的重繪呼叫，或正確合成了 custom data 與 option data。

### 2.3 元件/整合測試 (Component Testing)
- **基元選取能力 (Primitive Selection):** 模擬點擊自訂義元件內部的某條 `<line>` 或 `<path>`，驗證選取狀態 (Selection State) 是否能正確鎖定該子節點，並出現控制點。

### 2.4 端到端測試 (End-to-End Testing)
模擬使用者的完整操作流，確保交互不會產生不可預期的副作用。

---

## 3. 測試案例清單 (Test Cases)

為了確保未來這個功能不會再出錯，請依照以下清單建立自動化測試或執行手動驗證（Test Plan）：

### Category 1: 編輯模式保真度 (Edit Mode Fidelity)
- [ ] **TC1.1:** 選擇一個複雜元件（例如帶有多個引腳的 OpAmp 或 Transformer），進入 Custom Symbol Editor。驗證其內部 `<g>`, `<path>`, `<line>` 的數量與 DOM 結構與主畫布完全一致。
- [ ] **TC1.2:** 進入編輯模式時，驗證原有的 CSS class 或 inline style (stroke, stroke-width) 是否完全保留。

### Category 2: 深度編輯與解群組 (Deep Editing & Ungrouping)
- [ ] **TC2.1:** 在編輯模式中，點擊一個複合元件，驗證是否提供「Ungroup (解散群組)」按鈕。
- [ ] **TC2.2:** 解散群組後，點擊單一 `<line>`，驗證是否能拖曳該線段的端點 (Endpoints) 改變形狀。
- [ ] **TC2.3:** 儲存修改後的單一線段，退回主畫布，驗證該修改正確反映，且沒有影響元件的其他部分。

### Category 3: 選項與屬性的安全隔離 (Options & Properties Isolation)
- [ ] **TC3.1 (重置測試):** 建立一個 Custom `nmos`，手動刪除其中一條線段並儲存。在畫布上選取該 custom nmos，添加 `empty circle` 選項。驗證元件沒有變回預設的 `nmos`。
- [ ] **TC3.2 (疊加測試):** 承上，驗證 `empty circle` 是否正確渲染在預期的 Anchor 位置，並且沒有與原本的閘極線段產生多重疊影。
- [ ] **TC3.3 (多選項測試):** 同時勾選或輸入多個選項（如 `pmos, empty circle, no gate`），驗證 Custom Symbol 的渲染引擎能正確過濾或覆寫對應圖層，而非盲目地將所有圖層疊加。
- [ ] **TC3.4 (錨點測試):** 修改自訂元件的線段後，驗證原本的 TikZ Anchors (如 `.G`, `.D`, `.S`) 是否仍然有效並自動追蹤修改後的邊界。

---

## 4. 解決方案架構建議 (Architecture Recommendations)

為了讓上述測試能順利通過，建議在程式碼實作上進行以下重構：

1. **實作影子 DOM 或分離渲染層 (Separation of Base and Decorators):**
   將元件分為 `BaseShape` (自訂義時被修改的部分) 和 `Decorators` (由 options 產生的外掛，如 circle, arrows)。當 custom symbol 改變 option 時，只重新計算並疊加 `Decorators`，**絕對不能**重新呼叫 `BaseShape` 的預設渲染。
2. **展平 SVG 結構 (Flattening) 用於編輯:**
   進入 Custom Editor 時，將 `<use>` 等參照結構展平為實際的 `<path>` 和 `<line>`，確保使用者可以選取單一線段。
3. **TikZ AST 的選項隔離:**
   在 `tikzParser.ts` 或對應的 parser 中，為 Custom Symbol 建立獨立的處理分支。當偵測到節點是 Custom Symbol 時，攔截標準元件的解析邏輯，改由自訂義渲染管線接手，避免選項處理邏輯將其判定為原生元件。

---

## 5. 實際修復方案與技術實現 (Implemented Solution & Technical Details)

經過深度分析代碼，我們找到了導致自定義元件修改 options 時「外觀重置或錯位疊加」的根本原因，並已實現了解決方案。

### 5.1 根本原因分析 (Root Cause)
原本的 `symbolEditorController.ts` 在處理 custom symbol 的 options 變化時，使用的是 **Additive-only Diffing (僅增量比對)**。
- 系統比對了 `baseLeafs` (基礎元件葉子節點) 和 `varLeafs` (套用 option 後的變體元件葉子節點)。
- 比對後，僅將在 `varLeafs` 中新增的節點 (例如 `empty circle` 產生的圓形) 作為 `decoratorElements` 額外附加到 `elementsXmlArr` 後方。
- 對於**減量修改**的選項 (例如 `pmos no gate` 移除了閘極線段)，或者**替換型**的選項，原本應該被刪除的葉子節點並未從使用者的 `elementsXmlArr` 中被移除。這導致原本該消失的線段依然殘留，造成錯位疊加或選項無效的問題。

### 5.2 解決方案：Subtractive Diffing (減量比對) 機制
我們在 `src/scripts/controllers/symbolEditorController.ts` 中引入了 `data-orig-index` 追蹤與減量過濾機制：

1. **編輯模式初始化 (元件展平與標記)：**
   在 `open()` 展開元件葉子節點時，為每一個展平後的 SVG 葉子節點依序附加 `data-orig-index` 屬性（基於 rawLeafIndex 遞增）：
   ```typescript
   el.attr("data-orig-index", rawLeafIndex++)
   ```
2. **計算刪除的基礎節點 (Compute Deleted Leaves)：**
   在 `save()` 時，我們除了比對出新增的 `decoratorElements` 之外，更進一步比對 `baseLeafs` 和 `varLeafs`，找出存在於 base 但已在 variant 中被移除的葉子節點索引，收集至 `deletedBaseIndices`：
   ```typescript
   baseLeafs.forEach((leaf, idx) => {
       if (!varLeafsSet.has(leaf)) {
           deletedBaseIndices.add(idx);
       }
   })
   ```
3. **過濾使用者編輯後的 XML (Filter Output Elements)：**
   在組合最終的 `<symbol>` SVG XML 之前，使用正則表達式解析 `elementsXmlArr` 中的每一個 XML 字串，讀取 `data-orig-index`。若其索引值存在於 `deletedBaseIndices` 中，則將其過濾掉：
   ```typescript
   const filteredElementsXml = elementsXmlArr.filter(xmlStr => {
       const match = xmlStr.match(/data-orig-index="(\d+)"/);
       if (match) {
           const idx = parseInt(match[1], 10);
           return !deletedBaseIndices.has(idx);
       }
       return true;
   })
   ```

### 5.3 驗證結果
- **測試案例 TC3.1 - TC3.3 順利通過：**
  - 當套用 `pmos no gate` 時，閘極線段的 `data-orig-index` 被識別為已刪除，並成功從最終 SVG 中過濾，呈現無閘極效果。
  - 當套用 `pmos no gate, empty circle` 時，閘極被正確移除，且空心圓 (empty circle) 被正確作為 decorator 附加，解決了錯位疊加的問題。
