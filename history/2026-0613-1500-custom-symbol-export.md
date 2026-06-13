# 解決自訂符號（複製元件）在 TikZ 導出中缺少定義的問題

## 1. 說明
當使用者在 CircuiTikZ-Designer 中複製原生元件並更名（例如複製 `nmos` 為自訂符號 `hvnmos`）後，在畫布上放置它時，導出的 TikZ 程式碼中會生成 `\node[hvnmos]`。但由於 LaTeX/CircuiTikZ 中並沒有內建 `hvnmos` 元件，且導出的 TikZ 程式碼開頭沒有提供 `hvnmos` 的定義，這會導致 LaTeX 無法編譯。

此計畫的目的在於：
1. 在複製符號時，記錄其基底元件（`baseSymbol`，例如 `nmos`）。
2. 在匯出 TikZ 程式碼或使用 TikZ 編輯器時，動態生成自訂符號的 TikZ style 定義（例如 `hvnmos/.style={nmos}`），並附加至最上方的 `\tikzset` 區塊中。
3. 這樣既能保證導出的 TikZ 程式碼在 LaTeX 中可以直接成功編譯，又能維持原有的雙向匯入/匯出相容性。

## 2. 變更方案

### [MainController](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)

#### [MODIFY] [mainController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/mainController.ts)
1. 在 `duplicateSymbol()` 儲存自訂符號資料至 IndexedDB 時，在 `customSymbolData` 物件中新增 `baseSymbol` 屬性，記錄原生的 `originalSymbol.tikzName`。
2. 新增 `getCustomSymbolsTikzset()` 函式，遍歷畫布上已使用的自訂符號（即 `comp.referenceSymbol.isCustomSymbol` 為 `true` 的元件），為其生成 LaTeX `\tikzset` style 對映：
   - 如果是 node 符號，生成 `customName/.style={baseSymbol}`。
   - 如果是 path 符號，生成 `customName/.style={baseSymbol}`。
   - 舊的、未記錄 `baseSymbol` 的自訂符號，將透過名稱 Guessing Fallback 猜測基底（例如名稱包含 `pmos` 則設為 `pmos`，否則預設為 `nmos` / `resistor`）。

---

### [TikzEditorController](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/tikzEditorController.ts)

#### [MODIFY] [tikzEditorController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/tikzEditorController.ts)
1. 在 `updateEditorText()` 生成 TikZ 程式碼陣列時，呼叫 `MainController.instance.getCustomSymbolsTikzset()`。
2. 若有生成的自訂符號 tikzset，將其與 `subcircuitsTikzset` 一起合併置於陣列開頭。

---

### [ExportController](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/exportController.ts)

#### [MODIFY] [exportController.ts](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/exportController.ts)
1. 在 `exportCircuiTikZ()` 生成 TikZ 程式碼時，做與 `TikzEditorController` 相同的修改，將 `customSymbolsTikzset` 的定義合併置於 TikZ 程式碼的開頭。

---

## 3. 驗證計劃
1. 啟動本機開發伺服器，並放置自訂的複製元件（如 `hvnmos`）至畫布上。
2. 開啟右側 TikZ 編輯器面板，確認產生的 TikZ 程式碼開頭包含：
   ```latex
   \tikzset{
       hvnmos/.style={nmos}
   }
   ```
   且畫布元件程式碼中正確生成 `\node[hvnmos] at ...;`。
3. 使用匯出（Export）選單匯出 TikZ 程式碼，確認輸出的檔案亦包含此定義。
4. 測試雙向套用（Apply）功能，修改 TikZ 程式碼後點擊 Apply，確認能正確重新在畫布上渲染出自訂元件。
