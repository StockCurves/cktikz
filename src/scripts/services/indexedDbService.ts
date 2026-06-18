export const DATABASE_NAME = "circuitikz-designer-db-v2"
export const DATABASE_VERSION = 1

export class IndexedDbService {
	public constructor(private readonly indexedDb: IDBFactory = indexedDB) {}

	public openDatabase(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION)

			request.onerror = (event) => {
				console.error("IndexedDB error")
				console.error(event)
				reject(request.error)
			}
			request.onblocked = () => {
				console.warn("Database upgrade blocked. Closing database in other tabs might help.")
			}
			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result
				if (!db.objectStoreNames.contains("tabs")) {
					const objectStore = db.createObjectStore("tabs", { keyPath: "id" })
					objectStore.createIndex("open", "open", { unique: false })
				}
				if (!db.objectStoreNames.contains("customCategories")) {
					db.createObjectStore("customCategories", { keyPath: "name" })
				}
				if (!db.objectStoreNames.contains("customSymbols")) {
					db.createObjectStore("customSymbols", { keyPath: "id" })
				}
			}
			request.onsuccess = () => {
				const db = request.result
				db.onversionchange = () => {
					db.close()
					console.log("Database closed due to version change request.")
				}
				resolve(db)
			}
		})
	}
}
