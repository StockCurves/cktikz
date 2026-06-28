---
name: sch2tikz
description: Convert schematic circuit images into editor-compatible CircuiTikZ code, lookup pin coordinates, and compile/verify rendered output via QuickLaTeX SVG API.
---

# Schematic to TikZ (sch2tikz) Skill

This skill converts schematic circuit diagrams into clean, editor-compatible CircuiTikZ LaTeX code and verifies the output iteratively using the QuickLaTeX API.

## Process

1. **Save Uploaded Image**: Save the user's uploaded circuit image to the output directory:
   ```bash
   # Copy the uploaded image from temp media storage
   cp <temp_media_path> sch2tikz-out/YYYY-MMDD-HHMM-upload.png
   ```
2. **Analyze Schematic**: Inspect the schematic diagram to identify all components, terminals, loops, and wire routes.
3. **Lookup Pin Offsets**: For multi-pin components (op amps, logic gates, transistors), run the lookup script to get exact pin coordinates relative to the component center:
   ```bash
   python .agents/skills/sch2tikz/scripts/lookup_pin_offset.py "op amp"
   ```
4. **Draft TikZ Code**: Write clean TikZ code using the **Editor Compatibility Rules** below.
5. **Compile and Verify**: Save to a `.tikz` file and compile to a vector SVG using the verification script:
   ```bash
   python .agents/skills/sch2tikz/scripts/verify_tikz.py sch2tikz-out/YYYY-MMDD-HHMM.tikz
   ```
6. **Iterate**: Inspect the compiled SVG. If there are misalignment or layout bugs, update the coordinates and compile again until perfect.

## Output Formatting & Storage

Save the resulting files in the following format:
- `sch2tikz-out/YYYY-MMDD-HHMM-upload.png` (the original uploaded schematic image)
- `sch2tikz-out/YYYY-MMDD-HHMM.tikz` (the CircuiTikZ LaTeX source file)
- `sch2tikz-out/YYYY-MMDD-HHMM.png` or `_rendered.svg` (the compiled output image)

---

## Editor Compatibility Rules

All generated TikZ code must be compatible with the visual editor's parser. Follow these rules strictly:

### 1. Absolute Coordinates Only
All wire and drawing coordinates must use absolute numerical values (e.g. `(2.5, 4.0)`). Relative coordinates (such as `++(1.0, 0)` or `+(0, 2)`) are strictly forbidden.

### 2. Node Pin References
For wires connecting to multi-pin components (like op amps or logic gates), use `(NODE_NAME.PIN_NAME)` references *after* the node is defined (e.g. `\draw (0.2, 6.01) -- (OP4.+);`).

### 3. No Custom Styles (Draw Terminals Manually)
Do not use custom node styles (such as `[terminal]`) for input/output terminals. The editor parser cannot resolve custom styles and will render them as huge default rectangles.
Instead, draw terminal boxes manually using `\draw rectangle` and place the text label nearby:
```tikz
% V_A Terminal
\draw (0.1, 5.935) rectangle (0.3, 6.085);
\draw (0.05, 6.01) node[left] {$V_A$};
```

### 4. Switch Components
Use `opening switch` for standard open switches (e.g. `to[opening switch, l=seln]`). Do not use unrecognized switch names like `spst`, as they are not mapped in the editor library and will be discarded.

### 5. Flipped Op Amps (Swapped Inputs)
If an op amp has swapped inputs (e.g., `+` on top and `-` on bottom):
1. Apply `yscale=-1` to the op amp node.
2. To prevent the op amp's label text (e.g., `OP5`) from rendering upside down, do not write text inside the node. Instead, draw the label as a separate un-mirrored text node:
   ```tikz
   \node[op amp, yscale=-1] (OP5) at (2, 3.5) {};
   \node at (2.2, 3.5) {OP5};
   ```

### 6. No Complex Drawing Options
Do not use complex styling options like `[dashed]` or `[->]` inside draw commands as they may not render correctly in the visual workspace. Keep drawing syntax as plain as possible.

### 7. Unified Document Structure
Every `.tikz` file must use the following standard LaTeX standalone wrapper:
```latex
\documentclass{standalone}
\usepackage[siunitx, american]{circuitikz}
\usepackage{tikz}
\usetikzlibrary{calc}
\begin{document}
\begin{circuitikz}[american, scale=1.0, every node/.style={transform shape}]
    % your tikz code 

\end{circuitikz}
\end{document}
```
### 8. Proportional Spacing and Text Box Widths
- Allocate horizontal and vertical coordinates based on component sizes (resistors/capacitors are ~0.8cm, transistors/comparators are ~1.5cm).
- Maintain a minimum clearing gap of 1.2cm between adjacent logic blocks.
- Set explicit alignment, text width, and anchors for text label nodes to prevent overlaps, using the `\small` font style by default:
  ```tikz
  \node[anchor=north east, align=right, text width=1.077cm, inner sep=6pt] at (3.2, 3.3) {\small $M_L$};
  ```
- Leave at least 2.0cm of vertical separation between horizontal rails and separate illustrative waveform sub-drawings.

### 9. Connection Dots Must Use `circ`
Do not emit filled circles such as:
```tikz
\fill (3.5, 3) circle (2pt);
```
Emit connection dots as editor-native `circ` nodes instead:
```tikz
\node[circ] at (3.5, 3){};
```
This keeps `Apply` round-trips stable and avoids the parser converting dots into generic circle shapes.

---

## Pin Offset Table (Reference)

| Component | Pin | dx (cm) | dy (cm) |
|---|---|---|---|
| `op amp` | `-` | -1.19 | +0.49 |
| `op amp` | `+` | -1.19 | -0.49 |
| `op amp` | `out` | +1.19 | 0 |
| `american nand port` | `in 1` | -1.386 | +0.28 |
| `american nand port` | `in 2` | -1.386 | -0.28 |
| `american nand port` | `out` | +0.154 | 0 |
| `american not port` | `in 1` | -0.7 | 0 |
| `american not port` | `out` | +0.7 | 0 |
| `nmos` | `G` | -0.98 | 0 |
| `nmos` | `D` | 0 | +0.77 |
| `nmos` | `S` | 0 | -0.77 |
| `pmos` | `G` | -0.98 | 0 |
| `pmos` | `D` | 0 | -0.77 |
| `pmos` | `S` | 0 | +0.77 |
