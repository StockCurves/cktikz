import { createRuntimeConfig } from "../config/runtimeConfig"

export function getApiBase(hostname?: string): string {
	return createRuntimeConfig({}, hostname).apiBase
}
