import { describe, expect, it, vi } from "vitest"
import { IndexedDbTemplateDataSource } from "../src/scripts/services/indexedDbTemplateDataSource"

function makeFakeDb(workFiles = new Map<string, any>()) {
	return {
		transaction(storeName: string) {
			if (storeName !== "workFiles") throw new Error(`Unexpected store: ${storeName}`)
			const tx: any = {
				oncomplete: null,
				onerror: null,
				onabort: null,
				error: null,
				objectStore() {
					return {
						get(key: string) {
							const request: any = { result: workFiles.get(key), onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: workFiles.get(key) } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						getAll() {
							const request: any = { result: [...workFiles.values()], onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: [...workFiles.values()] } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						put(value: any) {
							workFiles.set(value.name, value)
							const request: any = { result: value, onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: value } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
						delete(key: string) {
							workFiles.delete(key)
							const request: any = { result: undefined, onsuccess: null, onerror: null, error: null }
							setTimeout(() => {
								request.onsuccess?.({ target: { result: undefined } })
								tx.oncomplete?.()
							}, 0)
							return request
						},
					}
				},
			}
			return tx
		},
	} as unknown as IDBDatabase
}

describe("IndexedDbTemplateDataSource", () => {
	it("delegates templates to the readonly source and works to IndexedDB", async () => {
		const templateSource = {
			listFiles: vi.fn().mockResolvedValue({ templates: ["rc-lowpass.tex"], works: ["ignored.tex"] }),
			readFile: vi.fn().mockResolvedValue("\\draw (0,0) -- (1,0);"),
		}
		const workFiles = new Map<string, any>([["draft.tex", { name: "draft.tex", content: "draft", updatedAt: 1 }]])
		const dataSource = new IndexedDbTemplateDataSource(Promise.resolve(makeFakeDb(workFiles)), templateSource)

		expect(await dataSource.listFiles()).toEqual({
			templates: ["rc-lowpass.tex"],
			works: ["draft.tex"],
		})

		expect(await dataSource.readFile("template", "rc-lowpass.tex")).toBe("\\draw (0,0) -- (1,0);")
		expect(templateSource.readFile).toHaveBeenCalledWith("template", "rc-lowpass.tex")
		expect(await dataSource.readFile("work", "draft.tex")).toBe("draft")

		await dataSource.saveWork("new.tex", "content")
		expect(await dataSource.readFile("work", "new.tex")).toBe("content")

		await dataSource.deleteWork("draft.tex")
		expect((await dataSource.listFiles()).works).toEqual(["new.tex"])
	})
})
