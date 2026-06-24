# VisioCirkit

> [!IMPORTANT]
> This repository is a fork of the original [CircuiTi*k*Z-Designer](https://github.com/Circuit2TikZ/CircuiTikZ-Designer). We have introduced a range of powerful new features to enhance custom component editing, TikZ synchronization, and the design workflow.

> [!WARNING]
>
> - **Always Backup Your TikZ Code!** 💾 VisioCircuit uses the TikZ code in the editor as the **single source of truth** for your design. To prevent any data loss, please copy and backup your `.tikz` code frequently.
> - **TikZ Code Alteration & Comments Loss**: Pressing **Apply** in the TikZ editor synchronizes the code to the visual canvas. This process will restructure your TikZ code and completely discard all LaTeX comments (`% ...`). Please keep an external backup of your code if you want to preserve formatting or comments.
> - **Alternative Preview Option**: As the app is still under active development, rendering bugs may occasionally occur. If you suspect an incorrect render, you can verify your TikZ code in an alternative online previewer such as the [HolaTeX Playground](https://holatex.app/playground.html).

---

## 🎨 About This Project

**CircuiTi*k*Z-Designer** is a visual schematic editor tailored for academic research and engineering development! We aim to eliminate the pain of manually writing LaTeX/TikZ code, letting you design, customize, and export high-quality LaTeX circuit diagrams in the most intuitive way possible! 🎨

### ✨ Key Features

- **🔌 Visio-like Intuitive Controls**: The interface and operations are designed to be as close as possible to **Microsoft Visio**. With smooth drag-and-drop, alignment, scaling, rotation, and grid snapping, it is extremely easy to get started!
- **🤖 Smooth AI Agent Collaboration**: You can seamlessly pair this app with **schematic-to-TikZ AI skills / agents**. Just let the AI agent convert your hand-drawn circuit sketch or image into TikZ code first, then copy the code directly into this app to visually refine and customize it!
- **🔄 Two-Way Sync (TikZ Editor & GUI)**: Real-time synchronization! Modifying the code instantly updates the visual canvas, and manipulating components on the GUI updates the TikZ code simultaneously.
- **🛠️ Visio-Style Custom Symbol Editor**: Inspect and dynamically modify sub-path attributes (like thickness, coordinates, etc.) of custom components.
- **🌟 Rich Enhancements**:
    1. **Custom Categories & Subcircuits**: Organize your design workspace with custom component categories and custom subcircuits.
    2. **Visual Subcircuit Previews**: The symbols panel displays actual, accurate graphical previews of your subcircuits instead of generic boxes!
    3. **Symbol Grouping**: Group multiple components together and save them as reusable custom symbols.
    4. **Premium Academic Theme**: Redesigned UI styling with a tailored dark mode palette and smooth gradients to reduce eye strain during long hours of research.
- **👁️ Live LaTeX Rendering**:
    - **Primary Renderer**: Powered by the **QuickLaTeX API** for high-quality cloud LaTeX compilation, supporting all complex CircuiTikZ syntax and fonts!
    - **Fallback Renderer**: Automatically falls back to the local **TikZJax (WebAssembly)** engine for offline rendering when network connection is down or QuickLaTeX is unavailable.

---

## 🚀 Use Locally

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Clone the repository to your local machine.
3. Install the dependencies:
    ```bash
    npm install
    ```
4. Start the local development server:
    ```bash
    npm start
    ```
5. Open your browser and navigate to the local URL (default is `http://localhost:1234`) to start designing!

---

## 📦 Demo Build & Deployment

- The default `npm run build` keeps the app in `server` runtime mode.
- To deploy to static hosts like Vercel, run `npm run build:demo`. This updates `<meta name="circuitikz-runtime" ...>` to `demo`.
- The deployed demo artifact boots with:
    - `storageMode = "indexeddb"`
    - `templateSource = "static-manifest"`
    - `latexMode = "serverless-proxy"`

**Recommended Demo Deployment Flow**:

1. Switch to the `demo/b-local-storage-vercel` branch.
2. Run `npm install`.
3. Verify the environment by running tests:
    ```bash
    npm run test -- tests/runtimeBootstrap.test.ts tests/apiServices.test.ts
    ```
4. Build the demo version:
    ```bash
    npm run build:demo
    ```
5. Deploy the generated `dist/` directory to your static host, and ensure the serverless backend proxy `api/latex.js` is available.

---

## 💡 Help & Contributing

- **How to Use**: Click the question mark icon `?` in the top right corner of the application to view the interactive help menu and shortcut keys.
- **Discussions**: If you have any questions, feel free to start a thread on [General Discussions](https://github.com/Circuit2TikZ/CircuiTikZ-Designer/discussions/categories/general).
- **Bug Reports**: Please use the [Issues Page](https://github.com/Circuit2TikZ/CircuiTikZ-Designer/issues) to report bugs. Please always provide clear steps to reproduce.
- **Feature Requests**: Share and discuss your ideas on the [Discussions - Ideas](https://github.com/Circuit2TikZ/CircuiTikZ-Designer/discussions/categories/ideas) page.
- **Contribute Code**: Fork the repository, make your changes, and submit a pull request. Please always test your code thoroughly!

---

## ☕ Buy Me a Coffee

If this tool or the associated AI Agent Skills have saved you time and made your research easier, please consider supporting the project by buying me a coffee! Your support is the greatest motivation for me to maintain and develop these tools. Thank you so much! ❤️

[![Buy Me a Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=☕&slug=stockcurves&button_colour=FFDD00&font_colour=000000&font_family=Arial&outline_colour=000000&coffee_colour=FF8F00)](https://buymeacoffee.com/stockcurves)
