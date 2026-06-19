import { describe, expect, it } from "vitest"
import { TabSessionService, type PersistedTabState, type TabSessionRepository } from "../src/scripts/services/tabSessionService"

type TestData = {
	components: any[]
}

type TestSettings = {
	gridVisible?: boolean
}

function makeRepository(initialTabs: PersistedTabState<TestData, TestSettings>[]): TabSessionRepository<TestData, TestSettings> {
	const tabs = new Map(initialTabs.map((tab) => [tab.id, structuredClone(tab)]))

	return {
		async getAllTabs() {
			return [...tabs.values()].map((tab) => structuredClone(tab))
		},
		async getTab(id: number) {
			const tab = tabs.get(id)
			return tab ? structuredClone(tab) : undefined
		},
		async putTab(tab) {
			tabs.set(tab.id, structuredClone(tab))
		},
		async addTab(tab) {
			tabs.set(tab.id, structuredClone(tab))
		},
		async deleteTab(id: number) {
			tabs.delete(id)
		},
	}
}

describe("TabSessionService", () => {
	it("opens an existing requested tab and persists its open state", async () => {
		const repository = makeRepository([
			{ id: 3, open: "false", data: { components: [1] }, settings: { gridVisible: true }, designName: "Saved" },
		])
		const service = new TabSessionService(repository)

		const session = await service.initializeTab(3, { components: [] }, {})

		expect(session).toEqual({
			tabId: 3,
			openedExisting: true,
			pendingData: { components: [1] },
			settings: { gridVisible: true },
			designName: "Saved",
		})
		expect((await repository.getTab(3))?.open).toBe("true")
	})

	it("creates a new tab entry when the requested tab does not exist", async () => {
		const repository = makeRepository([])
		const service = new TabSessionService(repository)

		const session = await service.initializeTab(undefined, { components: [] }, {})

		expect(session).toEqual({
			tabId: 0,
			openedExisting: false,
			pendingData: { components: [] },
			settings: {},
		})
		expect(await repository.getTab(0)).toMatchObject({ id: 0, open: "true" })
	})

	it("marks other open tabs closed for probe and removes already-closed empty tabs", async () => {
		const repository = makeRepository([
			{ id: 0, open: "true", data: { components: [1] }, settings: {} },
			{ id: 1, open: "true", data: { components: [2] }, settings: {} },
			{ id: 2, open: "false", data: { components: [] }, settings: {} },
		])
		const service = new TabSessionService(repository)

		await service.markOtherTabsClosedForProbe(0, (data) => data.components.length > 0)

		expect((await repository.getTab(1))?.open).toBe("false")
		expect(await repository.getTab(2)).toBeUndefined()
	})

	it("persists snapshots and deletes empty tabs on close", async () => {
		const repository = makeRepository([{ id: 0, open: "true", data: { components: [1] }, settings: {} }])
		const service = new TabSessionService(repository)

		const updated = await service.persistSnapshot(
			0,
			{ data: { components: [1, 2] }, settings: { gridVisible: true }, designName: "Draft" },
			false,
			(data) => data.components.length > 0
		)
		expect(updated).toBe("updated")
		expect(await repository.getTab(0)).toMatchObject({
			data: { components: [1, 2] },
			settings: { gridVisible: true },
			designName: "Draft",
		})

		const deleted = await service.persistSnapshot(
			0,
			{ data: { components: [] }, settings: {}, designName: undefined },
			true,
			(data) => data.components.length > 0
		)
		expect(deleted).toBe("deleted")
		expect(await repository.getTab(0)).toBeUndefined()
	})

	it("builds management summary URLs without changing existing tab-open rules", async () => {
		const repository = makeRepository([
			{ id: 0, open: "true", data: { components: [1] }, settings: {}, designName: "Main" },
			{ id: 2, open: "false", data: { components: [1, 2] }, settings: {} },
		])
		const service = new TabSessionService(repository)

		const summary = await service.getTabManagementSummary(
			0,
			(data) => data.components.length * 10,
			(data) => data.components.length
		)

		expect(summary.totalSize).toBe(30)
		expect(summary.newTabUrl).toBe(".")
		expect(summary.entries).toEqual([
			{
				id: 0,
				displayName: "Main",
				componentCount: 1,
				size: 10,
				open: true,
				isCurrent: true,
				openUrl: ".",
			},
			{
				id: 2,
				displayName: "1",
				componentCount: 2,
				size: 20,
				open: false,
				isCurrent: false,
				openUrl: ".?tabID=2",
			},
		])
	})
})
