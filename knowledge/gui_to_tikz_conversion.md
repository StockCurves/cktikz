# GUI to TikZ Conversion Workflow in CircuiTikZ-Designer

This document details how coordinate structures and visual component data in the CircuiTikZ-Designer GUI are transformed and serialized into compilable LaTeX/CircuiTikZ code.

---

## 1. Coordinate Mapping: SVG (Pixels) to LaTeX (Centimeters)

In the graphical user interface, positions are tracked in SVG pixel space. However, LaTeX/TikZ draws in centimeters (`cm`) with the Y-axis pointing upwards. 

The coordinate conversion is handled by extending the `SVG.Point` interface inside [`src/scripts/utils/impSVGNumber.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/utils/impSVGNumber.ts#L622-L628):

```typescript
toTikzString(noParantheses = false): string {
    if (noParantheses) {
        return `${roundTikz(this.x * unitConvertMap.px.cm)}, ${roundTikz(-this.y * unitConvertMap.px.cm)}`
    } else {
        return `(${roundTikz(this.x * unitConvertMap.px.cm)}, ${roundTikz(-this.y * unitConvertMap.px.cm)})`
    }
}
```

### Key Mapping Rules:
1. **Scaling Factor**: `unitConvertMap.px.cm` is defined as `127 / 4800` (approximately `0.0264583`).
2. **Y-Axis Inversion**: Since SVG's Y-axis increases downwards while LaTeX's Y-axis increases upwards, the Y coordinate is negated (`-this.y`).
3. **Rounding**: Coordinates are rounded to 2 decimal places using `roundTikz()`.

---

## 2. Serialization Entry Point: `ExportController`

The conversion is initiated in [`src/scripts/controllers/exportController.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/controllers/exportController.ts#L113-L148) through `exportCircuiTikZ()`:

```typescript
exportCircuiTikZ() {
    let circuitElements = []
    let requiredTikzLibraries: Set<string> = new Set<string>()
    
    // 1. Gather TikZ libraries and TikZ strings from all active components
    for (const circuitElement of MainController.instance.circuitComponents) {
        circuitElement.requiredTikzLibraries().forEach((item) => requiredTikzLibraries.add(item))
        circuitElements.push("\t" + circuitElement.toTikzString())
    }
    
    let libraryStr = requiredTikzLibraries.size > 0 
        ? "\\usetikzlibrary{" + requiredTikzLibraries.values().toArray().join(", ") + "}"
        : ""

    // 2. Wrap components in a \begin{tikzpicture} ... \end{tikzpicture} environment
    const tikzSettings = EnvironmentVariableController.instance.getTikzSettings()
    let arr = [
        "\\begin{tikzpicture}" + "[" + ["transform shape"].concat(tikzSettings.environment).join(", ") + "]",
        ...tikzSettings.ctikzset.map((setting) => "\t\\ctikzset{" + setting + "}"),
        "\t% Paths, nodes and wires:",
        ...circuitElements,
        "\\end{tikzpicture}",
    ]
    // ...
}
```

---

## 3. Structural Representation: Node vs. Path Commands

Every visual component inherits from the abstract base class `CircuitComponent` (defined in [`src/scripts/components/circuitComponent.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/circuitComponent.ts)). Components serialize themselves into either a TikZ Node or Path structure.

### A. TikZ Node Commands (`TikzNodeCommand`)
Used for components anchored at a single coordinate (e.g., transistors, ground, labels, and rectangles).
*   **Data Structure** (defined in [`src/scripts/utils/tikzBuilder.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/utils/tikzBuilder.ts#L3-L9)):
    ```typescript
    export type TikzNodeCommand = {
        options: string[]
        name?: string
        position?: string | SVG.Point
        content?: string
        additionalNodes: TikzNodeCommand[]
    }
    ```
*   **Compilation**: Formatted via `buildTikzStringFromNodeCommand(command)` into:
    `\node[options] (name) at (X, Y) {content};`

### B. TikZ Path Commands (`TikzPathCommand`)
Used for components with multiple reference coordinates (e.g., resistors, capacitors, and multi-segmented wires).
*   **Data Structure** (defined in [`src/scripts/utils/tikzBuilder.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/utils/tikzBuilder.ts#L16-L21)):
    ```typescript
    export type TikzPathCommand = {
        options: string[]
        coordinates: (string | SVG.Point)[]
        connectors: (string | CircuitikzTo)[]
        additionalNodes: TikzNodeCommand[]
    }
    ```
*   **Compilation**: Formatted via `buildTikzStringFromPathCommand(command)` into:
    `\draw[options] (X1, Y1) connector1 (X2, Y2) connector2 ...;` (e.g., `\draw (0,0) to[R] (2,0);` or `\draw (0,0) -| (2,2);`).

---

## 4. Component Implementation Examples

### Node Component Example (`NodeSymbolComponent`)
Located in [`src/scripts/components/nodeSymbolComponent.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/nodeSymbolComponent.ts):
```typescript
public toTikzString(): string {
    let command: TikzNodeCommand = {
        options: [this.referenceSymbol.tikzName],
        additionalNodes: [],
    }
    this.buildTikzCommand(command)
    return buildTikzStringFromNodeCommand(command)
}
```

### Path Component Example (`WireComponent`)
Located in [`src/scripts/components/wireComponent.ts`](file:///c:/Users/iMonet/Projects/antigravity/CircuiTikZ-Designer/src/scripts/components/wireComponent.ts):
```typescript
protected buildTikzCommand(command: TikzPathCommand): void {
    super.buildTikzCommand(command)
    // Map arrows, connection lines (straight "--", or orthogonal "-|" / "|-")
    // and coordinates to the TikzPathCommand structure, then compile via tikzBuilder
}
```
