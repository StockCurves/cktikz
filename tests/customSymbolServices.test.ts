import { describe, expect, it, vi } from "vitest"

const { MockComponentSymbol } = vi.hoisted(() => {
	class MockComponentSymbol {
		tikzName: string
		displayName: string
		isCustomSymbol?: boolean

		constructor(componentMetadata: Element) {
			this.tikzName = componentMetadata.getAttribute("tikz") ?? ""
			this.displayName = componentMetadata.getAttribute("display") ?? this.tikzName
		}
	}
	return { MockComponentSymbol }
})

vi.mock("../src/scripts/components/componentSymbol", () => ({
	ComponentSymbol: MockComponentSymbol,
}))

import { IndexedDbService, DATABASE_NAME, DATABASE_VERSION } from "../src/scripts/services/indexedDbService"
import { CustomSymbolService } from "../src/scripts/services/customSymbolService"
import { CustomSymbolRepository } from "../src/scripts/services/customSymbolRepository"
import { CustomSymbolDomService } from "../src/scripts/services/customSymbolDomService"
import { TabRepository } from "../src/scripts/services/tabRepository"

type FakeCategory = {
	name: string
	symbolIds: string[]
}

const asyncRequest = <T>(value: T) => {
	const request: any = { result: value, onsuccess: null, onerror: null, error: null }
	setTimeout(() => request.onsuccess?.({ target: { result: value } }), 0)
	return request as IDBRequest<T>
}

function makeFakeDb(stores: { customSymbols: Map<string, any>; customCategories: FakeCategory[]; tabs?: Map<number, any> }) {
	const scheduleComplete = (tx: any) => setTimeout(() => tx.oncomplete?.(), 0)

	return {
		transaction(storeNames: string | string[], _mode?: IDBTransactionMode) {
			const normalizedNames = Array.isArray(storeNames) ? storeNames : [storeNames]
			const tx: any = {
				oncomplete: null,
				onerror: null,
				onabort: null,
				error: null,
				objectStore(name: string) {
					if (!normalizedNames.includes(name)) throw new Error(`Unexpected store: ${name}`)
					if (name === "tabs") {
						return {
							get: (key: number) => {
								const request = asyncRequest(stores.tabs?.get(key))
								scheduleComplete(tx)
								return request
							},
							getAll: () => {
								const request = asyncRequest([...(stores.tabs?.values() || [])])
								scheduleComplete(tx)
								return request
							},
							add: (value: any) => {
								stores.tabs?.set(value.id, value)
								scheduleComplete(tx)
								return asyncRequest(value)
							},
							put: (value: any) => {
								stores.tabs?.set(value.id, value)
								scheduleComplete(tx)
								return asyncRequest(value)
							},
							delete: (key: number) => {
								stores.tabs?.delete(key)
								scheduleComplete(tx)
								return asyncRequest(undefined)
							},
						}
					}
					if (name === "customSymbols") {
						return {
							get: (key: string) => {
								const request = asyncRequest(stores.customSymbols.get(key))
								scheduleComplete(tx)
								return request
							},
							getAll: () => {
								const request = asyncRequest([...stores.customSymbols.values()])
								scheduleComplete(tx)
								return request
							},
							put: (value: any) => {
								stores.customSymbols.set(value.id, value)
								scheduleComplete(tx)
								return asyncRequest(value)
							},
							delete: (key: string) => {
								stores.customSymbols.delete(key)
								scheduleComplete(tx)
								return asyncRequest(undefined)
							},
						}
					}
					return {
						get: (key: string) => {
							const request = asyncRequest(stores.customCategories.find((cat) => cat.name === key))
							scheduleComplete(tx)
							return request
						},
						getAll: () => {
							const request = asyncRequest(
								stores.customCategories.map((cat) => ({ ...cat, symbolIds: [...cat.symbolIds] }))
							)
							scheduleComplete(tx)
							return request
						},
						put: (value: FakeCategory) => {
							const idx = stores.customCategories.findIndex((cat) => cat.name === value.name)
							if (idx >= 0) stores.customCategories[idx] = { name: value.name, symbolIds: [...value.symbolIds] }
							else stores.customCategories.push({ name: value.name, symbolIds: [...value.symbolIds] })
							scheduleComplete(tx)
							return asyncRequest(value)
						},
						delete: (key: string) => {
							stores.customCategories = stores.customCategories.filter((cat) => cat.name !== key)
							scheduleComplete(tx)
							return asyncRequest(undefined)
						},
					}
				},
			}
			return tx
		},
	} as unknown as IDBDatabase
}

