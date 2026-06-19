export type StorageMode = "server" | "indexeddb"
export type TemplateSourceMode = "server" | "static-manifest"
export type LatexMode = "server-proxy" | "serverless-proxy"

export type AppRuntimeConfig = {
	storageMode: StorageMode
	templateSource: TemplateSourceMode
	latexMode: LatexMode
	apiBase: string
}

declare global {
	interface Window {
		__CIRCUITIKZ_DESIGNER_RUNTIME__?: Partial<AppRuntimeConfig>
	}
}

function getDefaultHostname() {
	if (typeof window === "undefined" || !window.location) {
		return "localhost"
	}
	return window.location.hostname
}

export function resolveServerApiBase(hostname = getDefaultHostname()): string {
	if (["localhost", "127.0.0.1"].includes(hostname)) {
		return "http://localhost:3001"
	}
	return ""
}

export function createRuntimeConfig(
	overrides: Partial<AppRuntimeConfig> = {},
	hostname = getDefaultHostname()
): AppRuntimeConfig {
	const windowOverrides =
		typeof window !== "undefined" ? (window.__CIRCUITIKZ_DESIGNER_RUNTIME__ ?? {}) : {}

	return {
		storageMode: "server",
		templateSource: "server",
		latexMode: "server-proxy",
		apiBase: resolveServerApiBase(hostname),
		...windowOverrides,
		...overrides,
	}
}

export const runtimeConfig = createRuntimeConfig()
