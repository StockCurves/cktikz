import { describe, expect, it, vi } from "vitest"
import { SymbolLibraryBootstrapController } from "../src/scripts/controllers/symbolLibraryBootstrapController"

describe("SymbolLibraryBootstrapController", () => {
	it("loads the base symbol library through the service", async () => {
		const symbolLibraryService = {
			loadIntoDocument: vi.fn().mockResolvedValue({
				symbolsSVG: { node: document.createElement("svg") },
				symbols: [{ tikzName: "node-a" }],
			}),
		}
		const customSymbolGraphicsController = {
			loadCustomSymbolsIntoSymbolDB: vi.fn(),
		}
		const controller = new SymbolLibraryBootstrapController({
			symbolLibraryService: symbolLibraryService as any,
			customSymbolGraphicsController: customSymbolGraphicsController as any,
		})

		await expect(controller.initializeSymbolLibrary()).resolves.toEqual({
			symbolsSVG: { node: document.createElement("svg") },
			symbols: [{ tikzName: "node-a" }],
		})
		expect(symbolLibraryService.loadIntoDocument).toHaveBeenCalledTimes(1)
	})

	it("delegates custom symbol hydration to the graphics controller", async () => {
		const symbolLibraryService = {
			loadIntoDocument: vi.fn(),
		}
		const customSymbolGraphicsController = {
			loadCustomSymbolsIntoSymbolDB: vi.fn().mockResolvedValue(undefined),
		}
		const controller = new SymbolLibraryBootstrapController({
			symbolLibraryService: symbolLibraryService as any,
			customSymbolGraphicsController: customSymbolGraphicsController as any,
		})

		await controller.loadCustomSymbolsIntoSymbolDB()

		expect(customSymbolGraphicsController.loadCustomSymbolsIntoSymbolDB).toHaveBeenCalledTimes(1)
	})
})
