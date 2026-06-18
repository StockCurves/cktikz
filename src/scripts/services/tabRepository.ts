export class TabRepository<TabState> {
	public constructor(private readonly db: IDBDatabase) {}

	private requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			request.onsuccess = (event) => resolve(((event.target as IDBRequest<T>)?.result ?? request.result) as T)
			request.onerror = () => reject(request.error)
		})
	}

	public getAllTabs(): Promise<TabState[]> {
		return this.requestToPromise<TabState[]>(this.db.transaction("tabs").objectStore("tabs").getAll())
	}

	public getTab(id: number): Promise<TabState | undefined> {
		return this.requestToPromise<TabState | undefined>(this.db.transaction("tabs").objectStore("tabs").get(id))
	}

	public putTab(tab: TabState): Promise<void> {
		const request = this.db.transaction("tabs", "readwrite").objectStore("tabs").put(tab)
		return this.requestToPromise(request).then(() => undefined)
	}

	public addTab(tab: TabState): Promise<void> {
		const request = this.db.transaction("tabs", "readwrite").objectStore("tabs").add(tab)
		return this.requestToPromise(request).then(() => undefined)
	}

	public deleteTab(id: number): Promise<void> {
		const request = this.db.transaction("tabs", "readwrite").objectStore("tabs").delete(id)
		return this.requestToPromise(request).then(() => undefined)
	}
}
