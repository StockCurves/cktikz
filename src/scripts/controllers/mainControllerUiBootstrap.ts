import type { GroupComponent } from "../components/groupComponent"

export type ContextMenuEntry = {
	result: string
	text: string
}

export type ContextMenuLike = {
	openForResult: (x: number, y: number) => Promise<string>
}

export type MainControllerUiBootstrapDependencies = {
	toggleTikzEditor: () => void
	exportSvg: () => void
	getSelectedComponents: () => unknown[]
	isGroupComponent: (component: unknown) => boolean
	groupSelection: (components: unknown[]) => void
	ungroupSelection: (component: GroupComponent) => void
	createSubcircuitFromSelection: () => void | Promise<void>
	createContextMenu: (entries: ContextMenuEntry[]) => ContextMenuLike
	preprocessAllSymbolColors: () => void
	onThemeChanged: (darkMode: boolean) => void
	updateTheme: () => void
}

export function initializeMainControllerUiBootstrap(dependencies: MainControllerUiBootstrapDependencies) {
	const exportCircuiTikZButton = document.getElementById("exportCircuiTikZButton") as HTMLButtonElement | null
	exportCircuiTikZButton?.addEventListener(
		"click",
		() => {
			dependencies.toggleTikzEditor()
		},
		{ passive: true }
	)

	const exportSvgButton = document.getElementById("exportSVGButton") as HTMLButtonElement | null
	exportSvgButton?.addEventListener("click", dependencies.exportSvg, { passive: true })

	const canvas = document.getElementById("canvas")
	canvas?.addEventListener(
		"contextmenu",
		(evt) => {
			evt.preventDefault()
			const selected = dependencies.getSelectedComponents()
			if (selected.length === 0) {
				return
			}

			const menuEntries: ContextMenuEntry[] = []
			if (selected.length > 1) {
				menuEntries.push({ result: "group", text: "Group Selection" })
			}

			if (selected.length === 1 && dependencies.isGroupComponent(selected[0])) {
				menuEntries.push({ result: "ungroup", text: "Ungroup" })
			}

			menuEntries.push({ result: "subcircuit", text: "Save Selection as Symbol..." })

			const menu = dependencies.createContextMenu(menuEntries)
			menu.openForResult(evt.clientX, evt.clientY).then((res) => {
				if (res === "group") {
					dependencies.groupSelection(selected)
				} else if (res === "ungroup") {
					dependencies.ungroupSelection(selected[0] as GroupComponent)
				} else if (res === "subcircuit") {
					void dependencies.createSubcircuitFromSelection()
				}
			}).catch(() => {})
		},
		{ passive: false }
	)

	dependencies.preprocessAllSymbolColors()

	const htmlElement = document.documentElement
	const switchElement = document.getElementById("darkModeSwitch") as HTMLInputElement | null
	switchElement?.addEventListener("change", () => {
		const darkMode = switchElement.checked
		htmlElement.setAttribute("data-bs-theme", darkMode ? "dark" : "light")
		localStorage.setItem("circuitikz-designer-theme", darkMode ? "dark" : "light")
		dependencies.onThemeChanged(darkMode)
		dependencies.updateTheme()
	})

	dependencies.updateTheme()
}
