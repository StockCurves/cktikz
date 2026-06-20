# AI Image-to-TikZ Prompt Design Spec

**Topic**: 讓 AI 將使用者上傳的電路圖圖片轉換為可匯入 CircuiTikZ-Designer 的 TikZ 程式碼  
**Date**: 2026-06-18  
**Scope**: 兩份輸出文件（System Prompt + 使用者說明），共用同一份語法規格知識

---

## 背景

CircuiTikZ-Designer 的 TikZ Editor 支援從文字輸入 TikZ 程式碼，並即時同步到視覺畫布。  
其 Parser（`tikzParser.ts`）只能解析特定語法子集；超出範圍的語法會拋出錯誤，導致匯入失敗。

目標：設計一份 Prompt，讓外部 AI（如 Claude、ChatGPT）根據使用者上傳的電路圖圖片，  
生成**只包含 Parser 白名單語法**的 TikZ 程式碼，遇到不支援的元素時明確說明。

---

## 決策記錄

| 問題 | 決策 |
|------|------|
| AI 整合方式 | C：外部 AI 轉換，使用者手動貼入 editor |
| Prompt 用途 | A+C：使用者文件 + 未來 system prompt 基礎 |
| 限制程度 | A：嚴格白名單，只輸出 parser 可處理的語法 |
| 不支援元素處理 | C：略過並在輸出後附上清單說明 |

---

## 語法規格（Whitelist Grammar）

此為兩份輸出文件的共同知識來源。

### 1. 允許的頂層命令

Parser 在剝除 preamble 後，只接受兩種頂層命令：

```
COMMAND := DRAW_CMD | NODE_CMD
```

任何其他命令（`\fill`、`\filldraw`、`\path`、`\coordinate`、`\foreach` 等）都會報錯。

---

### 2. `\draw` 命令語法

```
DRAW_CMD :=
  | \draw (COORD) CONNECTOR (COORD) [CONNECTOR (COORD) ...] ;
  | \draw (COORD) to[COMPONENT_OPTS] (COORD) ;
  | \draw (COORD) pic{SUBCIRCUIT_NAME} ;
```

**CONNECTOR（合法的連接符）**：

| 符號 | 意義 |
|------|------|
| `--` | 直線 |
| `-|` | 先水平後垂直 |
| `|-` | 先垂直後水平 |

> ⚠️ `to`（不帶 `[...]`）、`arc`、`cycle`、`rectangle` 等不支援。

**COMPONENT_OPTS（`to[...]` 中的選項）**：

```
to[SYMBOL_NAME]              % 基本放置
to[SYMBOL_NAME, l=LABEL]     % 帶標籤（上方）
to[SYMBOL_NAME, l_=LABEL]    % 帶標籤（下方）
```

> ⚠️ `\draw` 本身不允許任何繪圖選項（`[dashed]`、`[color=red]`、`[thick]` 等）。

**Arrow Tips（`\draw[TIP-TIP]` 格式，僅限 wire 線段）**：

只有在無 `to[...]` 的純 wire 命令上，才允許 arrow 格式（如 `-->`、`<->`），  
且 tip 必須是以下之一：

```
(空)  >  <  |  stealth  latex  o  *
```

---

### 3. `\node` 命令語法

**3a. CircuiTikZ node-style 元件**：

```
\node[NODE_SYMBOL_ID] (NODE_NAME) at (COORD) {LABEL} ;
\node[NODE_SYMBOL_ID, rotate=DEG] (NODE_NAME) at (COORD) {LABEL} ;
\node[NODE_SYMBOL_ID, xscale=S, yscale=S] (NODE_NAME) at (COORD) {LABEL} ;
```

**3b. 文字 / 矩形節點**：

```
\node[minimum width=Wcm, minimum height=Hcm, anchor=ANCHOR] at (COORD) {TEXT} ;
```

合法的 `ANCHOR` 值：`north`, `south`, `east`, `west`, `north east`, `north west`, `south east`, `south west`, `center`

**快速方向關鍵字**（等同 anchor）：`above`, `below`, `left`, `right`

---

### 4. 座標格式

```
COORD := (X, Y)                  % 絕對座標，X 和 Y 為 cm 數值，如 (1.5, -2.0)
       | (NODE_NAME.PIN_NAME)    % 節點 pin 引用，如 (opamp.-)、(opamp.out)
       | (NODE_NAME)             % 節點中心引用，如 (GND)
```

