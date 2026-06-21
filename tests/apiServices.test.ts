import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/scripts/services/subcircuitPreviewService", () => ({
	SubcircuitPreviewService: class {
		generatePreview = vi.fn().mockResolvedValue(null)
	},
}))

vi.mock("../src/scripts/components/componentSymbol", () => ({
	ComponentSymbol: class {},
}))

vi.mock("../src/scripts/components/circuitComponent", () => ({
	CircuitComponent: class {},
}))

import { createRuntimeConfig } from "../src/scripts/config/runtimeConfig"
import { getApiBase } from "../src/scripts/services/apiBase"
import { getAppRuntime, setAppRuntimeForTests } from "../src/scripts/services/appRuntime"
import { TemplateFileService } from "../src/scripts/services/templateFileService"
import { LatexRenderService, prepareLatexSource } from "../src/scripts/services/latexRenderService"
import { IndexedDbTemplateDataSource } from "../src/scripts/services/indexedDbTemplateDataSource"
import { StaticTemplateDataSource } from "../src/scripts/services/staticTemplateDataSource"

const mockFetch = (response: Partial<Response>) => {
	const fetchMock = vi.fn().mockResolvedValue(response)
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

function makeFakeDb(workFiles = new Map<string, any>()) {
	return {
		transaction(storeName: string) {
			if (storeName !== "workFiles") throw new Error(`Unexpected store: ${storeName}`)
			const tx: any = {
				oncomplete: null,
				onerror: null,
				onabort: null,
				error: null,
				objectStore() {
					return {
						get(key: string) {
							const request: any = { result: workFiles.get(key), onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: workFiles.get(key) } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						getAll() {
							const request: any = { result: [...workFiles.values()], onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: [...workFiles.values()] } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						put(value: any) {
							workFiles.set(value.name, value)
							const request: any = { result: value, onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: value } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						delete(key: string) {
							workFiles.delete(key)
							const request: any = { result: undefined, onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: undefined } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
					}
				},
			}
			return tx
		},
		objectStoreNames: {
			contains: vi.fn().mockReturnValue(true),
		},
		createObjectStore: vi.fn(),
		close: vi.fn(),
		onversionchange: null,
	} as unknown as IDBDatabase
}

describe("getApiBase", () => {
	it("uses the local dev server for localhost", () => {
		expect(getApiBase("localhost")).toBe("http://localhost:3001")
		expect(getApiBase("127.0.0.1")).toBe("http://localhost:3001")
	})

	it("uses same-origin API paths for deployed hosts", () => {
		expect(getApiBase("example.com")).toBe("")
	})
})

describe("createRuntimeConfig", () => {
	afterEach(() => {
		delete (window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__
		setAppRuntimeForTests(null)
		vi.unstubAllGlobals()
	})

	it("defaults to the current server-backed runtime modes", () => {
		expect(createRuntimeConfig({}, "localhost")).toEqual({
			storageMode: "server",
			templateSource: "server",
			latexMode: "server-proxy",
			apiBase: "http://localhost:3001",
		})
	})

	it("allows runtime overrides for provider-based modes", () => {
		;(window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
			storageMode: "indexeddb",
			templateSource: "static-manifest",
			latexMode: "serverless-proxy",
			apiBase: "/demo-api",
		}

		expect(createRuntimeConfig({}, "example.com")).toEqual({
			storageMode: "indexeddb",
			templateSource: "static-manifest",
			latexMode: "serverless-proxy",
			apiBase: "/demo-api",
		})
	})

	it("switches template data source to IndexedDB-backed work storage in indexeddb mode", () => {
		setAppRuntimeForTests(null)
		;(window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
			storageMode: "indexeddb",
			templateSource: "server",
			latexMode: "server-proxy",
			apiBase: "/api",
		}
		vi.stubGlobal("indexedDB", {
			open: vi.fn(() => ({
				result: {
					objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
					onversionchange: null,
					close: vi.fn(),
				},
				onsuccess: null,
				onerror: null,
				onblocked: null,
				onupgradeneeded: null,
			})),
		})
		setAppRuntimeForTests(null)

		expect(getAppRuntime().createTemplateDataSource()).toBeInstanceOf(IndexedDbTemplateDataSource)
	})

	it("switches template data source to static-manifest mode when configured", () => {
		;(window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
			storageMode: "server",
			templateSource: "static-manifest",
			latexMode: "server-proxy",
			apiBase: "/api",
		}
		setAppRuntimeForTests(null)

		expect(getAppRuntime().createTemplateDataSource()).toBeInstanceOf(StaticTemplateDataSource)
	})

	it("creates custom symbol services through the runtime instead of controller-local constructors", () => {
		const service = getAppRuntime().createCustomSymbolService(() => ({}) as IDBDatabase)
		expect(service).toMatchObject({
			loadCustomSymbolsIntoDomAndRuntime: expect.any(Function),
			duplicateSymbol: expect.any(Function),
			renameCustomGraphicsSymbol: expect.any(Function),
		})
	})

	it("creates custom symbol application services through the runtime for symbol-state orchestration", () => {
		const service = getAppRuntime().createCustomSymbolApplicationService(() => ({}) as IDBDatabase)
		expect(service).toMatchObject({
			loadState: expect.any(Function),
			loadRuntimeSymbols: expect.any(Function),
			renameGraphicsSymbol: expect.any(Function),
		})
	})

	it("creates symbol library services through the runtime for base symbol boot", () => {
		const service = getAppRuntime().createSymbolLibraryService()
		expect(service).toMatchObject({
			loadIntoDocument: expect.any(Function),
		})
	})

	it("creates tab application services through the runtime instead of controller-local session wiring", () => {
		const service = getAppRuntime().createTabApplicationService(
			() => ({}) as IDBDatabase,
			(data: { components?: unknown[] }) => (data.components?.length ?? 0) > 0
		)
		expect(service).toMatchObject({
			initializeTab: expect.any(Function),
			getTabManagementSummary: expect.any(Function),
			persistSnapshot: expect.any(Function),
		})
	})

	it("creates tab broadcast services through the runtime for cross-tab coordination", () => {
		const service = getAppRuntime().createTabBroadcastService()
		expect(service).toMatchObject({
			createMessage: expect.any(Function),
			handleIncomingMessage: expect.any(Function),
		})
	})

	it("creates tab lifecycle services through the runtime for autosave boot wiring", () => {
		const service = getAppRuntime().createTabLifecycleService()
		expect(service).toMatchObject({
			clearLegacyStorage: expect.any(Function),
			bindPersistenceHandlers: expect.any(Function),
			initializeCurrentTab: expect.any(Function),
		})
	})

	it("uses the demo runtime providers without touching server filesystem APIs", async () => {
		const fetchMock = mockFetch({
			ok: true,
			text: vi.fn().mockResolvedValue("\\draw (0,0) -- (1,0);"),
		})
		const fakeDb = makeFakeDb()
		;(window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
			storageMode: "indexeddb",
			templateSource: "static-manifest",
			latexMode: "serverless-proxy",
		}
		vi.stubGlobal("indexedDB", {
			open: vi.fn(() => {
				const request: any = {
					result: fakeDb,
					onsuccess: null,
					onerror: null,
					onblocked: null,
					onupgradeneeded: null,
				}
				setTimeout(() => {
					request.onsuccess?.({ target: request })
				}, 0)
				return request
			}),
		})
		setAppRuntimeForTests(null)

		const dataSource = getAppRuntime().createTemplateDataSource()
		const files = await dataSource.listFiles()
		await dataSource.readFile("template", files.templates[0])
		await dataSource.saveWork("draft.tex", "content")
		expect(await dataSource.readFile("work", "draft.tex")).toBe("content")
		await dataSource.deleteWork("draft.tex")

		const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url))
		expect(files.templates.length).toBeGreaterThan(0)
		expect(requestedUrls.some((url) => url.includes("/api/files"))).toBe(false)
		expect(requestedUrls.some((url) => url.includes("/api/file"))).toBe(false)
		expect(requestedUrls.some((url) => url.includes("/api/save"))).toBe(false)
		expect(requestedUrls.some((url) => url.includes("/api/delete"))).toBe(false)
		expect(requestedUrls).toHaveLength(1)
		expect(requestedUrls[0]).not.toContain("/api/")
	})
})

describe("TemplateFileService", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("fetches the server file list from the existing endpoint", async () => {
		const fetchMock = mockFetch({
			json: vi.fn().mockResolvedValue({ templates: ["rc-lowpass.tex"], works: ["draft.tex"] }),
		})

		const result = await new TemplateFileService("http://localhost:3001").fetchFiles()

		expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/files")
		expect(result).toEqual({ templates: ["rc-lowpass.tex"], works: ["draft.tex"] })
	})

	it("loads files with the same query shape as the previous controller code", async () => {
		const fetchMock = mockFetch({
			ok: true,
			text: vi.fn().mockResolvedValue("\\begin{circuitikz}\\end{circuitikz}"),
		})

		const result = await new TemplateFileService("").loadFile("work", "my circuit.tex")

		expect(fetchMock).toHaveBeenCalledWith("/api/file?dir=work&name=my%20circuit.tex")
		expect(result).toBe("\\begin{circuitikz}\\end{circuitikz}")
	})

	it("saves work files to the existing save endpoint", async () => {
		const fetchMock = mockFetch({
			ok: true,
			json: vi.fn().mockResolvedValue({ success: true }),
		})

		await new TemplateFileService("").saveWorkFile("draft.tex", "\\draw (0,0) -- (1,0);")

		expect(fetchMock).toHaveBeenCalledWith("/api/save", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dir: "work", name: "draft.tex", content: "\\draw (0,0) -- (1,0);" }),
		})
	})

	it("deletes work files through the existing delete endpoint", async () => {
		const fetchMock = mockFetch({
			ok: true,
			json: vi.fn().mockResolvedValue({ success: true }),
		})

		await new TemplateFileService("").deleteWorkFile("draft.tex")

		expect(fetchMock).toHaveBeenCalledWith("/api/delete", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dir: "work", name: "draft.tex" }),
		})
	})
})

