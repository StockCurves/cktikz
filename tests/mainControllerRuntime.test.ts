import { describe, expect, it, vi, afterEach } from "vitest"
import { configureMainControllerRuntime } from "../src/scripts/controllers/mainControllerRuntime"
import { getComponentRuntime, configureComponentRuntime } from "../src/scripts/components/componentRuntime"
import { getPropertyRuntime, configurePropertyRuntime } from "../src/scripts/properties/propertyRuntime"
import { getNamingRuntime, configureNamingRuntime } from "../src/scripts/mixins/namingRuntime"

describe("mainControllerRuntime", () => {
	afterEach(() => {
		configureComponentRuntime(null)
		configurePropertyRuntime(null)
		configureNamingRuntime(null)
	})

	it("wires property, naming, and component runtime through one bootstrap", () => {
		const dragTarget = { draggingFromInput: null as HTMLElement | null }
		const firstComponent = { name: { value: "R1" } } as any
		const secondComponent = { name: { value: "R2" } } as any
		const selectionElement = { kind: "selection" } as any
		const visualizationGroup = { kind: "group" } as any
		const selectionReference = { current: null as any }

		const dependencies = {
			switchMode: vi.fn(),
			draggingInputTarget: dragTarget,
			setDraggingInputTarget: vi.fn((element: HTMLElement | null) => {
				dragTarget.draggingFromInput = element
			}),
			addUndoState: vi.fn(),
			circuitComponents: [firstComponent, secondComponent] as any,
			addComponent: vi.fn(),
			removeComponent: vi.fn(),
			createSelectionElement: vi.fn(() => selectionElement),
			createVisualizationGroup: vi.fn(() => visualizationGroup),
			putSelectionElement: vi.fn(),
			setSnapCursorVisible: vi.fn(),
			snapDrag: vi.fn(),
			bringToForeground: vi.fn(),
			sendToBackground: vi.fn(),
			moveForward: vi.fn(),
			moveBackward: vi.fn(),
			getSelectionReference: vi.fn(() => selectionReference.current),
			setSelectionReference: vi.fn((component) => {
				selectionReference.current = component
			}),
			createExportId: vi.fn((prefix: string) => `${prefix}42`),
			dragPanMode: 7,
		}

		configureMainControllerRuntime(dependencies)

		getPropertyRuntime().enterDragPanMode()
		expect(dependencies.switchMode).toHaveBeenCalledWith(7)

		const input = document.createElement("input")
		getPropertyRuntime().markDraggingInput(input)
		expect(dragTarget.draggingFromInput).toBe(input)

		getPropertyRuntime().addUndoState()
		expect(dependencies.addUndoState).toHaveBeenCalled()

		expect(getNamingRuntime().isNameTaken("R1", secondComponent)).toBe(true)
		expect(getNamingRuntime().isNameTaken("R1", firstComponent)).toBe(false)
		expect(getNamingRuntime().createExportId("N")).toBe("N42")

		expect(getComponentRuntime().createSelectionElement()).toBe(selectionElement)
		expect(getComponentRuntime().createVisualizationGroup()).toBe(visualizationGroup)

		getComponentRuntime().registerComponent(firstComponent)
		expect(dependencies.addComponent).toHaveBeenCalledWith(firstComponent)

		getComponentRuntime().setSelectionReference(secondComponent)
		expect(selectionReference.current).toBe(secondComponent)
		expect(getComponentRuntime().getSelectionReference()).toBe(secondComponent)
	})
})