**Pin 引用規則（重要）**：

- ✅ 允許 `(NODE_NAME.PIN_NAME)` 格式作為 `\draw` 的起點或終點
- ✅ 允許 `(NODE_NAME)` 引用已定義節點的中心
- ⚠️ **必須先定義再引用**：`\node` 命令必須出現在所有引用它的 `\draw` 命令之前
- ❌ 禁用相對座標 `+(1,0)`、`++(0,-1)`
- ❌ 禁用未經 `\node` 定義的名稱引用（Parser 會靜默回退到 `(0,0)`）

**AI 生成建議**：
1. 所有 `\node` 命令集中在前，所有 `\draw` 命令在後
2. 使用 pin 引用代替手動計算 op amp、logic gate 等多腳元件的 pin 座標

---

### 5. 允許的 Preamble（Parser 會靜默忽略）

以下可以出現，Parser 不報錯，但匯入後不會影響視覺效果：

```
\usetikzlibrary{circuitikz}
\ctikzset{...}
\begin{tikzpicture}[...]
\end{tikzpicture}
\tikzset{NAME/.pic = {...}}   % 僅限 subcircuit 定義
```

---

### 6. 元件白名單

元件名稱分兩類：

#### 6a. Path-style 元件（用於 `to[NAME]`）

常見元件（建議 AI 優先使用）：

| TikZ 名稱 | 說明 |
|-----------|------|
| `american-resistor` | 美式電阻（方塊） |
| `european-resistor` | 歐式電阻（鋸齒） |
| `capacitor` | 電容 |
| `curved-capacitor` | 彎曲電容 |
| `american-inductor` | 美式電感 |
| `european-inductor` | 歐式電感 |
| `cute-inductor` | 可愛電感 |
| `battery` | 電池（長短極） |
| `battery1` / `battery2` | 電池變體 |
| `dcvsource` | 直流電壓源 |
| `dcisource` | 直流電流源 |
| `sinusoidal-voltage-source` | 正弦電壓源 |
| `sinusoidal-current-source` | 正弦電流源 |
| `american-voltage-source` *(alias: vsource)* | 美式電壓源 |
| `american-current-source` *(alias: isource)* | 美式電流源 |
| `european-voltage-source` | 歐式電壓源 |
| `european-current-source` | 歐式電流源 |
| `empty-diode` | 空心二極體 |
| `full-diode` | 實心二極體 |
| `empty-Zener-diode` | Zener 二極體 |
| `empty-led` | LED |
| `empty-Schottky-diode` | Schottky 二極體 |
| `fuse` | 保險絲 |
| `switch` | 開關 |
| `normal-open-switch` | 常開開關 |
| `normal-closed-switch` | 常閉開關 |
| `short` | 短路（直接連線） |
| `open` | 斷路 |
| `generic` | 通用兩端元件 |
| `lamp` | 燈泡 |
| `loudspeaker` | 揚聲器 |
| `mic` | 麥克風 |

完整清單（239 個 path-style symbols，含所有變體）：

<details>
<summary>展開完整 path-style 白名單</summary>

