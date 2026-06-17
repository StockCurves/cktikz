# Right-Click Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all native prompt/confirm dialogs triggered by right-click menu actions with Bootstrap 5 modals styled consistently and displaying English text.

**Architecture:** We will declare `#customPromptModal` and `#customConfirmModal` markup in the index.html. `MainController` will expose helper methods returning Promises that resolve when users confirm or dismiss these Bootstrap modals. Other controllers will invoke these methods asynchronously via the singleton instance `MainController.instance`.

**Tech Stack:** TypeScript, HTML, Bootstrap 5 Modals

---

### Task 1: Update HTML Modals in `src/pages/index.html`

**Files:**
- Modify: `src/pages/index.html`

- [ ] **Step 1: Translate `#renameModal` to English and add `#customPromptModal` and `#customConfirmModal`**

Make the following modifications:
- Translate `#renameModal` title to "Rename", buttons to "Cancel" and "Confirm", and placeholder to "Enter new name".
- Add `#customPromptModal` and `#customConfirmModal` below `#renameModal`.

```html
		<!-- Modal (rename dialog) -->
		<div class="modal fade" id="renameModal" tabindex="-1"
		     aria-labelledby="renameModalLabel" aria-hidden="true" role="dialog">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title fs-5" id="renameModalLabel">Rename</h1>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<input type="text" class="form-control" id="renameModalInput" placeholder="Enter new name" />
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
						<button type="button" class="btn btn-primary" id="renameModalConfirm">Confirm</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Modal (custom prompt dialog) -->
		<div class="modal fade" id="customPromptModal" tabindex="-1"
		     aria-labelledby="customPromptModalLabel" aria-hidden="true" role="dialog">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title fs-5" id="customPromptModalLabel">Input Required</h1>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<p id="customPromptModalMessage" class="mb-2"></p>
						<input type="text" class="form-control" id="customPromptModalInput" placeholder="Enter value" />
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
						<button type="button" class="btn btn-primary" id="customPromptModalConfirm">OK</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Modal (custom confirm dialog) -->
		<div class="modal fade" id="customConfirmModal" tabindex="-1"
		     aria-labelledby="customConfirmModalLabel" aria-hidden="true" role="dialog">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title fs-5" id="customConfirmModalLabel">Confirm Action</h1>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<p id="customConfirmModalMessage" class="mb-0"></p>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
						<button type="button" class="btn btn-primary" id="customConfirmModalConfirm">Confirm</button>
					</div>
				</div>
			</div>
		</div>
```

---

### Task 2: Implement Promise-based Modal Helpers in `MainController`

**Files:**
- Modify: `src/scripts/controllers/mainController.ts`

- [ ] **Step 1: Implement `openPrompt` and `openConfirm` methods**

Add the following methods to `MainController`:

```typescript
	public openPrompt(title: string, message: string, defaultValue = ""): Promise<string | null> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("customPromptModal") as HTMLDivElement
			const input = document.getElementById("customPromptModalInput") as HTMLInputElement
			const label = document.getElementById("customPromptModalLabel") as HTMLElement
			const messageEl = document.getElementById("customPromptModalMessage") as HTMLElement
			const confirmBtn = document.getElementById("customPromptModalConfirm") as HTMLButtonElement

			label.innerText = title
			messageEl.innerText = message
			input.value = defaultValue

			const bsModal = new Modal(modalEl)

			const onConfirm = () => {
				const val = input.value.trim()
				cleanup()
				resolve(val)
			}

			const onDismiss = () => {
				cleanup()
				resolve(null)
			}

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
				input.removeEventListener("keydown", onKeyDown)
				bsModal.hide()
			}

			confirmBtn.addEventListener("click", onConfirm)
			
			const onKeyDown = (ev: KeyboardEvent) => {
				if (ev.key === "Enter") onConfirm()
			}
			input.addEventListener("keydown", onKeyDown)

			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })
			modalEl.addEventListener("shown.bs.modal", () => { input.focus(); input.select() }, { once: true })
			bsModal.show()
		})
	}

	public openConfirm(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("customConfirmModal") as HTMLDivElement
			const label = document.getElementById("customConfirmModalLabel") as HTMLElement
			const messageEl = document.getElementById("customConfirmModalMessage") as HTMLElement
			const confirmBtn = document.getElementById("customConfirmModalConfirm") as HTMLButtonElement

			label.innerText = title
			messageEl.innerText = message

			const bsModal = new Modal(modalEl)

			let isConfirmed = false

			const onConfirm = () => {
				isConfirmed = true
				cleanup()
				resolve(true)
			}

			const onDismiss = () => {
				cleanup()
				resolve(isConfirmed)
			}

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
				bsModal.hide()
			}

			confirmBtn.addEventListener("click", onConfirm)

			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })
			bsModal.show()
		})
	}
```

---

### Task 3: Replace dialogs in `MainController` right-click handlers

**Files:**
- Modify: `src/scripts/controllers/mainController.ts`

- [ ] **Step 1: Update `addCategoryButton` event listener**

