import { CircuitComponent } from "../components/circuitComponent"
import { ComponentSymbol } from "../components/componentSymbol"
import { CustomSymbolDomService } from "./customSymbolDomService"
import { CustomCategory, CustomSymbolRepository } from "./customSymbolRepository"

export type CustomSymbolRecord = {
	id: string
	tikzName: string
	displayName: string
	isCustomSymbol?: boolean
	isNodeSymbol?: boolean
	type?: string
	subcircuitData?: any
	svgPreview?: string | null
	componentXml?: string
	symbols?: Record<string, string>
	baseSymbol?: string
}

export type RuntimeSymbolUpdateResult = {
	componentSymbol: ComponentSymbol
	updatedRecord: CustomSymbolRecord
}

export class CustomSymbolService {
	public constructor(
		private readonly getDb: () => IDBDatabase,
		private readonly domService = new CustomSymbolDomService(),
		private readonly generateSubcircuitPreview: (subcircuitData: any) => Promise<string | null> = async () => null
	) {}

	private get repository(): CustomSymbolRepository {
		return new CustomSymbolRepository(this.getDb())
	}

	public getCustomCategories(): Promise<CustomCategory[]> {
		return this.repository.getCustomCategories()
	}

	public async getCustomSymbols(): Promise<CustomSymbolRecord[]> {
		return (await this.repository.getCustomSymbols()) as CustomSymbolRecord[]
	}

	public renameSymbolIdInCategories(oldId: string, newId: string): Promise<void> {
		return this.repository.renameSymbolInCategories(oldId, newId)
	}

	public async loadCustomSymbolsIntoDomAndRuntime(
		symbolDB: Element,
		runtimeSymbols: ComponentSymbol[]
	): Promise<CustomSymbolRecord[]> {
		const records = (await this.repository.getCustomSymbols()) as CustomSymbolRecord[]
		runtimeSymbols.push(...this.domService.loadCustomSymbolsIntoDom(records, symbolDB, runtimeSymbols))
		return records
	}

	public async duplicateSymbol(
		symbolDB: Element,
		runtimeSymbols: ComponentSymbol[],
		originalSymbol: ComponentSymbol,
		newTikzName: string,
		categoryName: string
	): Promise<RuntimeSymbolUpdateResult | null> {
		const duplicated = this.domService.duplicateSymbolDom(symbolDB, originalSymbol, newTikzName)
		if (!duplicated) return null

		const updatedRecord = duplicated.customSymbolData as CustomSymbolRecord
		this.replaceRuntimeSymbol(runtimeSymbols, duplicated.componentSymbol)
		await this.addSymbolToCategory(categoryName, newTikzName, updatedRecord)

		return {
			componentSymbol: duplicated.componentSymbol,
			updatedRecord,
		}
	}

	public async renameCustomGraphicsSymbol(
		oldTikzName: string,
		newTikzName: string,
		symbolDB: Element,
		runtimeSymbols: ComponentSymbol[],
		customSymbols: CustomSymbolRecord[],
		circuitComponents: CircuitComponent[]
	): Promise<RuntimeSymbolUpdateResult | null> {
		const oldId = "custom-" + oldTikzName
		const symbolRecord = (await this.repository.getCustomSymbol(oldId)) as CustomSymbolRecord | undefined
		if (!symbolRecord) return null

		const renameResult = this.domService.renameCustomGraphicsSymbolDom(oldTikzName, newTikzName, symbolRecord, symbolDB)
		await this.repository.renameCustomSymbolRecord(oldId, renameResult.updatedRecord)
		await this.repository.renameSymbolInCategories(oldTikzName, newTikzName)

		const componentSymbol = new ComponentSymbol(renameResult.componentNode!)
		componentSymbol.isCustomSymbol = true
		this.replaceRuntimeSymbol(runtimeSymbols, componentSymbol, oldTikzName)
		this.replaceCustomSymbolRecord(customSymbols, renameResult.updatedRecord, oldId, oldTikzName)

		for (const comp of circuitComponents) {
			if ((comp as any).referenceSymbol && (comp as any).referenceSymbol.tikzName === oldTikzName) {
				;(comp as any).referenceSymbol = componentSymbol
				if ((comp as any).displayName === oldTikzName) {
					(comp as any).displayName = newTikzName
				}
				comp.update()
			}
		}

		return {
			componentSymbol,
			updatedRecord: renameResult.updatedRecord as CustomSymbolRecord,
		}
	}

	public async deleteCustomGraphicsSymbol(
		tikzName: string,
		runtimeSymbols: ComponentSymbol[],
		customSymbols: CustomSymbolRecord[]
	): Promise<void> {
		const symbolId = "custom-" + tikzName
		await this.repository.removeSymbolFromCategories(tikzName)
		await this.repository.deleteCustomSymbol(symbolId)

		this.removeRuntimeSymbol(runtimeSymbols, tikzName)
		this.removeCustomSymbolRecord(customSymbols, symbolId, tikzName)
	}

	public async addCategory(name: string): Promise<void> {
		await this.repository.putCustomCategory({ name, symbolIds: [] })
	}

