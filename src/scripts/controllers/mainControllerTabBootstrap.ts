import type { ComponentSaveObject } from "../components/circuitComponent"
import type { GroupSaveObject } from "../components/groupComponent"
import type { BroadcastMessage } from "../services/tabBroadcastService"

export type MainControllerTabBootstrapDependencies<TSettings> = {
	clearLegacyStorage: (localStorage: Storage, sessionStorage: Storage) => void
	openDatabase: () => Promise<IDBDatabase>
	bindPersistenceHandlers: (windowObject: Window, documentObject: Document, saveCurrentState: (closeTab?: boolean) => void) => void
	initializeCurrentTab: (
		url: string,
		defaultData: unknown,
		defaultSettings: TSettings,
		initializeTab: (requestedId: number | null, data: unknown, settings: TSettings) => Promise<any>,
		applySession: (session: { tabId: number; designName?: string; settings: TSettings; pendingData: any }) => void
	) => Promise<void>
	getTabManagementSummary: (
		currentTabId: number,
		measureSize: (data: unknown) => number,
		countComponents: (data: { components: ComponentSaveObject[] }) => number
	) => Promise<any>
	deleteTab: (tabId: number) => Promise<void>
	markOtherTabsClosedForProbe: (currentTabId: number) => Promise<void>
	handleIncomingMessage: (
		message: BroadcastMessage,
		currentTabId: number,
		markTabOpen: (tabId: number) => Promise<void>
	) => Promise<{
		flashCurrentTab?: boolean
		refreshTabManagement?: boolean
		clipboardPayload?: unknown
		outgoingMessage?: BroadcastMessage
	}>
	markTabOpen: (tabId: number) => Promise<void>
	renderTabManagementSummary: (summary: any, actions: {
		openTab: (url: string) => void
		deleteTab: (tabId: number) => void
		highlightTab: (tabId: number) => void
		openNewTab: (url: string) => void
	}) => void
	bindTabManagementShow: (loadSummary: () => void) => void
	bindProbeRefresh: (refresh: () => void) => void
	requestTabManagementRefresh: () => void
	refreshTabManagementIfOpen: () => void
	postBroadcastMessage: (message: BroadcastMessage) => void
	createBroadcastMessage: (type: string, from: number, payload?: any) => BroadcastMessage
	setClipboard: (payload: unknown) => void
	setBroadcastMessageHandler: (handler: (message: BroadcastMessage) => Promise<void>) => void
	initializeTab: (requestedId: number | null, data: unknown, settings: TSettings) => Promise<any>
	applySession: (session: { tabId: number; designName?: string; settings: TSettings; pendingData: any }) => void
	onDatabaseOpened: (db: IDBDatabase) => void
	onInitialized: () => void
	saveCurrentState: (closeTab?: boolean) => void
	openUrl: (url: string) => void
	currentTabId: () => number
	defaultData: unknown
	defaultSettings: TSettings
	measureSize: (data: unknown) => number
}

export function initializeMainControllerTabBootstrap<TSettings>(
	dependencies: MainControllerTabBootstrapDependencies<TSettings>
) {
	dependencies.clearLegacyStorage(localStorage, sessionStorage)

	dependencies.openDatabase().then((db) => {
		dependencies.onDatabaseOpened(db)

		dependencies.bindPersistenceHandlers(window, document, (closeTab = true) => dependencies.saveCurrentState(closeTab))
		dependencies.initializeCurrentTab(
			window.location.href,
			dependencies.defaultData,
			dependencies.defaultSettings,
			dependencies.initializeTab,
			dependencies.applySession
		).then(() => {
			dependencies.onInitialized()
		})
	})

	bindTabManagementHandlers(dependencies)
	bindBroadcastHandler(dependencies)
}

function bindTabManagementHandlers<TSettings>(dependencies: MainControllerTabBootstrapDependencies<TSettings>) {
	dependencies.bindTabManagementShow(() => {
		dependencies.saveCurrentState(false)
		dependencies.getTabManagementSummary(
			dependencies.currentTabId(),
			dependencies.measureSize,
			(data) => countComponents(data.components)
		).then((summary) => {
			dependencies.renderTabManagementSummary(summary, {
				openTab: (url) => dependencies.openUrl(url),
				deleteTab: (tabId) => {
					dependencies.deleteTab(tabId).then(() => {
						dependencies.requestTabManagementRefresh()
						dependencies.postBroadcastMessage(
							dependencies.createBroadcastMessage("update", dependencies.currentTabId())
						)
					})
				},
				highlightTab: (tabId) => {
					dependencies.postBroadcastMessage(
						dependencies.createBroadcastMessage("show", dependencies.currentTabId(), tabId)
					)
				},
				openNewTab: (url) => dependencies.openUrl(url),
			})
		})
	})

	dependencies.bindProbeRefresh(() => {
		dependencies.markOtherTabsClosedForProbe(dependencies.currentTabId()).then(() => {
			dependencies.requestTabManagementRefresh()
			setTimeout(() => {
				dependencies.postBroadcastMessage(
					dependencies.createBroadcastMessage("probe", dependencies.currentTabId())
				)
			}, 10)
		})
	})
}

function bindBroadcastHandler<TSettings>(dependencies: MainControllerTabBootstrapDependencies<TSettings>) {
	const favicon = document.getElementById("favicon") as HTMLLinkElement | null
	const faviconAlternate = document.getElementById("faviconAlternate") as HTMLLinkElement | null
	if (!favicon || !faviconAlternate) {
		return
	}

	const faviconLink = favicon.href
	const alternateLink = faviconAlternate.href
	faviconAlternate.href = " "
	faviconAlternate.disabled = true

	dependencies.setBroadcastMessageHandler((message: BroadcastMessage) => {
		return dependencies
			.handleIncomingMessage(message, dependencies.currentTabId(), (tabId) => dependencies.markTabOpen(tabId))
			.then((reaction) => {
				if (reaction.flashCurrentTab) {
					const oldTitle = document.title
					let darkMode = true
					const switchFavicon = () => {
						if (darkMode) {
							favicon.href = alternateLink
							document.title = "Click here!"
						} else {
							favicon.href = faviconLink
							document.title = oldTitle
						}
						darkMode = !darkMode
					}
					const interval = setInterval(switchFavicon, 1100)
					switchFavicon()
					document.addEventListener("visibilitychange", () => {
						if (!document.hidden) {
							clearInterval(interval)
							darkMode = false
							switchFavicon()
						}
					})
				}

				if (reaction.refreshTabManagement) {
					dependencies.refreshTabManagementIfOpen()
				}

				if (reaction.clipboardPayload) {
					dependencies.setClipboard(reaction.clipboardPayload)
				}

				if (reaction.outgoingMessage) {
					dependencies.postBroadcastMessage(reaction.outgoingMessage)
				}
			})
	})
}

function countComponents(data: ComponentSaveObject[]) {
	let count = 0
	for (const component of data) {
		if (component.type === "group") {
			count += countComponents((component as GroupSaveObject).components)
		}
		count++
	}
	return count
}
