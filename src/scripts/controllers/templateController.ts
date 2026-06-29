import { Modal } from "bootstrap"
import { MainController } from "./mainController"
import { TikzEditorController } from "./tikzEditorController"
import { createTemplateControllerRuntime } from "../services/controllerRuntime"
import { TemplateDirectory, TemplateListViewModel } from "../services/templateTypes"
import { CanvasController, LiveRenderController } from "../internal"

export class TemplateController {
	private static _instance: TemplateController
	public static get instance(): TemplateController {
		if (!TemplateController._instance) {
			TemplateController._instance = new TemplateController()
		}
		return TemplateController._instance
	}

	private templateDropdownBtn: HTMLButtonElement | null = null
	private templateDropdownMenu: HTMLUListElement | null = null
	private saveServerModal: Modal | null = null
	private saveServerFilenameInput: HTMLInputElement
	private saveServerConfirmButton: HTMLButtonElement
	private workContextMenu: HTMLDivElement | null = null
	private deleteWorkButton: HTMLButtonElement | null = null
	private contextMenuTargetFile: string | null = null
	private readonly runtime = createTemplateControllerRuntime(
		{
			getCode: () => TikzEditorController.instance.getCode(),
			setCode: (code) => TikzEditorController.instance.setCode(code),
			applyEditorText: () => TikzEditorController.instance.applyEditorText(),
		},
		{
			alert: (title, message) => MainController.instance.openAlert(title, message),
			confirm: (title, message) => MainController.instance.openConfirm(title, message),
		}
	)

	private constructor() {
		this.templateDropdownBtn = document.getElementById("template-dropdown-btn") as HTMLButtonElement
		this.templateDropdownMenu = document.getElementById("template-dropdown-menu") as HTMLUListElement
		this.saveServerFilenameInput = document.getElementById("saveServerFilenameInput") as HTMLInputElement
		this.saveServerConfirmButton = document.getElementById("saveServerConfirmButton") as HTMLButtonElement
		this.workContextMenu = document.getElementById("workContextMenu") as HTMLDivElement
		this.deleteWorkButton = document.getElementById("deleteWorkButton") as HTMLButtonElement

		const modalEl = document.getElementById("saveServerModal")
		if (modalEl) {
			this.saveServerModal = new Modal(modalEl)
		}

		this.initEvents()
	}

	public async initialize() {
		if (!this.templateDropdownMenu) return
		try {
			const viewModel = await this.runtime.applicationService.bootstrapDefaultFile()
			this.renderDropdown(viewModel)
		} catch (err) {
			console.error("Error loading templates:", err)
		}
	}

	public openSaveModal() {
		const baseName = this.runtime.applicationService.getState().currentName.replace(/\.tex$/, "")
		this.saveServerFilenameInput.value =
			baseName === "rc-lowpass" || baseName === "blank" ? "my-circuit" : baseName
		this.saveServerModal?.show()
	}

	private initEvents() {
		this.saveServerConfirmButton?.addEventListener("click", () => {
			this.confirmSaveToServer()
		})

		this.deleteWorkButton?.addEventListener("click", () => {
			this.confirmDeleteWorkFile()
		})

		document.addEventListener("click", () => {
			if (this.workContextMenu) {
				this.workContextMenu.style.display = "none"
			}
		})
	}

	private renderDropdown(viewModel: TemplateListViewModel) {
		if (!this.templateDropdownMenu) return
		this.templateDropdownMenu.innerHTML = ""

		const appendHeader = (text: string) => {
			const header = document.createElement("li")
			header.innerHTML = `<span class="dropdown-header fw-bold text-uppercase fs-7" style="color: var(--text-muted, #888);">${text}</span>`
			this.templateDropdownMenu!.appendChild(header)
		}

		const appendEntry = (dir: TemplateDirectory, name: string, withContextMenu = false) => {
			const li = document.createElement("li")
			const link = document.createElement("a")
			link.className = "dropdown-item py-1"
			link.href = "#"
			link.textContent = name.replace(/\.tex$/, "")
			link.style.color = "var(--text-main)"
			link.addEventListener("click", async (e) => {
				e.preventDefault()
				await this.handleFileOpen(dir, name)
			})
			if (withContextMenu) {
				link.addEventListener("contextmenu", (e) => {
					e.preventDefault()
					e.stopPropagation()
					this.showContextMenu(e, name)
				})
			}
			li.appendChild(link)
			this.templateDropdownMenu!.appendChild(li)
		}

		appendHeader("Templates (Read-Only)")
		viewModel.templates.forEach((name) => appendEntry("template", name))

		const divider = document.createElement("li")
		divider.innerHTML = `<hr class="dropdown-divider" style="border-color: var(--border-color);">`
		this.templateDropdownMenu.appendChild(divider)

		appendHeader("Work (Editable)")
		if (viewModel.hasWorks) {
			viewModel.works.forEach((name) => appendEntry("work", name, true))
		} else {
			const li = document.createElement("li")
			li.innerHTML = `<span class="dropdown-item-text text-muted py-1 small italic">No saved works</span>`
			this.templateDropdownMenu.appendChild(li)
		}

		this.updateDropdownButtonText(viewModel.selectedDisplayName)
		const currentDir = this.runtime.applicationService.getState().currentDir
		TikzEditorController.instance.setApplyButtonVisible(currentDir !== "template")
	}

	private updateDropdownButtonText(selectedDisplayName: string) {
		if (!this.templateDropdownBtn) return
		const span = this.templateDropdownBtn.querySelector("span")
		if (span) {
			span.textContent = selectedDisplayName
		} else {
			this.templateDropdownBtn.textContent = selectedDisplayName
		}
	}

	private async handleFileOpen(dir: TemplateDirectory, name: string) {
		const viewModel = await this.runtime.applicationService.openFile(dir, name)
		this.renderDropdown(viewModel)
		requestAnimationFrame(() => {
			CanvasController.instance?.fitView()
			LiveRenderController.instance?.fitView()
		})
	}

	private async confirmSaveToServer() {
		try {
			const viewModel = await this.runtime.applicationService.saveWork(this.saveServerFilenameInput.value)
			this.saveServerModal?.hide()
			this.renderDropdown(viewModel)
		} catch (err) {
			console.error("Failed to save file:", err)
		}
	}

	private showContextMenu(e: MouseEvent, filename: string) {
		if (!this.workContextMenu) return

		this.contextMenuTargetFile = filename
		this.workContextMenu.style.display = "block"

		const rect = this.workContextMenu.getBoundingClientRect()
		let left = e.pageX
		let top = e.pageY

		if (left + rect.width > window.innerWidth) {
			left = window.innerWidth - rect.width - 10
		}
		if (left < 0) left = 10

		if (top + rect.height > window.innerHeight) {
			top = window.innerHeight - rect.height - 10
		}
		if (top < 0) top = 10

		this.workContextMenu.style.left = `${left}px`
		this.workContextMenu.style.top = `${top}px`
	}

	private async confirmDeleteWorkFile() {
		if (!this.contextMenuTargetFile) return
		try {
			const viewModel = await this.runtime.applicationService.deleteWork(this.contextMenuTargetFile)
			this.renderDropdown(viewModel)
		} catch (err) {
			console.error("Failed to delete file:", err)
		} finally {
			this.contextMenuTargetFile = null
		}
	}
}
