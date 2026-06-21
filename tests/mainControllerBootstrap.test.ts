import { afterEach, describe, expect, it, vi } from "vitest"
import { configureMainControllerBootstrap } from "../src/scripts/controllers/mainControllerBootstrap"
import { configureTikzParserRuntime, parseTikz } from "../src/scripts/utils/tikzParser"
import { GroupComponent } from "../src/scripts/components/groupComponent"
import { SymbolEditorController } from "../src/scripts/controllers/symbolEditorController"

vi.mock("../src/scripts/internal", () => {
	return {
		CircuitComponent: class {},
		poleChoices: [],
		arrowTips: [],
	}
})

vi.mock("@svgdotjs/svg.js", () => {
	class MockPoint {
		x: number
		y: number
		constructor(x = 0, y = 0) {
			this.x = x
			this.y = y
		}
		clone() { return new MockPoint(this.x, this.y) }
		rotate() { return this }
		sub(other: MockPoint) { return new MockPoint(this.x - other.x, this.y - other.y) }
		add(other: MockPoint) { return new MockPoint(this.x + other.x, this.y + other.y) }
		mul(val: any) { return typeof val === "number" ? new MockPoint(this.x * val, this.y * val) : new MockPoint(this.x * val.x, this.y * val.y) }
		div(val: any) { return typeof val === "number" ? new MockPoint(this.x / val, this.y / val) : new MockPoint(this.x / val.x, this.y / val.y) }
		simplifyForJson() { return { x: this.x, y: this.y } }
	}
	return {
		Point: MockPoint,
		Box: class {},
		G: class {},
		Line: class {},
		Element: class {},
		Matrix: class {},
		SVG: vi.fn(),
	}
})

describe("mainControllerBootstrap", () => {
	afterEach(() => {
		configureTikzParserRuntime(null)
		GroupComponent.setCreateSubcircuitHandler(() => {})
	})

	it("wires symbol editor runtime, tikz parser runtime, and group subcircuit handler", async () => {
		const openPrompt = vi.fn().mockResolvedValue("pin-1")
		const openAlert = vi.fn().mockResolvedValue(undefined)
		const findCustomSymbol = vi.fn()
		const runtimeSymbol = {
			tikzName: "ground",
			getVariant: () => ({
				defaultAnchor: { point: { x: 0, y: 0, clone() { return this }, rotate() { return this }, sub() { return this }, add() { return this } } },
				pins: [],
			}),
		} as any
		const findRuntimeSymbol = vi.fn().mockReturnValue(runtimeSymbol)
		const getCircuitComponents = vi.fn().mockReturnValue([])
		const persistCustomSymbol = vi.fn().mockResolvedValue(undefined)
		const refreshCustomCategories = vi.fn().mockResolvedValue(undefined)
		const preprocessSymbolColors = vi.fn()
		const addParsedSubcircuit = vi.fn()
		const createSubcircuitFromSelection = vi.fn().mockResolvedValue(undefined)

		configureMainControllerBootstrap({
			openPrompt,
			openAlert,
			findCustomSymbol,
			findRuntimeSymbol,
			getCircuitComponents,
			persistCustomSymbol,
			refreshCustomCategories,
			preprocessSymbolColors,
			getRuntimeSymbols: () => [runtimeSymbol],
			addParsedSubcircuit,
			createSubcircuitFromSelection,
		})

		const runtime = (SymbolEditorController.instance as any).runtime
		expect(runtime).toBeTruthy()
		expect(runtime.openPrompt).toBe(openPrompt)
		expect(runtime.findRuntimeSymbol("ground")).toBe(runtimeSymbol)

		expect(() => parseTikz("\\draw (0,0) node[ground] {};")).not.toThrow()

		const groupingProperty = {
			labels: [["Ungroup", ""], ["Save to Symbols", ""]],
			callbacks: [vi.fn(), undefined as unknown as () => void],
		}
		groupingProperty.callbacks[1] = (() => {
			const handler = (GroupComponent as any).createSubcircuitHandler
			handler()
		}) as () => void

		groupingProperty.callbacks[1]()
		await Promise.resolve()

		expect(createSubcircuitFromSelection).toHaveBeenCalledTimes(1)
	})
})
