import { beforeEach, describe, expect, it, vi } from "vitest"

const menuResponses: Array<string | null> = []
const openForResult = vi.fn(() => Promise.resolve(menuResponses.shift() ?? null))

vi.mock("../src/scripts/controllers/contextMenu", () => ({
	ContextMenu: class {
		public openForResult = openForResult
	},
}))

import { CustomSymbolDrawerController } from "../src/scripts/controllers/customSymbolDrawerController"

describe("CustomSymbolDrawerController", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="leftOffcanvasAccordion">
				<div class="custom-category-accordion-item" data-stale="true"></div>
				<div id="builtin-category"></div>
			</div>
		`
		menuResponses.length = 0
		openForResult.mockClear()
	})

	it("re-renders custom categories and keeps built-in sections in place", async () => {
		const controller = new CustomSymbolDrawerController()
		const persistCustomSymbol = vi.fn(async () => {})

		controller.render(
			[{ name: "My Symbols", symbolIds: ["sub-1"] }],
			[{
				id: "sub-1",
				tikzName: "sub-1",
				displayName: "Amplifier",
				isCustomSymbol: false,
				subcircuitData: { components: [] },
				svgPreview: "<svg><rect width='10' height='10'></rect></svg>",
			} as any],
			[],
			{
				hideDrawer: vi.fn(),
				openRenameModal: vi.fn(async () => null),
				openConfirm: vi.fn(async () => true),
				renameCategory: vi.fn(),
				deleteCategory: vi.fn(),
				removeSymbolFromCategory: vi.fn(),
				openSymbolEditor: vi.fn(),
				renameGraphicsSymbol: vi.fn(),
				deleteGraphicsSymbol: vi.fn(),
				renameSubcircuit: vi.fn(),
				deleteSubcircuit: vi.fn(),
				placeStandardSymbol: vi.fn(),
				placeSubcircuit: vi.fn(),
				generateSubcircuitPreview: vi.fn(async () => null),
				persistCustomSymbol,
			}
		)

		const items = Array.from(document.querySelectorAll("#leftOffcanvasAccordion > div"))
		expect(items).toHaveLength(2)
		expect(items[0].classList.contains("custom-category-accordion-item")).toBe(true)
		expect(items[1].id).toBe("builtin-category")
		expect(document.querySelectorAll(".custom-category-accordion-item")).toHaveLength(1)
		expect((document.querySelector(".libComponent") as HTMLDivElement).innerHTML).toContain("<svg>")
		expect(persistCustomSymbol).not.toHaveBeenCalled()
	})

	it("routes category and subcircuit actions through injected callbacks", async () => {
		const controller = new CustomSymbolDrawerController()
		const openRenameModal = vi.fn(async (title: string) => title === "Rename Category" ? "Renamed Category" : "Renamed Sub")
		const renameCategory = vi.fn()
		const renameSubcircuit = vi.fn()
		const placeSubcircuit = vi.fn()
		const hideDrawer = vi.fn()
		const persistCustomSymbol = vi.fn(async () => {})

		controller.render(
			[{ name: "My Symbols", symbolIds: ["sub-1"] }],
			[{
				id: "sub-1",
				tikzName: "sub-1",
				displayName: "Amplifier",
				isCustomSymbol: false,
				subcircuitData: { components: [1] },
			} as any],
			[],
			{
				hideDrawer,
				openRenameModal,
				openConfirm: vi.fn(async () => true),
				renameCategory,
				deleteCategory: vi.fn(),
				removeSymbolFromCategory: vi.fn(),
				openSymbolEditor: vi.fn(),
				renameGraphicsSymbol: vi.fn(),
				deleteGraphicsSymbol: vi.fn(),
				renameSubcircuit,
				deleteSubcircuit: vi.fn(),
				placeStandardSymbol: vi.fn(),
				placeSubcircuit,
				generateSubcircuitPreview: vi.fn(async () => "<svg><circle cx='5' cy='5' r='4'></circle></svg>"),
				persistCustomSymbol,
			}
		)

		await Promise.resolve()
		await Promise.resolve()

		menuResponses.push("rename")
		;(document.querySelector(".accordion-button") as HTMLButtonElement).dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
		)
		await Promise.resolve()
		await Promise.resolve()

		menuResponses.push("rename")
		;(document.querySelector(".libComponent") as HTMLDivElement).dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })
		)
		await Promise.resolve()
		await Promise.resolve()

		;(document.querySelector(".libComponent") as HTMLDivElement).dispatchEvent(
			new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 })
		)

		expect(renameCategory).toHaveBeenCalledWith("My Symbols", "Renamed Category")
		expect(renameSubcircuit).toHaveBeenCalledWith("sub-1", "Renamed Sub")
		expect(placeSubcircuit).toHaveBeenCalledWith(expect.objectContaining({ id: "sub-1" }))
		expect(hideDrawer).toHaveBeenCalled()
		expect(persistCustomSymbol).toHaveBeenCalledWith(expect.objectContaining({
			id: "sub-1",
			svgPreview: expect.stringContaining("<svg>"),
		}))
	})
})
