import { beforeEach, describe, expect, it, vi } from "vitest"
import { initializeMainControllerModeBootstrap } from "../src/scripts/controllers/mainControllerModeBootstrap"

describe("mainControllerModeBootstrap", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<button id="modeDragPan"></button>
			<button id="modeDrawLine"></button>
			<button id="modeEraser"></button>
		`
	})

	it("binds mode buttons and preserves draw-line selected class behavior", () => {
		const switchToDragPanMode = vi.fn()
		const switchToEraseMode = vi.fn()
		const placeWireMode = vi.fn()

		const buttons = initializeMainControllerModeBootstrap({
			switchToDragPanMode,
			switchToEraseMode,
			placeWireMode,
		})

		buttons.modeDragPan?.click()
		buttons.modeDrawLine?.click()
		buttons.modeEraser?.click()

		expect(switchToDragPanMode).toHaveBeenCalledTimes(1)
		expect(placeWireMode).toHaveBeenCalledTimes(1)
		expect(buttons.modeDrawLine?.classList.contains("selected")).toBe(true)
		expect(switchToEraseMode).toHaveBeenCalledTimes(1)
	})
})
