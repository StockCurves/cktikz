import { describe, expect, it } from "vitest"
import { defaultFill } from "../src/scripts/utils/themeDefaults"
import { resolveEditorFill, resolveEditorPathFill } from "../src/scripts/utils/symbolEditorFill"

describe("symbolEditorFill", () => {
	it("keeps closed diode-style paths filled when no explicit fill is present", () => {
		expect(resolveEditorPathFill("m21.69628 13.75964-21.16492-13.22828v26.45657l21.16492-13.22829", null)).toBe(defaultFill)
	})

	it("keeps open stroke paths unfilled when no explicit fill is present", () => {
		expect(resolveEditorPathFill("M21.69628 26.98793v-26.45657", null)).toBe("none")
	})

	it("treats closed basic shapes as filled by default", () => {
		expect(resolveEditorFill("rect", null)).toBe(defaultFill)
		expect(resolveEditorFill("polygon", null)).toBe(defaultFill)
	})
})
