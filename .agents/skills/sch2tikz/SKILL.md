---
name: sch2tikz
description: Convert schematic circuit images into editor-compatible CircuiTikZ code, lookup pin coordinates, and compile/verify rendered output locally or via QuickLaTeX fallback.
---

# Schematic to TikZ (sch2tikz) Skill

This skill converts schematic circuit diagrams into clean, editor-compatible CircuiTikZ LaTeX code and verifies the output iteratively. Prefer local LaTeX rendering when available; if local `pdflatex` is unavailable, use the QuickLaTeX API fallback.

## Process

1. **Save Uploaded Image (Blocking First Step)**: Before analysis, drafting, linting, or verification, save the user's uploaded circuit image to the output directory. Do not move on until the original upload is preserved:
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
5. **Compile and Verify**: Save to a `.tikz` file and compile/render it before handoff.
   - First check for local LaTeX tooling (`pdflatex`, `lualatex`, or `tectonic`) and use the local renderer if available.
   - If local `pdflatex`/LaTeX rendering is not available, use the QuickLaTeX verification script as the fallback:
   ```bash
   python .agents/skills/sch2tikz/scripts/verify_tikz.py sch2tikz-out/YYYY-MMDD-HHMM.tikz
   ```
   - QuickLaTeX sends the generated TikZ content to an external service; this is the expected fallback path for this skill when local rendering is unavailable.
6. **Editor Compatibility Lint**: Run the local lint script before handing off generated code:
   ```bash
   python .agents/skills/sch2tikz/scripts/lint_editor_compat.py sch2tikz-out/YYYY-MMDD-HHMM.tikz --report sch2tikz-out/YYYY-MMDD-HHMM_lint-report.md
   ```
7. **Visual Overlay QA**: When the original image and rendered output are both available, create an overlay report:
   ```bash
   python .agents/skills/sch2tikz/scripts/overlay_diff.py sch2tikz-out/YYYY-MMDD-HHMM-upload.png sch2tikz-out/YYYY-MMDD-HHMM_rendered.svg
   ```
8. **Iterate**: Inspect the compiled SVG and overlay report. Treat label size, font metrics, and hand-drawn wobble as low-priority visual differences; prioritize topology, pin alignment, missing symbols, wire routing, and connection dots. Do not present the result as visually verified unless render verification and overlay QA were actually run.

## Output Formatting & Storage

Save the resulting files in the following format:
- `sch2tikz-out/YYYY-MMDD-HHMM-upload.png` (the original uploaded schematic image)
- `sch2tikz-out/YYYY-MMDD-HHMM.tikz` (the CircuiTikZ LaTeX source file)
- `sch2tikz-out/YYYY-MMDD-HHMM.png` or `_rendered.svg` (the compiled output image)
- `sch2tikz-out/YYYY-MMDD-HHMM_lint-report.md` (optional editor compatibility lint report)
- `sch2tikz-out/YYYY-MMDD-HHMM_rendered_overlay.html` (optional visual overlay QA report)

These scripts are manual agent/developer QA tools. Do not wire them into the production frontend bundle, Vercel build command, or `build:demo` unless a separate deployment decision is made.

---

## Editor Compatibility Rules

All generated TikZ code must be compatible with the visual editor's parser. Follow these rules strictly:

### 1. Absolute Coordinates Only
All wire and drawing coordinates must use absolute numerical values (e.g. `(2.5, 4.0)`). Relative coordinates (such as `++(1.0, 0)` or `+(0, 2)`) are strictly forbidden.

### 2. Node Pin References
For wires connecting to multi-pin components (like op amps or logic gates), use `(NODE_NAME.PIN_NAME)` references *after* the node is defined (e.g. `\draw (0.2, 6.01) -- (OP4.+);`).

### 3. Use osquarepole for Terminals
Do not use custom node styles (such as `[terminal]`) or manually draw rectangles for input/output terminals.
Instead, use standard CircuiTikZ `osquarepole` nodes for terminal boxes and place the text label nearby:
```tikz
% V_A Terminal
\node[osquarepole] at (0.1, 6.01) {};
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

---

## Local LaTeX Rendering Setup

To achieve extremely fast rendering verification (under 1 second compared to 8+ seconds via the remote QuickLaTeX API), it is highly recommended to configure a local LaTeX compilation environment.

### 1. Install local TeX Distribution
- **Windows**: Install [MiKTeX](https://miktex.org/download) or TeX Live. Ensure the bin directory containing `pdflatex.exe` is added to your Windows user or system PATH environment variable.
- **macOS / Linux**: Install MacTeX or TeX Live via your package manager.

### 2. Install SVG Conversion Tools
- `dvisvgm` is required to convert Compiled PDF outputs into vector SVG format. It is bundled by default in most MiKTeX and TeX Live installations.
- Ensure `pdflatex` and `dvisvgm` are discoverable by running `pdflatex --version` and `dvisvgm --version` in your terminal.

### 3. Recommended Packages
Ensure the following LaTeX packages are installed in your TeX manager:
- `standalone`
- `circuitikz` (v1.8.0+)
- `amsmath`, `amsfonts`, `amssymb`
- `siunitx`

If package auto-installation is not globally enabled, install them manually using the MiKTeX Console or running `mpm --install=<package_name>`. The verification script automatically runs `pdflatex` with `-disable-installer` to avoid background execution hangs, falling back cleanly to the remote QuickLaTeX API if packages are missing.
