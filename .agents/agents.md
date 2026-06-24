## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

- 用繁體中文交談，專有名詞保留英文，檔名不要中文
- /grill-me 後產生的 implementation_plan 存到 porject ./history/YYYY-MMDD-HHMM-<topic>.md

## Custom Commands
When the user prompt starts with `/sch2tikz`, you must act as a Schematic-to-TikZ converter. Follow these rules strictly:

**Process:**
1. Analyze the provided image of the schematic circuit.
2. Use the `sch2tikz` skill to lookup pin coordinate offsets, accurately align multi-pin components, and determine the routing strategy.
3. Generate the TikZ code using the `circuitikz` package.
4. Use the `sch2tikz` skill's verification script to compile the `.tikz` file into an image. Visually verify the output and iteratively fix any compilation errors or layout issues until the output matches the original schematic.

**Output Formatting & Storage:**
Save the resulting files in the following format:
- `./sch2tikz-out/YYYY-MMDD-HHMM.jpg` (or the compiled image format)
- `./sch2tikz-out/YYYY-MMDD-HHMM.tikz`

**Strict TikZ Parser Rules:**
1. **Complete Document Structure**: The code must include the complete LaTeX preamble (e.g., `\documentclass{article}`, `\usepackage{circuitikz}`, etc.) and the full `\begin{document}` to `\end{document}` wrapper. Do not provide only the core code.
2. **Basic Path Syntax Only**: All circuit components must use the most basic syntax: `\draw (x1, y1) to[component_name] (x2, y2);`. Complex nested paths or continuous connections omitting the starting point are strictly prohibited.
3. **Absolute Coordinates**: All coordinate points must use absolute numerical coordinates (e.g., `(0,0)`, `(2,4)`). Relative coordinates (such as `++(1,0)` or `+(0,2)`) are strictly forbidden.
4. **No Logic or Loops**: The code strictly forbids the use of `\foreach`, `\if`, or custom `\newcommand` macros. Every component and wire must be explicitly written out individually.
5. **No Colors**: Do not use any color options (e.g., `[blue]`, `[red]`) in the drawing commands, as the parser currently does not support color definitions.
6. **Standard Component Naming**: Use only the most common standard component names from official CircuiTikZ documentation (e.g., `R` for resistor, `C` for capacitor, `spst` for switch, `op amp` for operational amplifier, etc.).
7. **Unified Label Format**: All labels should uniformly use the `to[R=$R_1$]` format. Avoid using complex TikZ node markers as much as possible.
8. **Clear Structure**: Each line of code should draw only one component or one segment of wire.
9. **English Comments**: All comments must be exclusively in English to keep the layout clean.
10. **No Complex Styling Options**: Avoid using complex drawing or node options such as `[dashed]`, `[ultra thick]`, `[thick, ->]`, `[emptycircle]`, `[xscale=-1]`, or `[font=\Huge...]`. These formatting options are currently unsupported by the internal SVG parser and will cause errors. Use the most plain syntax possible (e.g., `\draw (0,0) node[pmos] {};` or `\draw (0,0) rectangle (2,2);`).
