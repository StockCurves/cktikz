import { describe, expect, it } from "vitest"

import { preprocessSymbolColors } from "../src/scripts/utils/symbolColorTheme"
import { defaultFill, defaultStroke } from "../src/scripts/utils/themeDefaults"

describe("preprocessSymbolColors", () => {
	it("normalizes theme colors and fills missing leaf fills", () => {
		const parser = new DOMParser()
		const doc = parser.parseFromString(
			`<svg xmlns="http://www.w3.org/2000/svg">
				<g stroke="#000">
					<path id="plain" d="M0 0 L1 1" />
					<path id="fillable" class="fillable" fill="none" d="M0 0 L1 1" />
				</g>
				<rect id="whiteFill" fill="#fff" stroke="#fff" width="1" height="1" />
			</svg>`,
			"image/svg+xml"
		)
		const root = doc.documentElement

		preprocessSymbolColors(root)

		expect(root.querySelector("#whiteFill")?.getAttribute("fill")).toBe(defaultFill)
		expect(root.querySelector("#whiteFill")?.getAttribute("stroke")).toBe(defaultFill)
		expect(root.querySelector("#fillable")?.getAttribute("fill")).toBe("currentFill")
		expect(root.querySelector("#plain")?.getAttribute("fill")).toBe("currentColor")
		expect(root.querySelector("g")?.getAttribute("stroke")).toBe(defaultStroke)
	})
})
