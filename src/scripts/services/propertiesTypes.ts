import type { CircuitComponent } from "../components/circuitComponent"
import type { EditableProperty } from "../properties/editableProperty"

export type PropertyActionId =
	| "resetView"
	| "fitView"
	| "rotate90cw"
	| "rotate90ccw"
	| "rotate45cw"
	| "rotate45ccw"
	| "flipVertical"
	| "flipHorizontal"
	| "foreground"
	| "background"
	| "forward"
	| "backward"
	| "group"
	| "alignLeft"
	| "alignCenterHorizontal"
	| "alignRight"
	| "alignTop"
	| "alignCenterVertical"
	| "alignBottom"
	| "distributeHorizontalCenter"
	| "distributeHorizontalSpacing"
	| "distributeVerticalCenter"
	| "distributeVerticalSpacing"

export type PropertiesPanelMode = "empty" | "single" | "multi"

export type PropertyActionItem = {
	id: PropertyActionId
	label: string
	icon: string | [string, string]
	tooltip?: string
	disabled?: boolean
}

export type PropertyActionSection = {
	title: string
	columns: 1 | 2 | 3 | 4 | 6 | 12
	items: PropertyActionItem[]
}

export type PropertiesPanelState = {
	mode: PropertiesPanelMode
	title: string
	showViewSettings: boolean
	showPropertyEntries: boolean
	majorGridSizecm: number
	majorGridSubdivisions: number
	minorGridDisplay: string
	properties: EditableProperty<any>[]
	transientProperties: EditableProperty<any>[]
	actionSections: PropertyActionSection[]
	environmentViewRequired: boolean
	selectedComponents: CircuitComponent[]
}

export interface SelectionPort {
	getSelectedComponents(): CircuitComponent[]
	rotateSelection(angle: number): void
	flipSelection(horizontal: boolean): void
	alignSelection(mode: -1 | 0 | 1, horizontal: boolean): void
	distributeSelection(mode: 0 | 1, horizontal: boolean): void
}

export interface CanvasViewPort {
	resetView(): void
	fitView(): void
	changeGrid(majorSizecm: number, majorSubdivisions: number): void
	componentsToForeground(components: CircuitComponent[]): void
	componentsToBackground(components: CircuitComponent[]): void
	moveComponentsForward(components: CircuitComponent[]): void
	moveComponentsBackward(components: CircuitComponent[]): void
	getGridSettings(): { majorGridSizecm: number; majorGridSubdivisions: number }
}

export interface GroupingPort {
	groupSelection(components: CircuitComponent[]): void
}

export interface UndoPort {
	addState(): void
}

export interface EnvironmentViewPort {
	getElement(): HTMLElement
}

export interface TooltipPort {
	refresh(): void
}
