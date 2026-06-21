import { describe, expect, it } from "vitest"
import { buildSymbolVariantDiff, collectComparableLeafs } from "../src/scripts/utils/symbolVariantDiff"

describe("symbolVariantDiff", () => {
	it("treats inherited presentation attributes as part of leaf identity and output", () => {
		document.body.innerHTML = `
			<svg>
				<symbol id="base">
					<g stroke="#000" stroke-width=".4">
						<path fill="none" d="M0 0h10"/>
						<path stroke-width=".5" d="M1 1c0 1 1 2 2 2Z"/>
					</g>
				</symbol>
				<symbol id="variant">
					<g stroke="#000" stroke-width=".4">
						<path fill="none" d="M0 0h10"/>
						<g fill="#fff">
							<path stroke-width=".5" d="M1 1c0 1 1 2 2 2Z"/>
						</g>
					</g>
				</symbol>
			</svg>
		`

		const diff = buildSymbolVariantDiff(
			document.getElementById("base")!,
			document.getElementById("variant")!
		)

		expect([...diff.deletedBaseIndices]).toEqual([1])
		expect(diff.decoratorElements).toHaveLength(1)
		expect(diff.decoratorElements[0]).toContain('fill="#fff"')
		expect(diff.decoratorElements[0]).toContain('d="M1 1c0 1 1 2 2 2Z"')
	})

	it("normalizes inherited styles so a semantically identical leaf is not duplicated", () => {
		document.body.innerHTML = `
			<svg>
				<symbol id="base"><g stroke="#000"><path d="M0 0h10"/></g></symbol>
				<symbol id="variant"><path stroke="#000" d="M0 0h10"/></symbol>
			</svg>
		`

		const diff = buildSymbolVariantDiff(
			document.getElementById("base")!,
			document.getElementById("variant")!
		)

		expect(diff.deletedBaseIndices.size).toBe(0)
		expect(diff.decoratorElements).toEqual([])
		expect(collectComparableLeafs(document.getElementById("base")!)[0].xml).toContain('stroke="#000"')
	})

	it("includes inherited linecap, linejoin, and opacity in leaf identity", () => {
		document.body.innerHTML = `
			<svg>
				<symbol id="base">
					<g stroke="#000" stroke-linecap="round" stroke-linejoin="bevel" stroke-opacity=".5">
						<path fill="none" d="M0 0h10"/>
					</g>
				</symbol>
				<symbol id="variant">
					<path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="bevel" stroke-opacity=".5" d="M0 0h10"/>
				</symbol>
			</svg>
		`

		const diff = buildSymbolVariantDiff(
			document.getElementById("base")!,
			document.getElementById("variant")!
		)

		expect(diff.deletedBaseIndices.size).toBe(0)
		expect(diff.decoratorElements).toEqual([])
		const leafXml = collectComparableLeafs(document.getElementById("base")!)[0].xml
		expect(leafXml).toContain('stroke-linecap="round"')
		expect(leafXml).toContain('stroke-linejoin="bevel"')
		expect(leafXml).toContain('stroke-opacity=".5"')
	})
})