describe("IndexedDbService", () => {
	it("opens the stable database name/version and creates the expected object stores", async () => {
		const createdStores: Record<string, any> = {}
		const db: any = {
			objectStoreNames: { contains: (name: string) => Boolean(createdStores[name]) },
			createObjectStore: vi.fn((name: string, options: any) => {
				createdStores[name] = { options, createIndex: vi.fn() }
				return createdStores[name]
			}),
			close: vi.fn(),
			onversionchange: null,
		}
		const request: any = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null }
		const indexedDb = {
			open: vi.fn(() => {
				setTimeout(() => {
					request.onupgradeneeded?.({ target: { result: db } })
					request.onsuccess?.({ target: { result: db } })
				}, 0)
				return request
			}),
		}

		const result = await new IndexedDbService(indexedDb as unknown as IDBFactory).openDatabase()

		expect(indexedDb.open).toHaveBeenCalledWith(DATABASE_NAME, DATABASE_VERSION)
		expect(result).toBe(db)
		expect(db.createObjectStore).toHaveBeenCalledWith("tabs", { keyPath: "id" })
		expect(db.createObjectStore).toHaveBeenCalledWith("customCategories", { keyPath: "name" })
		expect(db.createObjectStore).toHaveBeenCalledWith("customSymbols", { keyPath: "id" })
		expect(createdStores.tabs.createIndex).toHaveBeenCalledWith("open", "open", { unique: false })
	})
})

describe("CustomSymbolRepository", () => {
	it("loads, saves, deletes, and updates category membership", async () => {
		const stores = {
			customSymbols: new Map<string, any>([["custom-old", { id: "custom-old", tikzName: "old" }]]),
			customCategories: [{ name: "Mine", symbolIds: ["old", "subcircuit-a"] }],
		}
		const repository = new CustomSymbolRepository(makeFakeDb(stores))

		expect(await repository.getCustomSymbols()).toEqual([{ id: "custom-old", tikzName: "old" }])
		expect(await repository.getCustomCategories()).toEqual([{ name: "Mine", symbolIds: ["old", "subcircuit-a"] }])

		await repository.putCustomSymbol({ id: "custom-new", tikzName: "new" })
		expect(stores.customSymbols.get("custom-new").tikzName).toBe("new")

		await repository.renameSymbolInCategories("old", "new")
		expect(stores.customCategories[0].symbolIds).toEqual(["new", "subcircuit-a"])

		await repository.removeSymbolFromCategories("subcircuit-a")
		expect(stores.customCategories[0].symbolIds).toEqual(["new"])

		await repository.deleteCustomSymbol("custom-old")
		expect(stores.customSymbols.has("custom-old")).toBe(false)
	})
})

describe("TabRepository", () => {
	it("wraps tab persistence without exposing object stores to controllers", async () => {
		const stores = {
			customSymbols: new Map<string, any>(),
			customCategories: [],
			tabs: new Map<number, any>([[0, { id: 0, open: "false", data: { components: [] }, settings: {} }]]),
		}
		const repository = new TabRepository<any>(makeFakeDb(stores))

		expect(await repository.getAllTabs()).toHaveLength(1)
		expect((await repository.getTab(0))?.open).toBe("false")

		await repository.putTab({ id: 0, open: "true", data: { components: [] }, settings: {}, designName: "A" })
		expect(stores.tabs.get(0).open).toBe("true")

		await repository.addTab({ id: 1, open: "true", data: { components: [] }, settings: {} })
		expect(stores.tabs.has(1)).toBe(true)

		await repository.deleteTab(1)
		expect(stores.tabs.has(1)).toBe(false)
	})
})