```
afuse, ageneric, allornothing, allpass, american-controlled-current-source,
american-current-source, american-gas-filled-surge-arrester, american-inductive-sensor,
american-inductor, american-light-dependent-resistor, american-potentiometer,
american-resistive-sensor, american-resistor, amp, baertty, bandpass, bandstop,
bare-jumper, barrier, battery, battery1, battery2, bgenerator, biast, bmultiwire,
bulb, buzzer, camera, capacitive-sensor, capacitor, cgenerator,
closed-double-solder-jumper, closed-jumper, closed-solder-jumper,
closing-normal-closed-switch, closing-normal-open-switch, closing-switch,
controlled-sinusoidal-current-source, controlled-sinusoidal-voltage-source,
cpe, currtap, curved-capacitor, cute-choke, cute-closed-switch, cute-closing-switch,
cute-european-controlled-current-source, cute-european-controlled-voltage-source,
cute-european-current-source, cute-european-voltage-source, cute-inductive-sensor,
cute-inductor, cute-opening-switch, cute-open-switch, damper, dcisource, dcvsource,
detector, empty-agtobar, empty-bidirectionaldiode, empty-controlled-source,
empty-diode, empty-gto, empty-gtobar, empty-laser-diode, empty-led,
empty-photodiode, empty-put, empty-Schottky-diode, empty-Shockley-diode,
empty-thyristor, empty-triac, empty-tunnel-diode, empty-TVS-diode, empty-varcap,
empty-Zener-diode, empty-ZZener-diode, esource, european-controlled-current-source,
european-controlled-voltage-source, european-current-source,
european-gas-filled-surge-arrester, european-inductive-sensor, european-inductor,
european-light-dependent-resistor, european-potentiometer, european-resistive-sensor,
european-resistor, european-voltage-source, ferrocap, fiber, full-agtobar,
full-bidirectionaldiode, full-diode, full-gto, full-gtobar, full-laser-diode,
full-led, full-photodiode, full-put, full-Schottky-diode, full-Shockley-diode,
full-thyristor, full-triac, full-tunnel-diode, full-TVS-diode, full-varcap,
full-Zener-diode, full-ZZener-diode, fuse, generic, highpass, highpass2, iamp,
iec-connector, iloop, iloop2, inerter, inline-proximeter, ioosource, lamp,
left-double-solder-jumper, loudspeaker, lowpass, lowpass2, mass, memristor, mic,
mov, mstline, multiwire, neonlampac, neonlampcc, ngenerator, noise-current-source,
noise-voltage-source, norator, normal-closed-switch, normally-closed-push-button,
normally-closed-push-button-open, normally-open-push-button-closed,
normal-open-switch, nullator, ooosource, oosourcetrans, openbarrier,
open-double-solder-jumper, opening-normal-closed-switch, opening-normal-open-switch,
opening-switch, open-jumper, open-solder-jumper, oscope, oscope_rotated-instruments,
photoresistor, piattenuator, piezoelectric, power, push-button, pvmodule, pvsource,
qgenerator, qiprobe, qpprobe, qvprobe, rbuzzer, reed, register, relais,
right-double-solder-jumper, rmeter, rmeter_rotated-instruments, rmeterwa,
rmeterwa_rotated-instruments, sacac, sacdc, saturation, sdcac, sdcdc, sgeneric,
sigmoid, sinetable, sinusoidal-current-source, sinusoidal-voltage-source, smeter,
smeter_rotated-instruments, solar, sparkgap, spring, square-voltage-source, squid,
stroke-agtobar, stroke-diode, stroke-gto, stroke-gtobar, stroke-laser-diode,
stroke-led, stroke-photodiode, stroke-put, stroke-Schottky-diode, stroke-thyristor,
stroke-triac, stroke-tunnel-diode, stroke-varcap, stroke-Zener-diode,
stroke-ZZener-diode, switch, swr, tacac, tacdc, tattenuator, tdcac, tgeneric,
thermistor, thermocouple, tline, tlmic, tmultiwire, toggle-switch, trx, tvset,
twoport, twoportsplit, vallpass, vamp, variable-american-inductor,
variable-american-resistor, variable-capacitor, variable-cute-inductor,
variable-european-inductor, variable-european-resistor, vco, vco_box, viscoe,
voosource, vpiattenuator, vsourcetri, vtattenuator, wfuse, xgeneric
```
</details>

#### 6b. Node-style 元件（用於 `\node[NAME] at (...)`）

常見元件：

| TikZ 名稱 | 說明 |
|-----------|------|
| `ground` | 數位接地 |
| `rground` | 電阻接地 |
| `sground` | 訊號接地 |
| `eground` | 大地接地 |
| `vcc` | 電源正極 |
| `vee` | 電源負極 |
| `circ` | 實心圓點（節點） |
| `ocirc` | 空心圓點 |
| `op amp` | 運算放大器 |
| `nmos` | N 型 MOSFET |
| `pmos` | P 型 MOSFET |
| `npn` | NPN BJT |
| `pnp` | PNP BJT |
| `american-and-port` | AND gate |
| `american-or-port` | OR gate |
| `american-not-port` | NOT gate |
| `american-nand-port` | NAND gate |
| `american-nor-port` | NOR gate |
| `american-xor-port` | XOR gate |
| `american-xnor-port` | XNOR gate |

<details>
<summary>展開部分 node-style 白名單（1195 個，含所有變體）</summary>