	public async deleteCategory(name: string): Promise<void> {
		await this.repository.deleteCustomCategory(name)
	}

	public async renameCategory(oldName: string, newName: string): Promise<void> {
		await this.repository.renameCustomCategory(oldName, newName)
	}

	public async renameCustomSymbol(
		symbolId: string,
		newName: string,
		customSymbols: CustomSymbolRecord[],
		circuitComponents: CircuitComponent[]
	): Promise<CustomSymbolRecord | null> {
		const sym = (await this.repository.getCustomSymbol(symbolId)) as CustomSymbolRecord | undefined
		if (!sym) return null

		const oldName = sym.displayName
		const newId = "subcircuit-" + newName
		const updated = {
			...sym,
			displayName: newName,
			tikzName: newName,
			id: newId,
			subcircuitData: sym.subcircuitData ? { ...sym.subcircuitData, displayName: newName } : sym.subcircuitData,
		}

		await this.repository.renameCustomSymbolRecord(symbolId, updated)
		await this.repository.renameSymbolInCategories(symbolId, newId)
		this.replaceCustomSymbolRecord(customSymbols, updated, symbolId, oldName)

		for (const comp of circuitComponents) {
			if ((comp as any).displayName === oldName) {
				(comp as any).displayName = newName
			}
		}

		return updated
	}

	public async deleteCustomSymbol(symbolId: string, customSymbols?: CustomSymbolRecord[]): Promise<void> {
		await this.repository.removeSymbolFromCategories(symbolId)
		await this.repository.deleteCustomSymbol(symbolId)
		if (customSymbols) {
			this.removeCustomSymbolRecord(customSymbols, symbolId)
		}
	}

	public async addSymbolToCategory(
		categoryName: string,
		symbolId: string,
		customSymbolData?: CustomSymbolRecord
	): Promise<CustomSymbolRecord | undefined> {
		if (customSymbolData && customSymbolData.subcircuitData && !customSymbolData.svgPreview) {
			try {
				const preview = await this.generateSubcircuitPreview(customSymbolData.subcircuitData)
				if (preview) {
					customSymbolData.svgPreview = preview
				}
			} catch (e) {
				console.error("Failed to generate preview during addSymbolToCategory:", e)
			}
		}

		await this.repository.addSymbolToCategory(categoryName, symbolId, customSymbolData)
		return customSymbolData
	}

	public async removeSymbolFromCategory(categoryName: string, symbolId: string): Promise<void> {
		await this.repository.removeSymbolFromCategory(categoryName, symbolId)
	}

	public async putCustomSymbol(customSymbol: CustomSymbolRecord): Promise<void> {
		await this.repository.putCustomSymbol(customSymbol)
	}

	public buildSubcircuitRecord(
		proposedName: string,
		subcircuitData: any,
		existingSymbols: CustomSymbolRecord[]
	): CustomSymbolRecord {
		const baseName = proposedName.trim()
		let finalName = baseName
		let suffix = 2
		while (existingSymbols.some((symbol) => symbol.displayName === finalName)) {
			finalName = `${baseName} (${suffix})`
			suffix++
		}

		const normalizedData = {
			...subcircuitData,
			displayName: finalName,
		}

		return {
			id: "subcircuit-" + finalName,
			type: "subcircuit",
			tikzName: finalName,
			displayName: finalName,
			isNodeSymbol: false,
			subcircuitData: normalizedData,
		}
	}

	public replaceCustomSymbolRecord(
		customSymbols: CustomSymbolRecord[],
		record: CustomSymbolRecord,
		oldId?: string,
		oldTikzName?: string
	): void {
		const idx = customSymbols.findIndex((symbol) => {
			if (oldId && symbol.id === oldId) return true
			if (oldTikzName && symbol.tikzName === oldTikzName) return true
			return symbol.id === record.id || symbol.tikzName === record.tikzName
		})
		if (idx >= 0) {
			customSymbols.splice(idx, 1, record)
		} else {
			customSymbols.push(record)
		}
	}

	private replaceRuntimeSymbol(
		runtimeSymbols: ComponentSymbol[],
		nextSymbol: ComponentSymbol,
		oldTikzName = nextSymbol.tikzName
	): void {
		const idx = runtimeSymbols.findIndex((symbol) => symbol.tikzName === oldTikzName || symbol.tikzName === nextSymbol.tikzName)
		if (idx >= 0) {
			runtimeSymbols.splice(idx, 1, nextSymbol)
		} else {
			runtimeSymbols.push(nextSymbol)
		}
	}

	private removeRuntimeSymbol(runtimeSymbols: ComponentSymbol[], tikzName: string): void {
		const idx = runtimeSymbols.findIndex((symbol) => symbol.tikzName === tikzName)
		if (idx >= 0) {
			runtimeSymbols.splice(idx, 1)
		}
	}

	private removeCustomSymbolRecord(customSymbols: CustomSymbolRecord[], id: string, tikzName?: string): void {
		const idx = customSymbols.findIndex((symbol) => symbol.id === id || (tikzName ? symbol.tikzName === tikzName : false))
		if (idx >= 0) {
			customSymbols.splice(idx, 1)
		}
	}
}
