import { TikzEditorController } from "./tikzEditorController"
import { Modal } from "bootstrap"
import { MainController } from "./mainController"

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
	private saveServerModal: Modal
	private saveServerFilenameInput: HTMLInputElement
	private saveServerConfirmButton: HTMLButtonElement
	private workContextMenu: HTMLDivElement | null = null
	private deleteWorkButton: HTMLButtonElement | null = null
	private contextMenuTargetFile: string | null = null

	public currentDir: string = "template"
	public currentName: string = "rc-lowpass.tex"

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

	private getApiBase(): string {
		if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
			return "http://localhost:3001"
		}
		return ""
	}

	private initEvents() {
		if (this.saveServerConfirmButton) {
			this.saveServerConfirmButton.addEventListener("click", () => {
				this.confirmSaveToServer()
			})
		}

		if (this.deleteWorkButton) {
			this.deleteWorkButton.addEventListener("click", () => {
				this.confirmDeleteWorkFile()
			})
		}

		// Hide context menu on left click anywhere on document
		document.addEventListener("click", () => {
			if (this.workContextMenu) {
				this.workContextMenu.style.display = "none"
			}
		})
	}

	public async fetchFiles() {
		if (!this.templateDropdownMenu) return
		try {
			const res = await fetch(`${this.getApiBase()}/api/files`)
			const data = await res.json()

			this.templateDropdownMenu.innerHTML = ""

			// Templates group header
			const headerTemplates = document.createElement("li")
			headerTemplates.innerHTML = `<span class="dropdown-header fw-bold text-uppercase fs-7" style="color: var(--text-muted, #888);">Templates (Read-Only)</span>`
			this.templateDropdownMenu.appendChild(headerTemplates)

			if (data.templates) {
				data.templates.forEach((t: string) => {
					const li = document.createElement("li")
					const a = document.createElement("a")
					const baseName = t.replace(/\.tex$/, "")
					a.className = "dropdown-item py-1"
					a.href = "#"
					a.textContent = baseName
					a.style.color = "var(--text-main)"
					a.addEventListener("click", (e) => {
						e.preventDefault()
						this.loadRemoteFile("template", t)
					})
					li.appendChild(a)
					this.templateDropdownMenu!.appendChild(li)
				})
			}

			// Divider
			const divider = document.createElement("li")
			divider.innerHTML = `<hr class="dropdown-divider" style="border-color: var(--border-color);">`
			this.templateDropdownMenu.appendChild(divider)

			// Works group header
			const headerWorks = document.createElement("li")
			headerWorks.innerHTML = `<span class="dropdown-header fw-bold text-uppercase fs-7" style="color: var(--text-muted, #888);">Work (Editable)</span>`
			this.templateDropdownMenu.appendChild(headerWorks)

			if (data.works && data.works.length > 0) {
				data.works.forEach((w: string) => {
					const li = document.createElement("li")
					const a = document.createElement("a")
					const baseName = w.replace(/\.tex$/, "")
					a.className = "dropdown-item py-1"
					a.href = "#"
					a.textContent = baseName
					a.style.color = "var(--text-main)"
					a.addEventListener("click", (e) => {
						e.preventDefault()
						this.loadRemoteFile("work", w)
					})
					// Right click (contextmenu) logic
					a.addEventListener("contextmenu", (e) => {
						e.preventDefault()
						e.stopPropagation()
						this.showContextMenu(e, w)
					})
					li.appendChild(a)
					this.templateDropdownMenu!.appendChild(li)
				})
			} else {
				const li = document.createElement("li")
				li.innerHTML = `<span class="dropdown-item-text text-muted py-1 small italic">No saved works</span>`
				this.templateDropdownMenu.appendChild(li)
			}

			// Update the dropdown button text
			this.updateDropdownButtonText()
		} catch (err) {
			console.error("Failed to fetch files:", err)
		}
	}

	private updateDropdownButtonText() {
		if (this.templateDropdownBtn && this.currentName) {
			const baseName = this.currentName.replace(/\.tex$/, "")
			const span = this.templateDropdownBtn.querySelector("span")
			if (span) {
				span.textContent = baseName
			} else {
				this.templateDropdownBtn.textContent = baseName
			}
		}
	}

	public async loadRemoteFile(dir: string, name: string) {
		try {
			const res = await fetch(`${this.getApiBase()}/api/file?dir=${dir}&name=${encodeURIComponent(name)}`)
			if (!res.ok) {
				throw new Error(await res.text())
			}
			const code = await res.text()

			this.currentDir = dir
			this.currentName = name

			// Sync code into editor text area
			TikzEditorController.instance.setCode(code)
			// Apply loaded code to canvas
			TikzEditorController.instance.applyEditorText()

			// Sync dropdown selection text
			this.updateDropdownButtonText()
		} catch (err: any) {
			console.error("Failed to load file:", err)
			await MainController.instance.openAlert("Error loading file", err.message)
		}
	}

	public openSaveModal() {
		if (this.saveServerFilenameInput) {
			const baseName = this.currentName.replace(/\.tex$/, "")
			this.saveServerFilenameInput.value = baseName === "rc-lowpass" ? "my-circuit" : baseName
		}
		if (this.saveServerModal) {
			this.saveServerModal.show()
		}
	}

	private async confirmSaveToServer() {
		let filename = this.saveServerFilenameInput.value.trim()
		if (!filename) {
			await MainController.instance.openAlert("Save File", "Please enter a filename.")
			return
		}
		if (/[\\/:*?"<>|]/.test(filename)) {
			await MainController.instance.openAlert("Save File", "Invalid filename characters.")
			return
		}
		const safeFilename = filename.endsWith(".tex") ? filename : `${filename}.tex`
		const content = TikzEditorController.instance.getCode()

		try {
			const res = await fetch(`${this.getApiBase()}/api/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dir: "work", name: safeFilename, content }),
			})

			const data = await res.json()
			if (!res.ok || data.error) {
				throw new Error(data.error || "Failed to save file.")
			}

			this.currentDir = "work"
			this.currentName = safeFilename

			if (this.saveServerModal) {
				this.saveServerModal.hide()
			}

			await MainController.instance.openAlert("Save Complete", `Successfully saved to work/${safeFilename}`)

			// Refresh file list and reload
			await this.fetchFiles()
			await this.loadRemoteFile("work", safeFilename)
		} catch (err: any) {
			console.error("Failed to save file:", err)
			await MainController.instance.openAlert("Save Error", err.message)
		}
	}

	private showContextMenu(e: MouseEvent, filename: string) {
		if (!this.workContextMenu) return

		this.contextMenuTargetFile = filename
		this.workContextMenu.style.display = "block"
		
		// Prevent context menu from overflowing the screen boundaries
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
		const filename = this.contextMenuTargetFile
		const baseName = filename.replace(/\.tex$/, "")

		const confirmDelete = await MainController.instance.openConfirm("Delete Work", `Are you sure you want to delete "${baseName}"?`)
		if (!confirmDelete) return

		try {
			const res = await fetch(`${this.getApiBase()}/api/delete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dir: "work", name: filename }),
			})

			const data = await res.json()
			if (!res.ok || data.error) {
				throw new Error(data.error || "Failed to delete file.")
			}

			// If the currently active file is deleted, load the default template
			if (this.currentDir === "work" && this.currentName === filename) {
				await this.loadRemoteFile("template", "rc-lowpass.tex")
			}

			await MainController.instance.openAlert("Delete Complete", `Successfully deleted ${baseName}`)

			// Refresh the file list
			await this.fetchFiles()
		} catch (err: any) {
			console.error("Failed to delete file:", err)
			await MainController.instance.openAlert("Delete Error", err.message)
		} finally {
			this.contextMenuTargetFile = null
		}
	}
}
