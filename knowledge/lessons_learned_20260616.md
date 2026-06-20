# CircuiTikZ 編輯器與語法解析器優化 - Lessons Learned (2026-06-16)

## 簡介
這份文件詳細記錄了今晚到凌晨（2026-06-15 至 2026-06-16）我們針對 CircuiTikZ 編輯器的重構、雙向高亮功能、語法解析器優化，以及多語言與模板刪除等功能的實作心得。同時整理了如何利用 `/grill-me` 進行設計對齊、如何撰寫精準 Prompt 提升命中率，以及如何透過測試驅動開發 (TDD) 減少迭代次數的經驗總結。

---

## 一、 新增功能 (New Features)

### 1. TikZ 編輯器與畫布元件之雙向高亮 (Bidirectional Highlighting)
* **功能描述**：當使用者在畫布上點選元件（如電阻、電容、運算放大器等）時，TikZ 編輯器會對應高亮顯示該元件的 TikZ 程式碼行（以淺藍色背景 `highlight-blue` 呈現），反之亦然。這讓使用者能快速在圖形介面與代碼之間進行定位。
* **技術實現**：
  * 在產生 TikZ 程式碼的過程中（`TikzEditorController.updateEditorText()`），我們精確計算每個元件在最終輸出的 TikZ 字串中所佔用的起迄行號，並將其記錄在元件模型屬性 `CircuitComponent.tikzLines` 中。
  * 當 `SelectionController` 中的選取元件改變時，主動讀取選取元件的 `tikzLines`，並對 `contenteditable` 編輯器中的對應子行 `div` 加入高亮類別。

### 2. TikZ 編輯器 DOM 化與內容編輯器重構 (TextArea to Contenteditable Editor)
* **功能描述**：將原本的 `<textarea>` 編輯器重構為支援富文字的 `<div id="tikzEditorTextArea" contenteditable="true">`。
* **技術實現**：
  * TextArea 本身無法對特定行套用獨立的背景樣式或插入 DOM 節點。我們將每一行程式碼都對應為一個獨立的 `div` 子節點。
  * 實作了客製化的 `getEditorText` 與 `setEditorText` 函數，用於在純文字程式碼與 `contenteditable` 的 DOM Tree 之間進行無損的資料同步。

### 3. 語法檢查與 Inline 錯誤氣泡 (TikZ Linting with Inline Error Bubbles)
* **功能描述**：當使用者在編輯器中修改程式碼並點擊 "Apply" 後，若解析出錯，編輯器會自動在該出錯行程式碼的下方，動態插入一個紅色的錯誤提示氣泡。
* **技術實現**：
  * 重構 `parseTikz` 語法解析器，使其在遇到無法解析的 token 或語法錯誤時，能將錯誤發生的行號（`startLine`, `endLine`）傳出。
  * `applyEditorText` 在捕獲錯誤後，會直接定位到對應行數的子 `div`，並動態附加一個類別為 `error-msg`、屬性為 `contenteditable="false"` 的 `div` 氣泡，完美避免錯誤氣泡影響編輯器文字游標的編輯。

### 4. 編輯器頂部按鈕排版調整 (Layout Optimization)
* **功能描述**：將 TikZ 編輯器上方的 4 個主要按鈕（Apply、Copy、Save、Save to Server）從原本的頂部右側，移至編輯器標題的下方。
* **技術實現**：
  * 原先的排版在使用者將瀏覽器視窗寬度縮窄時，會因為寬度不足導致按鈕發生重疊、溢出 (Layout Overflow) 的視覺問題。
  * 將按鈕移至標題下方，提供足夠的水平延展空間，顯著改善小螢幕或分螢幕開發時的 UX 體驗。

### 5. 模板管理強化與國際化 (Works Deletion & Internationalization)
* **功能描述**：支援刪除個人已儲存的設計作品 (work)；完成 "Save to Server" 視窗之英文化翻譯。
* **技術實現**：
  * 在範本下拉選單的 "work" 類別檔案中，註冊滑鼠右鍵點擊事件（Context Menu），彈出刪除選項並連結後端 API 刪除檔案，提升使用者管理雲端設計檔的便利性。

---

## 二、 關鍵問題、成因與解決方案 (Issues, What Happened, How We Solved It, How to Avoid It)

