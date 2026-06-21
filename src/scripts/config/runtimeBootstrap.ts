import type { AppRuntimeConfig } from "./runtimeConfig"

export type RuntimePreset = "server" | "demo"

const DEMO_RUNTIME_OVERRIDES: Partial<AppRuntimeConfig> = Object.freeze({
	storageMode: "indexeddb",
	templateSource: "static-manifest",
	latexMode: "serverless-proxy",
})

declare global {
	interface Window {
		__CIRCUITIKZ_DESIGNER_RUNTIME_PRESET__?: RuntimePreset
	}
}

function isRuntimePreset(value: string | null | undefined): value is RuntimePreset {
	return value === "server" || value === "demo"
}

export function resolveRuntimePreset(
	search = typeof window !== "undefined" ? window.location.search : "",
	doc: Document | undefined = typeof document !== "undefined" ? document : undefined,
	win: Window | undefined = typeof window !== "undefined" ? window : undefined
): RuntimePreset | null {
	const queryPreset = new URLSearchParams(search).get("runtime")
	if (isRuntimePreset(queryPreset)) {
		return queryPreset
	}

	const metaPreset = doc?.querySelector('meta[name="circuitikz-runtime"]')?.getAttribute("content")?.trim()
	if (isRuntimePreset(metaPreset)) {
		return metaPreset
	}

	const dataPreset = doc?.documentElement?.dataset.runtime?.trim() ?? doc?.body?.dataset.runtime?.trim()
	if (isRuntimePreset(dataPreset)) {
		return dataPreset
	}

	const windowPreset = win?.__CIRCUITIKZ_DESIGNER_RUNTIME_PRESET__
	if (isRuntimePreset(windowPreset)) {
		return windowPreset
	}

	return null
}

export function getRuntimeOverridesForPreset(preset: RuntimePreset): Partial<AppRuntimeConfig> {
	if (preset === "demo") {
		return DEMO_RUNTIME_OVERRIDES
	}
	return {}
}

export function bootstrapRuntimeConfig(
	win: Window | undefined = typeof window !== "undefined" ? window : undefined,
	doc: Document | undefined = typeof document !== "undefined" ? document : undefined
) {
	if (!win) {
		return
	}

	const preset = resolveRuntimePreset(win.location.search, doc, win)
	if (!preset) {
		return
	}

	win.__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
		...getRuntimeOverridesForPreset(preset),
		...(win.__CIRCUITIKZ_DESIGNER_RUNTIME__ ?? {}),
	}
}
