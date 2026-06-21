import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { initializeMainControllerTabBootstrap } from "../src/scripts/controllers/mainControllerTabBootstrap"

describe("mainControllerTabBootstrap", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<link id="favicon" href="main.ico" />
			<link id="faviconAlternate" href="alt.ico" />
		`
		document.title = "Original"
	})

	afterEach(() => {
		document.body.innerHTML = ""
	})

	it("opens database, initializes tab session, and handles broadcast reactions", async () => {
		const db = {} as IDBDatabase
		const applySession = vi.fn()
		const onDatabaseOpened = vi.fn()
		const onInitialized = vi.fn()
		const setClipboard = vi.fn()
		const postBroadcastMessage = vi.fn()
		let showHandler: (() => void) | null = null
		let probeHandler: (() => void) | null = null
		let broadcastHandler: ((message: any) => Promise<void>) | null = null

		const deps: any = {
			clearLegacyStorage: vi.fn(),
			openDatabase: vi.fn().mockResolvedValue(db),
			bindPersistenceHandlers: vi.fn(),
			initializeCurrentTab: vi.fn().mockImplementation(async (_url: string, _data: unknown, _settings: unknown, _init: any, apply: any) => {
				apply({ tabId: 3, designName: "Draft", settings: {}, pendingData: null })
			}),
			getTabManagementSummary: vi.fn(),
			deleteTab: vi.fn(),
			markOtherTabsClosedForProbe: vi.fn(),
			handleIncomingMessage: vi.fn().mockResolvedValue({
				refreshTabManagement: true,
				clipboardPayload: { hello: "world" },
				outgoingMessage: { type: "probe-response", from: 8 },
			}),
			markTabOpen: vi.fn(),
			renderTabManagementSummary: vi.fn(),
			bindTabManagementShow: vi.fn((handler: () => void) => { showHandler = handler }),
			bindProbeRefresh: vi.fn((handler: () => void) => { probeHandler = handler }),
			requestTabManagementRefresh: vi.fn(),
			refreshTabManagementIfOpen: vi.fn(),
			postBroadcastMessage,
			createBroadcastMessage: vi.fn((type: string, from: number, payload?: any) => ({ type, from, payload })),
			setClipboard,
			setBroadcastMessageHandler: vi.fn((handler: (message: any) => Promise<void>) => { broadcastHandler = handler }),
			initializeTab: vi.fn(),
			applySession,
			onDatabaseOpened,
			onInitialized,
			saveCurrentState: vi.fn(),
			openUrl: vi.fn(),
			currentTabId: vi.fn(() => 3),
			defaultData: {},
			defaultSettings: {},
			measureSize: vi.fn(() => 123),
		}

		initializeMainControllerTabBootstrap(deps)
		await Promise.resolve()
		await Promise.resolve()

		expect(deps.clearLegacyStorage).toHaveBeenCalled()
		expect(onDatabaseOpened).toHaveBeenCalledWith(db)
		expect(deps.bindPersistenceHandlers).toHaveBeenCalled()
		expect(applySession).toHaveBeenCalledWith({ tabId: 3, designName: "Draft", settings: {}, pendingData: null })
		expect(onInitialized).toHaveBeenCalled()
		expect(typeof showHandler).toBe("function")
		expect(typeof probeHandler).toBe("function")
		expect(typeof broadcastHandler).toBe("function")

		await broadcastHandler?.({ type: "probe", from: 9 })
		expect(deps.refreshTabManagementIfOpen).toHaveBeenCalled()
		expect(setClipboard).toHaveBeenCalledWith({ hello: "world" })
		expect(postBroadcastMessage).toHaveBeenCalledWith({ type: "probe-response", from: 8 })
	})
})
