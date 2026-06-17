# Design Spec: Replace Native Dialogs with Custom Modals for Right-Click Actions

Modify all native dialog calls (`confirm`, `prompt`) triggered by right-click actions into custom Bootstrap 5 modals. Align UI text style and translate all Chinese strings to English.

## 1. Goal Description
Right-click context menu actions currently trigger browser-native dialogs (e.g., `confirm` for deletion, `prompt` for renaming or categories). Native dialogs differ in layout and appearance across different operating systems and browsers, detracting from a unified visual theme. 
This specification outlines the transition to customized Bootstrap 5 modals (specifically designed to fit the application theme), with all UI dialog prompts translated to English.

## 2. Proposed Changes

### A. UI Template (`src/pages/index.html`)
- Update existing `#renameModal` labels and button texts from Chinese to English.
- Add `#customPromptModal` for user text inputs (replacing native `prompt`).
- Add `#customConfirmModal` for yes/no choices (replacing native `confirm`).

### B. Controller Logics

#### `src/scripts/controllers/mainController.ts`
- Implement `openPrompt(title: string, message: string, defaultValue?: string): Promise<string | null>`
- Implement `openConfirm(title: string, message: string): Promise<boolean>`
- Update right-click event listener callbacks (rename, delete, duplicate, category additions) to use the new modal methods.
- Update UI string literals to English.

#### `src/scripts/controllers/templateController.ts`
- Update the work file deletion confirm prompt to use `MainController.instance.openConfirm`.

#### `src/scripts/controllers/symbolEditorController.ts`
- Update the Pin insertion prompt (triggered in Pin tool mode) to use `MainController.instance.openPrompt`.

## 3. Detailed Interface Specification

### Custom Prompt Modal: `#customPromptModal`
- HTML elements:
  - Header: `#customPromptModalLabel`
  - Body: `#customPromptModalMessage`, `#customPromptModalInput`
  - Footer: Cancel (secondary), OK (primary: `#customPromptModalConfirm`)

### Custom Confirm Modal: `#customConfirmModal`
- HTML elements:
  - Header: `#customConfirmModalLabel`
  - Body: `#customConfirmModalMessage`
  - Footer: Cancel (secondary), Confirm (primary: `#customConfirmModalConfirm`)

## 4. Verification Plan
- Verify category renaming and deletion triggers.
- Verify symbol duplication, renaming, deletion triggers.
- Verify work item deletion (template controller).
- Verify connection point naming (symbol editor).
- Verify all dialog texts are in English and responsive buttons work correctly.
