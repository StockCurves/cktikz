import type { AppRuntimeConfig } from "./runtimeConfig"

export type RuntimePreset = "server" | "demo"
const RUNTIME_META_SELECTOR = 'meta[name="circuitikz-runtime"]'

const DEMO_RUNTIME_OVERRIDES: Partial<AppRuntimeConfig> = Object.freeze({
	storageMode: "indexeddb",
	templateSource: "static-manifest",
	latexMode: "serverless-proxy",
})

function isRuntimePreset(value: string | null | undefined): value is RuntimePreset {
	return value === "server" || value === "demo"
}

export function resolveRuntimePreset(
	doc: Document | undefined = typeof document !== "undefined" ? document : undefined
): RuntimePreset | null {
	const metaPreset = doc?.querySelector(RUNTIME_META_SELECTOR)?.getAttribute("content")?.trim()
	if (isRuntimePreset(metaPreset)) {
		return metaPreset
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

	const preset = resolveRuntimePreset(doc)
	if (!preset) {
		return
	}

	win.__CIRCUITIKZ_DESIGNER_RUNTIME__ = {
		...getRuntimeOverridesForPreset(preset),
		...(win.__CIRCUITIKZ_DESIGNER_RUNTIME__ ?? {}),
	}
}
