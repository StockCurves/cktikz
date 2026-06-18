import type { CircuitComponent } from "../components/circuitComponent"
import { PropertiesSelectionService } from "./propertiesSelectionService"
import {
	CanvasViewPort,
	EnvironmentViewPort,
	GroupingPort,
	PropertiesPanelState,
	PropertyActionId,
	PropertyActionSection,
	SelectionPort,
	TooltipPort,
	UndoPort,
} from "./propertiesTypes"

const buildMinorGridDisplay = (majorSizecm: number, majorSubdivisions: number) =>
	(majorSizecm / majorSubdivisions).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " cm"

const MULTI_SELECTION_ACTIONS: PropertyActionSection[] = [
	{
		title: "Selection",
		columns: 2,
		items: [
			{ id: "rotate90cw", label: "Rotate 90° CW", icon: "rotate_right", tooltip: "Rotate the components 90 degrees clockwise" },
			{ id: "rotate90ccw", label: "Rotate 90° CCW", icon: "rotate_left", tooltip: "Rotate the components 90 degrees counter clockwise" },
			{ id: "rotate45cw", label: "Rotate 45° CW", icon: "rotate_right", tooltip: "Rotate the components 45 degrees clockwise" },
			{ id: "rotate45ccw", label: "Rotate 45° CCW", icon: "rotate_left", tooltip: "Rotate the components 45 degrees counter clockwise" },
			{ id: "flipVertical", label: "Flip vertically", icon: ["flip", "rotateText"], tooltip: "Flip the components around its x-axis" },
			{ id: "flipHorizontal", label: "Flip horizontally", icon: "flip", tooltip: "Flip the components around its y-axis" },
		],
	},
	{
		title: "Ordering",
		columns: 2,
		items: [
			{ id: "foreground", label: "Foreground", icon: "" },
			{ id: "background", label: "Background", icon: "" },
			{ id: "forward", label: "Forward", icon: "" },
			{ id: "backward", label: "Backward", icon: "" },
		],
	},
	{
		title: "Grouping",
		columns: 1,
		items: [{ id: "group", label: "Group", icon: "" }],
	},
	{
		title: "Align",
		columns: 3,
		items: [
			{ id: "alignLeft", label: "", icon: "align_horizontal_left" },
			{ id: "alignCenterHorizontal", label: "", icon: "align_horizontal_center" },
			{ id: "alignRight", label: "", icon: "align_horizontal_right" },
			{ id: "alignTop", label: "", icon: "align_vertical_top" },
			{ id: "alignCenterVertical", label: "", icon: "align_vertical_center" },
			{ id: "alignBottom", label: "", icon: "align_vertical_bottom" },
		],
	},
	{
		title: "Distribute",
		columns: 2,
		items: [
			{ id: "distributeHorizontalCenter", label: "Center", icon: "horizontal_distribute" },
			{ id: "distributeHorizontalSpacing", label: "Spacing", icon: "align_justify_space_even" },
			{ id: "distributeVerticalCenter", label: "Center", icon: "vertical_distribute" },
			{ id: "distributeVerticalSpacing", label: "Spacing", icon: "align_space_even" },
		],
	},
]

const ALIGNMENT = {
	START: -1 as const,
	CENTER: 0 as const,
	END: 1 as const,
}

const DISTRIBUTION = {
	CENTER: 0 as const,
	SPACE: 1 as const,
}

export class PropertiesApplicationService {
	public constructor(
		private readonly selectionPort: SelectionPort,
		private readonly canvasPort: CanvasViewPort,
		private readonly groupingPort: GroupingPort,
		private readonly undoPort: UndoPort,
		private readonly environmentViewPort: EnvironmentViewPort,
		private readonly tooltipPort: TooltipPort,
		private readonly selectionService = new PropertiesSelectionService()
	) {}

