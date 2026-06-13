# Circuit3Tikz 設計系統與品牌指南 (Brand Guidelines)

這份文件定義了 **Circuit3Tikz**（Premium Academic GUI Designer）的視覺風格、配色系統、字型排版、陰影階層以及常用 UI 元件的規範，旨在提供其他專案在進行 UI/UX 修改或全新開發時，有一套可依循的高級、現代化設計系統。

---

## 1. 品牌視覺風格 (Design Aesthetics)

*   **核心風格定位**：**Premium Academic Light Theme** (高級學術亮色主題)
*   **設計哲學**：融合了學術的嚴謹感與現代化 Web 的微互動、毛玻璃擬物化 (Glassmorphic) 效果。介面清爽、層級分明，並且透過精心設計的陰影與彈性動畫，為使用者帶來極具質感的視覺反饋。
*   **關鍵美學特徵**：
    *   **和諧的 HSL 色調**：不使用高飽和度的純色，而是使用經過調和、帶有灰藍質感的 HSL 色彩，減輕長時間工作的視覺疲勞。
    *   **無縫的微互動**：所有按鈕、卡片與輸入控制項在 Hover 或 Active 時都具有平滑的位移或縮放反饋。
    *   **精準的物理動畫**：彈窗與面板使用 `cubic-bezier(0.16, 1, 0.3, 1)`（超平滑物理曲線）進行過場，使得介面感覺富有彈性且反應靈敏。

---

## 2. 配色系統 (Color Palette)

本設計系統基於 HSL (Hue, Saturation, Lightness) 模型進行配色，確保色彩的層次感與一致性。

```css
:root {
  /* HSL Tailored Academic Light Theme */
  --primary-h: 215;
  --primary-s: 90%;
  --primary-l: 52%;
  
  /* Primary & Accent Colors */
  --primary: hsl(var(--primary-h), var(--primary-s), var(--primary-l)); /* #1E70E6 */
  --primary-hover: hsl(var(--primary-h), var(--primary-s), calc(var(--primary-l) - 8%));
  --primary-light: hsl(var(--primary-h), var(--primary-s), 95%);
  
  /* Status / Feedback Colors */
  --success: hsl(142, 70%, 45%);
  --danger: hsl(350, 80%, 55%);
  --warning: hsl(38, 92%, 50%);
  
  /* Background Colors */
  --bg-app: hsl(210, 20%, 98%);     /* App整體底色，偏灰藍 */
  --bg-panel: hsl(0, 0%, 100%);     /* 面板與卡片背景，純白 */
  --bg-editor: hsl(210, 25%, 99%);  /* 編輯器程式碼區域，極淡灰藍 */
  
  /* Typography Colors */
  --text-main: hsl(210, 30%, 15%);   /* 主文字，深藍黑 */
  --text-muted: hsl(210, 15%, 45%);  /* 次要文字/說明，中灰藍 */
  --text-light: hsl(210, 10%, 70%);  /* 極淡文字/Placeholder/停用狀態 */
  
  /* Border Colors */
  --border-color: hsl(210, 14%, 90%);
  --border-focus: var(--primary);
}
```

### 色彩使用規範
1.  **Primary (主色)**：用於關鍵動作（Save, Submit）、當前選取狀態（Active Tab, Active Accordion Header）、焦點指示器。
2.  **Primary Light (主要淡色)**：用於選項卡 Hover 效果、選取狀態的背景微調、輸入框 Focus 時的呼吸外光暈（Ring）。
3.  **Success / Danger / Warning**：
    *   `--success` 用於狀態同步成功、編譯成功等正面提示。
    *   `--danger` 用於刪除、危險操作、編譯錯誤面板，以及進入編輯模式（如 Pin Mode）時的強力警示。
    *   `--warning` 用於未同步提示、警告標籤等。

---

## 3. 字型與排版系統 (Typography)

本系統採用 Google Fonts 引入的現代化字型，建立清晰的閱讀階層。

