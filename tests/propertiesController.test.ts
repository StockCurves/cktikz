import { beforeEach, describe, expect, it, vi } from "vitest"

const appServiceMocks = vi.hoisted(() => ({
	buildPanelState: vi.fn(),
	runSelectionAction: vi.fn(),
	setSliderValues: vi.fn(),
	changeGrid: vi.fn(),
	refreshTooltips: vi.fn(),
	getEnvironmentView: vi.fn(),
}))

vi.mock("../src/scripts/services/propertiesApplicationService", () => ({
	PropertiesApplicationService: class {
		buildPanelState = appServiceMocks.buildPanelState
		runSelectionAction = appServiceMocks.runSelectionAction
		setSliderValues = appServiceMocks.setSliderValues
		changeGrid = appServiceMocks.changeGrid
		refreshTooltips = appServiceMocks.refreshTooltips
		getEnvironmentView = appServiceMocks.getEnvironmentView
	},
}))

vi.mock("../src/scripts/internal", () => {
	class MockButtonGridProperty {
		private readonly labels: [string, string | [string, string]][]
		private readonly callbacks: (() => void)[]
		constructor(
			_privateColumns: number,
			labels: [string, string | [string, string]][],
			callbacks: (() => void)[]
		) {
			this.labels = labels
			this.callbacks = callbacks
		}
		getHTMLElement() {
			const row = document.createElement("div")
			this.labels.forEach((label, index) => {
				const button = document.createElement("button")
				button.textContent = label[0]
				button.addEventListener("click", this.callbacks[index])
				row.appendChild(button)
			})
			return row
		}
		remove() {}
	}

	class MockSectionHeaderProperty {
		constructor(private readonly title: string) {}
		getHTMLElement() {
			const el = document.createElement("div")
			el.textContent = this.title
			return el
		}
		remove() {}
	}

	return {
		ButtonGridProperty: MockButtonGridProperty,
		CanvasController: {
			instance: {
				majorGridSizecm: 2,
				majorGridSubdivisions: 4,
				resetView: vi.fn(),
				fitView: vi.fn(),
				changeGrid: vi.fn(),
				componentsToForeground: vi.fn(),
				componentsToBackground: vi.fn(),
				moveComponentsForward: vi.fn(),
				moveComponentsBackward: vi.fn(),
			},
		},
		CircuitComponent: class {},
		EditableProperty: class {},
		EnvironmentVariableController: {
			instance: {
				getHTML: vi.fn(() => {
					const el = document.createElement("div")
					el.id = "envVarView"
					return el
				}),
			},
		},
		GroupComponent: { group: vi.fn() },
		MainController: {
			instance: {
				designName: { getHTMLElement: () => document.createElement("div") },
				updateTooltips: vi.fn(),
			},
		},
		SectionHeaderProperty: MockSectionHeaderProperty,
		SelectionController: {
			instance: {
				currentlySelectedComponents: [],
				rotateSelection: vi.fn(),
				flipSelection: vi.fn(),
				alignSelection: vi.fn(),
				distributeSelection: vi.fn(),
			},
		},
		Undo: { addState: vi.fn() },
	}
})