```
adder, adder_box, adder_box-only, american-and-port, american-buffer-port,
american-nand-port, american-nor-port, american-not-port, american-or-port,
american-xnor-port, american-xor-port, antenna, bareantenna, bareRXantenna,
bareTXantenna, bnc, buffer, cground, circ, circulator, circulator_box,
circulator_box-only, coupler, coupler2, currarrow, cute-spdt-down,
cute-spdt-down-arrow, cute-spdt-mid, cute-spdt-mid-arrow, cute-spdt-up,
cute-spdt-up-arrow, diamondpole, dinantenna, diodetube, eground, eground2,
european-blank-not-port, european-blank-port, flowarrow, fourport, GaN-hemt,
genericsplitter, gridnode, ground, gyrator, gyrator_inline, harmonics, hemt,
iecconnshape, iecplugL, iecplugR, iecsocketL, inputarrow, jump-crossing,
nmos, nmosd, op amp, ocirc, osquarepole, odiamondpole, plain-crossing,
pmos, pmosd, npn, pnp, pujt, rground, sground, squarepole, tground, tlground,
trarrow, triode, tetrode, txantenna, rxantenna, vcc, vee, waves, wilkinson,
schmitt, schmitt-symbol, spdt, splitter, tlinestub, ...（及所有 _variant 變體）
```
</details>

---

### 7. 短別名對照（TIKZ_NAME_MAP）

Parser 內建以下別名，AI 可使用任一寫法：

| 別名 | 等同 |
|------|------|
| `R` | `american resistor` |
| `C` | `capacitor` |
| `L` | `american inductor` |
| `D` | `empty diode` |
| `sD` | `stroke diode` |
| `g` | `generic` |
| `vR` | `variable american resistor` |
| `vC` | `variable capacitor` |
| `vL` | `variable american inductor` |
| `vsourcesin` | `sinusoidal voltage source` |
| `isourcesin` | `sinusoidal current source` |
| `vsource` | `american voltage source` |
| `isource` | `american current source` |
| `vsourcedc` | `dcvsource` |
| `isourcedc` | `dcisource` |
| `battery` | `battery` |

---

### 8. 禁用語法清單

以下語法在 CircuiTikZ-Designer 中**一定會報錯或靜默忽略**（視情況而定）：

| 語法 | 後果 |
|------|------|
| `\fill`、`\filldraw` | 報錯：unsupported command |
| `\path` | 報錯：unsupported command |
| `\coordinate (name) at (...)` | 報錯：unsupported command |
| `\foreach` | 報錯：unsupported command |
| `\begin{scope}...\end{scope}` | 報錯：unsupported command |
| `\draw[dashed]`、`\draw[thick]`、`\draw[color=red]` | draw 選項被忽略但可能導致 parse 失敗 |
| `arc(...)` | 報錯：無法解析 |
| `+(...)` / `++(...)` 相對座標 | 無法解析（座標計算錯誤） |
| `cycle` | 報錯 |
| `\draw ... rectangle (...)` | 報錯 |

---

## 輸出文件 1：System Prompt

**用途**：貼入外部 AI 工具的 System Prompt 欄位（如 Claude Projects、ChatGPT Custom Instructions）

