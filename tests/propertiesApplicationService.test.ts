import { describe, expect, it, vi, beforeEach } from "vitest"
import { PropertiesApplicationService } from "../src/scripts/services/propertiesApplicationService"
import { PropertiesSelectionService } from "../src/scripts/services/propertiesSelectionService"

describe("PropertiesApplicationService", () => {
	let selectionPort: any
	let canvasPort: any
	let groupingPort: any
	let undoPort: any
	let environmentViewPort: any
	let tooltipPort: any
	let selectionService: PropertiesSelectionService

	beforeEach(() => {
		selectionPort = {
			getSelectedComponents: vi.fn().mockReturnValue([]),
			rotateSelection: vi.fn(),
			flipSelection: vi.fn(),
			alignSelection: vi.fn(),
			distributeSelection: vi.fn(),
		}
		canvasPort = {
			resetView: vi.fn(),
			fitView: vi.fn(),
			changeGrid: vi.fn(),
			componentsToForeground: vi.fn(),
			componentsToBackground: vi.fn(),
			moveComponentsForward: vi.fn(),
			moveComponentsBackward: vi.fn(),
			getGridSettings: vi.fn().mockReturnValue({ majorGridSizecm: 2, majorGridSubdivisions: 4 }),
		}
		groupingPort = { groupSelection: vi.fn() }
		undoPort = { addState: vi.fn() }
		environmentViewPort = { getElement: vi.fn(() => document.createElement("div")) }
		tooltipPort = { refresh: vi.fn() }
		selectionService = new PropertiesSelectionService()
	})

	it("builds general settings state for empty selection", () => {
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			selectionService
		)

		const state = service.buildPanelState([])

		expect(state.mode).toBe("empty")
		expect(state.title).toBe("General settings")
		expect(state.minorGridDisplay).toBe("0.5 cm")
		expect(state.environmentViewRequired).toBe(true)
	})

	it("builds single-selection state from the selected component properties", () => {
		const component = {
			displayName: "Resistor",
			properties: { sorted: vi.fn(() => [{ getHTMLElement: vi.fn() }]) },
		}
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			selectionService
		)

		const state = service.buildPanelState([component] as any)

		expect(state.mode).toBe("single")
		expect(state.title).toBe("Resistor")
		expect(state.properties).toHaveLength(1)
	})

	it("builds multi-selection actions and overlap properties", () => {
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			{
				buildSingleSelectionProperties: vi.fn(),
				buildMultiSelectionProperties: vi.fn().mockReturnValue({
					properties: [{ getHTMLElement: vi.fn() }],
					transientProperties: [{ remove: vi.fn() }],
				}),
			} as any
		)

		const state = service.buildPanelState([{ displayName: "A" }, { displayName: "B" }] as any)

		expect(state.mode).toBe("multi")
		expect(state.actionSections.length).toBeGreaterThan(0)
		expect(state.properties).toHaveLength(1)
	})

	it("dispatches rotate actions and records undo", () => {
		selectionPort.getSelectedComponents.mockReturnValue([{ id: 1 }])
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			selectionService
		)

		service.runSelectionAction("rotate90cw")

		expect(selectionPort.rotateSelection).toHaveBeenCalledWith(-90)
		expect(undoPort.addState).toHaveBeenCalledTimes(1)
	})

	it("dispatches ordering and alignment actions to the correct ports", () => {
		const selected = [{ id: 1 }]
		selectionPort.getSelectedComponents.mockReturnValue(selected)
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			selectionService
		)

		service.runSelectionAction("foreground")
		service.runSelectionAction("alignLeft")
		service.runSelectionAction("distributeVerticalSpacing")

		expect(canvasPort.componentsToForeground).toHaveBeenCalledWith(selected)
		expect(selectionPort.alignSelection).toHaveBeenCalled()
		expect(selectionPort.distributeSelection).toHaveBeenCalled()
	})

	it("changes grid through the canvas port and returns formatted labels", () => {
		const service = new PropertiesApplicationService(
			selectionPort,
			canvasPort,
			groupingPort,
			undoPort,
			environmentViewPort,
			tooltipPort,
			selectionService
		)

		const gridState = service.changeGrid(3, 6)

		expect(canvasPort.changeGrid).toHaveBeenCalledWith(3, 6)
		expect(gridState.minorGridDisplay).toBe("0.5 cm")
	})
})
