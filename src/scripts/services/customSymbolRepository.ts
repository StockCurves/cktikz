export type CustomCategory = {
	name: string
	symbolIds: string[]
}

export class CustomSymbolRepository {
	public constructor(private readonly db: IDBDatabase) {}

	private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			request.onsuccess = (event) => resolve(((event.target as IDBRequest<T>)?.result ?? request.result) as T)
			request.onerror = () => reject(request.error)
		})
	}

	private transactionComplete(transaction: IDBTransaction): Promise<void> {
		return new Promise((resolve, reject) => {
			transaction.oncomplete = () => resolve()
			transaction.onerror = () => reject(transaction.error)
			transaction.onabort = () => reject(transaction.error)
		})
	}

	public async getCustomSymbols(): Promise<any[]> {
		const transaction = this.db.transaction("customSymbols", "readonly")
		const store = transaction.objectStore("customSymbols")
		return (await this.requestToPromise<any[]>(store.getAll())) || []
	}

	public async getCustomCategories(): Promise<CustomCategory[]> {
		const transaction = this.db.transaction("customCategories", "readonly")
		const store = transaction.objectStore("customCategories")
		return (await this.requestToPromise<CustomCategory[]>(store.getAll())) || []
	}

	public async putCustomSymbol(symbol: any): Promise<void> {
		const transaction = this.db.transaction("customSymbols", "readwrite")
		transaction.objectStore("customSymbols").put(symbol)
		await this.transactionComplete(transaction)
	}

	public async deleteCustomSymbol(id: string): Promise<void> {
		const transaction = this.db.transaction("customSymbols", "readwrite")
		transaction.objectStore("customSymbols").delete(id)
		await this.transactionComplete(transaction)
	}

	public async putCustomCategory(category: CustomCategory): Promise<void> {
		const transaction = this.db.transaction("customCategories", "readwrite")
		transaction.objectStore("customCategories").put(category)
		await this.transactionComplete(transaction)
	}

	public async deleteCustomCategory(name: string): Promise<void> {
		const transaction = this.db.transaction("customCategories", "readwrite")
		transaction.objectStore("customCategories").delete(name)
		await this.transactionComplete(transaction)
	}

	public async getCustomSymbol(id: string): Promise<any | undefined> {
		const transaction = this.db.transaction("customSymbols", "readonly")
		const store = transaction.objectStore("customSymbols")
		return this.requestToPromise<any | undefined>(store.get(id))
	}

	public async renameCustomSymbolRecord(oldId: string, symbol: any): Promise<void> {
		const transaction = this.db.transaction("customSymbols", "readwrite")
		const store = transaction.objectStore("customSymbols")
		store.delete(oldId)
		store.put(symbol)
		await this.transactionComplete(transaction)
	}

	public async renameCustomCategory(oldName: string, newName: string): Promise<void> {
		const categories = await this.getCustomCategories()
		const category = categories.find((cat) => cat.name === oldName)
		if (!category) return
		await this.deleteCustomCategory(oldName)
		await this.putCustomCategory({ ...category, name: newName })
	}

	public async renameSymbolInCategories(oldName: string, newName: string): Promise<void> {
		const categories = await this.getCustomCategories()
		const transaction = this.db.transaction("customCategories", "readwrite")
		const store = transaction.objectStore("customCategories")
		for (const category of categories) {
			const idx = category.symbolIds.indexOf(oldName)
			if (idx >= 0) {
				const updated = { ...category, symbolIds: [...category.symbolIds] }
				updated.symbolIds[idx] = newName
				store.put(updated)
			}
		}
		await this.transactionComplete(transaction)
	}

	public async removeSymbolFromCategories(symbolId: string): Promise<void> {
		const categories = await this.getCustomCategories()
		const transaction = this.db.transaction("customCategories", "readwrite")
		const store = transaction.objectStore("customCategories")
		for (const category of categories) {
			if (category.symbolIds.includes(symbolId)) {
				store.put({
					...category,
					symbolIds: category.symbolIds.filter((id: string) => id !== symbolId),
				})
			}
		}
		await this.transactionComplete(transaction)
	}

	public async addSymbolToCategory(categoryName: string, symbolId: string, customSymbolData?: any): Promise<void> {
		const transaction = this.db.transaction(["customCategories", "customSymbols"], "readwrite")
		const catStore = transaction.objectStore("customCategories")
		const symStore = transaction.objectStore("customSymbols")

		if (customSymbolData) {
			symStore.put(customSymbolData)
		}

		const category = await this.requestToPromise<CustomCategory | undefined>(catStore.get(categoryName))
		if (category && !category.symbolIds.includes(symbolId)) {
			catStore.put({ ...category, symbolIds: [...category.symbolIds, symbolId] })
		}

		await this.transactionComplete(transaction)
	}

	public async removeSymbolFromCategory(categoryName: string, symbolId: string): Promise<void> {
		const categories = await this.getCustomCategories()
		const category = categories.find((cat) => cat.name === categoryName)
		if (!category) return
		await this.putCustomCategory({
			...category,
			symbolIds: category.symbolIds.filter((id: string) => id !== symbolId),
		})
	}
}
