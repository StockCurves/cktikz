import { TemplateDataSource, TemplateDirectory } from "./templateTypes"

export interface TemplateFileList {
	templates?: string[]
	works?: string[]
}

export class TemplateFileService implements TemplateDataSource {
	public constructor(private readonly apiBase: string) {}

	public async listFiles(): Promise<{ templates: string[]; works: string[] }> {
		const res = await fetch(`${this.apiBase}/api/files`)
		const data = (await res.json()) as TemplateFileList
		return {
			templates: data.templates ?? [],
			works: data.works ?? [],
		}
	}

	public async readFile(dir: TemplateDirectory, name: string): Promise<string> {
		const res = await fetch(`${this.apiBase}/api/file?dir=${dir}&name=${encodeURIComponent(name)}`)
		if (!res.ok) {
			throw new Error(await res.text())
		}
		return res.text()
	}

	public async saveWorkFile(name: string, content: string): Promise<void> {
		const res = await fetch(`${this.apiBase}/api/save`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dir: "work", name, content }),
		})

		const data = await res.json()
		if (!res.ok || data.error) {
			throw new Error(data.error || "Failed to save file.")
		}
	}

	public async deleteWorkFile(name: string): Promise<void> {
		const res = await fetch(`${this.apiBase}/api/delete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dir: "work", name }),
		})

		const data = await res.json()
		if (!res.ok || data.error) {
			throw new Error(data.error || "Failed to delete file.")
		}
	}

	public fetchFiles(): Promise<{ templates: string[]; works: string[] }> {
		return this.listFiles()
	}

	public loadFile(dir: TemplateDirectory, name: string): Promise<string> {
		return this.readFile(dir, name)
	}

	public saveWork(name: string, content: string): Promise<void> {
		return this.saveWorkFile(name, content)
	}

	public deleteWork(name: string): Promise<void> {
		return this.deleteWorkFile(name)
	}
}