```
------- SYSTEM PROMPT START -------
You are a CircuiTikZ code generator. Your only job is to convert circuit diagram images into TikZ code that can be directly imported into CircuiTikZ-Designer.

## STRICT OUTPUT RULES

1. Only use commands from the ALLOWED COMMANDS list below. Any other TikZ command will cause an import error.
2. Use absolute (x, y) coordinates in centimeters for most positions. For multi-pin components (op amp, logic gates, transistors), use NODE_NAME.PIN_NAME references AFTER the node is defined.
3. Do NOT add any draw options like [dashed], [thick], [color=...], or [->] to \draw commands that contain to[...].
4. Place components left-to-right, top-to-bottom. Use a grid with 2cm spacing as the default.
5. Do NOT output \fill, \filldraw, \path, \coordinate, \foreach, arc, cycle, or scope commands.

## ALLOWED COMMANDS

### Wires
\draw (X1,Y1) -- (X2,Y2) ;                    % straight wire
\draw (X1,Y1) -| (X2,Y2) ;                    % horizontal then vertical
\draw (X1,Y1) |- (X2,Y2) ;                    % vertical then horizontal
\draw (X1,Y1) -- (X2,Y2) -- (X3,Y3) ;        % multi-segment wire

% Pin references (NODE must be defined above via \node before use)
\draw (X1,Y1) -- (NODE_NAME.PIN_NAME) ;       % wire to a component pin
\draw (NODE_NAME.PIN_NAME) -- (X2,Y2) ;       % wire from a component pin

### Path-style components (two-terminal)
\draw (X1,Y1) to[COMPONENT_NAME] (X2,Y2) ;
\draw (X1,Y1) to[COMPONENT_NAME, l=LABEL] (X2,Y2) ;
\draw (X1,Y1) to[COMPONENT_NAME, l_=LABEL] (X2,Y2) ;  % label on other side

Common COMPONENT_NAMEs:
  american-resistor, european-resistor, capacitor, curved-capacitor,
  american-inductor, european-inductor, cute-inductor,
  battery, battery1, battery2, dcvsource, dcisource,
  sinusoidal-voltage-source, sinusoidal-current-source,
  american-voltage-source, american-current-source,
  european-voltage-source, european-current-source,
  empty-diode, full-diode, empty-Zener-diode, empty-led,
  empty-Schottky-diode, fuse, switch, normal-open-switch,
  normal-closed-switch, short, open, generic, lamp, loudspeaker, mic

Short aliases also accepted: R, C, L, D, battery, vsource, isource

### Node-style components (placed at a point)
% IMPORTANT: Define all \node commands BEFORE any \draw that references their pins
\node[COMPONENT_NAME] (NODE_NAME) at (X,Y) {} ;
\node[COMPONENT_NAME, rotate=DEG] (NODE_NAME) at (X,Y) {} ;

Common COMPONENT_NAMEs:
  ground, rground, sground, eground, vcc, vee,
  circ, ocirc,
  op amp, nmos, pmos, npn, pnp,
  american-and-port, american-or-port, american-not-port,
  american-nand-port, american-nor-port, american-xor-port, american-xnor-port

### Text / Rectangle nodes
\node[minimum width=Wcm, minimum height=Hcm, anchor=north west] at (X,Y) {TEXT} ;

## ORDERING RULE

ALWAYS output \node commands before \draw commands. Example:

```
% 1. Define all nodes first
\node[op amp] (U1) at (3,0) {} ;
\node[ground] (GND) at (3,-2) {} ;

% 2. Then draw wires using pin references
\draw (0, 0.5) -- (U1.-) ;         % connect to inverting input
\draw (0, -0.5) -- (U1.+) ;        % connect to non-inverting input
\draw (U1.out) -- (6, 0) ;         % connect from output
\draw (U1.down) -- (GND) ;         % connect power to ground
```

## PIN OFFSET TABLE (cm from component center)

Use this table to compute the absolute Y coordinate of start/end points for horizontal wires.
Formula: wire_start_Y = component_center_Y + pin_dy

| Component | Pin | dx | dy |
|-----------|-----|-----|-----|
| `op amp` | `-` | -1.19 | +0.49 |
| `op amp` | `+` | -1.19 | -0.49 |
| `op amp` | `out` | +1.19 | 0 |
| `op amp` | `up` | -0.08 | +0.54 |
| `op amp` | `down` | -0.08 | -0.54 |
| `american and port` | `in 1` | -1.39 | +0.28 |
| `american and port` | `in 2` | -1.39 | -0.28 |
| `american and port` | `out` | +0.15 | 0 |
| `american not port` | `in 1` | -0.70 | 0 |
| `american not port` | `out` | +0.70 | 0 |
| `npn` | `B` | -0.84 | 0 |
| `npn` | `C` | 0 | +0.77 |
| `npn` | `E` | 0 | -0.77 |
| `pnp` | `B` | -0.84 | 0 |
| `pnp` | `C` | 0 | -0.77 |
| `pnp` | `E` | 0 | +0.77 |
| `nmos` | `G` | -0.98 | 0 |
| `nmos` | `D` | 0 | +0.77 |
| `nmos` | `S` | 0 | -0.77 |
| `pmos` | `G` | -0.98 | 0 |
| `pmos` | `D` | 0 | -0.77 |
| `pmos` | `S` | 0 | +0.77 |
| `transformer` | `A1` | -1.05 | +1.05 |
| `transformer` | `A2` | -1.05 | -1.05 |
| `transformer` | `B1` | +1.05 | +1.05 |
| `transformer` | `B2` | +1.05 | -1.05 |

Example — horizontal resistor into op amp inverting input:
```
\node[op amp] (U1) at (3, 0) {} ;
% ".-" dy = +0.49, so wire Y = 0 + 0.49 = 0.49
\draw (0, 0.49) to[american-resistor, l=$R_1$] (U1.-) ;
```

## OUTPUT FORMAT

Produce exactly two sections:

### TikZ Code
```
\begin{tikzpicture}[transform shape]
  % Paths, nodes and wires:
  ... (only allowed commands here) ...
