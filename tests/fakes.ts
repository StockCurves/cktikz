import { vi } from "vitest"

/**
 * All fake classes and factories used in tests.
 * Kept in a separate file so vi.mock() factories can import them
 * without running into TDZ (temporal dead zone) issues from hoisting.
 */

export class FakePoint {
	constructor(public x = 0, public y = 0) {}
	sub(o: FakePoint) { return new FakePoint(this.x - o.x, this.y - o.y) }
	add(o: FakePoint) { return new FakePoint(this.x + o.x, this.y + o.y) }
	mul(o: FakePoint) { return new FakePoint(this.x * o.x, this.y * o.y) }
	rotate(_a: number, _c?: FakePoint) { return new FakePoint(this.x, this.y) }
	simplifyForJson() { return { x: this.x, y: this.y } }
}

export class FakeBox {
	x2: number
	y2: number
	constructor(public x = 0, public y = 0, w = 0, h = 0) {
		this.x2 = x + w
		this.y2 = y + h
	}
	get w() { return this.x2 - this.x }
	get h() { return this.y2 - this.y }
	get cx() { return (this.x + this.x2) / 2 }
	get cy() { return (this.y + this.y2) / 2 }
	merge(o: FakeBox): FakeBox {
		const x = Math.min(this.x, o.x)
		const y = Math.min(this.y, o.y)
		const x2 = Math.max(this.x2, o.x2)
		const y2 = Math.max(this.y2, o.y2)
		return new FakeBox(x, y, x2 - x, y2 - y)
	}
}

export const makeEl = () => ({
	node: { classList: { add: vi.fn(), remove: vi.fn() }, style: {} },
	hide: vi.fn().mockReturnThis(),
	show: vi.fn().mockReturnThis(),
	stroke: vi.fn().mockReturnThis(),
	fill: vi.fn().mockReturnThis(),
	size: vi.fn().mockReturnThis(),
	center: vi.fn().mockReturnThis(),
	add: vi.fn().mockReturnThis(),
	remove: vi.fn().mockReturnThis(),
	put: vi.fn().mockReturnThis(),
	find: vi.fn().mockReturnValue([]),
	parent: vi.fn().mockReturnValue({ index: vi.fn().mockReturnValue(0), add: vi.fn() }),
	index: vi.fn().mockReturnValue(0),
})

export const makeCanvas = () => ({
	rect: vi.fn().mockImplementation(makeEl),
	group: vi.fn().mockImplementation(makeEl),
	circle: vi.fn().mockImplementation(makeEl),
	put: vi.fn().mockReturnThis(),
})
