import { describe, it, expect, vi } from "vitest"

// Mock the internal modules
vi.mock("../src/scripts/internal", () => {
	class MockPoint {
		x: number; y: number
		constructor(x = 0, y = 0) { this.x = x; this.y = y }
		clone() { return new MockPoint(this.x, this.y) }
		rotate(_angle: number) { return this }
		sub(other: MockPoint) { return new MockPoint(this.x - other.x, this.y - other.y) }
		add(other: MockPoint) { return new MockPoint(this.x + other.x, this.y + other.y) }
		simplifyForJson() { return { x: this.x, y: this.y } }
	}

	const makeMockSymbol = (tikzName: string) => ({
		tikzName,
		getVariant: () => ({
			defaultAnchor: { point: new MockPoint(0, 0) },
			pins: []
		})
	});

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
	];

	return {
		MainController: {
			instance: {
				symbols: mockSymbols,
				addSymbolToCategory: vi.fn(),
			}
		},
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

import { parseTikz } from "../src/scripts/utils/tikzParser"

describe("parseTikz parser lint relaxation", () => {
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
});
