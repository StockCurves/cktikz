type HotkeysRegistrar = (shortcut: string, handler: () => boolean | void) => void

export type MainControllerShortcutBootstrapDependencies = {
	registerHotkey: HotkeysRegistrar
	switchToDragPanMode: () => void
	switchToEraseMode: () => void
	isComponentPlacementMode: () => boolean
	hasSelection: () => boolean
	rotatePlacement: (angleDeg: number) => void
	rotateSelection: (angleDeg: number) => void
	flipPlacement: (horizontal: boolean) => void
	flipSelection: (horizontal: boolean) => void
	addUndoState: () => void
	selectAll: () => void
	undo: () => void
	redo: () => void
	copy: () => void
	paste: () => void
	cut: () => void
	exportSvg: () => void
	clickAddComponentButton: () => void
	fitActiveView: () => void
	placeWireComponent: () => void
	removeSelection: () => void
	placeTextComponent: () => void
	activateShortcutComponent: (componentTitle: string) => void
}

const shortcutComponents: Array<{ shortcut: string; component: string }> = [
	{ shortcut: "g", component: "Ground" },
	{ shortcut: "alt+g,option+g", component: "Ground (tailless)" },
	{ shortcut: "r", component: "Resistor (american)" },
	{ shortcut: "alt+r,option+r", component: "Resistor (european)" },
	{ shortcut: "c", component: "Capacitor" },
	{ shortcut: "alt+c,option+c", component: "Curved (polarized) capacitor" },
	{ shortcut: "l", component: "Inductor (american)" },
	{ shortcut: "alt+l,option+l", component: "Inductor (cute)" },
	{ shortcut: "d", component: "Empty diode" },
	{ shortcut: "b", component: "NPN" },
	{ shortcut: "alt+b,option+b", component: "PNP" },
	{ shortcut: "n", component: "NMOS" },
	{ shortcut: "alt+n,option+n", component: "PMOS" },
	{ shortcut: "x", component: "Plain style crossing node" },
	{ shortcut: "alt+x,option+x", component: "Jumper-style crossing node" },
	{ shortcut: ".", component: "Connected terminal" },
	{ shortcut: "alt+.,option+.", component: "Unconnected terminal" },
]

export function initializeMainControllerShortcutBootstrap(
	dependencies: MainControllerShortcutBootstrapDependencies
) {
	const register = dependencies.registerHotkey

	register("ctrl+r,command+r", () => false)

	register("ctrl+r,command+r", () => {
		if (dependencies.isComponentPlacementMode()) {
			dependencies.rotatePlacement(-90)
		} else if (dependencies.hasSelection()) {
			dependencies.rotateSelection(-90)
			dependencies.addUndoState()
		}
		return false
	})

	register("ctrl+shift+r,command+shift+r", () => {
		if (dependencies.isComponentPlacementMode()) {
			dependencies.rotatePlacement(90)
		} else if (dependencies.hasSelection()) {
			dependencies.rotateSelection(90)
			dependencies.addUndoState()
		}
		return false
	})

	register("shift+x", () => {
		if (dependencies.isComponentPlacementMode()) {
			dependencies.flipPlacement(true)
		} else if (dependencies.hasSelection()) {
			dependencies.flipSelection(true)
			dependencies.addUndoState()
		}
		return false
	})

	register("shift+y", () => {
		if (dependencies.isComponentPlacementMode()) {
			dependencies.flipPlacement(false)
		} else if (dependencies.hasSelection()) {
			dependencies.flipSelection(false)
			dependencies.addUndoState()
		}
		return false
	})

	register("ctrl+a,command+a", () => {
		dependencies.selectAll()
		return false
	})

	register("ctrl+z,command+z", () => {
		dependencies.undo()
		return false
	})

	register("ctrl+y,command+y", () => {
		dependencies.redo()
		return false
	})

	const undoButton = document.getElementById("undoButton") as HTMLButtonElement | null
	const redoButton = document.getElementById("redoButton") as HTMLButtonElement | null
	undoButton?.addEventListener("click", () => dependencies.undo())
	redoButton?.addEventListener("click", () => dependencies.redo())

	register("ctrl+c,command+c", () => {
		dependencies.copy()
		return false
	})
	register("ctrl+v,command+v", () => {
		dependencies.paste()
		return false
	})
	register("ctrl+x,command+x", () => {
		dependencies.cut()
		return false
	})

	register("ctrl+shift+e,command+shift+e", () => {
		dependencies.exportSvg()
		return false
	})

	register("q", () => {
		dependencies.clickAddComponentButton()
		return false
	})
	register("esc", () => {
		dependencies.switchToDragPanMode()
		return false
	})
	register("f", () => {
		dependencies.fitActiveView()
		return false
	})
	register("w", () => {
		dependencies.switchToDragPanMode()
		dependencies.placeWireComponent()
		return false
	})
	register("del, backspace", () => {
		if (!dependencies.hasSelection()) {
			dependencies.switchToEraseMode()
		} else {
			dependencies.removeSelection()
			dependencies.addUndoState()
		}
		return false
	})
	register("t", () => {
		dependencies.switchToDragPanMode()
		dependencies.placeTextComponent()
		return false
	})

	for (const { shortcut, component } of shortcutComponents) {
		register(shortcut, () => {
			dependencies.switchToDragPanMode()
			dependencies.activateShortcutComponent(component)
		})
	}
}
