import {
	TemplateDataSource,
	TemplateDirectory,
	TemplateEditorPort,
	TemplateListViewModel,
	TemplateNotifierPort,
	TemplateSessionState,
} from "./templateTypes"

const DEFAULT_TEMPLATE_DIR: TemplateDirectory = "template"
const DEFAULT_TEMPLATE_NAME = "rc-lowpass.tex"

export class TemplateApplicationService {
	private state: TemplateSessionState = {
		currentDir: DEFAULT_TEMPLATE_DIR,
		currentName: DEFAULT_TEMPLATE_NAME,
		templates: [],
		works: [],
	}

	public constructor(
		private readonly dataSource: TemplateDataSource,
		private readonly editor: TemplateEditorPort,
		private readonly notifier: TemplateNotifierPort
	) {}

	public getState(): TemplateSessionState {
		return {
			currentDir: this.state.currentDir,
			currentName: this.state.currentName,
			templates: [...this.state.templates],
			works: [...this.state.works],
		}
	}

	public async listEntries(): Promise<TemplateListViewModel> {
		const files = await this.dataSource.listFiles()
		this.state = {
			...this.state,
			templates: files.templates ?? [],
			works: files.works ?? [],
		}
		return this.buildListViewModel()
	}

	public async openFile(dir: TemplateDirectory, name: string): Promise<TemplateListViewModel> {
		try {
			const code = await this.dataSource.readFile(dir, name)
			this.editor.setCode(code)
			this.editor.applyEditorText()
			this.state = {
				...this.state,
				currentDir: dir,
				currentName: name,
			}
			return this.buildListViewModel()
		} catch (err: any) {
			await this.notifier.alert("Error loading file", err.message)
			throw err
		}
	}

	public async saveWork(name: string): Promise<TemplateListViewModel> {
		const filename = name.trim()
		if (!filename) {
			await this.notifier.alert("Save File", "Please enter a filename.")
			return this.buildListViewModel()
		}
		if (/[\\/:*?"<>|]/.test(filename)) {
			await this.notifier.alert("Save File", "Invalid filename characters.")
			return this.buildListViewModel()
		}

		const safeFilename = filename.endsWith(".tex") ? filename : `${filename}.tex`
		const content = this.editor.getCode()

		try {
			await this.dataSource.saveWork(safeFilename, content)
			this.state = {
				...this.state,
				currentDir: "work",
				currentName: safeFilename,
			}
			await this.listEntries()
			await this.notifier.alert("Save Complete", `Successfully saved to work/${safeFilename}`)
			return await this.openFile("work", safeFilename)
		} catch (err: any) {
			await this.notifier.alert("Save Error", err.message)
			throw err
		}
	}

	public async deleteWork(name: string): Promise<TemplateListViewModel> {
		const baseName = name.replace(/\.tex$/, "")
		const confirmDelete = await this.notifier.confirm("Delete Work", `Are you sure you want to delete "${baseName}"?`)
		if (!confirmDelete) {
			return this.buildListViewModel()
		}

		try {
			await this.dataSource.deleteWork(name)
			const deletedCurrent = this.state.currentDir === "work" && this.state.currentName === name
			await this.listEntries()
			if (deletedCurrent) {
				await this.openFile(DEFAULT_TEMPLATE_DIR, DEFAULT_TEMPLATE_NAME)
			}
			await this.notifier.alert("Delete Complete", `Successfully deleted ${baseName}`)
			return this.buildListViewModel()
		} catch (err: any) {
			await this.notifier.alert("Delete Error", err.message)
			throw err
		}
	}

	public async bootstrapDefaultFile(shouldLoadDefault = !window.location.search.includes("base=")): Promise<TemplateListViewModel> {
		await this.listEntries()
		if (shouldLoadDefault) {
			await this.openFile(DEFAULT_TEMPLATE_DIR, DEFAULT_TEMPLATE_NAME)
		}
		return this.buildListViewModel()
	}

	private buildListViewModel(): TemplateListViewModel {
		return {
			templates: [...this.state.templates],
			works: [...this.state.works],
			selectedDisplayName: this.state.currentName.replace(/\.tex$/, ""),
			hasWorks: this.state.works.length > 0,
		}
	}
}
