import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the internal modules
vi.mock("../src/scripts/internal", () => {
	return {
		CircuitComponent: class {},
		poleChoices: [],
		arrowTips: []
	}
})

// Mock @svgdotjs/svg.js since it's used inside parseTikz
vi.mock("@svgdotjs/svg.js", () => {
	class MockPoint {
		x: number; y: number
		constructor(x = 0, y = 0) { this.x = x; this.y = y }
		clone() { return new MockPoint(this.x, this.y) }
		rotate(_angle: number) { return this }
		sub(other: MockPoint) { return new MockPoint(this.x - other.x, this.y - other.y) }
		add(other: MockPoint) { return new MockPoint(this.x + other.x, this.y + other.y) }
		mul(val: any) {
			if (typeof val === "number") return new MockPoint(this.x * val, this.y * val)
			return new MockPoint(this.x * val.x, this.y * val.y)
		}
		div(val: any) {
			if (typeof val === "number") return new MockPoint(this.x / val, this.y / val)
			return new MockPoint(this.x / val.x, this.y / val.y)
		}
		simplifyForJson() { return { x: this.x, y: this.y } }
	}
	return {
		Point: MockPoint,
		Box: class {},
		G: class {},
		Line: class {},
		Element: class {},
		Matrix: class {},
	}
})

import { configureTikzParserRuntime, parseTikz } from "../src/scripts/utils/tikzParser"

const scale = 127 / 4800;
const addParsedSubcircuit = vi.fn()
const makeMockSymbol = (tikzName: string) => ({
	tikzName,
	getVariant: () => ({
		defaultAnchor: { point: { x: 0, y: 0, clone() { return this }, rotate() { return this }, sub() { return this }, add() { return this } } },
		pins: []
	})
})
const mockSymbols = [
	makeMockSymbol("ground"),
	makeMockSymbol("op amp"),
	makeMockSymbol("pmos"),
	makeMockSymbol("nmos"),
	makeMockSymbol("vcc"),
	makeMockSymbol("american resistor"),
	makeMockSymbol("capacitor"),
	makeMockSymbol("american inductor"),
	makeMockSymbol("empty diode"),
	makeMockSymbol("sinusoidal voltage source"),
]

