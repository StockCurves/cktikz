import { describe, expect, it, vi } from "vitest"
import { initializeMainControllerAppBootstrap } from "../src/scripts/controllers/mainControllerAppBootstrap"

describe("mainControllerAppBootstrap", () => {
	it("runs startup steps in order and marks init done", async () => {
		const calls: string[] = []
		const error = new Error("template init failed")

		await initializeMainControllerAppBootstrap({
			hideLoadingSpinner: () => calls.push("hideLoadingSpinner"),
			loadCustomSymbolsIntoSymbolDB: async () => {
				calls.push("loadCustomSymbolsIntoSymbolDB")
			},
			initAddComponentOffcanvas: async () => {
				calls.push("initAddComponentOffcanvas")
			},
			initShortcuts: () => calls.push("initShortcuts"),
			initTikzEditor: () => calls.push("initTikzEditor"),
			initLiveRender: () => calls.push("initLiveRender"),
			initUiBootstrap: () => calls.push("initUiBootstrap"),
			updatePropertiesPanel: () => calls.push("updatePropertiesPanel"),
			initializeTemplates: async () => {
				calls.push("initializeTemplates")
				throw error
			},
			loadPendingData: () => calls.push("loadPendingData"),
			markInitDone: () => calls.push("markInitDone"),
			reportTemplateInitializeError: (reported) => {
				calls.push(`report:${(reported as Error).message}`)
			},
		})

		expect(calls).toEqual([
			"hideLoadingSpinner",
			"loadCustomSymbolsIntoSymbolDB",
			"initAddComponentOffcanvas",
			"initShortcuts",
			"initTikzEditor",
			"initLiveRender",
			"initUiBootstrap",
			"updatePropertiesPanel",
			"initializeTemplates",
			"loadPendingData",
			"markInitDone",
			"report:template init failed",
		])
	})
})