Replace:
```typescript
		document.getElementById("addCategoryButton").addEventListener("click", () => {
			const name = prompt("請輸入自訂分類名稱：")
			if (name) {
				this.addCustomCategory(name)
			}
		})
```
with:
```typescript
		document.getElementById("addCategoryButton").addEventListener("click", async () => {
			const name = await this.openPrompt("New Category", "Please enter a custom category name:")
			if (name) {
				this.addCustomCategory(name)
			}
		})
```

- [ ] **Step 2: Update `addButton` (Custom Symbol Right-click Context Menu) logic around line 1400**

Modify the `"contextmenu"` event handler for `addButton` inside `initAddComponentOffcanvas`:
1. Use `this.openPrompt` for checking custom categories if none exist:
   ```typescript
   const name = await this.openPrompt("Create Category", "You don't have any custom categories. Please enter a name to create one:")
   ```
2. Update the `rename` action's call to use English:
   ```typescript
   const newName = await this.openRenameModal("Rename Custom Symbol", symbol.tikzName)
   ```
3. Use `this.openConfirm` for `delete` action:
   ```typescript
   if (await this.openConfirm("Delete Symbol", `Are you sure you want to delete custom symbol "${symbol.tikzName}"?\n(Components already placed on the canvas will not be affected)`)) {
       this.deleteCustomGraphicsSymbol(symbol.tikzName)
   }
   ```
4. Use `this.openPrompt` for `new` action:
   ```typescript
   const name = await this.openPrompt("New Category", "Please enter a custom category name:")
   ```
5. Use `this.openPrompt` for `duplicate` action (both name and category prompts):
   ```typescript
   const newName = await this.openPrompt("Duplicate Symbol", "Please enter a name for the new custom symbol (e.g., hvnmos):")
   ...
   const catIndexStr = await this.openPrompt("Select Category", `Please enter a number to select a category:\n${catOptions}\n\nOr enter a new category name directly:`)
   ```

- [ ] **Step 3: Update custom category accordion context menu around line 2017**

1. Update the `rename` action:
   ```typescript
   const newName = await this.openRenameModal("Rename Category", cat.name)
   ```
2. Update the `delete` action:
   ```typescript
   if (await this.openConfirm("Delete Category", `Are you sure you want to delete category "${cat.name}"?`)) {
       this.deleteCustomCategory(cat.name)
   }
   ```

- [ ] **Step 4: Update custom symbols context menu in category view around line 2055**

1. Update the custom graphics symbol `rename` action:
   ```typescript
   const newName = await this.openRenameModal("Rename Custom Symbol", symbolId)
   ```
2. Update the custom graphics symbol `delete` action:
   ```typescript
   if (await this.openConfirm("Delete Symbol", `Are you sure you want to delete custom symbol "${symbolId}"?\n(Components already placed on the canvas will not be affected)`)) {
       this.deleteCustomGraphicsSymbol(symbolId)
   }
   ```
3. Update the subcircuit symbol `rename` action:
   ```typescript
   const newName = await this.openRenameModal("Rename Subcircuit", customSymbol.displayName)
   ```
4. Update the subcircuit symbol `delete` action:
   ```typescript
   if (await this.openConfirm("Delete Subcircuit", `Are you sure you want to delete subcircuit "${customSymbol.displayName}"?\n(Components already placed on the canvas will not be affected)`)) {
       this.deleteCustomSymbol(symbolId)
   }
   ```

- [ ] **Step 5: Translate error messages in `duplicateSymbol` around line 1770**

Change `alert("找不到原符號的中繼資料！")` to a styled alert, or since this is a rare internal error, change to:
`alert("Could not find the metadata for the original symbol!")`

---

### Task 4: Replace native dialogs in other controllers

**Files:**
- Modify: `src/scripts/controllers/templateController.ts`
- Modify: `src/scripts/controllers/symbolEditorController.ts`

- [ ] **Step 1: Modify `templateController.ts`**

Update the `"contextmenu"` delete work confirmation:
```typescript
		const confirmDelete = await MainController.instance.openConfirm("Delete Work", `Are you sure you want to delete "${baseName}"?`)
```
Note: Since `confirmDelete` is now awaited, the wrapping method `onDeleteConfirm` or similar must be made `async`.

- [ ] **Step 2: Modify `symbolEditorController.ts`**

Update the pin insertion prompt (when using the `pin` tool):
```typescript
					const pinName = await MainController.instance.openPrompt("New Connection Point", "Please enter a name for the new connection point (e.g., g, s, d, in, out):")
```
Note: The mouse event listener callback that runs this prompt must be marked `async`.

---

### Task 5: Compilation and Verification

- [ ] **Step 1: Verify types and compilation**

Verify that `npm run build` or compilation compiles without TypeScript errors.

- [ ] **Step 2: Manual testing of each flow**

- Click on standard components, right-click, select Rename, Delete, Duplicate, Add to Category, and ensure that custom Bootstrap Modals show up instead of browser-native popups.
- Make sure that all modals display the text in English.
