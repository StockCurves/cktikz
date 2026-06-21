import * as SVG from "@svgdotjs/svg.js"
import { configureComponentRuntime } from "../components/componentRuntime"
import type { CircuitComponent } from "../components/circuitComponent"
import { configureNamingRuntime } from "../mixins/namingRuntime"
import { configurePropertyRuntime } from "../properties/propertyRuntime"
import type { TextProperty } from "../properties/textProperty"

export type MainControllerRuntimeDependencies = {
	switchMode: (mode: number) => void
	draggingInputTarget: { draggingFromInput: HTMLElement | null } | null
	setDraggingInputTarget: (element: HTMLElement | null) => void
	addUndoState: () => void
	circuitComponents: CircuitComponent[]
	addComponent: (component: CircuitComponent) => void
	removeComponent: (component: CircuitComponent) => void
	createSelectionElement: () => SVG.Element
	createVisualizationGroup: () => SVG.Element
	putSelectionElement: (element: SVG.Element) => void
	setSnapCursorVisible: (visible: boolean) => void
	snapDrag: (component: CircuitComponent, enable: boolean, dragElement?: SVG.Element) => void
	bringToForeground: (components: CircuitComponent[]) => void
	sendToBackground: (components: CircuitComponent[]) => void
	moveForward: (components: CircuitComponent[]) => void
	moveBackward: (components: CircuitComponent[]) => void
	getSelectionReference: () => CircuitComponent | null
	setSelectionReference: (component: CircuitComponent | null) => void
	createExportId: (prefix: string) => string
	dragPanMode: number
}

export function configureMainControllerRuntime(dependencies: MainControllerRuntimeDependencies) {
	configurePropertyRuntime({
		enterDragPanMode: () => dependencies.switchMode(dependencies.dragPanMode),
		markDraggingInput: (element) => {
			if (dependencies.draggingInputTarget) {
				dependencies.setDraggingInputTarget(element)
			}
		},
		addUndoState: dependencies.addUndoState,
	})

	configureNamingRuntime({
		isNameTaken: (text, self) =>
			dependencies.circuitComponents.some((component) => {
				if (component === self || !("name" in component)) {
					return false
				}
				const otherName = (component as CircuitComponent & { name?: TextProperty }).name
				return text !== "" && otherName?.value === text
			}),
		createExportId: dependencies.createExportId,
	})

	configureComponentRuntime({
		registerComponent: dependencies.addComponent,
		removeComponent: dependencies.removeComponent,
		createSelectionElement: dependencies.createSelectionElement,
		createVisualizationGroup: dependencies.createVisualizationGroup,
		putSelectionElement: dependencies.putSelectionElement,
		setSnapCursorVisible: dependencies.setSnapCursorVisible,
		snapDrag: dependencies.snapDrag,
		bringToForeground: dependencies.bringToForeground,
		sendToBackground: dependencies.sendToBackground,
		moveForward: dependencies.moveForward,
		moveBackward: dependencies.moveBackward,
		addUndoState: dependencies.addUndoState,
		getSelectionReference: dependencies.getSelectionReference,
		setSelectionReference: dependencies.setSelectionReference,
	})
}
