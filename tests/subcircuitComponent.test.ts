/**
 * Unit tests for SubcircuitComponent
 *
 * Strategy: mock the entire `internal` barrel and provide a stub GroupComponent
 * for SubcircuitComponent to extend. This avoids the circular dep in Node ESM.
 * We test SubcircuitComponent's own logic: serialisation and toTikzString.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------
const { components, canvas, FakePoint, FakeBox, makeEl, StubGroupComponent } = vi.hoisted(() => {
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

	/**
	 * Stub GroupComponent — SubcircuitComponent extends this.
	 * It provides just enough interface to run the SubcircuitComponent constructor
	 * and its own methods (toJson, toTikzString, etc.).
	 */
	class StubGroupComponent {
		// GroupComponent-level state
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
		isSelectionReference = false
		componentProperties = new Map()
		properties = { add: vi.fn() }
		groupedComponents: any[] = []

		static jsonSaveMap = new Map()
		static fromJson(_o: any): any {}

		constructor(comps: any[] = []) {
			;(components as any[]).push(this)
			this.selectionElement = canvas.rect(0, 0)
			this.visualization = canvas.group()
			this.groupedComponents = [...comps]

			// Mimics GroupComponent.update() on construction
			if (comps.length > 0) {
				let box: any = comps[0].bbox
				for (let i = 1; i < comps.length; i++) box = box.merge(comps[i].bbox)
				this._bbox = box
				this.position = new FakePoint(box.cx, box.cy)
				this.referencePosition = this.position.sub(new FakePoint(box.x, box.y))
			}
		}

		update() {
			this._bbox = undefined
			for (const c of this.groupedComponents) {
				this._bbox = this._bbox ? this._bbox.merge(c.bbox) : c.bbox
			}
			if (!this._bbox) return
			this.position = new FakePoint(this._bbox.cx, this._bbox.cy)
			this.referencePosition = this.position.sub(new FakePoint(this._bbox.x, this._bbox.y))
		}

		moveTo(pos: any) {
			const rel = pos.sub(this.position)
			for (const c of this.groupedComponents) c.moveRel(rel)
			this.update()
		}

		moveRel(delta: any) {
			for (const c of this.groupedComponents) c.moveRel(delta)
			this.update()
		}

		viewSelected(_show: boolean) {}
		draggable(_d: boolean) {}
		remove() {}
		getTransformMatrix() { return {} }
		recalculateSnappingPoints() {}
		setAsSelectionReference() {}
		requiredTikzLibraries() { return [] }
		toJson() { return { type: "group", components: [] } }
		getSnappingInfo() { return { additionalSnappingPoints: [], trackedSnappingPoints: [] } }
		isInsideSelectionRectangle(_sel: any) { return false }
	}

	return { components, canvas, FakePoint, FakeBox, makeEl, StubGroupComponent }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@svgdotjs/svg.js", () => ({
	extend: vi.fn(),
	Number: class {},
	Color: class {},
	Symbol: class {},
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
 * Provides stub GroupComponent so SubcircuitComponent can extend it.
 * Does NOT re-export groupComponent.ts or subcircuitComponent.ts (breaks circular dep).
 */
vi.mock("../src/scripts/internal", () => {
	class PropertiesCollection { add = vi.fn() }
	const PropertyCategories = { ordering: "ordering", manipulation: "manipulation" }
	class SectionHeaderProperty { constructor(public label: string) {} }
	class ButtonGridProperty { constructor(..._a: any[]) {} }

	return {
		GroupComponent: StubGroupComponent,
		CircuitComponent: StubGroupComponent, // also used as base by some checks
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
		GroupSaveObject: {},
	}
})

// ---------------------------------------------------------------------------
// Real class under test
// ---------------------------------------------------------------------------
import { SubcircuitComponent } from "../src/scripts/components/subcircuitComponent"

// ---------------------------------------------------------------------------
// Helper: minimal fake inner component
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
describe("SubcircuitComponent", () => {
	beforeEach(() => {
		components.length = 0
		vi.clearAllMocks()
		canvas.rect.mockImplementation(makeEl)
		canvas.group.mockImplementation(makeEl)
	})

	it("does NOT crash when created with no components", () => {
		expect(() => new SubcircuitComponent("MyCircuit", [])).not.toThrow()
	})

	it("sets displayName correctly", () => {
		const sub = new SubcircuitComponent("TestSub", [])
		expect(sub.displayName).toBe("TestSub")
	})

	describe("toJson()", () => {
		it("returns type = 'subcircuit'", () => {
			const sub = new SubcircuitComponent("MyCircuit", [])
			expect(sub.toJson().type).toBe("subcircuit")
		})

		it("includes displayName in json", () => {
			const sub = new SubcircuitComponent("MyCircuit", [])
			expect(sub.toJson().displayName).toBe("MyCircuit")
		})

		it("serialises each inner component", () => {
			const comp = makeFakeComponent(new FakeBox(0, 0, 10, 10))
			const sub = new SubcircuitComponent("WithComp", [comp])
			const json = sub.toJson()
			expect(json.components).toHaveLength(1)
			expect(json.components[0]).toEqual({ type: "fake" })
		})

		it("includes position", () => {
			const sub = new SubcircuitComponent("PosTest", [])
			const json = sub.toJson()
			expect(json.position).toBeDefined()
			expect(typeof json.position.x).toBe("number")
			expect(typeof json.position.y).toBe("number")
		})
	})

	describe("toTikzString()", () => {
		it("outputs joined tikz string of inner components", () => {
			const comp1 = makeFakeComponent(new FakeBox(0, 0, 10, 10))
			comp1.toTikzString = () => "\\draw (0,0) node {A};"
			const comp2 = makeFakeComponent(new FakeBox(10, 10, 10, 10))
			comp2.toTikzString = () => "\\draw (1,1) node {B};"
			const sub = new SubcircuitComponent("mySymbol", [comp1, comp2])
			const tikz = sub.toTikzString()
			expect(tikz).toBe("\\draw (0,0) node {A};\n\t\\draw (1,1) node {B};")
		})
	})
})
