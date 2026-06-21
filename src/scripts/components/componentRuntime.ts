import * as SVG from "@svgdotjs/svg.js"

export type ComponentRuntime = {
	registerComponent: (component: unknown) => void
	removeComponent: (component: unknown) => void
	createSelectionElement: () => SVG.Element
	createVisualizationGroup: () => SVG.Element
	putSelectionElement: (element: SVG.Element) => void
	setSnapCursorVisible: (visible: boolean) => void
	snapDrag: (component: unknown, enable: boolean, dragElement?: SVG.Element) => void
	bringToForeground: (components: unknown[]) => void
	sendToBackground: (components: unknown[]) => void
	moveForward: (components: unknown[]) => void
	moveBackward: (components: unknown[]) => void
	addUndoState: () => void
	getSelectionReference: () => unknown
	setSelectionReference: (component: unknown | null) => void
	getSelectedCount: () => number
}

function createFallbackElement(): SVG.Element {
	const classList = {
		add: () => {},
		remove: () => {},
	}
	const parentElement = {
		index: () => 0,
		add: () => parentElement,
	}
	const element: any = {
		node: {
			classList,
			style: {},
			setAttribute: () => {},
			getAttribute: () => null,
		},
		hide: () => element,
		show: () => element,
		size: () => element,
		center: () => element,
		transform: () => element,
		add: () => element,
		remove: () => {},
		fill: () => element,
		stroke: () => element,
		move: () => element,
		plot: () => element,
		insertAfter: () => element,
		insertBefore: () => element,
		parent: () => parentElement,
		bbox: () => new SVG.Box(0, 0, 0, 0),
		clone: () => createFallbackElement(),
		find: () => [],
		addClass: () => element,
		removeClass: () => element,
		attr: () => element,
	}
	return element as SVG.Element
}

const defaultComponentRuntime: ComponentRuntime = {
	registerComponent: () => {},
	removeComponent: () => {},
	createSelectionElement: () => createFallbackElement(),
	createVisualizationGroup: () => createFallbackElement(),
	putSelectionElement: () => {},
	setSnapCursorVisible: () => {},
	snapDrag: () => {},
	bringToForeground: () => {},
	sendToBackground: () => {},
	moveForward: () => {},
	moveBackward: () => {},
	addUndoState: () => {},
	getSelectionReference: () => null,
	setSelectionReference: () => {},
	getSelectedCount: () => 0,
}

let componentRuntime: ComponentRuntime = defaultComponentRuntime

export function configureComponentRuntime(runtime: Partial<ComponentRuntime> | null) {
	componentRuntime = runtime ? { ...defaultComponentRuntime, ...runtime } : defaultComponentRuntime
}

export function getComponentRuntime(): ComponentRuntime {
	return componentRuntime
}
