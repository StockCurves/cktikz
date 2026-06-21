/**
 * Unit tests for GroupComponent
 *
 * Strategy: mock the entire `internal` barrel so it doesn't re-export
 * subcircuitComponent.ts (which would create a circular dependency in Node ESM).
 * We provide a minimal stub CircuitComponent for GroupComponent to extend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// vi.hoisted — shared mutable state usable inside vi.mock factories
// ---------------------------------------------------------------------------
const { components, canvas, FakePoint, FakeBox, makeEl, StubCircuitComponent } = vi.hoisted(() => {
	class FakePoint {
		x: number; y: number
		constructor(x = 0, y = 0) { this.x = x; this.y = y }
		sub(o: any) { return new FakePoint(this.x - o.x, this.y - o.y) }
		add(o: any) { return new FakePoint(this.x + o.x, this.y + o.y) }
		mul(o: any) { return new FakePoint(this.x * o.x, this.y * o.y) }
		rotate(_a: number, _c?: any) { return new FakePoint(this.x, this.y) }
		simplifyForJson() { return { x: this.x, y: this.y } }
	}

	class FakeBox {
		x: number; y: number; x2: number; y2: number
		constructor(x = 0, y = 0, w = 0, h = 0) {
			this.x = x; this.y = y; this.x2 = x + w; this.y2 = y + h
		}
		get w() { return this.x2 - this.x }
		get h() { return this.y2 - this.y }
		get cx() { return (this.x + this.x2) / 2 }
		get cy() { return (this.y + this.y2) / 2 }
		merge(o: any): any {
			const x = Math.min(this.x, o.x), y = Math.min(this.y, o.y)
			const x2 = Math.max(this.x2, o.x2), y2 = Math.max(this.y2, o.y2)
			return new FakeBox(x, y, x2 - x, y2 - y)
		}
	}

	const makeEl = () => ({
		node: { classList: { add: vi.fn(), remove: vi.fn() }, style: {} },
		hide: vi.fn().mockReturnThis(), show: vi.fn().mockReturnThis(),
		stroke: vi.fn().mockReturnThis(), fill: vi.fn().mockReturnThis(),
		size: vi.fn().mockReturnThis(), center: vi.fn().mockReturnThis(),
		add: vi.fn().mockReturnThis(), remove: vi.fn().mockReturnThis(),
		put: vi.fn().mockReturnThis(), find: vi.fn().mockReturnValue([]),
		parent: vi.fn().mockReturnValue({ index: vi.fn().mockReturnValue(0), add: vi.fn() }),
		index: vi.fn().mockReturnValue(0),
	})

	const canvas = {
		rect: vi.fn().mockImplementation(makeEl),
		group: vi.fn().mockImplementation(makeEl),
		circle: vi.fn().mockImplementation(makeEl),
		put: vi.fn().mockReturnThis(),
	}

	const components: any[] = []

	// Minimal stub so GroupComponent can extend it
	class StubCircuitComponent {
		position = new FakePoint()
		referencePosition = new FakePoint()
		_bbox: any = undefined
		get bbox() { return this._bbox }
		selectionElement: any = null
		visualization: any = null
		snappingPoints: any[] = []
		parentGroup: any = null
		displayName = ""
		finishedPlacing = false
		isSelected = false
		isHovered = false
		isSelectionReference = false
		componentProperties = new Map()
		properties = { add: vi.fn() }
		static jsonSaveMap = new Map()
		static fromJson(_o: any): any {}
		constructor() {
			// side-effects that CircuitComponent normally does
			;(components as any[]).push(this) // addComponent
			this.selectionElement = canvas.rect(0, 0)
			this.visualization = canvas.group()
		}
		viewSelected(_show: boolean) {}
		draggable(_d: boolean) {}
		remove() { this.visualization?.remove?.() }
		getTransformMatrix() { return new (class M { a=1;b=0;c=0;d=1;e=0;f=0 })() }
		recalculateSnappingPoints(_m?: any) {}
		setAsSelectionReference() {}
		requiredTikzLibraries() { return [] }
		toJson() { return { type: "component" } }
		addPositioning() {}
		addZOrdering() {}
	}

	return { components, canvas, FakePoint, FakeBox, makeEl, StubCircuitComponent }
})

// ---------------------------------------------------------------------------
// Mocks — vi.mock is hoisted; factories can reference hoisted values
// ---------------------------------------------------------------------------
vi.mock("@svgdotjs/svg.js", () => ({
	Point: FakePoint,
	Box: FakeBox,
	G: class { node = { classList: { add: vi.fn() }, style: {} }; add = vi.fn() },
	Line: class {}, Element: class {}, Matrix: class {},
}))

vi.mock("@svgdotjs/svg.draggable.js", () => ({}))

vi.mock("../src/scripts/utils/selectionHelper", () => ({
	rectRectIntersection: vi.fn().mockReturnValue(true),
	selectedBoxWidth: 1,
	selectionColor: "red",
	referenceColor: "cyan",
	hoverColor: "magenta",
	roundTikz: (n: number) => String(n),
}))

/**
 * Mock the entire internal barrel.
 * This is the key: the mock does NOT re-export subcircuitComponent,
 * so the circular dependency is broken entirely.
 */