\end{tikzpicture}
```

### Unsupported Elements
List any elements from the image that could not be represented using the allowed syntax. For each, write:
- [element description]: reason it was skipped or approximated

If all elements were represented, write: "None — all elements mapped successfully."
------- SYSTEM PROMPT END -------
```

---

## 輸出文件 2：使用者說明

**用途**：放在 CircuiTikZ-Designer 的說明文件或 UI tooltip

---

### 用 AI 將電路圖照片轉成 TikZ

CircuiTikZ-Designer 的 TikZ Editor 支援直接貼入 TikZ 程式碼。  
你可以用 AI 工具（如 Claude 或 ChatGPT）把電路圖照片自動轉換成可匯入的程式碼。

**操作步驟：**

1. 開啟 [Claude.ai](https://claude.ai) 或 [ChatGPT](https://chat.openai.com)
2. 建立新對話，貼入以下 System Prompt（或在對話開頭貼上）：

   > 你可以從 [AI 匯入提示詞下載頁面] 複製 System Prompt

3. 上傳你的電路圖照片（手繪或截圖均可）
4. 發送訊息：「請將這張電路圖轉換成 TikZ 程式碼」
5. AI 會回覆兩個區塊：
   - **TikZ Code**：可直接複製
   - **Unsupported Elements**：說明哪些元件無法轉換
6. 複製 `TikZ Code` 內的程式碼
7. 在 CircuiTikZ-Designer 中按 `Ctrl+B` 開啟 TikZ Editor
8. 將複製的程式碼貼入編輯器，按 **Apply**

**注意事項：**

- AI 轉換結果可能需要微調座標，使用 Designer 的拖曳功能調整即可
- 若 AI 輸出的程式碼匯入失敗，請確認沒有包含 `\fill`、`\foreach`、`dashed` 等不支援語法
- 複雜電路（超過 20 個元件）建議分段轉換

**支援的元件類型：**

| 類型 | 範例 |
|------|------|
| 電阻 | `american-resistor`, `european-resistor` |
| 電容 | `capacitor`, `curved-capacitor` |
| 電感 | `american-inductor`, `european-inductor` |
| 電源 | `dcvsource`, `battery`, `sinusoidal-voltage-source` |
| 二極體 | `empty-diode`, `full-led`, `empty-Zener-diode` |
| 開關 | `switch`, `normal-open-switch` |
| 接地 | `ground`, `rground`, `sground` |
| 運算放大器 | `op amp` |
| 電晶體 | `nmos`, `pmos`, `npn`, `pnp` |
| 邏輯閘 | `american-and-port`, `american-or-port`, ... |
| 連線 | 直線 `--`、直角折線 `-|` / `|-` |

**目前不支援的語法（AI 應略過並說明）：**

- 虛線、顏色、線寬樣式（`dashed`、`color=red`、`thick`）
- 弧線、曲線（`arc`）
- 填色區塊（`\fill`、`\filldraw`）
- 迴圈結構（`\foreach`）
- 相對座標（`+(1,0)` 格式）
- 任何非 `\draw` / `\node` 的命令

---

## Spec 自我審查

- [x] 無 TBD 或待補欄位
- [x] Grammar 規格與 `tikzParser.ts` 實際邏輯一致（已交叉比對 stripPreambles、parseOptions、TIKZ_NAME_MAP、getPinAbsolutePosition）
- [x] **已修正**：`NODE_NAME.PIN_NAME` 引用在 `\draw` 中合法，Parser 透過 `nodeMap` 計算絕對座標
- [x] 加入「先定義後引用」順序規則，與 Parser 建 nodeMap 的順序邏輯一致
- [x] Symbol 白名單來源：`symbols.svg` 中 `path_` 前綴 239 個、`node_` 前綴 1195 個
- [x] 禁用語法清單與 parser throwParseError 邏輯一致
- [x] System prompt 為英文（AI 輸入）；使用者說明為中文（終端使用者）
- [x] 兩份文件共用同一份白名單知識，無矛盾
