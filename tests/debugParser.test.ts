import { describe, it } from "vitest"
import fs from "fs"
import path from "path"

// Mock internal modules and svg.js the same way as tikzParser.test.ts
import { vi } from "vitest"
vi.mock("../src/scripts/internal", () => {
	return {
		CircuitComponent: class {},
		poleChoices: [],
		arrowTips: []
	}
})
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
	return { Point: MockPoint, Box: class {}, G: class {}, Line: class {}, Element: class {}, Matrix: class {} }
})

import { configureTikzParserRuntime, parseTikz } from "../src/scripts/utils/tikzParser"

describe("debug parseTikz", () => {
	it("should parse op2_circuit.tikz and print errors", () => {
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
			makeMockSymbol("american current source"),
			makeMockSymbol("american voltage source"),
			makeMockSymbol("generic"),
		]
		configureTikzParserRuntime({
			getSymbols: () => mockSymbols as any,
			addParsedSubcircuit: () => {},
		})
		const filePath = path.join(__dirname, "../examples-code/op2_circuit.tikz")
		const code = fs.readFileSync(filePath, "utf8")
		try {
			const result = parseTikz(code)
			console.log("Parsed successfully, components count:", result.length)
		} catch (e: any) {
			console.error("Parse Error:", e.message)
			console.error("Start line:", e.startLine, "End line:", e.endLine)
			throw e
		}
	})
})
