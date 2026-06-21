import { afterEach, describe, expect, it } from "vitest"

import {
	bootstrapRuntimeConfig,
	getRuntimeOverridesForPreset,
	resolveRuntimePreset,
} from "../src/scripts/config/runtimeBootstrap"

describe("runtimeBootstrap", () => {
	afterEach(() => {
		delete (window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__
		document.head.innerHTML = ""
	})

	it("resolves the demo preset from the runtime meta tag", () => {
		document.head.innerHTML = `<meta name="circuitikz-runtime" content="demo" />`

		expect(resolveRuntimePreset(document)).toBe("demo")
	})

	it("applies the demo runtime preset to the shared runtime override slot", () => {
		document.head.innerHTML = `<meta name="circuitikz-runtime" content="demo" />`

		bootstrapRuntimeConfig(window, document)

		expect(window.__CIRCUITIKZ_DESIGNER_RUNTIME__).toEqual({
			storageMode: "indexeddb",
			templateSource: "static-manifest",
			latexMode: "serverless-proxy",
		})
	})

	it("keeps explicit runtime overrides on top of the preset defaults", () => {
		document.head.innerHTML = `<meta name="circuitikz-runtime" content="demo" />`
		window.__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
			apiBase: "/demo-api",
			latexMode: "server-proxy",
		}

		bootstrapRuntimeConfig(window, document)

		expect(window.__CIRCUITIKZ_DESIGNER_RUNTIME__).toEqual({
			storageMode: "indexeddb",
			templateSource: "static-manifest",
			latexMode: "server-proxy",
			apiBase: "/demo-api",
		})
	})

	it("ignores missing or invalid runtime meta values", () => {
		document.head.innerHTML = `<meta name="circuitikz-runtime" content="staging" />`

		expect(resolveRuntimePreset(document)).toBeNull()

		bootstrapRuntimeConfig(window, document)
		expect(window.__CIRCUITIKZ_DESIGNER_RUNTIME__).toBeUndefined()
	})

	it("returns empty overrides for the server preset", () => {
		expect(getRuntimeOverridesForPreset("server")).toEqual({})
	})
})
