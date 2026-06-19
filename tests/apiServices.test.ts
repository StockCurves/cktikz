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
