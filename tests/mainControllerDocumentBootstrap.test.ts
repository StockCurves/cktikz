import { beforeEach, describe, expect, it, vi } from "vitest"
import { initializeMainControllerDocumentBootstrap } from "../src/scripts/controllers/mainControllerDocumentBootstrap"

describe("mainControllerDocumentBootstrap", () => {
	beforeEach(() => {
		localStorage.clear()
		document.body.innerHTML = `
			<input id="darkModeSwitch" type="checkbox" checked />
			<input id="exportModalFileBasename" />
			<span class="version"></span>
			<span class="version"></span>
		`
		document.title = "Initial"
		document.documentElement.setAttribute("data-bs-theme", "dark")
	})

	it("initializes default theme, binds version labels, and reacts to design name changes", async () => {
		let changeListener: (() => void) | null = null
		const designName = {
			value: "",
			addChangeListener: vi.fn((listener: () => void) => {
				changeListener = listener
			}),
		}
		const setDarkModeState = vi.fn()
		const setDarkModeLastState = vi.fn()
		const setCurrentTheme = vi.fn()
		const updateDesignName = vi.fn().mockResolvedValue(true)
		const sendUpdateBroadcast = vi.fn()

		initializeMainControllerDocumentBootstrap({
			version: "1.2.3",
			designName,
			setDarkModeState,
			setDarkModeLastState,
			setCurrentTheme,
			updateDesignName,
			sendUpdateBroadcast,
		})

		expect(setCurrentTheme).toHaveBeenCalledWith("light")
		expect(setDarkModeState).toHaveBeenCalledWith(false)
		expect(setDarkModeLastState).toHaveBeenCalledWith(false)
		expect(document.documentElement.getAttribute("data-bs-theme")).toBe("light")
		expect(localStorage.getItem("circuitikz-designer-theme")).toBe("light")
		expect((document.getElementById("darkModeSwitch") as HTMLInputElement).checked).toBe(false)

		document.dispatchEvent(new Event("DOMContentLoaded"))
		for (const element of document.getElementsByClassName("version")) {
			expect(element.textContent).toBe("v1.2.3")
		}

		designName.value = "My Circuit 01"
		changeListener?.()
		await Promise.resolve()

		expect(document.title).toBe("My Circuit 01 - VisioCirkit")
		expect((document.getElementById("exportModalFileBasename") as HTMLInputElement).placeholder).toBe("My_Circuit_01")
		expect(updateDesignName).toHaveBeenCalledWith("My Circuit 01")
		expect(sendUpdateBroadcast).toHaveBeenCalled()
	})
})