```html
<!-- 引入字型 -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

*   **UI/文字字型 (Sans-serif)**：
    `--font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;`
    用於介面標題、按鈕、選單、標籤等。
*   **代碼/數值字型 (Monospace)**：
    `--font-mono: 'JetBrains Mono', 'Fira Code', monospace;`
    用於 LaTeX 代碼編輯器、快速鍵提示、坐標與引腳名稱、數值輸入框等。

### 字級與字重規範 (Hierarchy)
*   **Logo 標題**：`font-size: 20px`, `font-weight: 700`, `letter-spacing: -0.5px`
*   **彈窗與次標題**：`font-size: 16px`, `font-weight: 700`
*   **面板標題 (Panel Title)**：`font-size: 15px`, `font-weight: 600`, `letter-spacing: -0.2px`
*   **標準 UI 字體/按鈕字體**：`font-size: 14px`, `font-weight: 600`
*   **屬性面板標籤/輔助說明**：`font-size: 12px` 或 `13px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.5px`, 搭配 `color: var(--text-muted)`
*   **輔助 Badge / 鍵盤 Key (KBD)**：`font-size: 11px`, `font-weight: 600`
*   **編輯器主代碼**：`font-size: 14px`, `line-height: 1.6`

---

## 4. 陰影與深度系統 (Shadows & Elevation)

透過三層陰影系統定義元件在 Z 軸上的高度層級，營造優雅的深度感：

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
/* 用於一般按鈕、微型控制項、緊貼背景的卡片 */

--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02);
/* 用於懸停狀態的卡片、下拉選單、加載 Spinner 等微懸浮物件 */

--shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04);
/* 用於右鍵上下文選單 (Context Menu)、屬性面板、側邊懸浮面板、快顯 Toast、互動彈窗 (Modal) */
```

---

## 5. 佈局與邊界 (Layout & Spacing)

*   **頂部導覽列 (Header)**：高度為 `64px` (`--header-height: 64px`)，底部具 `1px` 邊框與 `var(--shadow-sm)`。
*   **工作區左右分割線 (Workspace Splitter Resizer)**：
    *   寬度 `4px`，滑鼠懸停 (Hover) 或正在拖曳 (Resizing) 時擴張為 `6px`，並將背景色變更為 `--primary`。
    *   拖曳時會加上 `.resizing-active` class 到 `body`，強制執行 `user-select: none`，確保拖曳過程不選取任何文字。
    *   內部具有拖曳指示條 (`::after`)：寬度 `2px`，高度從 `24px` 平滑增長至 `36px`，底色為 `--text-light`。
*   **固定面板 (Floating Panels)**：
    *   不直接使用擠壓式側欄，而是採用四邊懸浮卡片設計（間距一律為 `20px`，如 `top: 20px; right: 20px;`）。

---

## 6. 微互動與動畫效果 (Micro-interactions & Animations)

```css
/* 1. 標準平滑微互動過場 */
transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

/* 2. 物理效果滑入動畫（適用於側邊浮動面板） */
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 3. 物理效果彈出動畫（適用於對話框） */
@keyframes slideUpModal {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 4. 快顯 Toast 彈簧動畫（Spring physics feel） */
transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
```

---

## 7. 典型 UI 元件範例 (Component Specifications)

### 7.1. 按鈕 (Buttons)
按鈕採用高對比且簡潔的圓角設計，並在 Hover 時有微小向上的浮動位移 (`translateY(-1px)`)。

```html
<!-- Primary Button -->
<button class="btn btn-primary">Save Changes</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Outline Button -->
<button class="btn btn-outline">🧩 New Symbol</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete Element</button>

<!-- Small Button -->
<button class="btn btn-sm btn-outline">Flip H</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}
.btn-primary {
  background-color: var(--primary);
  color: white;
}
.btn-primary:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
}
.btn-secondary {
  background-color: var(--bg-app);
  color: var(--text-main);
  border-color: var(--border-color);
}
.btn-secondary:hover {
  background-color: var(--border-color);
  transform: translateY(-1px);
}
.btn-outline {
  background-color: transparent;
  color: var(--text-main);
  border-color: var(--border-color);
}
.btn-outline:hover {
  background-color: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}
.btn-danger {
  background-color: var(--danger);
  color: white;
}
.btn-danger:hover {
  background-color: hsl(350, 80%, 45%);
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
}
```

