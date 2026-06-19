import type { TemplateDataSource, TemplateDirectory } from "./templateTypes"
import { WorkFileRepository } from "./workFileRepository"

export class IndexedDbTemplateDataSource implements TemplateDataSource {
	public constructor(
		private readonly dbPromise: Promise<IDBDatabase>,
		private readonly templateSource: Pick<TemplateDataSource, "listFiles" | "readFile">
	) {}

	private async getRepository(): Promise<WorkFileRepository> {
		return new WorkFileRepository(await this.dbPromise)
	}

	public async listFiles(): Promise<{ templates: string[]; works: string[] }> {
		const [templateFiles, repository] = await Promise.all([this.templateSource.listFiles(), this.getRepository()])
		const workFiles = await repository.listWorkFiles()
		return {
			templates: templateFiles.templates ?? [],
			works: workFiles.map((file) => file.name),
		}
	}

	public async readFile(dir: TemplateDirectory, name: string): Promise<string> {
		if (dir === "template") {
			return this.templateSource.readFile(dir, name)
		}
		const record = await (await this.getRepository()).getWorkFile(name)
		if (!record) {
			throw new Error(`Work file not found: ${name}`)
		}
		return record.content
	}

	public async saveWork(name: string, content: string): Promise<void> {
		await (await this.getRepository()).putWorkFile(name, content)
	}

	public async deleteWork(name: string): Promise<void> {
		await (await this.getRepository()).deleteWorkFile(name)
	}
}
