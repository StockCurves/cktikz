import { beforeEach, describe, expect, it, vi } from "vitest"

class MockSvgNode {
	node = { style: {} as Record<string, string> }
	addTo() { return this }
	viewbox() { return this }
	width() { return this }
	height() { return this }
	line() { return this }
	circle() { return this }
	rect() { return this }
	ellipse() { return this }
	polygon() { return this }
	polyline() { return this }
	text() { return this }
	fill() { return this }
	stroke() { return this }
	center() { return this }
	move() { return this }
	rotate() { return this }
	use() { return this }
}

vi.mock("@svgdotjs/svg.js", () => ({
	extend: vi.fn(),
	SVG: vi.fn(() => new MockSvgNode()),
	Box: class {
		x: number
		y: number
		w: number
		h: number
		width: number
		height: number

		constructor(xOrBox: any = 0, y = 0, width = 0, height = 0) {
			if (typeof xOrBox === "object" && xOrBox !== null) {
				this.x = xOrBox.x ?? 0
				this.y = xOrBox.y ?? 0
				this.w = xOrBox.w ?? xOrBox.width ?? 0
				this.h = xOrBox.h ?? xOrBox.height ?? 0
			} else {
				this.x = xOrBox
				this.y = y
				this.w = width
				this.h = height
			}
			this.width = this.w
			this.height = this.h
		}
	},
}))

vi.mock("../src/scripts/internal", () => ({
	ComponentSymbol: class {},
	NodeSymbolComponent: class NodeSymbolComponent {
		constructor(public symbol: unknown) {}
	},
	PathSymbolComponent: class PathSymbolComponent {
		constructor(public symbol: unknown) {}
	},
	CircuitComponent: class {},
	defaultStroke: "#000000",
	defaultFill: "#ffffff",
}))

vi.mock("../src/scripts/internal.ts", () => ({
	ComponentSymbol: class {},
	NodeSymbolComponent: class NodeSymbolComponent {
		constructor(public symbol: unknown) {}
	},
	PathSymbolComponent: class PathSymbolComponent {
		constructor(public symbol: unknown) {}
	},
	CircuitComponent: class {},
	defaultStroke: "#000000",
	defaultFill: "#ffffff",
}))

import { ComponentLibraryController } from "../src/scripts/controllers/componentLibraryController"
import { NodeSymbolComponent, PathSymbolComponent } from "../src/scripts/internal"

function makeSymbol(overrides: Partial<any> = {}) {
	return {
		tikzName: "resistor",
		displayName: "Resistor",
		isNodeSymbol: false,
		possibleOptions: [],
		possibleEnumOptions: [],
		maxStroke: 0,
		viewBox: { width: 17, height: 12 },
		symbolElement: { id: () => "symbol-resistor" },
		_mapping: {
			values: () => ({
				toArray: () => [{ viewBox: { x: 0, y: 0, w: 17, h: 12, width: 17, height: 12 } }],
			}),
		},
		...overrides,
	}
}

describe("ComponentLibraryController", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<input id="componentFilterInput" />
			<button id="filterRegexButton"></button>
			<div id="invalid-feedback-text" class="d-none"></div>
			<div id="leftOffcanvasAccordion"></div>
		`
	})

	it("renders grouped symbols into accordion sections", () => {
		const controller = new ComponentLibraryController()
		const root = document.getElementById("leftOffcanvasAccordion") as HTMLDivElement
		controller.render(
			root,
			[
				makeSymbol({ groupName: "Analog", tikzName: "opamp", displayName: "OpAmp" }),
				makeSymbol({ groupName: "Analog", tikzName: "vcc", displayName: "VCC" }),
				makeSymbol({ groupName: "Power", tikzName: "gnd", displayName: "GND" }),
			],
			{
				hideDrawer: vi.fn(),
				switchToComponentMode: vi.fn(),
				cancelComponentPlacement: vi.fn(),
				placeComponent: vi.fn(),
				openContextMenu: vi.fn(async () => {}),
			}
		)

		expect(root.querySelectorAll(".accordion-item")).toHaveLength(2)
		expect(root.querySelectorAll(".libComponent")).toHaveLength(3)
		expect((root.querySelector(".accordion-button") as HTMLButtonElement).innerText).toBe("Analog")
	})

	it("filters component groups by title and search data", () => {
		const controller = new ComponentLibraryController()
		const root = document.getElementById("leftOffcanvasAccordion") as HTMLDivElement
		controller.render(
			root,
			[
				makeSymbol({ groupName: "Analog", tikzName: "opamp", displayName: "OpAmp" }),
				makeSymbol({ groupName: "Power", tikzName: "gnd", displayName: "Ground" }),
			],
			{
				hideDrawer: vi.fn(),
				switchToComponentMode: vi.fn(),
				cancelComponentPlacement: vi.fn(),
				placeComponent: vi.fn(),
				openContextMenu: vi.fn(async () => {}),
			}
		)

		;(document.getElementById("componentFilterInput") as HTMLInputElement).value = "gnd"
		controller.filterComponents(new Event("input", { bubbles: true, cancelable: true }))

		const buttons = Array.from(document.querySelectorAll(".libComponent")) as HTMLDivElement[]
		expect(buttons[0].classList.contains("d-none")).toBe(true)
		expect(buttons[1].classList.contains("d-none")).toBe(false)
		expect((document.querySelectorAll(".accordion-item")[0] as HTMLDivElement).classList.contains("d-none")).toBe(true)
		expect((document.querySelectorAll(".accordion-item")[1] as HTMLDivElement).classList.contains("d-none")).toBe(false)
	})

	it("places a component and opens the context menu callback", async () => {
		const controller = new ComponentLibraryController()
		const root = document.getElementById("leftOffcanvasAccordion") as HTMLDivElement
		const hideDrawer = vi.fn()
		const switchToComponentMode = vi.fn()
		const cancelComponentPlacement = vi.fn()
		const placeComponent = vi.fn()
		const openContextMenu = vi.fn(async () => {})

		controller.render(root, [makeSymbol()], {
			hideDrawer,
			switchToComponentMode,
			cancelComponentPlacement,
			placeComponent,
			openContextMenu,
		})

		;(document.querySelector(".libComponent") as HTMLDivElement).dispatchEvent(
			new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 })
		)
		expect(switchToComponentMode).toHaveBeenCalled()
		expect(cancelComponentPlacement).toHaveBeenCalled()
		expect(placeComponent.mock.calls[0][0]).toBeInstanceOf(PathSymbolComponent)
		expect(hideDrawer).toHaveBeenCalled()

		await (document.querySelector(".libComponent") as HTMLDivElement).dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 20 })
		)
		expect(openContextMenu).toHaveBeenCalled()
	})
})
