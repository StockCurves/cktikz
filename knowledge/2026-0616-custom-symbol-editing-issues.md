# 經驗教訓：自訂符號編輯與 SVG DOM 操作

## 背景
在 CircuiTikZ Designer 中，使用者可以複製標準元件（例如 `nmos`、`pmos`），建立自己的自訂分類與符號（例如 `hvnmos`、`hvpmos`）。建立自訂符號後，使用者會在 Symbol Editor 中修改其視覺外觀。然而，要讓這些自訂視覺設計在所有元件變體（options）之間都能正確同步，同時仍保持可編輯性，實務上出現了幾個關鍵挑戰。

這份文件作為開發者參考，用來避免在操作與解析 SVG DOM 節點時再次踩到類似陷阱，特別是當問題涉及 SVG 樣式繼承、複合路徑，以及深層 DOM diff 時。

---

## 1. 變體同步與深層葉節點 Diff
**問題：**
當使用者對自訂符號套用 options（例如對 `hvnmos` 切換 `arrowmos` 選項）時，符號的視覺外觀會退回到原始基底元件的樣子（也就是預設 `nmos` 的外觀），完全覆蓋掉使用者原本的自訂編輯。

**根本原因：**
系統原本嘗試用淺層 diff 來抽取「option 裝飾元素」（例如箭頭）。它比較的是原始 base variant 與選定 variant 之間第一層子節點的 outer HTML；但那些節點其實只是 `<g>`。由於 variant 的 `<g>` 內多了箭頭 path，整個 `<g>` 字串就被判定為「不同」，並被當成 decorator 疊加到使用者已編輯的元素之上，結果等同於覆蓋或遮住了使用者的修改。

**解法：**
實作 **深層葉節點 Diff（Deep Leaf-Node Diffing）**。不要比較群組節點（`<g>`），而是沿著 SVG 樹往下走，直到葉節點幾何元素（例如 `<path>`、`<rect>`）為止。接著比較原始 base variant 與選定 variant 中這些葉節點經標準化後的 `outerHTML`。凡是在 variant 中獨有的葉節點，都會被抽取成 decorator，並安全地組合回使用者自訂的 `<g>` 結構中。

---

## 2. SVG 預設樣式判定（隱形線條與黑點）
**問題：**
當開啟一個複製出來的 `pmos` 符號進行編輯時，線條會消失，而 gate 上的圓圈會顯示成實心黑點。

**根本原因：**
在扁平化巢狀 `<g>` 元素時，系統原本透過 `SVG.js` 的 `el.attr("stroke")` 嘗試把父層群組的 `stroke` 與 `fill` 樣式手動繼承到子層葉節點。
但如果某個 `<path>` 沒有明確寫出 `stroke` 屬性，SVG 的預設計算值其實是 `"none"`。因此 `el.attr("stroke")` 會回傳 `"none"`。而條件 `if (!el.attr("stroke"))` 會變成 `!"none"`，也就是 `false`，導致程式**跳過**從父層繼承 `stroke="#000"`。
同樣地，SVG 的預設 `fill` 是 `#000000`（黑色）。gate 的圓圈 path 沒有 `fill` 屬性，因此 `el.attr("fill")` 會回傳 `#000000`，最後它就變成實心黑點，而不是繼承 `"none"`。

**解法：**
檢查屬性是否**明確存在**時，一律使用原生 DOM 方法，而不是依賴可能回傳「計算後預設值」的函式庫 API。
將 `!el.attr("stroke")` 改成 `!el.node.hasAttribute("stroke")`，並搭配 `el.node.hasAttribute("fill")`。這樣才能確保樣式繼承完全依照原始 SVG XML 的定義進行。

---

## 3. 複合 Path 拆分（可獨立選取線段）
**問題：**
當編輯複製出來的 `pmos` 或 `hvnmos` 時，使用者想移動其中一條垂直線（例如 gate line），卻發現多條線會一起移動，因為它們被視為同一個物件。

**根本原因：**
CircuiTikZ 的元件圖形高度最佳化，常會把多段彼此不相連的子路徑合併進同一個 `<path>`，並使用相對與絕對的 Move 指令（`M` 與 `m`），例如：`<path d="M19.05 15.08 v29.1 m-4.44 -24.7 v20.3"/>`。編輯器把這整個 DOM 節點當成一個不可分割的單一 SVG 元素。

**解法：**
在符號扁平化階段（`open()` 時），對於沒有 fill 的複合 path（`fill="none"`）進行拆分，分成多個獨立 `<path>` 節點。
這裡使用 `new SVG.PathArray(pathStr)`，它會自動把所有相對指令（例如 `m`、`v`、`h`）正規化成絕對指令。接著在每次遇到 `M`（MoveTo）時，把正規化後的陣列切成多個子陣列。最後將每個子陣列重新渲染成獨立的 `<path>` DOM 元素，讓使用者可以分別選取、編輯與移動各條線段。

---

## 4. DOMParser 支援的 MimeType 拼字錯誤
**問題：**
儲存自訂符號時發生 runtime error：`Failed to execute 'parseFromString' on 'DOMParser': The provided value 'image/xml+xml' is not a valid enum`。

**根本原因：**
傳給 `DOMParser` 的 MIME type 不合法（`image/xml+xml`）。

**解法：**
在解析自訂元件 XML 定義時，統一改用 `"text/xml"`。`DOMParser` 對 MIME type 很嚴格，只接受支援清單中的值：`text/html`、`text/xml`、`application/xml`、`application/xhtml+xml`、`image/svg+xml`。
