export type PersistedTabState<TData, TSettings> = {
	id: number
	open: string
	data: TData
	settings: TSettings
	designName?: string
}

export type TabSessionRepository<TData, TSettings> = {
	getAllTabs(): Promise<PersistedTabState<TData, TSettings>[]>
	getTab(id: number): Promise<PersistedTabState<TData, TSettings> | undefined>
	putTab(tab: PersistedTabState<TData, TSettings>): Promise<void>
	addTab(tab: PersistedTabState<TData, TSettings>): Promise<void>
	deleteTab(id: number): Promise<void>
}

export type TabInitializationResult<TData, TSettings> = {
	tabId: number
	openedExisting: boolean
	pendingData: TData
	settings: TSettings
	designName?: string
}

export type TabSnapshot<TData, TSettings> = {
	data: TData
	settings: TSettings
	designName?: string
}

export type TabManagementEntry = {
	id: number
	displayName: string
	componentCount: number
	size: number
	open: boolean
	isCurrent: boolean
	openUrl: string
}

export type TabManagementSummary = {
	entries: TabManagementEntry[]
	totalSize: number
	newTabUrl: string
}

export class TabSessionService<TData, TSettings> {
	public constructor(private readonly repository: TabSessionRepository<TData, TSettings>) {}

	public async initializeTab(requestedId: number | undefined, defaultData: TData, defaultSettings: TSettings) {
		const allTabs = await this.repository.getAllTabs()
		let resolvedId = requestedId

		if (resolvedId == undefined || Number.isNaN(resolvedId)) {
			// Preserve current controller behavior: use the first closed tab's array index.
			resolvedId = allTabs.findIndex((tab) => tab.open == "false")

			if (resolvedId < 0) {
				resolvedId = 0
				while (allTabs.find((tab) => tab.id == resolvedId)) {
					resolvedId++
				}
			}
		}

		const requestedTab = allTabs.find((tab) => tab.id == resolvedId)
		if (requestedTab) {
			requestedTab.open = "true"
			await this.repository.putTab(requestedTab)
			return {
				tabId: requestedTab.id,
				openedExisting: true,
				pendingData: requestedTab.data,
				settings: requestedTab.settings,
				designName: requestedTab.designName,
			} satisfies TabInitializationResult<TData, TSettings>
		}

		const newEntry: PersistedTabState<TData, TSettings> = {
			id: resolvedId,
			open: "true",
			data: defaultData,
			settings: defaultSettings,
		}
		await this.repository.addTab(newEntry)
		return {
			tabId: resolvedId,
			openedExisting: false,
			pendingData: defaultData,
			settings: defaultSettings,
		} satisfies TabInitializationResult<TData, TSettings>
	}

	public async updateDesignName(tabId: number, designName?: string): Promise<boolean> {
		const tab = await this.repository.getTab(tabId)
		if (!tab) return false
		tab.designName = designName
		await this.repository.putTab(tab)
		return true
	}

	public async listTabs() {
		return this.repository.getAllTabs()
	}

	public async getTabManagementSummary(
		currentTabId: number,
		measureSize: (data: TData) => number,
		countComponents: (data: TData) => number
	): Promise<TabManagementSummary> {
		const tabs = await this.repository.getAllTabs()
		let totalSize = 0
		const entries = tabs.map((tab, index) => {
			const size = measureSize(tab.data)
			totalSize += size
			return {
				id: tab.id,
				displayName: tab.designName || `${index}`,
				componentCount: countComponents(tab.data),
				size,
				open: tab.open == "true",
				isCurrent: tab.id == currentTabId,
				openUrl: this.buildLaunchUrl(tabs, tab.id),
			} satisfies TabManagementEntry
		})

		return {
			entries,
			totalSize,
			newTabUrl: this.buildNextTabUrl(tabs),
		}
	}

	public async deleteTab(tabId: number): Promise<void> {
		await this.repository.deleteTab(tabId)
	}

	public async markOtherTabsClosedForProbe(currentTabId: number, hasPersistedComponents: (data: TData) => boolean): Promise<void> {
		const allTabs = await this.repository.getAllTabs()
		const requests: Promise<void>[] = []
		for (const tab of allTabs) {
			if (tab.id == currentTabId) continue
			if (tab.open == "true") {
				tab.open = "false"
				requests.push(this.repository.putTab(tab))
			} else if (!hasPersistedComponents(tab.data)) {
				requests.push(this.repository.deleteTab(tab.id))
			}
		}
		await Promise.all(requests)
	}

	public async markTabOpen(tabId: number): Promise<boolean> {
		const tab = await this.repository.getTab(tabId)
		if (!tab) return false
		tab.open = "true"
		await this.repository.putTab(tab)
		return true
	}

	public async persistSnapshot(
		tabId: number,
		snapshot: TabSnapshot<TData, TSettings>,
		closeTab: boolean,
		hasPersistedComponents: (data: TData) => boolean
	): Promise<"updated" | "deleted" | "missing"> {
		const tab = await this.repository.getTab(tabId)
		if (!tab) return "missing"
		if (closeTab) {
			tab.open = "false"
		}
		tab.data = snapshot.data
		if (hasPersistedComponents(snapshot.data)) {
			tab.settings = snapshot.settings
			tab.designName = snapshot.designName
			await this.repository.putTab(tab)
			return "updated"
		}
		if (closeTab) {
			await this.repository.deleteTab(tabId)
			return "deleted"
		}
		return "missing"
	}

	private buildNextTabUrl(tabs: PersistedTabState<TData, TSettings>[]): string {
		let requestedId = 0
		let allOpen = true
		while (true) {
			const tab = tabs.find((entry) => entry.id == requestedId)
			if (tab) {
				requestedId++
				allOpen = allOpen && tab.open == "true"
			} else {
				break
			}
		}
		return allOpen ? "." : `.?tabID=${requestedId}`
	}

	private buildLaunchUrl(tabs: PersistedTabState<TData, TSettings>[], requestedId: number): string {
		let allOpen = true
		for (let index = 0; index < requestedId; index++) {
			const current = tabs.find((tab) => tab.id == index)
			if (current) {
				allOpen = allOpen && current.open == "true"
			} else {
				allOpen = false
			}
		}
		return allOpen ? "." : `.?tabID=${requestedId}`
	}
}
