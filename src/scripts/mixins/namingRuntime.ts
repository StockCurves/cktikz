export type NamingRuntime = {
	isNameTaken: (candidate: string, self: unknown) => boolean
	createExportId: (prefix: string) => string
}

let fallbackCounter = 1

const defaultNamingRuntime: NamingRuntime = {
	isNameTaken: () => false,
	createExportId: (prefix: string) => prefix + fallbackCounter++,
}

let namingRuntime: NamingRuntime = defaultNamingRuntime

export function configureNamingRuntime(runtime: Partial<NamingRuntime> | null) {
	namingRuntime = runtime ? { ...defaultNamingRuntime, ...runtime } : defaultNamingRuntime
}

export function getNamingRuntime(): NamingRuntime {
	return namingRuntime
}
