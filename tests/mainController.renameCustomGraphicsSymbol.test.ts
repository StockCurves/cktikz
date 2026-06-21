import { describe, it, expect, vi, beforeEach } from "vitest"

const { MockComponentSymbol, flushAsync } = vi.hoisted(() => {
	class MockComponentSymbol {
		tikzName: string
		displayName: string
		isCustomSymbol?: boolean

		constructor(componentMetadata: Element) {
			this.tikzName = componentMetadata.getAttribute("tikz") ?? ""
			this.displayName = componentMetadata.getAttribute("display") ?? this.tikzName
		}
	}

	const flushAsync = async (rounds = 4) => {
		for (let i = 0; i < rounds; i++) {
			await new Promise((resolve) => setTimeout(resolve, 0))
		}
	}

	return { MockComponentSymbol, flushAsync }
})

vi.mock("@svgdotjs/svg.js", () => ({
	extend: vi.fn(),
	Number: class {},
	Point: class {},
	Box: class {},
	Color: class {},
	G: class {},
	Svg: class {},
	Symbol: class {},
}))
vi.mock("@svgdotjs/svg.draggable.js", () => ({}))
vi.mock("bootstrap", () => ({
	Button: class {},
	Collapse: class {},
	Offcanvas: class {},
	Tooltip: class {},
	Modal: class {},
}))
vi.mock("hotkeys-js", () => ({ default: vi.fn() }))
vi.mock("../../../package.json", () => ({ version: "0.0.0-test" }), { virtual: true })
vi.mock("../src/scripts/components/componentSymbol", () => ({
	ComponentSymbol: MockComponentSymbol,
}))

vi.mock("../src/scripts/internal", () => ({
	CanvasController: class {},
	ExportController: { instance: {} },
	SelectionController: { instance: {} },
	SaveController: { instance: {} },
	Undo: { addState: vi.fn() },
	CopyPaste: class {},
	PropertyController: { instance: { update: vi.fn() } },
	CircuitComponent: class {},
	ComponentPlacer: { instance: {} },
	NodeSymbolComponent: class {},
	PathSymbolComponent: class {},
	WireComponent: class {},
	ComponentSymbol: MockComponentSymbol,
	ComponentSaveObject: class {},
	EraseController: { instance: {} },
	RectangleComponent: class {},
	EllipseComponent: class {},
	defaultStroke: "#000000",
	defaultFill: "#ffffff",
	PolygonComponent: class {},
	GroupComponent: class {},
	GroupSaveObject: class {},
	memorySizeOf: vi.fn(),
	SaveFileFormat: class {},
	emtpySaveState: {},
	currentSaveVersion: "test",
	loadTextConverter: vi.fn(),
	TextProperty: class {},
	ShortComponent: class {},
	OpenComponent: class {},
	TikzEditorController: { instance: { init: vi.fn() } },
	ContextMenu: class {},
	SubcircuitComponent: class {},
	SubcircuitSaveObject: class {},
	SymbolEditorController: { instance: {} },
	TemplateController: { instance: { initialize: vi.fn().mockResolvedValue(undefined) } },
	LiveRenderController: { instance: { init: vi.fn() } },
	EditableProperty: class {},
}))
vi.mock("../src/scripts/components/groupComponent", () => ({
	GroupComponent: class {
		public static group = vi.fn()
	},
}))
vi.mock("../src/scripts/components/subcircuitComponent", () => ({
	SubcircuitComponent: class {
		public constructor() {}

		public toJson() {
			return { type: "subcircuit" }
		}
	},
}))

import { MainController } from "../src/scripts/controllers/mainController"
import { CustomSymbolApplicationService } from "../src/scripts/services/customSymbolApplicationService"
import { CustomSymbolService } from "../src/scripts/services/customSymbolService"
import { CustomSymbolDomService } from "../src/scripts/services/customSymbolDomService"

type FakeCategory = {
	name: string
	symbolIds: string[]
}

function makeTransaction(
	stores: {
		customSymbols: Map<string, any>
		customCategories: FakeCategory[]
	},
	storeNames: string | string[]
) {
	const normalizedNames = Array.isArray(storeNames) ? storeNames : [storeNames]
	let completeScheduled = false
	const scheduleComplete = () => {
		if (completeScheduled) return
		completeScheduled = true
		setTimeout(() => {
			tx.oncomplete?.()
		}, 0)
	}
	const tx: {
		oncomplete: null | (() => void)
		objectStore: (name: string) => any
	} = {
		oncomplete: null,
		objectStore(name: string) {
			if (!normalizedNames.includes(name)) {
				throw new Error(`Unexpected store: ${name}`)
			}

			if (name === "customSymbols") {
				return {
					get(key: string) {
						const request: { onsuccess: null | ((ev: any) => void) } = { onsuccess: null }
						setTimeout(() => {
							request.onsuccess?.({ target: { result: stores.customSymbols.get(key) } })
						}, 0)
						return request
					},
					getAll() {
						const request: { onsuccess: null | ((ev: any) => void) } = { onsuccess: null }
						setTimeout(() => {
							request.onsuccess?.({
								target: {
									result: [...stores.customSymbols.values()],
								},
							})
						}, 0)
						return request
					},
					delete(key: string) {
						stores.customSymbols.delete(key)
						scheduleComplete()
					},
					put(value: any) {
						stores.customSymbols.set(value.id, value)
						scheduleComplete()
					},
				}
			}

			return {
				getAll() {
					const request: { onsuccess: null | ((ev: any) => void) } = { onsuccess: null }
					setTimeout(() => {
						request.onsuccess?.({
							target: {
								result: stores.customCategories.map((cat) => ({
									name: cat.name,
									symbolIds: [...cat.symbolIds],
								})),
							},
						})
					}, 0)
					return request
				},
				put(category: FakeCategory) {
					const idx = stores.customCategories.findIndex((cat) => cat.name === category.name)
					if (idx >= 0) {
						stores.customCategories[idx] = {
							name: category.name,
							symbolIds: [...category.symbolIds],
						}
					}
					scheduleComplete()
				},
			}
		},
	}

	return tx
}

