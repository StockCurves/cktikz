import { describe, expect, it, vi } from "vitest"
import * as SVG from "@svgdotjs/svg.js"
import { CustomSymbolExportService } from "../src/scripts/services/customSymbolExportService"

describe("CustomSymbolExportService", () => {
	it("builds tikzset definitions for subcircuits", () => {
		const service = new CustomSymbolExportService()
		const moveRel = vi.fn()
		const circuitComponents = [
			{
				constructor: { name: "SubcircuitComponent" },
				displayName: "U1",
				position: new SVG.Point(10, 20),
				groupedComponents: [
					{ moveRel, toTikzString: () => "\\draw (0,0) -- (1,0);" },
				],
				toTikzString: () => "\\pic {U1}",
			},
		]

		const result = service.getCustomSubcircuitsTikzset(circuitComponents as any)

		expect(result).toContain("\\tikzset{")
		expect(result).toContain("U1/.pic={")
		expect(result).toContain("\\draw (0,0) -- (1,0);")
		expect(moveRel).toHaveBeenCalledTimes(2)
		expect(moveRel.mock.calls[0][0]).toEqual(expect.objectContaining({ x: -10, y: -20 }))
		expect(moveRel.mock.calls[1][0]).toEqual(expect.objectContaining({ x: 10, y: 20 }))
	})

	it("builds custom symbol styles from runtime symbols", () => {
		const service = new CustomSymbolExportService()
		const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		rect.setAttribute("x", "10")
		rect.setAttribute("y", "20")
		rect.setAttribute("width", "30")
		rect.setAttribute("height", "40")
		rect.setAttribute("stroke-width", "1")

		const circuitComponents = [
			{
				referenceSymbol: {
					isCustomSymbol: true,
					tikzName: "mysym",
				},
			},
		]

		const customSymbols = [
			{
				tikzName: "mysym",
				baseSymbol: "nmos",
			},
		]

		const symbols = [
			{
				tikzName: "mysym",
				_mapping: new Map([
					[
						"default",
						{
							mid: new SVG.Point(0, 0),
							symbol: {
								node: { children: [rect] },
							},
						},
					],
				]),
			},
		]

		const result = service.getCustomSymbolsTikzset(circuitComponents as any, customSymbols as any, symbols as any)

		expect(result).toContain("\\tikzset{")
		expect(result).toContain("mysym/.style={")
		expect(result).toContain("\\draw [line width=1pt]")
		expect(result).toContain("rectangle")
	})
})