### 1. 複雜範本載入導致的語法解析器當機問題 (Parser Crash on Normal TikZ Code)
* **What Happened**：
  * 原本的 `parseTikz` 解析器有一條硬性規則：每一個 `\draw` 指令必須至少包含兩個座標點，否則視為無效語法並拋出錯誤。
  * 然而，許多標準範本（如運算放大器 `opamp`、濾波器 `shallen-key` 等）含有類似 `\draw (0,0) node[ground] {};` 或 `\draw (5,2.5) node[op amp] (OA) {};` 這種只包含單個座標但放置了 node 的語法，這在 TikZ 中是完全合法的，但在原解析器中卻會觸發 crash。
  * 同時，像 `to[L=$L_F$]` 這類使用簡寫（如 `L` 代表 `american inductor`, `R` 代表 `american resistor`, `C` 代表 `capacitor` 等）的元件，在 `user-complex` 範本中因為沒有被對應到 symbol，也會導致解析失敗。
* **How We Solved It**：
  * 修改 `parseTikz` 的座標計數驗證邏輯：僅當 `\draw` 內容中確實包含連接線語法時（透過 RegExp 偵測 `to`、`--`、`-|`、`|-`），才強制限制座標數量必須 $\ge 2$；若是單點 node 放置則予以放行。
  * 在 `tikzParser.ts` 中引入元件名稱映射表 `TIKZ_NAME_MAP`，確保能將 `L`、`R`、`C` 等簡寫無縫對應到標準的 Symbol ID，並新增 `cleanTikzText` 函數清理標籤的數學符號（如去除字串前後的 `$`）。
* **How to Avoid It**：
  * 設計語法解析器時應保持「鬆弛檢查 (lint relaxation)」的原則，避免過度嚴格的規則導致正常邊界語法無法通過。必須準備包含各種複雜範本的語法測試案例，確保語法解析器的魯棒性。

### 2. Apply 程式碼更新時，最後一行代碼遺失問題 (Code Loss Issue on Apply)
* **What Happened**：
  * 在將編輯器改為 `contenteditable` 後，我們需要自行透過 DOM 結構解析出純文字（`getEditorText`）以供 parser 使用，並將純文字轉換為 HTML 顯示（`setEditorText`）。
  * 若我們直接使用瀏覽器的 `.innerText` 或節點巡檢實作不夠精確，容易在遇到行尾或空行 `div` 內含 `<br>` 的情況時漏掉換行符（如末尾行字元被吞掉），導致使用者每次點選 Apply，程式碼最後一行就會被意外刪除。
* **How We Solved It**：
  * 實作了強健且可預測的 `getEditorText` 函數：精確遍歷 `editorTextArea` 的 `childNodes`。當節點為 `DIV` 時，進一步過濾掉帶有 `.error-msg` 的子節點（以避免把錯誤訊息也當作程式碼讀入），僅拼接真實的文字內容，最後用 `\n` 合併。
  * 在 `setEditorText` 中，精確將文字以 `\n` 分割，每一行建立一個 `div`；如果是空行則補上 `<br>`，確保 DOM 的對應百分之百對稱。
* **How to Avoid It**：
  * 對於 `contenteditable` 的富文字編輯器，不可直接依賴瀏覽器大雜燴的 `.innerText` 或 `.innerHTML` 來代表程式碼字串。必須依賴嚴格的 DOM tree 結構遍歷與過濾，並編寫單元測試驗證字串還原的等價性（Idempotency）。

---

## 三、 如何利用 `/grill-me` 進行設計對齊 (How to /grill-me to Get Things Done the First Time)

在進行中大型功能開發時，常因需求模糊或設計細節未對齊而產生多次來回迭代，浪費 Token 與時間。`/grill-me` 是一個引導式的互動訪談命令，能有效在開發前釐清所有細節。

### 運作模式
在我們開始寫扣前，主動發起 `/grill-me`。AI 會針對目前需求列出 3-5 個影響架構、UI 或資料流的關鍵決策（Design Decisions），並與使用者進行問答對齊。