describe("PropertyController", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		document.body.innerHTML = `
			<div id="propertiesTitle"></div>
			<div id="view-properties"><div></div></div>
			<div id="propertiesEntries"></div>
			<button id="resetViewButton"></button>
			<button id="fitViewButton"></button>
			<input id="minorSliderInput" />
			<input id="majorSliderInput" />
			<div id="majorLabel"></div>
			<div id="minorLabel"></div>
			<div id="gridInfo"></div>
		`
		appServiceMocks.getEnvironmentView.mockReturnValue(Object.assign(document.createElement("div"), { id: "envVarView" }))
		appServiceMocks.setSliderValues.mockReturnValue({
			majorGridSizecm: 2,
			majorGridSubdivisions: 4,
			minorGridDisplay: "0.5 cm",
		})
		appServiceMocks.changeGrid.mockReturnValue({
			majorGridSizecm: 3,
			majorGridSubdivisions: 6,
			minorGridDisplay: "0.5 cm",
		})
	})

	it("renders empty state and environment view", async () => {
		appServiceMocks.buildPanelState.mockReturnValue({
			mode: "empty",
			title: "General settings",
			showViewSettings: true,
			showPropertyEntries: false,
			majorGridSizecm: 2,
			majorGridSubdivisions: 4,
			minorGridDisplay: "0.5 cm",
			properties: [],
			transientProperties: [],
			actionSections: [],
			environmentViewRequired: true,
			selectedComponents: [],
		})
		const { PropertyController } = await import("../src/scripts/controllers/propertiesController")

		PropertyController.instance.update()

		expect((document.getElementById("propertiesTitle") as HTMLElement).innerText).toBe("General settings")
		expect(document.getElementById("view-properties")!.classList.contains("d-none")).toBe(false)
		expect(document.getElementById("envVarView")).not.toBeNull()
		expect(appServiceMocks.refreshTooltips).toHaveBeenCalled()
	})

	it("renders multi-selection action sections and properties", async () => {
		const propertyElement = document.createElement("div")
		propertyElement.textContent = "Shared property"
		const property = { getHTMLElement: vi.fn(() => propertyElement), remove: vi.fn() }
		appServiceMocks.buildPanelState.mockReturnValue({
			mode: "multi",
			title: "Selection",
			showViewSettings: false,
			showPropertyEntries: true,
			majorGridSizecm: 2,
			majorGridSubdivisions: 4,
			minorGridDisplay: "0.5 cm",
			properties: [property],
			transientProperties: [],
			actionSections: [{ title: "Ordering", columns: 2, items: [{ id: "foreground", label: "Foreground", icon: "" }] }],
			environmentViewRequired: false,
			selectedComponents: [{}, {}],
		})
		const { PropertyController } = await import("../src/scripts/controllers/propertiesController")

		PropertyController.instance.update()

		expect((document.getElementById("propertiesTitle") as HTMLElement).innerText).toBe("Selection")
		expect(document.getElementById("propertiesEntries")!.textContent).toContain("Ordering")
		expect(document.getElementById("propertiesEntries")!.textContent).toContain("Foreground")
		expect(document.getElementById("propertiesEntries")!.textContent).toContain("Shared property")
	})

	it("dispatches action buttons through the application service", async () => {
		appServiceMocks.buildPanelState.mockReturnValue({
			mode: "multi",
			title: "Selection",
			showViewSettings: false,
			showPropertyEntries: true,
			majorGridSizecm: 2,
			majorGridSubdivisions: 4,
			minorGridDisplay: "0.5 cm",
			properties: [],
			transientProperties: [],
			actionSections: [{ title: "Ordering", columns: 2, items: [{ id: "foreground", label: "Foreground", icon: "" }] }],
			environmentViewRequired: false,
			selectedComponents: [{}, {}],
		})
		const { PropertyController } = await import("../src/scripts/controllers/propertiesController")

		PropertyController.instance.update()
		;(document.querySelector("#propertiesEntries button") as HTMLButtonElement).click()

		expect(appServiceMocks.runSelectionAction).toHaveBeenCalledWith("foreground")
	})

	it("setSliderValues updates labels without rebinding listeners", async () => {
		const { PropertyController } = await import("../src/scripts/controllers/propertiesController")

		PropertyController.instance.setSliderValues(2, 4)
		;(document.getElementById("majorSliderInput") as HTMLInputElement).value = "3"
		document.getElementById("majorSliderInput")!.dispatchEvent(new Event("input", { bubbles: true }))

		expect((document.getElementById("majorLabel") as HTMLElement).innerText).toBe("3 cm")
		expect(appServiceMocks.changeGrid).toHaveBeenCalledTimes(1)
	})
})
