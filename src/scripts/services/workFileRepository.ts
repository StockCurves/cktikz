export type WorkFileRecord = {
	name: string
	content: string
	updatedAt: number
}

export class WorkFileRepository {
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

	public async listWorkFiles(): Promise<WorkFileRecord[]> {
		const transaction = this.db.transaction("workFiles", "readonly")
		const store = transaction.objectStore("workFiles")
		const result = (await this.requestToPromise<WorkFileRecord[]>(store.getAll())) || []
		return result.sort((a, b) => a.name.localeCompare(b.name))
	}

	public async getWorkFile(name: string): Promise<WorkFileRecord | undefined> {
		const transaction = this.db.transaction("workFiles", "readonly")
		const store = transaction.objectStore("workFiles")
		return this.requestToPromise<WorkFileRecord | undefined>(store.get(name))
	}

	public async putWorkFile(name: string, content: string): Promise<void> {
		const transaction = this.db.transaction("workFiles", "readwrite")
		transaction.objectStore("workFiles").put({
			name,
			content,
			updatedAt: Date.now(),
		} satisfies WorkFileRecord)
		await this.transactionComplete(transaction)
	}

	public async deleteWorkFile(name: string): Promise<void> {
		const transaction = this.db.transaction("workFiles", "readwrite")
		transaction.objectStore("workFiles").delete(name)
		await this.transactionComplete(transaction)
	}
}