describe("parseTikz parser lint relaxation", () => {
	beforeEach(() => {
		addParsedSubcircuit.mockReset()
		configureTikzParserRuntime({
			getSymbols: () => mockSymbols as any,
			addParsedSubcircuit,
		})
	})

	it("should parse single point node placement without throwing error", () => {
		const code = `\\draw (0,0) node[ground] {};`;
		expect(() => parseTikz(code)).not.toThrow();
	});

	it("should parse complex templates containing single-coordinate node draw calls without errors", () => {
		const opampAmpCode = `\\begin{circuitikz}[american]
		\\draw (0,3) to[sinusoidal voltage source, l=$V_{in}$] (0,0);
		\\draw (0,0) node[ground] {};
		\\draw (5,2.5) node[op amp] (OA) {};
		\\draw (0,3) to[R, l=$R_1$] (OA.-);
		\\end{circuitikz}`;
		expect(() => parseTikz(opampAmpCode)).not.toThrow();
	});

	it("should still throw error if coordinate count is less than 2 and there is a connector", () => {
		const badCode = `\\draw (0,0) --;`;
		expect(() => parseTikz(badCode)).toThrow("Draw command must contain at least two coordinates");
	});

	it("should parse shorthand notation components like to[L=$L_F$] correctly", () => {
		const code = `\\draw (0,0) to[L=$L_F$] (2,0);`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("path");
		expect(result[0].id).toBe("american inductor");
		expect(result[0].label).toBeDefined();
		expect(result[0].label.value).toBe("L_F");
	});

	it("should parse user complex code containing multiple shorthands without errors", () => {
		const userComplex = `\\begin{circuitikz}[american]
		\\draw (  9.25, 2.0) to[L=$L_F$] ( 11.75, 2.0);
		\\draw ( 11.75, 0.5) to[C=$C_F$] ( 11.75,-1.5);
		\\draw ( 13.75, 2.0) to[R=$R_L$] ( 13.75,-1.5);
		\\end{circuitikz}`;
		expect(() => parseTikz(userComplex)).not.toThrow();
	});

	it("should parse node labels and set isMath correctly", () => {
		const code = `\\node[anchor=west] at (7.5, 2.5) {$V_{out}$};`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("rect");
		expect(result[0].text.text).toBe("V_{out}");
		expect(result[0].text.isMath).toBe(true);
	});

	it("should ignore arc arguments and not treat them as coordinate points", () => {
		const code = `\\draw (8.0, 3.0) -- (9.8, 3.0) arc(180:0:0.2) -- (12.0, 3.0);`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("wire");
		// Should only have 3 points: (8,3), (9.8,3), and (12,3)
		expect(result[0].points).toHaveLength(3);
		expect(result[0].points[0]).toEqual({ x: 8.0 / scale, y: -3.0 / scale });
		expect(result[0].points[1]).toEqual({ x: 9.8 / scale, y: -3.0 / scale });
		expect(result[0].points[2]).toEqual({ x: 12.0 / scale, y: -3.0 / scale });
	});

	it("should parse standalone circle node as an ellipse component with correct type", () => {
		const code = `\\draw (2.0, 3.0) node[circle, fill, inner sep=1.2pt] {};`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("ellipse");
		// Size should be computed from inner sep (1.2pt = 1.2 * 2.54 / 72 = 0.04233cm -> * 2 = 0.08466cm)
		const expectedCm = (1.2 * 2.54 / 72) * 2;
		const expectedPx = expectedCm / scale;
		expect(result[0].size.x).toBeCloseTo(expectedPx, 1);
		expect(result[0].size.y).toBeCloseTo(expectedPx, 1);
	});

	it("registers parsed subcircuits through the configured runtime callback", () => {
		const code = `\\tikzset{demo/.pic={\\draw (0,0) -- (1,0);}}`

		parseTikz(code)

		expect(addParsedSubcircuit).toHaveBeenCalledWith(
			"我的最愛",
			"subcircuit-demo",
			expect.objectContaining({
				id: "subcircuit-demo",
				tikzName: "demo",
				displayName: "demo",
			})
		)
	})

	it("should parse full LaTeX documents containing documentclass and usepackage without errors", () => {
		const fullLatexCode = `\\documentclass[tikz,border=10pt]{standalone}
		\\usepackage[siunitx,american]{circuitikz}
		\\begin{document}
		\\begin{circuitikz}
		\\draw (0,0) to[R, l=$R_1$] (2,0);
		\\end{circuitikz}
		\\end{document}`;
		const result = parseTikz(fullLatexCode);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("path");
		expect(result[0].id).toBe("american resistor");
	});

	it("should parse standalone fill circle command as ellipse component with black fill and 0px stroke", () => {
		const code = `\\fill (3.5, 3) circle (2pt);`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("ellipse");
		expect(result[0].fill.color).toBe("#000000");
		expect(result[0].fill.opacity).toBe(1);
		expect(result[0].stroke.width).toBe("0px");
		// Verify position conversion (3.5, 3) -> (3.5/scale, -3/scale)
		expect(result[0].position.x).toBeCloseTo(3.5 / scale, 1);
		expect(result[0].position.y).toBeCloseTo(-3.0 / scale, 1);
		// Size should be (2pt * 2) = 4pt
		const expectedPx = (2 * 2.54 / 72) * 2 / scale;
		expect(result[0].size.x).toBeCloseTo(expectedPx, 1);
	});

	it("should parse draw rectangle command as a rect component with correct bounding box", () => {
		const code = `\\draw[dashed] (-2.5, -1) rectangle (17, 6.8);`;
		const result = parseTikz(code);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("rect");
		expect(result[0].stroke.style).toBe("dashed");
		expect(result[0].fill.opacity).toBe(0);

		// Coords in cm: (-2.5, -1) and (17, 6.8)
		// SVG coords: x1 = -2.5 / scale, x2 = 17 / scale, y1 = 1 / scale, y2 = -6.8 / scale
		const x1 = -2.5 / scale;
		const x2 = 17.0 / scale;
		const y1 = 1.0 / scale; // y=-1 -> negated to 1
		const y2 = -6.8 / scale; // y=6.8 -> negated to -6.8
		const expectedCenterX = (x1 + x2) / 2;
		const expectedCenterY = (y1 + y2) / 2;
		const expectedWidth = Math.abs(x2 - x1);
		const expectedHeight = Math.abs(y2 - y1);

		expect(result[0].position.x).toBeCloseTo(expectedCenterX, 1);
		expect(result[0].position.y).toBeCloseTo(expectedCenterY, 1);
		expect(result[0].size.x).toBeCloseTo(expectedWidth, 1);
		expect(result[0].size.y).toBeCloseTo(expectedHeight, 1);
	});
});