describe("MainController.renameCustomGraphicsSymbol", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		document.body.innerHTML = `<svg id="symbolDB"></svg>`
	})

	it("keeps the renamed symbol custom and updates in-memory customSymbols immediately", async () => {
		const symbolDB = document.getElementById("symbolDB")!
		symbolDB.innerHTML = `
			<symbol id="node_old mos"></symbol>
			<component tikz="old mos" display="old mos" type="node">
				<variant for="node_old mos"></variant>
			</component>
		`

		const oldSymbolRecord = {
			id: "custom-old mos",
			tikzName: "old mos",
			displayName: "old mos",
			isCustomSymbol: true,
			componentXml: `<component tikz="old mos" display="old mos" type="node"><variant for="node_old mos"></variant></component>`,
			symbols: {
				"node_old mos": `<symbol id="node_old mos"></symbol>`,
			},
		}

		const stores = {
			customSymbols: new Map([[oldSymbolRecord.id, oldSymbolRecord]]),
			customCategories: [{ name: "My Favorite", symbolIds: ["old mos"] }],
		}

		const oldRuntimeSymbol = { tikzName: "old mos", isCustomSymbol: true }
		const renamedComponent = {
			referenceSymbol: oldRuntimeSymbol,
			displayName: "old mos",
			update: vi.fn(),
		}
		const db = {
			transaction: vi.fn((storeNames: string | string[]) => makeTransaction(stores, storeNames)),
		}

		const context: any = {
			db,
			customSymbolDomService: new CustomSymbolDomService(),
			customSymbolService: new CustomSymbolService(
				() => db as any,
				new CustomSymbolDomService(),
				vi.fn().mockResolvedValue(null)
			),
			customSymbolApplicationService: new CustomSymbolApplicationService(
				new CustomSymbolService(() => db as any, new CustomSymbolDomService(), vi.fn().mockResolvedValue(null))
			),
			symbols: [oldRuntimeSymbol],
			customSymbols: [{ id: oldSymbolRecord.id, tikzName: "old mos" }],
			circuitComponents: [renamedComponent],
			customCategories: [{ name: "My Favorite", symbolIds: ["old mos"] }],
			customSymbolWorkspaceController: {
				applyAndRender: vi.fn((state: { customCategories: FakeCategory[]; customSymbols: any[] }) => {
					context.customCategories = state.customCategories
					context.customSymbols = state.customSymbols
				}),
			},
		}
		context.customSymbolGraphicsController = {
			renameCustomGraphicsSymbol: async (oldTikzName: string, newTikzName: string) => {
				const state = await context.customSymbolApplicationService.renameGraphicsSymbol(
					oldTikzName,
					newTikzName,
					document.getElementById("symbolDB"),
					context.symbols,
					context.customSymbols,
					context.circuitComponents
				)
				if (state === "no-op" || state === "missing-dom") return
				context.customSymbolWorkspaceController.applyAndRender(state, context.symbols)
			},
		}

		await MainController.prototype.renameCustomGraphicsSymbol.call(context, "old mos", "new mos")
		await flushAsync()

		expect(context.symbols).toHaveLength(1)
		expect(context.symbols[0].tikzName).toBe("new mos")
		expect(context.symbols[0].isCustomSymbol).toBe(true)

		expect(context.customSymbols).toHaveLength(1)
		expect(context.customSymbols[0].id).toBe("custom-new mos")
		expect(context.customSymbols[0].tikzName).toBe("new mos")

		expect(renamedComponent.referenceSymbol).toBe(context.symbols[0])
		expect(renamedComponent.displayName).toBe("new mos")
		expect(renamedComponent.update).toHaveBeenCalledTimes(1)

		expect(stores.customCategories[0].symbolIds).toEqual(["new mos"])
		expect(document.getElementById("node_old mos")).toBeNull()
		expect(document.querySelector(`component[tikz="old mos"]`)).toBeNull()
		expect(document.getElementById("node_new mos")).not.toBeNull()
		expect(document.querySelector(`component[tikz="new mos"]`)).not.toBeNull()
		expect(context.customSymbolWorkspaceController.applyAndRender).toHaveBeenCalledTimes(1)
	})
})
