import { vi } from "vitest"

// ---------------------------------------------------------------------------
// Minimal SVG.Point mock
// ---------------------------------------------------------------------------
export class FakePoint {
	x: number
	y: number
	constructor(x = 0, y = 0) {
		this.x = x
		this.y = y
	}
	sub(other: FakePoint): FakePoint {
		return new FakePoint(this.x - other.x, this.y - other.y)
	}
	add(other: FakePoint): FakePoint {
		return new FakePoint(this.x + other.x, this.y + other.y)
	}
	mul(other: FakePoint): FakePoint {
		return new FakePoint(this.x * other.x, this.y * other.y)
	}
	rotate(_angleDeg: number, _center?: FakePoint): FakePoint {
		return new FakePoint(this.x, this.y)
	}
	simplifyForJson() {
		return { x: this.x, y: this.y }
	}
}

// ---------------------------------------------------------------------------
// Minimal SVG.Box mock
// ---------------------------------------------------------------------------
export class FakeBox {
	x: number
	y: number
	x2: number
	y2: number
	constructor(x = 0, y = 0, w = 0, h = 0) {
		this.x = x
		this.y = y
		this.x2 = x + w
		this.y2 = y + h
	}
	get w() { return this.x2 - this.x }
	get h() { return this.y2 - this.y }
	get cx() { return (this.x + this.x2) / 2 }
	get cy() { return (this.y + this.y2) / 2 }
	merge(other: FakeBox): FakeBox {
		const x = Math.min(this.x, other.x)
		const y = Math.min(this.y, other.y)
		const x2 = Math.max(this.x2, other.x2)
		const y2 = Math.max(this.y2, other.y2)
		return new FakeBox(x, y, x2 - x, y2 - y)
	}
}

// ---------------------------------------------------------------------------
// Fake SVG element factory
// ---------------------------------------------------------------------------
export const fakeElement = () => ({
	node: { classList: { add: vi.fn(), remove: vi.fn() }, style: {} },
	hide: vi.fn().mockReturnThis(),
	show: vi.fn().mockReturnThis(),
	stroke: vi.fn().mockReturnThis(),
	fill: vi.fn().mockReturnThis(),
	size: vi.fn().mockReturnThis(),
	center: vi.fn().mockReturnThis(),
	move: vi.fn().mockReturnThis(),
	add: vi.fn().mockReturnThis(),
	remove: vi.fn().mockReturnThis(),
	put: vi.fn().mockReturnThis(),
	parent: vi.fn().mockReturnValue({ index: vi.fn().mockReturnValue(0), add: vi.fn() }),
	index: vi.fn().mockReturnValue(0),
	find: vi.fn().mockReturnValue([]),
	clone: vi.fn().mockReturnThis(),
	bbox: vi.fn().mockReturnValue(new FakeBox(0, 0, 10, 10)),
})

export const fakeCanvas = {
	rect: vi.fn().mockImplementation(() => fakeElement()),
	group: vi.fn().mockImplementation(() => ({
		...fakeElement(),
		add: vi.fn().mockReturnThis(),
	})),
	circle: vi.fn().mockImplementation(() => fakeElement()),
	put: vi.fn().mockReturnThis(),
}

// ---------------------------------------------------------------------------
// Singleton mocks — exported so tests can read/reset them
// ---------------------------------------------------------------------------
export const circuitComponents: any[] = []

export const fakeMainController = {
	instance: {
		addComponent: vi.fn((c: any) => circuitComponents.push(c)),
		circuitComponents,
		customSymbols: [],
	},
}

export const fakeCanvasController = {
	instance: { canvas: fakeCanvas },
}

export const fakeSelectionController = {
	instance: {
		selectComponents: vi.fn(),
		referenceComponent: null,
		viewSelection: vi.fn(),
	},
}

export const fakeUndo = { addState: vi.fn() }
export const fakeSnapDragHandler = { snapDrag: vi.fn() }
export const fakeSnapCursorController = { instance: { visible: false } }

// ---------------------------------------------------------------------------
// vi.mock calls — must be at module top level (hoisted by Vitest)
// ---------------------------------------------------------------------------
vi.mock("@svgdotjs/svg.js", () => ({
	Point: FakePoint,
	Box: FakeBox,
	G: class FakeG {
		node = { classList: { add: vi.fn(), remove: vi.fn() }, style: {} }
		add = vi.fn().mockReturnThis()
		remove = vi.fn()
	},
	Line: class {},
	Element: class {},
	Matrix: class {},
}))

vi.mock("@svgdotjs/svg.draggable.js", () => ({}))
vi.mock("@svgdotjs/svg.panzoom.js", () => ({}))