describe("CustomSymbolDomService", () => {
	it("renames a custom graphics symbol record and replaces symbolDB nodes", () => {
		document.body.innerHTML = `
			<svg id="symbolDB">
				<symbol id="node_old mos"></symbol>
				<component tikz="old mos" display="old mos" type="node">
					<variant for="node_old mos"></variant>
				</component>
			</svg>
		`
		const symbolDB = document.getElementById("symbolDB")!
		const service = new CustomSymbolDomService()
		const oldRecord = {
			id: "custom-old mos",
			tikzName: "old mos",
			displayName: "old mos",
			isCustomSymbol: true,
			componentXml: `<component tikz="old mos" display="old mos" type="node"><variant for="node_old mos"></variant></component>`,
			symbols: { "node_old mos": `<symbol id="node_old mos"></symbol>` },
		}

		const result = service.renameCustomGraphicsSymbolDom("old mos", "new mos", oldRecord, symbolDB)

		expect(result.updatedRecord).toMatchObject({
			id: "custom-new mos",
			tikzName: "new mos",
			displayName: "new mos",
		})
		expect(Object.keys(result.updatedRecord.symbols)).toEqual(["node_new mos"])
		expect(result.updatedRecord.componentXml).toContain('tikz="new mos"')
		expect(document.getElementById("node_old mos")).toBeNull()
		expect(document.querySelector(`component[tikz="old mos"]`)).toBeNull()
		expect(document.getElementById("node_new mos")).not.toBeNull()
		expect(document.querySelector(`component[tikz="new mos"]`)).not.toBeNull()
	})
})

