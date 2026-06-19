import type { TemplateDataSource, TemplateDirectory } from "./templateTypes"
import type { StaticTemplateEntry } from "./staticTemplateManifest"
import { staticTemplateManifest } from "./staticTemplateManifest"

export class StaticTemplateDataSource implements TemplateDataSource {
	private readonly templateMap: Map<string, string>

	public constructor(private readonly manifest: StaticTemplateEntry[] = staticTemplateManifest) {
		this.templateMap = new Map(manifest.map((entry) => [entry.name, entry.url]))
	}

	public async listFiles(): Promise<{ templates: string[]; works: string[] }> {
		return {
			templates: this.manifest.map((entry) => entry.name),
			works: [],
		}
	}

	public async readFile(dir: TemplateDirectory, name: string): Promise<string> {
		if (dir !== "template") {
			throw new Error("Static template source does not provide editable work files.")
		}
		const url = this.templateMap.get(name)
		if (!url) {
			throw new Error(`Template not found: ${name}`)
		}
		const res = await fetch(url)
		if (!res.ok) {
			throw new Error(await res.text())
		}
		return res.text()
	}

	public async saveWork(): Promise<void> {
		throw new Error("Static template source cannot save work files.")
	}

	public async deleteWork(): Promise<void> {
		throw new Error("Static template source cannot delete work files.")
	}
}