	public buildPanelState(selection: CircuitComponent[] = this.selectionPort.getSelectedComponents()): PropertiesPanelState {
		const grid = this.canvasPort.getGridSettings()
		const baseState = {
			majorGridSizecm: grid.majorGridSizecm,
			majorGridSubdivisions: grid.majorGridSubdivisions,
			minorGridDisplay: buildMinorGridDisplay(grid.majorGridSizecm, grid.majorGridSubdivisions),
			selectedComponents: selection,
		}

		if (selection.length > 1) {
			const result = this.selectionService.buildMultiSelectionProperties(selection)
			return {
				mode: "multi",
				title: "Selection",
				showViewSettings: false,
				showPropertyEntries: true,
				properties: result.properties,
				transientProperties: result.transientProperties,
				actionSections: MULTI_SELECTION_ACTIONS,
				environmentViewRequired: false,
				...baseState,
			}
		}

		if (selection.length === 1) {
			const result = this.selectionService.buildSingleSelectionProperties(selection[0])
			return {
				mode: "single",
				title: selection[0].displayName,
				showViewSettings: false,
				showPropertyEntries: true,
				properties: result.properties,
				transientProperties: result.transientProperties,
				actionSections: [],
				environmentViewRequired: false,
				...baseState,
			}
		}

		return {
			mode: "empty",
			title: "General settings",
			showViewSettings: true,
			showPropertyEntries: false,
			properties: [],
			transientProperties: [],
			actionSections: [],
			environmentViewRequired: true,
			...baseState,
		}
	}

	public getEnvironmentView(): HTMLElement {
		return this.environmentViewPort.getElement()
	}

	public refreshTooltips() {
		this.tooltipPort.refresh()
	}

	public runSelectionAction(actionId: PropertyActionId): void {
		const selectedComponents = this.selectionPort.getSelectedComponents()
		switch (actionId) {
			case "resetView":
				this.canvasPort.resetView()
				return
			case "fitView":
				this.canvasPort.fitView()
				return
			case "rotate90cw":
				this.selectionPort.rotateSelection(-90)
				this.undoPort.addState()
				return
			case "rotate90ccw":
				this.selectionPort.rotateSelection(90)
				this.undoPort.addState()
				return
			case "rotate45cw":
				this.selectionPort.rotateSelection(-45)
				this.undoPort.addState()
				return
			case "rotate45ccw":
				this.selectionPort.rotateSelection(45)
				this.undoPort.addState()
				return
			case "flipVertical":
				this.selectionPort.flipSelection(true)
				this.undoPort.addState()
				return
			case "flipHorizontal":
				this.selectionPort.flipSelection(false)
				this.undoPort.addState()
				return
			case "foreground":
				this.canvasPort.componentsToForeground(selectedComponents)
				return
			case "background":
				this.canvasPort.componentsToBackground(selectedComponents)
				return
			case "forward":
				this.canvasPort.moveComponentsForward(selectedComponents)
				return
			case "backward":
				this.canvasPort.moveComponentsBackward(selectedComponents)
				return
			case "group":
				this.groupingPort.groupSelection(selectedComponents)
				return
			case "alignLeft":
				this.selectionPort.alignSelection(ALIGNMENT.START, true)
				return
			case "alignCenterHorizontal":
				this.selectionPort.alignSelection(ALIGNMENT.CENTER, true)
				return
			case "alignRight":
				this.selectionPort.alignSelection(ALIGNMENT.END, true)
				return
			case "alignTop":
				this.selectionPort.alignSelection(ALIGNMENT.START, false)
				return
			case "alignCenterVertical":
				this.selectionPort.alignSelection(ALIGNMENT.CENTER, false)
				return
			case "alignBottom":
				this.selectionPort.alignSelection(ALIGNMENT.END, false)
				return
			case "distributeHorizontalCenter":
				this.selectionPort.distributeSelection(DISTRIBUTION.CENTER, true)
				return
			case "distributeHorizontalSpacing":
				this.selectionPort.distributeSelection(DISTRIBUTION.SPACE, true)
				return
			case "distributeVerticalCenter":
				this.selectionPort.distributeSelection(DISTRIBUTION.CENTER, false)
				return
			case "distributeVerticalSpacing":
				this.selectionPort.distributeSelection(DISTRIBUTION.SPACE, false)
				return
		}
	}

	public changeGrid(majorSizecm: number, majorSubdivisions: number) {
		this.canvasPort.changeGrid(majorSizecm, majorSubdivisions)
		return {
			majorGridSizecm: majorSizecm,
			majorGridSubdivisions: majorSubdivisions,
			minorGridDisplay: buildMinorGridDisplay(majorSizecm, majorSubdivisions),
		}
	}

	public setSliderValues(majorSizecm: number, majorSubdivisions: number) {
		return this.changeGrid(majorSizecm, majorSubdivisions)
	}
}