### 訪談重點
1. **UI/UX 互動細節**：例如：高亮程式碼行是要整行變色還是只要文字變色？錯誤訊息是在編輯器下方顯示，還是像這次實作為行內泡泡 (inline error bubbles)？
2. **資料結構與邊界條件**：例如：編輯器語法解析失敗時，畫布上的元件是要全部清空、保留原樣，還是還原？元件的行數該如何與編輯器中的 DOM 動態連動？
3. **自動產出實作計畫**：訪談結束後，AI 會自動將對齊後的結論整理成 `implementation_plan.md`，並存到專案的 `./history/YYYY-MMDD-HHMM-<topic>.md`。此時雙方已達成共識，能確保一次實作到位，避免重複修改。

---

## 四、 如何撰寫 Prompt 提升 AI 命中率 (How to Prompt to Increase Hit Rate)

為了讓 AI 能在第一時間寫出完全符合預期的程式碼，下 Prompt 時建議遵循以下原則：

1. **精確指定檔案路徑與變數 Symbol**：
   * ❌ *壞 Prompt*："改一下那個畫布元件的選取邏輯，讓它能跟編輯器同步高亮。"
   *  *好 Prompt*："修改 `src/scripts/controllers/tikzEditorController.ts` 中的 `highlightSelectedComponents`，當 `SelectionController.instance.currentlySelectedComponents` 改變時，對應高亮編輯器中對應行號的 `div` 子節點。"
2. **具體說明 DOM 結構與 CSS 樣式名稱**：
   * ❌ *壞 Prompt*："在錯的那行下面顯示錯誤訊息，樣式弄好看一點。"
   *  *好 Prompt*："錯誤的程式碼行加上 `highlight-red`，並在其下方插入一個帶有 `error-msg` class 的 div，內容設定為 `contenteditable="false"`，背景色為淡紅，以氣泡形式呈現。"
3. **明確定義行為規則與 Fallback 機制**：
   * ❌ *壞 Prompt*："如果 Apply 失敗了，報錯就好。"
   *  *好 Prompt*："點選 Apply 時，如果 `parseTikz` 拋出錯誤，不可呼叫 `MainController.instance.removeComponent`，也不可更新 Undo 歷史，必須直接標記錯誤行並顯示 bubble。"
4. **小步迭代與任務拆解**：
   * 避免在一個 Prompt 中塞入過多不相關的變更。建議先解決 Parser 機制，再處理編輯器 DOM 重構，最後調整樣式，這能讓 AI 的注意力高度集中，進一步提升程式碼品質。

---

## 五、 測試驅動開發 (TDD) 對減少迭代的助益 (How TDD Reduces Iteration Times)

在本專案的語法解析器優化過程中，TDD（測試驅動開發）發揮了極大的作用，將每次修改後的驗證時間縮短至毫秒級，並保障了程式碼品質。

### 1. 前端依賴的 Mock 化 (Mocking Frontend Dependencies)
* 我們的 `parseTikz` 雖然運行在前端且使用到了 SVG.js 或其他 DOM 元件，但透過 Vitest 建立 Mock（例如 Mock `MainController`, `Point`, `svg.js` 等），能讓我們在無瀏覽器的 Node.js 環境下直接執行單元測試（`npm run test`）。這使得我們能以極快速度驗證代碼。

### 2. 建立 Regression 測試保護網
* 當我們為了解析 `opamp` 範本修改了語法解析邏輯，如果沒有 TDD，很有可能會在不知不覺中弄壞了原本能正常解析的 `user-complex` 元件簡寫。
* **TDD 實踐流程**：
  1. 當收到 bug 回報（例如：某特定語法會報錯），先在 `tests/tikzParser.test.ts` 中寫入該語句的 `expect(() => parseTikz(code)).not.toThrow()`。
  2. 執行測試，此時該測試會 fail。
  3. 修改 `tikzParser.ts` 代碼以修復 Bug。
  4. 重新執行測試，確保新測試通過，且舊的測試案例（如 wire, path, R, L, C 簡寫等）維持 green 狀態。

### 3. 等價性測試 (Idempotency Testing)
* 針對 `getEditorText` 與 `setEditorText` 撰寫等價性測試：
  * `expect(getEditorText(setEditorText(mockDiv, originalCode))).toBe(originalCode)`。
  * 這確保了不論經過幾次寫入與讀取，程式碼內容都不會遺失任何字元。如此一來便能從根本上消滅點擊 Apply 卻遺失程式碼的 bug，完全不需要在瀏覽器中手動狂按按鈕測試。
