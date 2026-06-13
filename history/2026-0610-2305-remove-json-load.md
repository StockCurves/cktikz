# 移除頂部存取按鍵與合併 TikZ 導出功能至側邊欄

這個設計方案旨在簡化頂部導覽列，並將 CircuiTikZ 代碼的導出與複製功能整合至左側的 TikZ Editor，避免彈出懸浮視窗，並徹底移除手動 JSON 存取功能及其快捷鍵。

## User Review Required

> [!IMPORTANT]
> 1. **移除頂部按鍵**：將移除頂部導覽列紅框內的「開啟 JSON」(Load) 與「儲存 JSON」(Save) 按鍵。
> 2. **完全移除手動 JSON 存取與快捷鍵**：除了移除 UI 按鍵外，將徹底移除 `Ctrl + O` 與 `Ctrl + S` 的鍵盤快捷鍵監聽器與手動載入/儲存 JSON 檔案的相關功能代碼。
> 3. **合併與移除懸浮視窗**：原本點擊綠框 `<>` (Export CircuiTikZ) 會跳出懸浮視窗 (modal) 以供複製和下載。現在此功能將合併至左側 TikZ Editor 面板的標題列（新增複製與下載按鍵），而原綠框 `<>` 按鍵將直接用作 Toggle 左側 TikZ Editor (效果同 `Ctrl + B` 或 `Cmd + B`，且修改其 hover tooltip 說明)。
> 4. **下載格式**：從左側 TikZ Editor 下載代碼時，將直接以設計名稱命名並下載為 `[DesignName].tikz` 檔案（若無名稱則為 `Circuit.tikz`），不再彈出選項視窗。
> 5. **快捷鍵移除**：移除原本的 `Ctrl+E` 導出快捷鍵。

## Proposed Changes

### UI 調整 (index.html)

#### [MODIFY] [index.html](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/pages/index.html)
- 移除 `loadButton` 與 `saveButton` 的 `<li>` 元素以清空紅框按鍵。
- 修改 `exportCircuiTikZButton` 的 tooltip，將其 `data-bs-title` 改為 `"Toggle TikZ Editor (Ctrl+B)"`。
- 在 `tikzEditorContainer` 的標題列中新增兩個按鍵：
  - `copyTikzCodeButton`：複製 TikZ 代碼到剪貼簿。
  - `saveTikzCodeButton`：下載 TikZ 代碼為 `.tikz` 檔案。

---

### 控制器邏輯 (TypeScript)

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)
- 移除 `saveButton` 與 `loadButton` 的 click 監聽器與 DOM 引用。
- 修改 `exportCircuiTikZButton` 的 click 事件監聽器，使其調用 `TikzEditorController.instance.toggleVisibility()`。
- 移除快捷鍵 `ctrl+o,command+o`、`ctrl+s,command+s`、`ctrl+e,command+e` 的監聽器與處理邏輯。

#### [MODIFY] [tikzEditorController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/tikzEditorController.ts)
- 引入 `FileSaver` 模組。
- 在 `TikzEditorController` 中獲取 `copyTikzCodeButton` 與 `saveTikzCodeButton` 元素並綁定事件監聽器。
  - 點擊「複製」：將 `editorTextArea.value` 寫入剪貼簿。
  - 點擊「下載」：使用 `FileSaver.saveAs` 將 TikZ 代碼保存為 `[DesignName].tikz`（若無名稱則為 `Circuit.tikz`）。

## Verification Plan

### Manual Verification
- 運行項目並在瀏覽器中確認：
  - 頂部導覽列中已無紅框內的 Load / Save 按鍵。
  - 點擊頂部綠框的 `<>` 按鍵可正常展開/收合左側 TikZ Editor 側邊欄。
  - 側邊欄上方新增了「複製」與「下載」按鍵，點擊「複製」可將 TikZ 代碼存入剪貼簿；點擊「下載」可直接下載 `.tikz` 檔案。
  - 快捷鍵 `Ctrl + B` 仍可正常切換側邊欄的顯示。
  - 快捷鍵 `Ctrl + O`、`Ctrl + S`、`Ctrl + E` 已被完全移除，不再有任何作用（可按下以確認不會載入/儲存檔案或彈窗）。
