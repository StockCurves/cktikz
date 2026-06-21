---
name: tikz-iterative-verification
description: >-
  Uses a background script to compile TikZ code via the QuickLaTeX API, converts it to an image, and allows the agent to visually verify or check compilation logs. Use this after generating TikZ code to establish an iterative verification loop.
---

# TikZ Iterative Verification

## Overview
This skill allows agents to programmatically compile generated TikZ code (`.tex` files containing `circuitikz` environments) into images (`.png`) using the QuickLaTeX API. It establishes a closed-loop "iterative verification" process: generate code -> compile -> check image/logs -> fix errors -> repeat until successful.

## Dependencies
None. This skill uses standard Python libraries (`urllib`, `re`, `os`).

## Quick Start
After generating or modifying a TikZ file (e.g., `circuit.tex`), run the verification script:

```bash
python .agents/skills/tikz-iterative-verification/scripts/verify_tikz.py circuit.tex
```

The script will:
1. Extract the `\begin{circuitikz}...\end{circuitikz}` block.
2. Send it to the QuickLaTeX API.
3. If successful, download the rendered PNG to `circuit_rendered.png`.
4. Output the markdown syntax you should use to embed the image in an artifact or message.

## Utility Scripts

### `verify_tikz.py`
A Python script that sends TikZ code to the QuickLaTeX API and handles the response.

**Usage:**
```bash
python .agents/skills/tikz-iterative-verification/scripts/verify_tikz.py <path_to_tikz_file.tex>
```

**Expected Outputs:**
- **Success:**
  ```text
  Submitting to QuickLaTeX...
  Success! Image generated at: https://quicklatex.com/...
  Image downloaded and saved to: /path/to/circuit_rendered.png
  Agent Action: You can now view this image or embed it in an artifact using: ![Rendered TikZ](file:///path/to/circuit_rendered.png)
  ```
- **Compilation Failure:**
  ```text
  Submitting to QuickLaTeX...
  Compilation Failed!
  Error Details:
  ... (LaTeX error logs) ...
  ```

## Workflow

When asked to generate or modify TikZ code, follow these steps to ensure quality:

### 1. Generate and Save Code
Write your TikZ code to a `.tex` file in the workspace.

### 2. Run Verification
Call the `verify_tikz.py` script on the file using the `run_command` tool.

### 3. Review Compilation Results
- **If Compilation Fails:** Read the LaTeX error output provided by the script. Identify the syntax error (e.g., missing semicolon, undefined coordinate), fix the code, and return to Step 2.
- **If Compilation Succeeds:** The script will output a file URL for the downloaded PNG image. Use the `view_file` tool to inspect the generated image (if you have visual capabilities), OR present the image to the user using the markdown syntax provided by the script (e.g., `![Rendered TikZ](file:///...)`).

### 4. Iterative Refinement
Ask the user if the rendered image meets their requirements. If they notice visual issues (e.g., "misaligned components", "diagonal lines where there should be right angles"), adjust the TikZ coordinates/routing and run the verification loop again.

## Rate Limiting
This skill relies on the public QuickLaTeX API. Please avoid sending rapid, concurrent requests. Wait for one compilation to finish before triggering another.

## Common Mistakes
1. **Forgetting to check the log:** LaTeX compilation errors are usually detailed. Always read the error message provided by the script if compilation fails.
2. **Path issues:** Ensure you pass the correct relative or absolute path to the `.tex` file when calling the script.
3. **Invalid TikZ Environment:** The script automatically extracts content between `\begin{circuitikz}` and `\end{circuitikz}`. If you use a different environment, it will wrap the entire file, which might cause preamble conflicts.
