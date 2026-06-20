import { describe, expect, it, vi } from "vitest"
import { AddComponentOffcanvasController } from "../src/scripts/controllers/addComponentOffcanvasController"

describe("AddComponentOffcanvasController", () => {
	it("binds toolbar, renders the libraries, and wires context menu actions", async () => {
		document.body.innerHTML = `
			<div id="leftOffcanvas"></div>
			<div id="leftOffcanvasAccordion"></div>
			<input id="componentFilterInput" />
			<button id="filterRegexButton"></button>
			<button id="addCategoryButton"></button>
			<div id="invalid-feedback-text"></div>
		`

		const componentLibraryController = {
			bindToolbar: vi.fn(),
			render: vi.fn(),
		}
		const shapeLibraryController = {
			render: vi.fn(),
		}
		const openAndExecute = vi.fn().mockResolvedValue(undefined)
		const symbolLibraryMenuController = {
			openAndExecute,
		}
		const addCustomCategory = vi.fn().mockResolvedValue(undefined)
		const loadCustomCategories = vi.fn().mockResolvedValue(undefined)
		const controller = new AddComponentOffcanvasController({
			componentLibraryController: componentLibraryController as any,
			shapeLibraryController: shapeLibraryController as any,
			symbolLibraryMenuController: symbolLibraryMenuController as any,
			hideDrawer: vi.fn(),
			switchToPanMode: vi.fn(),
			switchToComponentMode: vi.fn(),
			cancelComponentPlacement: vi.fn(),
			placeComponent: vi.fn(),
			openPrompt: vi.fn(),
			openRenameModal: vi.fn(),
			openConfirm: vi.fn(),
			addCustomCategory,
			loadCustomCategories,
			getCustomCategoryNames: () => ["Mine"],
			getSymbolByName: (name) => (name === "dup" ? ({ tikzName: "dup" } as any) : undefined),
			openSymbolEditor: vi.fn(),
			renameCustomGraphicsSymbol: vi.fn().mockResolvedValue(undefined),
			deleteCustomGraphicsSymbol: vi.fn().mockResolvedValue(undefined),
			addSymbolToCategory: vi.fn().mockResolvedValue(undefined),
			duplicateSymbol: vi.fn().mockResolvedValue(undefined),
		})

		await controller.initialize(
			document.getElementById("leftOffcanvas") as HTMLDivElement,
			document.getElementById("leftOffcanvasAccordion") as HTMLDivElement,
			[{ tikzName: "dup" } as any]
		)

		expect(componentLibraryController.bindToolbar).toHaveBeenCalledTimes(1)
		expect(shapeLibraryController.render).toHaveBeenCalledTimes(1)
		expect(loadCustomCategories).toHaveBeenCalledTimes(1)
		expect(componentLibraryController.render).toHaveBeenCalledTimes(1)

		const renderCallbacks = componentLibraryController.render.mock.calls[0][2]
		await renderCallbacks.openContextMenu({ clientX: 1, clientY: 2 } as MouseEvent, { tikzName: "dup" } as any)
		expect(openAndExecute).toHaveBeenCalledWith(
			expect.objectContaining({
				clientX: 1,
				clientY: 2,
				symbolName: "dup",
				categoryNames: ["Mine"],
			})
		)
	})
})