describe("LatexRenderService", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("prepares LaTeX using the same cleanup and library extraction rules", () => {
		const prepared = prepareLatexSource(`\\documentclass{article}
\\usepackage{circuitikz}
\\begin{document}
% comment
\\usetikzlibrary{positioning, arrows.meta}
\\draw (0,0) node[font=\\small] {電};
\\end{document}`)

		expect(prepared.libraries).toEqual(["calc", "positioning", "arrows.meta"])
		expect(prepared.bodyCode).not.toContain("\\documentclass")
		expect(prepared.bodyCode).not.toContain("\\usepackage")
		expect(prepared.bodyCode).not.toContain("\\usetikzlibrary")
		expect(prepared.bodyCode).not.toContain("電")
		expect(prepared.bodyCode).toContain("\\draw (0,0) node[] {};")
	})

	it("posts QuickLaTeX form data and converts png URLs to svg URLs", async () => {
		const fetchMock = mockFetch({
			text: vi.fn().mockResolvedValue("0\nhttps://quicklatex.com/cache/example.png 100 50\n"),
		})

		const img = await new LatexRenderService("").renderViaQuickLaTeX("\\draw (0,0) -- (1,0);", ["calc"])

		expect(fetchMock).toHaveBeenCalledWith("/api/latex", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: expect.stringContaining("formula=%5Cdraw%20(0%2C0)%20--%20(1%2C0)%3B"),
		})
		expect(img.src).toBe("https://quicklatex.com/cache/example.svg")
		expect(img.alt).toBe("CircuiTikZ Render")
	})

	it("preserves QuickLaTeX compilation errors", async () => {
		mockFetch({
			text: vi.fn().mockResolvedValue("1\nUnknown control sequence\n"),
		})

		await expect(new LatexRenderService("").renderViaQuickLaTeX("\\bad", ["calc"])).rejects.toThrow(
			"QuickLaTeX: Unknown control sequence"
		)
	})
})
