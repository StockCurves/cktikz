# Implementation Plan — Context Menu: 分類更名 & Subcircuit 刪除/更名

## 目標

在 Symbols 面板的自訂分類中，透過滑鼠右鍵選單新增以下功能：

| 右鍵目標 | 現有功能 | 新增功能 |
|---|---|---|
| 分類標頭 | 刪除分類 | ✅ **更名分類** |
| 分類內的 Subcircuit item | 從分類移除 | ✅ **刪除整個 subcircuit**、✅ **更名 subcircuit** |

---

## 設計決策（訪談結果）

| 議題 | 決定 |
|---|---|
| UX 輸入方式 | 彈出自訂 Bootstrap Modal（有 `<input>` 欄位）|
| 分類更名時，內含 subcircuit 的 displayName/tikzName | **不連帶更新**（分類名 ≠ subcircuit 名，分類是容器）|
| 「刪除整個 subcircuit」語意 | 從**所有分類**移除 + 刪除 DB 中的 `customSymbols` 定義（真正刪除）|
| Subcircuit 多分類歸屬 | 每個 subcircuit 只屬於一個分類（簡化設計）|
| 更名 subcircuit 時，畫布上的 SubcircuitComponent | 連帶更新所有同名實例的 `displayName` |
| 實作位置 | 直接在 `mainController.ts` 加方法 |
| Modal 用途 | 共用一個 `renameModal`，透過 JS 動態設定內容 |

---

## Proposed Changes

### HTML — 新增共用 Rename Modal

#### [MODIFY] [index.html](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/pages/index.html)

在最後一個 `</div>` 前（body 結尾）插入：

```html
<!-- Modal (rename dialog) -->
<div class="modal fade" id="renameModal" tabindex="-1"
     aria-labelledby="renameModalLabel" aria-hidden="true" role="dialog">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h1 class="modal-title fs-5" id="renameModalLabel">更名</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <input type="text" class="form-control" id="renameModalInput" placeholder="請輸入新名稱" />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        <button type="button" class="btn btn-primary" id="renameModalConfirm">確認</button>
      </div>
    </div>
  </div>
</div>
```

---

### mainController.ts — 新方法 + 更新 Context Menu

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)

**A. 新增 `openRenameModal(title, currentName)` 私有輔助方法**

回傳 `Promise<string | null>`，用 Bootstrap Modal 取代 `prompt()`，自動 focus 並全選文字。

**B. 新增 `renameCustomCategory(oldName, newName)` 方法**

- IndexedDB `keyPath = "name"`，不能直接改 key，需 delete old + put new
- 只更新分類紀錄本身，subcircuit 的 tikzName/displayName **不動**
- 完成後呼叫 `loadAndRenderCustomCategories()`

**C. 新增 `renameCustomSymbol(symbolId, newName)` 方法**

- 更新 `customSymbols` 中的 `displayName`、`tikzName`、`subcircuitData.displayName`
- 因 id = `"subcircuit-" + tikzName`，需 delete old id + put new id
- 呼叫私有方法 `_updateSymbolIdInCategories(oldId, newId)` 同步所有分類的 `symbolIds` 陣列
- 遍歷 `this.circuitComponents` 更新畫布上所有 `(comp as any).displayName === oldName` 的元件
- 完成後呼叫 `loadAndRenderCustomCategories()`

**D. 新增 `deleteCustomSymbol(symbolId)` 方法**

- 先從所有分類的 `symbolIds` 移除（readwrite transaction on `customCategories`）
- 再刪除 `customSymbols` 中的紀錄
- **不**刪除畫布上已放置的 `SubcircuitComponent`（符合用戶預期：「畫布元件不受影響」）
- 完成後呼叫 `loadAndRenderCustomCategories()`

**E. 更新分類標頭的 Context Menu（在 `loadAndRenderCustomCategories` 中）**

目前只有「刪除分類」，改為：
- `rename` → 更名分類...
- `delete` → 刪除分類（保留現有行為含 `confirm()`）

**F. 更新 customSymbol item 的 Context Menu（在 `loadAndRenderCustomCategories` 中）**

目前只有「從此分類移除」，改為：
- `rename` → 更名子電路...
- `remove` → 從此分類移除（保留現有行為）
- `delete` → 刪除子電路定義（含 `confirm()`）

> [!NOTE]
> 標準 symbol (standardSymbol) 的 contextmenu 邏輯（「從此分類移除」）**維持現狀不動**。

---

## 邊界情況

> [!IMPORTANT]
> - Subcircuit id 是 `"subcircuit-" + tikzName`，更名時必須同步更新 DB key 和各分類的 symbolIds
> - 若新名稱與現有 id 衝突（同名已存在），目前**不做額外處理**（put 直接覆蓋），可視為進階功能之後再處理
> - 更名 Modal 按下 Enter 鍵也應觸發確認（透過 `keydown` 事件或 `form` submit）

---

## Verification Plan

### Manual Verification

1. **分類更名**：右鍵分類標頭 → 「更名分類...」→ 輸入新名稱確認 → 分類標頭更新，重整後持久。
2. **分類刪除**（回歸測試）：右鍵 → 「刪除分類」→ confirm → 分類消失。
3. **Subcircuit 更名**：右鍵 subcircuit item → 「更名子電路...」→ Symbols 面板顯示新名稱；畫布上同名 SubcircuitComponent.displayName 同步；TikZ 導出使用新 `\pic{newName}` 和新 `\tikzset{newName/.pic={...}}`。
4. **Subcircuit 刪除**：右鍵 → 「刪除子電路定義」→ confirm → Symbols 面板消失，IndexedDB `customSymbols` 中無此 ID；畫布上已放置元件**不消失**。
5. **Subcircuit 從分類移除**（回歸測試）：右鍵 → 「從此分類移除」→ 從此分類消失，DB 中 `customSymbols` 紀錄仍在。
6. **Rename Modal Enter 鍵確認**：開啟更名 Modal，輸入文字後按 Enter 應等同於按確認鈕。
