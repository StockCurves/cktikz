import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => {
	return {
		bootstrapDefaultFile: vi.fn(),
		openFile: vi.fn(),
		saveWork: vi.fn(),
		deleteWork: vi.fn(),
		getState: vi.fn(),
	}
})

vi.mock("bootstrap", () => ({
	Modal: class {
		show = vi.fn()
		hide = vi.fn()
	},
}))

vi.mock("../src/scripts/services/templateApplicationService", () => ({
	TemplateApplicationService: class {
		bootstrapDefaultFile = serviceMocks.bootstrapDefaultFile
		openFile = serviceMocks.openFile
		saveWork = serviceMocks.saveWork
		deleteWork = serviceMocks.deleteWork
		getState = serviceMocks.getState
	},
}))

vi.mock("../src/scripts/controllers/mainController", () => ({
	MainController: {
		instance: {
			openAlert: vi.fn(),
			openConfirm: vi.fn(),
		},
	},
}))

vi.mock("../src/scripts/controllers/tikzEditorController", () => ({
	TikzEditorController: {
		instance: {
			getCode: vi.fn(),
			setCode: vi.fn(),
			applyEditorText: vi.fn(),
			setApplyButtonVisible: vi.fn(),
		},
	},
}))

vi.mock("../src/scripts/services/controllerRuntime", () => ({
	createTemplateControllerRuntime: vi.fn(() => ({
		applicationService: {
			bootstrapDefaultFile: serviceMocks.bootstrapDefaultFile,
			openFile: serviceMocks.openFile,
			saveWork: serviceMocks.saveWork,
			deleteWork: serviceMocks.deleteWork,
			getState: serviceMocks.getState,
		},
	})),
}))

vi.mock("../src/scripts/internal", () => ({
	CanvasController: {
		instance: {
			fitView: vi.fn(),
		},
	},
	LiveRenderController: {
		instance: {
			fitView: vi.fn(),
		},
	},
}))

describe("TemplateController", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		document.body.innerHTML = `
			<button id="template-dropdown-btn"><span>initial</span></button>
			<ul id="template-dropdown-menu"></ul>
			<div id="saveServerModal"></div>
			<input id="saveServerFilenameInput" />
			<button id="saveServerConfirmButton"></button>
			<div id="workContextMenu" style="display:none; position:absolute;"></div>
			<button id="deleteWorkButton"></button>
		`

		serviceMocks.bootstrapDefaultFile.mockResolvedValue({
			templates: ["rc-lowpass.tex"],
			works: ["blank.tex"],
			selectedDisplayName: "blank",
			hasWorks: true,
		})
		serviceMocks.openFile.mockResolvedValue({
			templates: ["rc-lowpass.tex"],
			works: ["blank.tex", "draft.tex"],
			selectedDisplayName: "draft",
			hasWorks: true,
		})
		serviceMocks.getState.mockReturnValue({
			currentDir: "work",
			currentName: "blank.tex",
			templates: ["rc-lowpass.tex"],
			works: ["blank.tex"],
		})
	})

	it("renders template and work groups with blank work", async () => {
		const { TemplateController } = await import("../src/scripts/controllers/templateController")

		await TemplateController.instance.initialize()

		const menu = document.getElementById("template-dropdown-menu")!
		expect(menu.textContent).toContain("Templates (Read-Only)")
		expect(menu.textContent).toContain("Work (Editable)")
		expect(menu.textContent).toContain("blank")
		expect(document.getElementById("template-dropdown-btn")!.textContent).toContain("blank")
	})

	it("opens a work file when a dropdown item is clicked", async () => {
		serviceMocks.bootstrapDefaultFile.mockResolvedValue({
			templates: ["rc-lowpass.tex"],
			works: ["draft.tex"],
			selectedDisplayName: "rc-lowpass",
			hasWorks: true,
		})
		const { TemplateController } = await import("../src/scripts/controllers/templateController")
		await TemplateController.instance.initialize()

		const workLink = Array.from(document.querySelectorAll("#template-dropdown-menu a")).find(
			(link) => link.textContent === "draft"
		) as HTMLAnchorElement
		workLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

		expect(serviceMocks.openFile).toHaveBeenCalledWith("work", "draft.tex")
	})

	it("shows the context menu and remembers the target work file on right click", async () => {
		serviceMocks.bootstrapDefaultFile.mockResolvedValue({
			templates: ["rc-lowpass.tex"],
			works: ["draft.tex"],
			selectedDisplayName: "rc-lowpass",
			hasWorks: true,
		})
		const { TemplateController } = await import("../src/scripts/controllers/templateController")
		await TemplateController.instance.initialize()

		const workLink = Array.from(document.querySelectorAll("#template-dropdown-menu a")).find(
			(link) => link.textContent === "draft"
		) as HTMLAnchorElement
		workLink.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, pageX: 50, pageY: 60 }))

		const controller = TemplateController.instance as any
		const menu = document.getElementById("workContextMenu") as HTMLDivElement
		expect(controller.contextMenuTargetFile).toBe("draft.tex")
		expect(menu.style.display).toBe("block")
	})
})
