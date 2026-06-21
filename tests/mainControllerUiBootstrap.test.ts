import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { initializeMainControllerUiBootstrap } from "../src/scripts/controllers/mainControllerUiBootstrap"

describe("mainControllerUiBootstrap", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<button id="exportCircuiTikZButton"></button>
			<button id="exportSVGButton"></button>
			<div id="canvas"></div>
			<input id="darkModeSwitch" type="checkbox" />
		`
		document.documentElement.setAttribute("data-bs-theme", "light")
		localStorage.clear()
	})

	afterEach(() => {
		document.body.innerHTML = ""
		localStorage.clear()
	})

	it("binds export buttons, context menu actions, and theme switch", async () => {
		const toggleTikzEditor = vi.fn()
		const exportSvg = vi.fn()
		const groupSelection = vi.fn()
		const ungroupSelection = vi.fn()
		const createSubcircuitFromSelection = vi.fn()
		const preprocessAllSymbolColors = vi.fn()
		const onThemeChanged = vi.fn()
		const updateTheme = vi.fn()
		const grouped = { constructor: { name: "GroupComponent" } }
		let selected: unknown[] = [grouped]
		const openForResult = vi.fn().mockResolvedValue("ungroup")

		initializeMainControllerUiBootstrap({
			toggleTikzEditor,
			exportSvg,
			getSelectedComponents: () => selected,
			isGroupComponent: (component) => (component as { constructor?: { name?: string } })?.constructor?.name === "GroupComponent",
			groupSelection,
			ungroupSelection: ungroupSelection as any,
			createSubcircuitFromSelection,
			createContextMenu: () => ({ openForResult }),
			preprocessAllSymbolColors,
			onThemeChanged,
			updateTheme,
		})

		;(document.getElementById("exportCircuiTikZButton") as HTMLButtonElement).click()
		;(document.getElementById("exportSVGButton") as HTMLButtonElement).click()

		const contextEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 20 })
		document.getElementById("canvas")?.dispatchEvent(contextEvent)
		await Promise.resolve()

		const switchElement = document.getElementById("darkModeSwitch") as HTMLInputElement
		switchElement.checked = true
		switchElement.dispatchEvent(new Event("change", { bubbles: true }))

		expect(toggleTikzEditor).toHaveBeenCalledTimes(1)
		expect(exportSvg).toHaveBeenCalledTimes(1)
		expect(openForResult).toHaveBeenCalledWith(10, 20)
		expect(ungroupSelection).toHaveBeenCalledWith(grouped)
		expect(preprocessAllSymbolColors).toHaveBeenCalledTimes(1)
		expect(onThemeChanged).toHaveBeenCalledWith(true)
		expect(document.documentElement.getAttribute("data-bs-theme")).toBe("dark")
		expect(localStorage.getItem("circuitikz-designer-theme")).toBe("dark")
		expect(updateTheme).toHaveBeenCalledTimes(2)
	})

	it("groups multi-selection and can save selection as symbol", async () => {
		const groupSelection = vi.fn()
		const createSubcircuitFromSelection = vi.fn()
		let selected: unknown[] = [{ id: 1 }, { id: 2 }]
		const openForResult = vi.fn()
			.mockResolvedValueOnce("group")
			.mockResolvedValueOnce("subcircuit")

		initializeMainControllerUiBootstrap({
			toggleTikzEditor: vi.fn(),
			exportSvg: vi.fn(),
			getSelectedComponents: () => selected,
			isGroupComponent: () => false,
			groupSelection,
			ungroupSelection: vi.fn() as any,
			createSubcircuitFromSelection,
			createContextMenu: () => ({ openForResult }),
			preprocessAllSymbolColors: vi.fn(),
			onThemeChanged: vi.fn(),
			updateTheme: vi.fn(),
		})

		const canvas = document.getElementById("canvas")
		canvas?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 2 }))
		await Promise.resolve()
		canvas?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 3, clientY: 4 }))
		await Promise.resolve()

		expect(groupSelection).toHaveBeenCalledWith(selected)
		expect(createSubcircuitFromSelection).toHaveBeenCalledTimes(1)
	})
})
