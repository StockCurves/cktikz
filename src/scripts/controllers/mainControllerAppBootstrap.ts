export type MainControllerAppBootstrapDependencies = {
	hideLoadingSpinner: () => void
	loadCustomSymbolsIntoSymbolDB: () => Promise<void>
	initAddComponentOffcanvas: () => Promise<void> | void
	initShortcuts: () => void
	initTikzEditor: () => void
	initLiveRender: () => void
	initUiBootstrap: () => void
	updatePropertiesPanel: () => void
	initializeTemplates: () => Promise<void>
	loadPendingData: () => void
	markInitDone: () => void
	reportTemplateInitializeError?: (error: unknown) => void
}

export async function initializeMainControllerAppBootstrap(
	dependencies: MainControllerAppBootstrapDependencies
) {
	dependencies.hideLoadingSpinner()
	await dependencies.loadCustomSymbolsIntoSymbolDB()
	await dependencies.initAddComponentOffcanvas()
	dependencies.initShortcuts()
	dependencies.initTikzEditor()
	dependencies.initLiveRender()
	dependencies.initUiBootstrap()
	dependencies.updatePropertiesPanel()
	void dependencies.initializeTemplates().catch((error) => {
		dependencies.reportTemplateInitializeError?.(error)
	})
	dependencies.loadPendingData()
	dependencies.markInitDone()
}
