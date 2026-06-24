import { describe, expect, it, vi } from "vitest"

// Mock internal to avoid loading full UI runtime components and controllers
vi.mock("../src/scripts/internal", () => {
	return {
		fontSizes: [],
		Text: class {},
		TextAlign: {},
		CanvasController: {
			instance: {
				canvas: {
					findOne: () => ({ put: () => {} })
				}
			}
		}
	}
})

import { replaceLatexSubSup } from "../src/scripts/utils/textHelper"

describe("replaceLatexSubSup", () => {
	it("should convert simple textsubscript correctly", () => {
		const input = "V\\textsubscript{CM\\_CTRL}"
		const expected = "V_{\\text{CM_CTRL}}"
		expect(replaceLatexSubSup(input)).toBe(expected)
	})

	it("should convert textsubscript wrapped in textbf correctly", () => {
		const input = "\\textbf{V\\textsubscript{CM\\_CTRL}}"
		const expected = "\\textbf{V}_{\\textbf{CM_CTRL}}"
		expect(replaceLatexSubSup(input)).toBe(expected)
	})

	it("should convert simple textsuperscript correctly", () => {
		const input = "V\\textsuperscript{OUT}"
		const expected = "V^{\\text{OUT}}"
		expect(replaceLatexSubSup(input)).toBe(expected)
	})

	it("should convert nested subscripts and superscripts correctly", () => {
		const input = "A\\textsubscript{B\\textsuperscript{C}}"
		const expected = "A_{\\text{B}^{\\text{C}}}"
		expect(replaceLatexSubSup(input)).toBe(expected)
	})

	it("should convert nested subscripts/superscripts wrapped in textbf correctly", () => {
		const input = "\\textbf{A\\textsubscript{B\\textsuperscript{C}}}"
		const expected = "\\textbf{A}_{\\textbf{B}^{\\textbf{C}}}"
		expect(replaceLatexSubSup(input)).toBe(expected)
	})

	it("should not modify normal text", () => {
		const input = "Just normal text with normal stuff."
		expect(replaceLatexSubSup(input)).toBe(input)
	})

	it("should handle unmatched braces gracefully by leaving them untouched", () => {
		const input = "A\\textsubscript{B"
		expect(replaceLatexSubSup(input)).toBe("A_{\\text{B}}")
	})

	it("should handle empty inputs and empty tags correctly", () => {
		expect(replaceLatexSubSup("")).toBe("")
		expect(replaceLatexSubSup("\\textsubscript{}")).toBe("_{\\text{}}")
	})
})
