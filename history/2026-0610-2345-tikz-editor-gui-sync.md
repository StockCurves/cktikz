# TikZ Code Direct Editing & GUI Synchronization - History

## Implementation Plan

This plan introduces a feature allowing users to directly edit TikZ code in a dedicated panel and synchronize the changes back to the GUI canvas. The TikZ parser will support a specific, constrained syntax to guarantee a 1-to-1 conversion between the TikZ code and GUI components.

### User Decisions
1. **UI Panel Location**: Left side panel, resizable by mouse drag, toggleable with `Ctrl+B`.
2. **Update Behavior**: Explicit "Apply" button to compile/load TikZ code onto the canvas.
3. **Canvas Update Policy**: Clear and rebuild the canvas entirely upon application of parsed TikZ code.
4. **Input Focus Safety**: Ensure keypress events (like Delete, Backspace, Ctrl+Z, Ctrl+Y, etc.) inside the TikZ textarea do not trigger global editor hotkeys or delete canvas elements.

### Proposed Changes

#### UI Components

##### [MODIFY] index.html
- Add a resizable left sidebar for the TikZ Editor before the canvas area.
- Include a `<textarea>` for code input, a header, and an "Apply" button.
- Add a resizable divider handle.

##### [MODIFY] styles.scss
- Define layout styles for the left panel, the resize handler, and the textarea.

#### Parser & Controller Logic

##### [NEW] tikzParser.ts
- Regular expression parsing of the TikZ syntax:
  - `\node[options] (name) at (X, Y) {content};`
  - `\draw[options] (X1, Y1) to[component] (X2, Y2);`
  - `\draw[options] (X1, Y1) connector (X2, Y2) ...;`
- Coordinate conversion from TikZ `cm` to SVG `px`.

##### [NEW] tikzEditorController.ts
- Listen to canvas change events to automatically update the TikZ text representation.
- Listen to "Apply" button clicks, call `tikzParser`, clear existing components, and instantiate new ones.
- Manage `Ctrl+B` toggle shortcut.
- Prevent keydown events originating from the TikZ editor `<textarea>` from propagating to the global shortcut listener.

---

## Walkthrough

We have implemented direct TikZ code editing on the left-side resizable panel and synchronized it with the visual canvas.

### Changes Made

#### 1. Left Side Panel & Resizer
- Added `tikzEditorContainer` and `tikzEditorResizer` inside `#siteContent` in `index.html`.
- Implemented drag-to-resize behavior using mouse events in `TikzEditorController`.
- Added global shortcut `Ctrl+B` (or `Cmd+B` on Mac) to toggle the editor panel.

#### 2. TikZ/CircuiTikZ Parser
- Created `tikzParser.ts` to scan coordinates, nodes, path commands, and wires.
- Converts TikZ centimeter-based coordinates `(x, y)` back to SVG pixel coordinates `(x/scale, -y/scale)`.
- Reconstructs nodes, shape rectangles, path symbol components, and wires by generating target `ComponentSaveObject` structures and initializing them via `CircuitComponent.fromJson()`.

#### 3. Synchronization & Shortcut Isolation
- Listens to undo state updates to sync the canvas's TikZ code back into the editor textarea.
- Wires up the "Apply" button to parse the editor code and reconstruct the canvas components.
- Configured keyboard focus rules and stopped propagation of key events from the textarea to prevent global hotkeys (like Backspace, Delete, Ctrl+Z) from firing when typing inside the editor.

### Verification

- Built successfully using `npm run build`.
- Parsed various components and verified exact 1-to-1 visual correspondence.
- Checked that resizing, toggling (`Ctrl+B`), and keyboard focus safety work as requested.
