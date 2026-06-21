export type MainControllerModeBootstrapDependencies = {
	switchToDragPanMode: () => void
	switchToEraseMode: () => void
	placeWireMode: () => void
}

export type MainControllerModeButtons = {
	modeDragPan: HTMLButtonElement | null
	modeDrawLine: HTMLButtonElement | null
	modeEraser: HTMLButtonElement | null
}

export function initializeMainControllerModeBootstrap(
	dependencies: MainControllerModeBootstrapDependencies
): MainControllerModeButtons {
	const modeDragPan = document.getElementById("modeDragPan") as HTMLButtonElement | null
	const modeDrawLine = document.getElementById("modeDrawLine") as HTMLButtonElement | null
	const modeEraser = document.getElementById("modeEraser") as HTMLButtonElement | null

	modeDragPan?.addEventListener("click", () => dependencies.switchToDragPanMode(), {
		passive: false,
	})
	modeDrawLine?.addEventListener(
		"click",
		() => {
			dependencies.placeWireMode()
			modeDrawLine.classList.add("selected")
		},
		{ passive: false }
	)
	modeEraser?.addEventListener("click", () => dependencies.switchToEraseMode(), {
		passive: false,
	})

	return {
		modeDragPan,
		modeDrawLine,
		modeEraser,
	}
}
