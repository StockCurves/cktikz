import { afterEach, describe, expect, it } from "vitest"

import {
	bootstrapRuntimeConfig,
	getRuntimeOverridesForPreset,
	resolveRuntimePreset,
} from "../src/scripts/config/runtimeBootstrap"

describe("runtimeBootstrap", () => {
	afterEach(() => {
		delete (window as any).__CIRCUITIKZ_DESIGNER_RUNTIME__
		delete (window as any).__CIRCUITIKZ_DESIGNER_RUNTIME_PRESET__
		document.head.innerHTML = ""
		document.documentElement.removeAttribute("data-runtime")
		document.body.removeAttribute("data-runtime")
		window.history.replaceState({}, "", "/")
	})

	it("resolves the demo preset from the runtime query parameter before DOM defaults", () => {
		document.head.innerHTML = `<meta name="circuitikz-runtime" content="server" />`
		window.history.replaceState({}, "", "/?runtime=demo")

		expect(resolveRuntimePreset(window.location.search, document, window)).toBe("demo")
	})

	it("applies the demo runtime preset to the shared runtime override slot", () => {
		window.history.replaceState({}, "", "/?runtime=demo")

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

	it("returns empty overrides for the server preset", () => {
		expect(getRuntimeOverridesForPreset("server")).toEqual({})
	})
})
