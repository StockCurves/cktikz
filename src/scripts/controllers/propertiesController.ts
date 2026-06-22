import {
	ButtonGridProperty,
	CanvasController,
	CircuitComponent,
	EditableProperty,
	EnvironmentVariableController,
	GroupComponent,
	MainController,
	SectionHeaderProperty,
	SelectionController,
	SelectionMode,
	Undo,
} from "../internal"
import { PropertiesApplicationService } from "../services/propertiesApplicationService"
import { PropertiesPanelState, PropertyActionSection } from "../services/propertiesTypes"

export type FormEntry = {
	originalObject: object
	propertyName: string
	inputType: string
	currentValue: any
}

export class PropertyController {
	private static _instance: PropertyController
	public static get instance(): PropertyController {
		if (!PropertyController._instance) {
			PropertyController._instance = new PropertyController()
		}
		return PropertyController._instance
	}

	private propertiesContainer: HTMLDivElement | null
	private viewProperties: HTMLDivElement
	private propertiesEntries: HTMLDivElement
	private propertiesTitle: HTMLElement
	private readonly minorSlider: HTMLInputElement
	private readonly majorSlider: HTMLInputElement
	private readonly majorLabel: HTMLElement
	private readonly minorLabel: HTMLElement
	private readonly gridInfo: HTMLElement
	private transientProperties: EditableProperty<any>[] = []
	private showGeneralSettings = false
	private readonly applicationService = new PropertiesApplicationService(
		{
			getSelectedComponents: () => SelectionController.instance.currentlySelectedComponents,
			rotateSelection: (angle) => SelectionController.instance.rotateSelection(angle),
			flipSelection: (horizontal) => SelectionController.instance.flipSelection(horizontal),
			alignSelection: (mode, horizontal) => SelectionController.instance.alignSelection(mode, horizontal),
			distributeSelection: (mode, horizontal) => SelectionController.instance.distributeSelection(mode, horizontal),
		},
		{
			resetView: () => CanvasController.instance.resetView(),
			fitView: () => CanvasController.instance.fitView(),
			changeGrid: (majorSizecm, majorSubdivisions) =>
				CanvasController.instance.changeGrid(majorSizecm, majorSubdivisions),
			componentsToForeground: (components: CircuitComponent[]) =>
				CanvasController.instance.componentsToForeground(components),
			componentsToBackground: (components: CircuitComponent[]) =>
				CanvasController.instance.componentsToBackground(components),
			moveComponentsForward: (components: CircuitComponent[]) =>
				CanvasController.instance.moveComponentsForward(components),
			moveComponentsBackward: (components: CircuitComponent[]) =>
				CanvasController.instance.moveComponentsBackward(components),
			getGridSettings: () => ({
				majorGridSizecm: CanvasController.instance.majorGridSizecm,
				majorGridSubdivisions: CanvasController.instance.majorGridSubdivisions,
			}),
		},
		{
			groupSelection: (components: CircuitComponent[]) => GroupComponent.group(components),
		},
		{
			addState: () => Undo.addState(),
		},
		{
			getElement: () => EnvironmentVariableController.instance.getHTML(),
		},
		{
			refresh: () => MainController.instance.updateTooltips(),
		}
	)

	private constructor() {
		this.propertiesContainer = document.getElementById("propertiesContainer") as HTMLDivElement
		this.propertiesTitle = document.getElementById("propertiesTitle") as HTMLElement
		this.viewProperties = document.getElementById("view-properties") as HTMLDivElement
		this.viewProperties.firstElementChild!.prepend(MainController.instance.designName.getHTMLElement())
		this.propertiesEntries = document.getElementById("propertiesEntries") as HTMLDivElement
		this.minorSlider = document.getElementById("minorSliderInput") as HTMLInputElement
		this.majorSlider = document.getElementById("majorSliderInput") as HTMLInputElement
		this.majorLabel = document.getElementById("majorLabel") as HTMLElement
		this.minorLabel = document.getElementById("minorLabel") as HTMLElement
		this.gridInfo = document.getElementById("gridInfo") as HTMLElement

		;(document.getElementById("resetViewButton") as HTMLButtonElement).addEventListener("click", () => {
			this.applicationService.runSelectionAction("resetView")
		})
		;(document.getElementById("fitViewButton") as HTMLButtonElement).addEventListener("click", () => {
			this.applicationService.runSelectionAction("fitView")
		})

		const settingsBtn = document.getElementById("navbarSettingsButton") as HTMLButtonElement | null
		settingsBtn?.addEventListener("click", () => {
			this.showGeneralSettings = !this.showGeneralSettings
			if (this.showGeneralSettings) {
				SelectionController.instance.selectComponents([], SelectionMode.RESET)
			} else {
				this.update()
			}
		})

		this.minorSlider.addEventListener("input", () => {
			const majorSizecm = CanvasController.instance.majorGridSizecm
			this.renderGridState(this.applicationService.changeGrid(majorSizecm, Number.parseFloat(this.minorSlider.value)))
		})

		this.majorSlider.addEventListener("input", () => {
			const majorSubdivisions = CanvasController.instance.majorGridSubdivisions
			this.renderGridState(this.applicationService.changeGrid(Number.parseFloat(this.majorSlider.value), majorSubdivisions))
		})
	}

