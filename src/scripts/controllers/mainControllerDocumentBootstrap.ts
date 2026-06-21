type ChangeListener = () => void

export type DesignNameLike = {
	value: string
	addChangeListener: (listener: ChangeListener) => void
}

export type MainControllerDocumentBootstrapDependencies = {
	version: string
	designName: DesignNameLike
	setDarkModeState: (darkMode: boolean) => void
	setDarkModeLastState: (darkMode: boolean) => void
	setCurrentTheme: (theme: string) => void
	updateDesignName: (name: string | undefined) => Promise<boolean>
	sendUpdateBroadcast: () => void
}

export function initializeMainControllerDocumentBootstrap(
	dependencies: MainControllerDocumentBootstrapDependencies
) {
	initializeDefaultTheme(dependencies)
	bindVersionLabels(dependencies.version)
	bindDesignName(dependencies)
}

function initializeDefaultTheme(dependencies: MainControllerDocumentBootstrapDependencies) {
	const htmlElement = document.documentElement
	const switchElement = document.getElementById("darkModeSwitch") as HTMLInputElement | null

	dependencies.setCurrentTheme("light")
	htmlElement.setAttribute("data-bs-theme", "light")
	localStorage.setItem("circuitikz-designer-theme", "light")
	dependencies.setDarkModeLastState(false)
	dependencies.setDarkModeState(false)

	if (switchElement) {
		switchElement.checked = false
	}
}

function bindVersionLabels(version: string) {
	document.addEventListener("DOMContentLoaded", () => {
		for (const element of document.getElementsByClassName("version")) {
			element.textContent = `v${version}`
		}
	})
}

function bindDesignName(dependencies: MainControllerDocumentBootstrapDependencies) {
	const fileExportName = document.getElementById("exportModalFileBasename") as HTMLInputElement | null

	dependencies.designName.addChangeListener(() => {
		const name = dependencies.designName.value
		document.title = `${name}${name ? " - " : ""}VisioCirkit`
		if (fileExportName) {
			fileExportName.placeholder = name.replace(/[^a-z0-9]/gi, "_") || "Circuit"
		}

		dependencies.updateDesignName(name || undefined).then((updated) => {
			if (updated) {
				dependencies.sendUpdateBroadcast()
			}
		})
	})
}