vi.mock("../src/scripts/internal", () => {
	class PropertiesCollection { add = vi.fn() }
	const PropertyCategories = { ordering: "ordering", manipulation: "manipulation" }
	class SectionHeaderProperty { constructor(public label: string) {} }
	class ButtonGridProperty {
		labels: any
		callbacks: any[]
		constructor(_columns: number, labels: any, callbacks: any[]) {
			this.labels = labels
			this.callbacks = callbacks
		}
	}

	return {
		// Base class stub — GroupComponent will extend this
		CircuitComponent: StubCircuitComponent,
		// Singletons
		MainController: {
			instance: {
				addComponent: vi.fn((c: any) => components.push(c)),
				circuitComponents: components,
				customSymbols: [],
			},
		},
		CanvasController: { instance: { canvas } },
		SelectionController: {
			instance: { selectComponents: vi.fn(), referenceComponent: null },
		},
		SelectionMode: { RESET: "RESET" },
		Undo: { addState: vi.fn() },
		SnapDragHandler: { snapDrag: vi.fn() },
		SnapCursorController: { instance: { visible: false } },
		PropertiesCollection,
		PropertyCategories,
		SectionHeaderProperty,
		ButtonGridProperty,
		EditableProperty: class {},
		SnapPoint: class { recalculate = vi.fn() },
		// NOT re-exporting subcircuitComponent — breaks circular dep
		GroupComponent: undefined,
	}
})

// ---------------------------------------------------------------------------
// Real class under test — imports internal (gets our mock)
// ---------------------------------------------------------------------------
import { GroupComponent } from "../src/scripts/components/groupComponent"

// ---------------------------------------------------------------------------
// Helper: minimal stand-in for a child CircuitComponent
// ---------------------------------------------------------------------------
function makeFakeComponent(bbox: InstanceType<typeof FakeBox>) {
	return {
		bbox,
		position: new FakePoint(bbox.cx, bbox.cy),
		snappingPoints: [],
		visualization: makeEl(),
		parentGroup: null,
		viewSelected: vi.fn(),
		moveRel: vi.fn(),
		moveTo: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		draggable: vi.fn(),
		toJson: vi.fn().mockReturnValue({ type: "fake" }),
	} as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GroupComponent", () => {
	beforeEach(() => {
		components.length = 0
		vi.clearAllMocks()
		canvas.rect.mockImplementation(makeEl)
		canvas.group.mockImplementation(makeEl)
	})

	describe("update()", () => {
		it("does NOT crash when _bbox is cleared manually (simulates empty group)", () => {
			const comp = makeFakeComponent(new FakeBox(10, 20, 100, 50))
			const g = new GroupComponent([comp])
			// Simulate the edge case by clearing groupedComponents and calling update
			;(g as any).groupedComponents = []
			expect(() => g.update()).not.toThrow()
		})

		it("leaves _bbox undefined after groupedComponents is cleared", () => {
			const comp = makeFakeComponent(new FakeBox(10, 20, 100, 50))
			const g = new GroupComponent([comp])
			;(g as any).groupedComponents = []
			g.update()
			expect((g as any)._bbox).toBeUndefined()
		})

		it("computes correct bbox from a single component", () => {
			const comp = makeFakeComponent(new FakeBox(10, 20, 100, 50))
			const g = new GroupComponent([comp])
			g.update()
			const box = (g as any)._bbox
			expect(box.x).toBe(10)
			expect(box.y).toBe(20)
			expect(box.w).toBe(100)
			expect(box.h).toBe(50)
		})

		it("merges bboxes from multiple components", () => {
			const a = makeFakeComponent(new FakeBox(0, 0, 50, 50))
			const b = makeFakeComponent(new FakeBox(40, 40, 50, 50))
			const g = new GroupComponent([a, b])
			g.update()
			const box = (g as any)._bbox
			expect(box.x).toBe(0)
			expect(box.y).toBe(0)
			expect(box.x2).toBe(90)
			expect(box.y2).toBe(90)
		})
	})

	describe("isInsideSelectionRectangle()", () => {
		it("returns false without crashing when _bbox is undefined", () => {
			const comp = makeFakeComponent(new FakeBox(10, 10, 50, 50))
			const g = new GroupComponent([comp])
			// Force _bbox to undefined to test the guard
			;(g as any)._bbox = undefined
			expect(g.isInsideSelectionRectangle(new FakeBox(0, 0, 200, 200) as any)).toBe(false)
		})

		it("delegates to rectRectIntersection when _bbox exists", () => {
			const comp = makeFakeComponent(new FakeBox(10, 10, 50, 50))
			const g = new GroupComponent([comp])
			// rectRectIntersection is mocked to return true
			expect(g.isInsideSelectionRectangle(new FakeBox(0, 0, 200, 200) as any)).toBe(true)
		})
	})

	describe("recalculateSelectionVisuals()", () => {
		it("does NOT crash when _bbox is undefined", () => {
			const comp = makeFakeComponent(new FakeBox(10, 10, 50, 50))
			const g = new GroupComponent([comp])
			;(g as any)._bbox = undefined
			expect(() => (g as any).recalculateSelectionVisuals()).not.toThrow()
		})
	})

	describe("subcircuit action", () => {
		it("invokes the configured subcircuit handler from the grouping property button", () => {
			const comp = makeFakeComponent(new FakeBox(10, 10, 50, 50))
			const handler = vi.fn()
			GroupComponent.setCreateSubcircuitHandler(handler)

			const g = new GroupComponent([comp])
			const orderingProperties = (g as any).properties.get("ordering") ?? []
			const groupingProperty = orderingProperties.find((property: any) => property?.labels?.[1]?.[0] === "Save to Symbols")
			const saveToSymbols = groupingProperty?.callbacks?.[1]

			saveToSymbols()

			expect(handler).toHaveBeenCalledTimes(1)
		})
	})
})