	public update() {
		const panelState = this.applicationService.buildPanelState()
		this.renderPanelState(panelState)
		this.applicationService.refreshTooltips()
	}

	public setSliderValues(majorSizecm: number, majorSubdivisions: number) {
		this.renderGridState(this.applicationService.setSliderValues(majorSizecm, majorSubdivisions))
	}

	private renderPanelState(panelState: PropertiesPanelState) {
		this.clearForm()

		if (panelState.mode === "single") {
			this.showGeneralSettings = false
		}

		const shouldShowPanel = panelState.mode === "single" || (panelState.mode === "empty" && this.showGeneralSettings)
		if (this.propertiesContainer) {
			const wasVisible = !this.propertiesContainer.classList.contains("d-none")
			this.propertiesContainer.classList.toggle("d-none", !shouldShowPanel)

			if (wasVisible !== shouldShowPanel) {
				requestAnimationFrame(() => {
					window.dispatchEvent(new Event("resize"))
				})
			}
		}

		this.propertiesTitle.innerText = panelState.title
		this.viewProperties.classList.toggle("d-none", !panelState.showViewSettings)
		this.propertiesEntries.classList.toggle("d-none", !panelState.showPropertyEntries)

		this.renderGridState(panelState)

		if (panelState.environmentViewRequired) {
			const environmentView = this.applicationService.getEnvironmentView()
			if (!document.getElementById("envVarView")) {
				this.viewProperties.appendChild(environmentView)
			}
		}

		this.transientProperties.push(...panelState.transientProperties)

		if (panelState.showPropertyEntries) {
			for (const section of panelState.actionSections) {
				this.renderActionSection(section)
			}
			this.propertiesEntries.append(...panelState.properties.map((property) => property.getHTMLElement()))
		}
	}

	private renderActionSection(section: PropertyActionSection) {
		const header = new SectionHeaderProperty(section.title)
		this.transientProperties.push(header)
		this.propertiesEntries.appendChild(header.getHTMLElement())

		const grid = new ButtonGridProperty(
			section.columns,
			section.items.map((item) => [item.label, item.icon]),
			section.items.map((item) => () => this.applicationService.runSelectionAction(item.id)),
			false,
			section.items.map((item) => item.tooltip ?? "")
		)
		this.transientProperties.push(grid)
		this.propertiesEntries.appendChild(grid.getHTMLElement())
	}

	private renderGridState(state: {
		majorGridSizecm: number
		majorGridSubdivisions: number
		minorGridDisplay: string
	}) {
		this.minorSlider.value = state.majorGridSubdivisions.toString()
		this.majorSlider.value = state.majorGridSizecm.toString()
		this.majorLabel.innerText = state.majorGridSizecm + " cm"
		this.minorLabel.innerText = state.majorGridSubdivisions.toString()
		this.gridInfo.innerText = state.minorGridDisplay
	}

	private clearForm() {
		for (const property of this.transientProperties) {
			property.remove()
		}
		this.transientProperties = []
		this.propertiesTitle.innerText = "Properties"
		this.viewProperties.classList.add("d-none")
		this.propertiesEntries.classList.add("d-none")
		this.propertiesEntries.innerText = ""

		while (this.propertiesEntries.lastElementChild) {
			this.propertiesEntries.removeChild(this.propertiesEntries.lastElementChild)
		}
	}
}
