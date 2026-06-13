# Subcircuit Symbol Panel — WYSIWYG 縮圖

## 目標

把 Symbols Panel 裡自訂分類的 subcircuit，從「方框 + 4 個字」換成與 GUI 上實際電路圖一致的 SVG 縮圖。

---

## 設計決策摘要（訪談結論）

| 議題 | 決定 |
|------|------|
| SVG 取得方式 | offscreen hidden `<svg>`：clone 主畫布 `<defs>` + 每個 groupedComponent 的 visualization，XMLSerializer 轉字串後移除 |
| 存 DB 格式 | SVG string，存到 `customSymbolData.svgPreview` |
| Panel 顯示 | `innerHTML` 直接插入 libComponent 的 div，用 subcircuit 合併 bbox 計算 viewBox，等比縮放到固定 px |
| 縮圖尺寸 | fit-to-bbox：等比縮放，符合 libComponent 的 CSS 容器（與現有普通 symbol 一致） |
| 樣式 | 無額外邊框/標籤，與普通 symbol 外觀一致 |
| 快照時機 | `addSymbolToCategory()` 完成後產生，更新 DB |
| rename 後 | `renameCustomSymbol()` 完成後重新快照 |
| WYSIWYG 精確度 | 盡力拙近；無法呈現的元件略過（不出現），整體 fallback 回方框 + 名稱 |
| 支援元件類型 | 全部（Wire、PathSymbol、NodeSymbol、形狀元件） |

---

## 技術設計

### 1. `generateSubcircuitSvgPreview(subcircuitData)` — 新 private 函式

放在 `mainController.ts`。

**步驟：**

1. 從 `subcircuitData.components` 做 `CircuitComponent.fromJson()`，只建元件、不加到主畫布：
   - 因為 `GroupComponent` 的 constructor 會操作 `MainController.circuitComponents`，我們不用 GroupComponent，直接對 JSON 裡的每個子元件呼叫 `CircuitComponent.fromJson()` 並收集 visualization
2. 建一個 `visibility:hidden; position:absolute` 的 offscreen `<svg>` 加到 `document.body`
3. Clone 主畫布 `<defs>`（symbol 定義都在這裡）貼進 offscreen SVG
4. 把每個元件的 `visualization.node` **clone** 並 append 到 offscreen SVG
5. 計算合併 bbox（`getClientBoundingClientRect` 或 SVG.js `bbox()`）
6. 設定 offscreen SVG 的 `viewBox` = 合併 bbox，加上 `maxStroke/2` margin
7. 用 `XMLSerializer.serializeToString()` 取得 SVG string
8. Remove offscreen SVG
9. 清理步驟 1 建立的臨時元件（`remove()`）
10. 回傳 SVG string（失敗則回傳 `null`）

> **難點**：臨時元件的 fromJson 仍會加進 `MainController.circuitComponents`。需要在快照後呼叫 `remove()` 並從陣列中移除，或改用更輕量的方式。

**替代方案（較簡單）**：直接對已在畫布的 SubcircuitComponent groupedComponents 做 visualization clone，省去重建步驟。若 subcircuit 已放在畫布上就用這個；若是剛存進 DB 還沒放置，則走 fromJson 路線。

### 2. 快照觸發點

**`addSymbolToCategory()`** 最後，取得剛儲存的 customSymbolData 後：

```typescript
const svgPreview = await this.generateSubcircuitSvgPreview(customSymbolData.subcircuitData)
if (svgPreview) {
  customSymbolData.svgPreview = svgPreview
  symStore.put(customSymbolData)  // 更新回 DB
}
```

**`renameCustomSymbol()`** 完成後（`_updateSymbolIdInCategories` callback 裡），重新呼叫 generateSubcircuitSvgPreview 並 put 回 DB。

### 3. Panel 顯示

`loadAndRenderCustomCategories()` 裡，`customSymbol` 分支（原本的方框程式碼，L1789–L1796）改為：

```typescript
if (customSymbol.svgPreview) {
  // 直接用儲存的 SVG string
  addButton.innerHTML = customSymbol.svgPreview
  const svgEl = addButton.querySelector('svg')
  if (svgEl) {
    svgEl.style.width = '100%'
    svgEl.style.height = '100%'
  }
} else {
  // fallback：原本的方框
  let svgIcon = SVG.SVG().addTo(addButton)
  svgIcon.viewbox(0, 0, 30, 15).width(30).height(15)
  svgIcon.rect(26, 12).move(2, 1.5).fill('none').stroke({ color: defaultStroke, width: 1 })
  svgIcon.text(...)
}
```

---

## 受影響的檔案

### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)

- **新增** `private async generateSubcircuitSvgPreview(subcircuitData): Promise<string | null>`
- **修改** `addSymbolToCategory()`：呼叫快照並更新 DB
- **修改** `renameCustomSymbol()` / `_updateSymbolIdInCategories()`：rename 後重新快照
- **修改** `loadAndRenderCustomCategories()` L1789–L1796：用 `svgPreview` 取代方框

---

## 已知風險 / 待確認

> [!WARNING]
> `CircuitComponent.fromJson()` 有 side effect — 會把元件加到 `MainController.circuitComponents` 並建立 SVG DOM 節點加到主畫布。快照用完後必須妥善 remove，否則會有幽靈元件。
>
> **緩解策略**：快照完成後對每個臨時元件呼叫 `component.remove()`，並從 `circuitComponents` 陣列剪除。

> [!NOTE]
> offscreen SVG 的 bbox 計算：visualization 加入 offscreen SVG 後，瀏覽器需要一個 micro-task 才能 layout。需用 `await new Promise(r => requestAnimationFrame(r))` 等 layout 完成後再呼叫 `.getBoundingClientRect()`。

> [!NOTE]
> 若 subcircuit 剛建立（`createSubcircuitFromSelection`）時已在畫布上，可直接對 canvas 上的實例做 visualization clone，不需要 fromJson 重建，更安全。但需確認此時 subcircuit instance 是否存在於 `circuitComponents`。

---

## 驗證計畫

1. **建立 subcircuit**：選取 nmos + wire，建立子電路 → 加到自訂分類 → panel 裡應顯示對應縮圖而非方框
2. **純 wire subcircuit**：只有 wire 元件的子電路縮圖是否正確
3. **rename**：更名後縮圖應反映新內容（其實內容沒變，只是驗證 snapshot 流程不會 crash）
4. **reload**：重新整理頁面後，從 IndexedDB 讀出的 `svgPreview` 仍可正常渲染
5. **fallback**：刻意製造 svgPreview 為空的舊 record，驗證方框 fallback 正常顯示