### 7.2. 表單輸入框與下拉選單 (Inputs & Selects)
注重焦點狀態的呈現，Focus 時外圈會有顯著的藍色呼吸環。

```html
<div class="form-group">
  <label for="input-demo">Filename:</label>
  <input type="text" id="input-demo" placeholder="my-circuit.tex" />
</div>
```

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.form-group input[type="text"],
.form-group select {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background-color: var(--bg-app);
  color: var(--text-main);
}
.form-group input[type="text"]:focus,
.form-group select:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--primary-light);
  background-color: var(--bg-panel);
}
```

### 7.3. 選項卡 (Tabs)
選項卡具有極簡下劃線的 Active 指示器。

```html
<div class="tab-header">
  <button class="tab-btn active">🎨 Visual Editor</button>
  <button class="tab-btn">🔬 Live LaTeX Render</button>
</div>
```

```css
.tab-header {
  height: 52px;
  background-color: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
}
.tab-btn {
  background: none;
  border: none;
  padding: 15px 20px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
  outline: none;
}
.tab-btn:hover {
  color: var(--text-main);
}
.tab-btn.active {
  color: var(--primary);
}
.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--primary);
  border-radius: 3px 3px 0 0;
}
```

### 7.4. 手風琴折疊面板 (Accordions)
用於組織長列表（如符號庫類別），Active 時 Chevron 箭頭轉向且文字著色。

```html
<div class="category-accordion active">
  <button class="accordion-header">
    <span class="accordion-title">Logic Gates</span>
    <span class="accordion-chevron">▼</span>
  </button>
  <div class="accordion-content">
    <!-- Content goes here -->
  </div>
</div>
```

```css
.category-accordion {
  border-bottom: 1px solid var(--border-color);
}
.accordion-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: none;
  border: none;
  cursor: pointer;
}
.accordion-header:hover {
  background-color: hsl(210, 20%, 97%);
}
.category-accordion.active .accordion-header {
  background-color: var(--primary-light);
}
.category-accordion.active .accordion-title {
  color: var(--primary);
}
.accordion-chevron {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
}
.category-accordion.active .accordion-chevron {
  transform: rotate(180deg);
  color: var(--primary);
}
.accordion-content {
  display: none;
  padding: 0 20px 12px 20px;
  background-color: white;
}
.category-accordion.active .accordion-content {
  display: block;
}
```

### 7.5. 快顯訊息 (Toasts)
Toast 訊息彈出時應具有彈性物理效果，適合快速通知。

```html
<div class="toast show" role="alert">📋 LaTeX code copied to clipboard!</div>
```

```css
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translate(-50%, 40px);
  background-color: var(--text-main);
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-lg);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
  z-index: 9999;
}
.toast.show {
  transform: translate(-50%, 0);
  opacity: 1;
}
```

### 7.6. 毛玻璃懸浮面板 (Glassmorphic Panels)
適合用於畫布上的浮動控制台，藉由高模糊背景與半透明邊框融合於畫面。

```html
<div class="symbol-panel">
  <div class="symbol-panel-header">
    <span class="symbol-panel-title">Symbols</span>
    <button class="close-symbols">×</button>
  </div>
  <!-- Body... -->
</div>
```

```css
.symbol-panel {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 20px;
  width: 320px;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 7.7. 互動對話框 (Modals)
使用毛玻璃 Overlay 遮罩與頂級對話框盒模型，具備清晰的層次感與彈出動畫。

```html
<div class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <span class="modal-title">Save Circuit</span>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Form elements... -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: hsla(210, 30%, 15%, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeInOverlay 0.2s ease-out;
}
.modal-box {
  background-color: var(--bg-panel);
  border-radius: 16px;
  width: 90%;
  max-width: 440px;
  box-shadow: var(--shadow-lg), 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  overflow: hidden;
  animation: slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background-color: var(--bg-app);
}
```