describe("CustomSymbolService", () => {
	it("renames custom graphics symbols across DB, DOM, runtime symbols, and placed components", async () => {
		document.body.innerHTML = `
			<svg id="symbolDB">
				<symbol id="node_old mos"></symbol>
				<component tikz="old mos" display="old mos" type="node">
					<variant for="node_old mos"></variant>
				</component>
			</svg>
		`
		const stores = {
			customSymbols: new Map([
				[
					"custom-old mos",
					{
						id: "custom-old mos",
						tikzName: "old mos",
						displayName: "old mos",
						isCustomSymbol: true,
						componentXml: `<component tikz="old mos" display="old mos" type="node"><variant for="node_old mos"></variant></component>`,
						symbols: { "node_old mos": `<symbol id="node_old mos"></symbol>` },
					},
				],
			]),
			customCategories: [{ name: "Mine", symbolIds: ["old mos"] }],
		}
		const service = new CustomSymbolService(() => makeFakeDb(stores), new CustomSymbolDomService())
		const runtimeSymbols = [{ tikzName: "old mos", isCustomSymbol: true }] as any[]
		const customSymbols = [{ id: "custom-old mos", tikzName: "old mos", displayName: "old mos" }] as any[]
		const placedComponent = {
			referenceSymbol: runtimeSymbols[0],
			displayName: "old mos",
			update: vi.fn(),
		}

		const result = await service.renameCustomGraphicsSymbol(
			"old mos",
			"new mos",
			document.getElementById("symbolDB")!,
			runtimeSymbols,
			customSymbols,
			[placedComponent] as any
		)

		expect(result?.updatedRecord.id).toBe("custom-new mos")
		expect(stores.customCategories[0].symbolIds).toEqual(["new mos"])
		expect(runtimeSymbols[0].tikzName).toBe("new mos")
		expect(customSymbols[0].tikzName).toBe("new mos")
		expect(placedComponent.referenceSymbol).toBe(runtimeSymbols[0])
		expect(placedComponent.displayName).toBe("new mos")
		expect(placedComponent.update).toHaveBeenCalledTimes(1)
	})

	it("duplicates a symbol and keeps the duplicate custom", async () => {
		document.body.innerHTML = `
			<svg id="symbolDB">
				<symbol id="node_base"></symbol>
				<component tikz="base" display="base" type="node">
					<variant for="node_base"></variant>
				</component>
			</svg>
		`
		const stores = {
			customSymbols: new Map<string, any>(),
			customCategories: [{ name: "Mine", symbolIds: [] }],
		}
		const symbolDB = document.getElementById("symbolDB")!
		const service = new CustomSymbolService(() => makeFakeDb(stores), new CustomSymbolDomService())
		const originalSymbol = new MockComponentSymbol(symbolDB.querySelector("component")!)
		const runtimeSymbols = [] as any[]

		const duplicated = await service.duplicateSymbol(symbolDB, runtimeSymbols, originalSymbol as any, "copy mos", "Mine")

		expect(duplicated?.componentSymbol.isCustomSymbol).toBe(true)
		expect(runtimeSymbols[0].tikzName).toBe("copy mos")
		expect(stores.customCategories[0].symbolIds).toEqual(["copy mos"])
		expect(stores.customSymbols.get("custom-copy mos")?.tikzName).toBe("copy mos")
	})

	it("deletes a custom symbol definition without touching placed components", async () => {
		const stores = {
			customSymbols: new Map([["custom-old", { id: "custom-old", tikzName: "old", displayName: "old" }]]),
			customCategories: [{ name: "Mine", symbolIds: ["old"] }],
		}
		const service = new CustomSymbolService(() => makeFakeDb(stores), new CustomSymbolDomService())
		const runtimeSymbols = [{ tikzName: "old" }] as any[]
		const customSymbols = [{ id: "custom-old", tikzName: "old" }] as any[]
		const placedComponent = { referenceSymbol: runtimeSymbols[0] }

		await service.deleteCustomGraphicsSymbol("old", runtimeSymbols, customSymbols)

		expect(stores.customSymbols.has("custom-old")).toBe(false)
		expect(stores.customCategories[0].symbolIds).toEqual([])
		expect(runtimeSymbols).toHaveLength(0)
		expect(customSymbols).toHaveLength(0)
		expect(placedComponent.referenceSymbol.tikzName).toBe("old")
	})

	it("adds and removes symbols from categories without duplicating entries", async () => {
		const stores = {
			customSymbols: new Map<string, any>(),
			customCategories: [{ name: "Mine", symbolIds: ["existing"] }],
		}
		const service = new CustomSymbolService(() => makeFakeDb(stores), new CustomSymbolDomService())

		await service.addSymbolToCategory("Mine", "existing")
		await service.addSymbolToCategory("Mine", "new")
		await service.removeSymbolFromCategory("Mine", "existing")

		expect(stores.customCategories[0].symbolIds).toEqual(["new"])
	})

	it("builds unique subcircuit records and adds preview before storing", async () => {
		const stores = {
			customSymbols: new Map<string, any>(),
			customCategories: [{ name: "Mine", symbolIds: [] }],
		}
		const preview = vi.fn().mockResolvedValue("<svg></svg>")
		const service = new CustomSymbolService(() => makeFakeDb(stores), new CustomSymbolDomService(), preview)
		const subcircuitRecord = service.buildSubcircuitRecord(
			"amp",
			{ displayName: "amp", components: [{ type: "wire" }] },
			[{ id: "subcircuit-amp", displayName: "amp", tikzName: "amp" }] as any
		)

		await service.addSymbolToCategory("Mine", subcircuitRecord.id, subcircuitRecord)

		expect(subcircuitRecord.displayName).toBe("amp (2)")
		expect(subcircuitRecord.subcircuitData.displayName).toBe("amp (2)")
		expect(subcircuitRecord.svgPreview).toBe("<svg></svg>")
		expect(preview).toHaveBeenCalledTimes(1)
		expect(stores.customCategories[0].symbolIds).toEqual(["subcircuit-amp (2)"])
	})
})
