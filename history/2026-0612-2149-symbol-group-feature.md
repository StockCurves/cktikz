# Symbol Group & Ungroup — 設計訪談

## 背景

**使用者需求：** 選取畫布上複數元件 → 組成一個 Symbol → 存入自訂分類 → 從 Symbols 面板呼叫出來放置 → 可以再 Ungroup 回個別元件，行為與 Microsoft Visio 的自訂 Shape 功能一致。

**現有相關架構（已確認）：**

| 類別 / 方法 | 路徑 | 說明 |
|---|---|---|
| `GroupComponent` | `src/scripts/components/groupComponent.ts` | 已有 group/ungroup 邏輯，但只是臨時分組，不能存到 symbols |
| `SubcircuitComponent` | `src/scripts/components/subcircuitComponent.ts` | 繼承 GroupComponent，有 `toJson` / `fromJson` / `toTikzString` |
| `createSubcircuitFromSelection()` | `mainController.ts:2035` | 選取元件 → 用 `prompt()` 輸入名稱 → 存到 IndexedDB |
| `customCategories` / `customSymbols` | `mainController.ts:1619` | IndexedDB 的 `customCategories` + `customSymbols` 兩個 store |
| `loadAndRenderCustomCategories()` | `mainController.ts:1622` | 讀取 DB → 在左側 Offcanvas Accordion 渲染自訂分類與元件 |
| `addSymbolToCategory()` | `mainController.ts:1988` | 新增 symbol 到指定分類 |
| `ungroup()` | `groupComponent.ts:69` | 已實作：恢復個別元件、加入 undo |

---

## ✅ 使用者決策（2026-06-12）

| # | 問題 | 決定 | 說明 |
|---|---|---|---|
| Q1 | 觸發方式 | **A** | 沿用右鍵選單入口，UI 升級為 Modal |
| Q2 | Group 與 Save 的步驟 | **A** | 兩步：先 Group，再對 Group 右鍵「Save to Symbols」 |
| Q3 | Ungroup 行為 | **B** | 只在畫布上拆開，Symbol 定義保留（維持現有行為）|
| Q4 | 分類選擇 UI | **B** | Modal 對話框，名稱 + 分類一次設定 |
| Q5 | 重名處理 | **B** | 自動加後綴（`OP Amp (2)`） |
| Q6 | 放置行為 | **新需求** | 呼叫出 Symbol 後，貼著游標移動，**點左鍵後才置於畫布**（標準 ComponentPlacer 行為）|
| Q7 | TikZ 輸出 | **B** | 展開為所有子元件的 TikZ，不依賴 `\pic` |
| Q8 | 舊選單 | **C** | 改名為「Save Selection as Symbol...」 |

---

## 📐 技術規格（由決策推導）

### 完整使用流程
```
1. 選取多個元件
2. 右鍵 → Group（現有功能）
   → 畫布上變成一個 GroupComponent（可整體移動）
3. 對 GroupComponent 右鍵 →「Save Selection as Symbol..."
   → 彈出 Modal（新增）：
      - 輸入名稱（有重名時自動加後綴）
      - 選擇分類（Dropdown 列現有分類 + 「+ 新分類」）
   → 確認後：
      a. GroupComponent 轉換為 SubcircuitComponent（替換畫布上的物件）
      b. 存入 IndexedDB (customSymbols + customCategories)
      c. 重新渲染 Symbols 面板
4. 從 Symbols 面板點選 → 貼著游標 → 點左鍵放置（現有 ComponentPlacer 機制）
5. 放置的 SubcircuitComponent 可右鍵/屬性面板 Ungroup → 還原個別元件，Symbol 定義保留
```

### Q6 的重要澄清：座標儲存方式需改變

> [!WARNING]
> 目前 `SubcircuitComponent` 子元件用**絕對座標**儲存。從 Symbols 面板呼叫出來時，所有子元件都跑到原本畫布上的位置，而非跟著游標。
> **必須改成相對座標**（相對於 group 的 center）才能實現「貼著游標」。

這是唯一涉及資料結構的改動：
- `SubcircuitSaveObject` 的 `components` 改存**相對座標**
- `SubcircuitComponent.toJson()` / `fromJson()` 需對應修改
- `placeMove()` 根據游標計算實際位置
- **無需升版 IndexedDB schema**（舊資料在 fromJson 時做兼容處理）

### Q7 TikZ 展開方式
`SubcircuitComponent.toTikzString()` 改為直接呼叫每個子元件的 `toTikzString()` 並串接（類似現有 `GroupComponent.toTikzString()` 的做法）。

---

## Open Questions（需要你決定）

> [!WARNING]
> 以下是會影響資料結構的設計決策，一旦確定後，現有 IndexedDB 資料需要 migration：

1. **子元件的座標儲存方式**：目前是絕對座標（relative to canvas origin），改成相對於 group center 的相對座標會讓「放置到游標位置」更自然，但需要修改 `SubcircuitSaveObject` schema。

2. **GroupComponent vs SubcircuitComponent**：目前 `GroupComponent` 是「臨時分組」，`SubcircuitComponent` 是「可重用的 Symbol」。是否要統一為一個類別？還是維持兩個分工？

3. **IndexedDB schema 版本**：目前是 `v2`，如果改資料結構需要升版到 `v3` 並寫 migration。

---

## 現有程式流程圖

```
右鍵 canvas (有選取元件)
    └→ ContextMenu "建立子電路"
        └→ createSubcircuitFromSelection()
            ├→ prompt() 輸入名稱
            ├→ 序列化 selected components (toJson)
            ├→ 建立 customSymbolData
            └→ addSymbolToCategory()
                ├→ generateSubcircuitSvgPreview() [thumbnail]
                └→ IndexedDB: customSymbols.put() + customCategories 更新
                    └→ loadAndRenderCustomCategories() [重新渲染 Offcanvas]
```

```
從 Symbols 面板點選 SubcircuitComponent
    └→ SubcircuitComponent.fromJson(customSymbol.subcircuitData)
        └→ ComponentPlacer.instance.placeComponent(sub)
            └→ 放置到畫布 (保有 ungroup 按鈕)
```

---

## 備註

- **不破壞現有功能**：現有 `GroupComponent.group()` / `ungroup()` 邏輯不動。
- **最小改動範圍**：只動 `mainController.ts` + 可能加一個 Modal HTML。
- **Undo 支援**：存 Symbol 不需要 undo（DB 操作），但 ungroup 已有 `Undo.addState()`。
