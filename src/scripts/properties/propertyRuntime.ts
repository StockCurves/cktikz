export type PropertyRuntime = {
	enterDragPanMode: () => void
	markDraggingInput: (element: HTMLElement | null) => void
	addUndoState: () => void
}

const defaultPropertyRuntime: PropertyRuntime = {
	enterDragPanMode: () => {},
	markDraggingInput: () => {},
	addUndoState: () => {},
}

let propertyRuntime: PropertyRuntime = defaultPropertyRuntime

export function configurePropertyRuntime(runtime: Partial<PropertyRuntime> | null) {
	propertyRuntime = runtime ? { ...defaultPropertyRuntime, ...runtime } : defaultPropertyRuntime
}

export function getPropertyRuntime(): PropertyRuntime {
	return propertyRuntime
}
