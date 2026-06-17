import * as SVG from "@svgdotjs/svg.js"
import { Button as _bootstrapButton, Collapse as _bootstrapCollapse, Offcanvas, Tooltip, Modal } from "bootstrap"
import "../utils/impSVGNumber"
import { waitForElementLoaded } from "../utils/domWatcher"
import hotkeys from "hotkeys-js"
import { version } from "../../../package.json"

import {
	CanvasController,
	ExportController,
	SelectionController,
	SaveController,
	Undo,
	CopyPaste,
	PropertyController,
	CircuitComponent,
	ComponentPlacer,
	NodeSymbolComponent,
	PathSymbolComponent,
	WireComponent,
	ComponentSymbol,
	ComponentSaveObject,
	EraseController,
	RectangleComponent,
	EllipseComponent,
	defaultStroke,
	defaultFill,
	PolygonComponent,
	GroupComponent,
	GroupSaveObject,
	memorySizeOf,
	SaveFileFormat,
	emtpySaveState,
	currentSaveVersion,
	loadTextConverter,
	TextProperty,
	ShortComponent,
	OpenComponent,
	TikzEditorController,
	ContextMenu,
	SubcircuitComponent,
	SubcircuitSaveObject,
	SymbolEditorController,
	TemplateController,
	LiveRenderController,
} from "../internal"

type TabState = {
	id: number
	open: string
	data: SaveFileFormat
	settings: CanvasSettings
	designName?: string
}

export type MessageData = {
	type: string
	from: number
	payload?: any
}

export type CanvasSettings = {
	gridVisible?: boolean
	majorGridSizecm?: number
	majorGridSubdivisions?: number
	viewBox?: SVG.Box
	viewZoom?: number
}

export enum Modes {
	DRAG_PAN,
	COMPONENT,
	ERASE,
}

// TODO Test
// TODO redo comments

export class MainController {
	private static _instance: MainController
	public static get instance(): MainController {
		if (!MainController._instance) {
			MainController._instance = new MainController()
		}
		return MainController._instance
	}

	// controllers
	canvasController: CanvasController

	symbolsSVG: SVG.Svg
	symbols: ComponentSymbol[]

	public darkMode = true
	private darkModeLast = true
	private currentTheme = "dark"

	private tabID = -1

	mode = Modes.DRAG_PAN

	private modeSwitchButtons = {
		modeDragPan: null,
		modeDrawLine: null,
		modeEraser: null,
	}

	initPromise: Promise<any>
	isInitDone: boolean = false

	circuitComponents: CircuitComponent[] = []
	// instances: ComponentInstance[] = [];
	// lines: Line[] = [];

	static appVersion = "0.0.0"

	isMac = false
	selectionController: SelectionController

	broadcastChannel: BroadcastChannel

	public designName: TextProperty
	public pendingLoadData: SaveFileFormat | null = null

	private db: IDBDatabase

	/**
	 * Init the app.
	 */
	private constructor() {
		MainController._instance = this
		this.isMac = window.navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
		this.broadcastChannel = new BroadcastChannel("circuitikz-designer")

		// dark mode init
		const htmlElement = document.documentElement
		const switchElement = document.getElementById("darkModeSwitch") as HTMLInputElement
		this.currentTheme = "light"
		htmlElement.setAttribute("data-bs-theme", "light")
		localStorage.setItem("circuitikz-designer-theme", "light")
		this.darkModeLast = false
		this.darkMode = false
		if (switchElement) {
			switchElement.checked = false
		}

		let mathJaxPromise = this.loadMathJax()
		let canvasPromise = this.initCanvas()
		let symbolsDBPromise = this.initSymbolDB()
		let dbResolve: (db: IDBDatabase) => void
		let dbPromise = new Promise<IDBDatabase>((resolve) => {
			dbResolve = resolve
		})
		let fontPromise = Promise.all([document.fonts.load("1em Computer Modern Serif"), loadTextConverter()])

		MainController.appVersion = version
		document.addEventListener("DOMContentLoaded", () => {
			for (const element of document.getElementsByClassName("version")) {
				element.textContent = "v" + version
			}
		})

		const fileExportName = document.getElementById("exportModalFileBasename") as HTMLInputElement
		this.designName = new TextProperty("Design Name", "")
		this.designName.addChangeListener(() => {
			document.title = this.designName.value + (this.designName.value ? " - " : "") + "VisioCirkit"
			fileExportName.placeholder =
				MainController.instance.designName.value.replace(/[^a-z0-9]/gi, "_") || "Circuit"

			let tabsObjectStore = MainController.instance.db.transaction("tabs", "readwrite").objectStore("tabs")
			tabsObjectStore.get(this.tabID).onsuccess = function (event) {
				const data = (event.target as IDBRequest).result as TabState
				data.designName = MainController.instance.designName.value
				tabsObjectStore.put(data)
				MainController.instance.sendBroadcastMessage("update")
			}
		})

		this.initModeButtons()

		this.updateTooltips()

		// init exporting
		ExportController.instance
		const exportCircuiTikZButton: HTMLButtonElement = document.getElementById(
			"exportCircuiTikZButton"
		) as HTMLButtonElement
		exportCircuiTikZButton.addEventListener(
			"click",
			() => {
				TikzEditorController.instance.toggleVisibility()
			},
			{
				passive: true,
			}
		)

		const exportSVGButton: HTMLButtonElement = document.getElementById("exportSVGButton") as HTMLButtonElement
		exportSVGButton.addEventListener("click", ExportController.instance.exportSVG.bind(ExportController.instance), {
			passive: true,
		})

		canvasPromise.then(() => {
			EraseController.instance
			SelectionController.instance
			PropertyController.instance
			ComponentPlacer.instance
		})
		this.addSaveStateManagement(dbResolve)
		this.initPromise = Promise.all([canvasPromise, symbolsDBPromise, mathJaxPromise, fontPromise, dbPromise]).then(async () => {
			document.getElementById("loadingSpinner")?.classList.add("d-none")
			await this.loadCustomSymbolsIntoSymbolDB()
			this.initAddComponentOffcanvas()
			this.initShortcuts()
			TikzEditorController.instance.init()
			LiveRenderController.instance.init()

			// Prevent "normal" browser menu
			document
				.getElementById("canvas")
				.addEventListener("contextmenu", (evt) => {
					evt.preventDefault()
					if (SelectionController.instance.currentlySelectedComponents.length > 0) {
						const selected = SelectionController.instance.currentlySelectedComponents
						const menuEntries = []
						
						if (selected.length > 1) {
							menuEntries.push({ result: "group", text: "Group Selection" })
						}
						
						if (selected.length === 1 && (selected[0] instanceof GroupComponent || selected[0].constructor.name === "GroupComponent" || selected[0].constructor.name === "SubcircuitComponent")) {
							menuEntries.push({ result: "ungroup", text: "Ungroup" })
						}
						
						menuEntries.push({ result: "subcircuit", text: "Save Selection as Symbol..." })
						
						const menu = new ContextMenu(menuEntries)
						menu.openForResult(evt.clientX, evt.clientY).then((res) => {
							if (res === "group") {
								GroupComponent.group(selected)
							} else if (res === "ungroup") {
								(selected[0] as GroupComponent).ungroup()
							} else if (res === "subcircuit") {
								this.createSubcircuitFromSelection()
							}
						}).catch(() => {})
					}
				}, { passive: false })

			// prepare symbolDB for colorTheme
			for (const g of this.symbolsSVG.defs().node.querySelectorAll("symbol>g")) {
				this.preprocessSymbolColors(g)
			}

			const htmlElement = document.documentElement
			const switchElement = document.getElementById("darkModeSwitch") as HTMLInputElement
			switchElement.addEventListener("change", function () {
				if ((MainController.instance.darkMode = switchElement.checked)) {
					htmlElement.setAttribute("data-bs-theme", "dark")
					localStorage.setItem("circuitikz-designer-theme", "dark")
				} else {
					htmlElement.setAttribute("data-bs-theme", "light")
					localStorage.setItem("circuitikz-designer-theme", "light")
				}
				MainController.instance.updateTheme()
			})
			MainController.instance.updateTheme()
			PropertyController.instance.update()
			
			TemplateController.instance.fetchFiles().then(() => {
				if (!window.location.search.includes("base=")) {
					TemplateController.instance.loadRemoteFile("template", "rc-lowpass.tex")
				}
			}).catch(err => console.error("Error loading templates:", err))

			if (MainController.instance.pendingLoadData) {
				SaveController.instance.loadFromJSON(MainController.instance.pendingLoadData)
			}

			this.isInitDone = true
		})
	}

	private allTooltips: Tooltip[] = []
	public updateTooltips() {
		var isMobile = window.matchMedia("only screen and (max-width: 760px)").matches
		//enable tooltips globally
		const tooltipTriggerList = document.querySelectorAll(
			'[data-bs-toggle="tooltip"],[data-bs-toggle-second="tooltip"]'
		)
		for (const tooltip of this.allTooltips) {
			tooltip.dispose()
		}
		if (isMobile) {
			this.allTooltips = [...tooltipTriggerList].map(
				(tooltipTriggerEl) =>
					new Tooltip(tooltipTriggerEl, {
						fallbackPlacements: [], //always show them exactly where defined
						trigger: "manual",
					})
			)
		} else {
			this.allTooltips = [...tooltipTriggerList].map(
				(tooltipTriggerEl) =>
					new Tooltip(tooltipTriggerEl, {
						fallbackPlacements: [], //always show them exactly where defined
						delay: { show: 1000, hide: 0 },
					})
			)
		}
	}

	private async loadMathJax() {
		var promise = new Promise((resolve) => {
			if (!("MathJax" in window)) {
				;(window as any).MathJax = {
					tex: {
						inlineMath: { "[+]": [["$", "$"]] },
					},
				}
			}
			var script = document.createElement("script")
			script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
			document.head.appendChild(script)

			script.addEventListener(
				"load",
				function () {
					resolve("")
				},
				false
			)
		})
		return promise
	}

	/**
	 * handle tabs and save state management
	 */
	private addSaveStateManagement(dbResolve: (db: IDBDatabase) => void) {
		// remove old localStorage data
		localStorage.removeItem("currentProgress")
		localStorage.removeItem("circuit2tikz-designer-grid")
		localStorage.removeItem("circuitikz-designer-grid")
		localStorage.removeItem("circuitikz-designer-saveState")
		sessionStorage.removeItem("circuitikz-designer-tabID")

		const defaultSettings: CanvasSettings = {}

		const IDBrequest = indexedDB.open("circuitikz-designer-db-v2", 1)
		IDBrequest.onerror = function (event) {
			console.error("IndexedDB error")
			console.error(event)
		}
		IDBrequest.onblocked = function (event) {
			console.warn("Database upgrade blocked. Closing database in other tabs might help.")
		}
		IDBrequest.onupgradeneeded = function (event) {
			MainController.instance.db = (event.target as IDBOpenDBRequest).result
			if (!MainController.instance.db.objectStoreNames.contains("tabs")) {
				const objectStore = MainController.instance.db.createObjectStore("tabs", { keyPath: "id" })
				objectStore.createIndex("open", "open", { unique: false })
			}
			if (!MainController.instance.db.objectStoreNames.contains("customCategories")) {
				MainController.instance.db.createObjectStore("customCategories", { keyPath: "name" })
			}
			if (!MainController.instance.db.objectStoreNames.contains("customSymbols")) {
				MainController.instance.db.createObjectStore("customSymbols", { keyPath: "id" })
			}
		}
		IDBrequest.onsuccess = function (event) {
			MainController.instance.db = (event.target as IDBOpenDBRequest).result
			MainController.instance.db.onversionchange = function () {
				MainController.instance.db.close()
				console.log("Database closed due to version change request.")
			}
			dbResolve(MainController.instance.db)

			window.addEventListener("visibilitychange", (ev) => {
				if (document.visibilityState == "hidden") {
					MainController.instance.saveCurrentState(false)
				}
			})

			window.addEventListener("beforeunload", (ev) => {
				MainController.instance.saveCurrentState()
			})

			let tabsObjectStore = MainController.instance.db.transaction("tabs", "readwrite").objectStore("tabs")

			// the URL of the current page
			var url = new URL(window.location.href)
			// check if a tabID is requested in the URL, otherwise use the first closed tab
			var requestedID = parseInt(url.searchParams.get("tabID"))

			tabsObjectStore.getAll().onsuccess = function (event) {
				let allTabs: TabState[] = (event.target as IDBRequest).result

				if (Number.isNaN(requestedID)) {
					// no tabID is requested in the URL, so we need to find the first closed tab
					requestedID = allTabs.findIndex((tab) => tab.open == "false")

					if (requestedID < 0) {
						// no closed tab found, use the next available ID
						requestedID = 0
						while (allTabs.find((tab) => tab.id == requestedID)) {
							requestedID++
						}
					}
				}

				let requestedTab = allTabs.find((tab) => tab.id == requestedID)
				if (requestedTab) {
					// if the requested tab is closed, open it
					requestedTab.open = "true"
					MainController.instance.tabID = requestedTab.id
					MainController.instance.designName.updateValue(requestedTab.designName ?? "", true, true)
					CanvasController.instance.setSettings(requestedTab.settings)
					MainController.instance.pendingLoadData = requestedTab.data
					tabsObjectStore.put(requestedTab).onsuccess = (event) => {
						MainController.instance.sendBroadcastMessage("update")
					}
				} else {
					// requested tab not found, so we create a new one
					const newEntry: TabState = {
						id: requestedID,
						open: "true",
						data: emtpySaveState,
						settings: defaultSettings,
					}
					MainController.instance.tabID = requestedID
					tabsObjectStore.add(newEntry).onsuccess = (event) => {
						// as soon as the tab is created and saved in the db, we can notify the other tabs
						MainController.instance.sendBroadcastMessage("update")
					}
				}
			}
		}

		//settings modal
		const settingsModalEl = document.getElementById("tabManagementModal") as HTMLDivElement
		const settingsTableBody = document.getElementById("tabManagementTableBody") as HTMLTableSectionElement

		settingsModalEl.addEventListener("show.bs.modal", (event) => {
			this.saveCurrentState(false)
			let tabsObjectStoreRead = MainController.instance.db.transaction("tabs").objectStore("tabs")

			tabsObjectStoreRead.getAll().onsuccess = function (event) {
				settingsTableBody.innerHTML = ""

				const currentData = (event.target as IDBRequest).result as TabState[]

				let totalSize = 0

				for (let i = 0; i < currentData.length; i++) {
					const tabData = currentData[i]
					let row = settingsTableBody.appendChild(document.createElement("tr"))
					row.classList.add("text-end")
					let cell1 = row.appendChild(document.createElement("td"))
					cell1.innerText = tabData.designName || "" + i
					let cell2 = row.appendChild(document.createElement("td"))
					cell2.innerText = countComponents(tabData.data.components) + ""
					let cell3 = row.appendChild(document.createElement("td"))
					let size = memorySizeOf(tabData.data)
					totalSize += size
					cell3.innerText = sizeString(size)
					let cell4 = row.appendChild(document.createElement("td"))
					if (tabData.open == "false") {
						let openButton = cell4.appendChild(document.createElement("button"))
						openButton.classList.add("btn", "btn-primary", "me-2")
						openButton.innerText = "Open"
						openButton.addEventListener("click", () => {
							// set the data in the object store to open
							let allOpen = true
							for (let index = 0; index < tabData.id; index++) {
								// current data will not be stale since the tab management gets updated immediately when something changes
								let current = currentData.find((tab) => tab.id == index)
								if (current) {
									allOpen = allOpen && current.open == "true"
								} else {
									allOpen = false
								}
							}
							if (allOpen) {
								// if possible, don't use the tabID parameter
								window.open(".", "_blank")
							} else {
								window.open(".?tabID=" + tabData.id, "_blank")
							}
						})

						let deleteButton = cell4.appendChild(document.createElement("button"))
						deleteButton.classList.add("btn", "btn-danger", "material-symbols-outlined")
						deleteButton.innerText = "delete"
						deleteButton.addEventListener("click", () => {
							let tabsObjectStore = MainController.instance.db
								.transaction("tabs", "readwrite")
								.objectStore("tabs")
							tabsObjectStore.delete(tabData.id).onsuccess = function () {
								settingsModalEl.dispatchEvent(new Event("show.bs.modal"))
								MainController.instance.sendBroadcastMessage("update")
							}
						})
					} else {
						if (tabData.id == MainController.instance.tabID) {
							let infoButton = cell4.appendChild(document.createElement("button"))
							infoButton.classList.add("btn")
							infoButton.innerText = "This tab"
							infoButton.disabled = true
							let _ = [cell1, cell2, cell3, cell4].forEach((cell) => {
								cell.classList.add("bg-primary")
							})
						} else {
							let closeButton = cell4.appendChild(document.createElement("button"))
							closeButton.classList.add("btn", "btn-primary")
							closeButton.innerText = "Highlight tab"
							closeButton.addEventListener("click", () => {
								// send a message to the broadcast channel to show the tab
								MainController.instance.sendBroadcastMessage("show", tabData.id)
							})
						}
					}
				}
				let row = settingsTableBody.appendChild(document.createElement("tr"))
				let cell1 = row.appendChild(document.createElement("td"))
				cell1.colSpan = 4
				cell1.classList.add("text-center")
				let newTabButton = cell1.appendChild(document.createElement("button"))
				newTabButton.classList.add("btn", "btn-primary")
				newTabButton.innerText = "New tab"
				newTabButton.addEventListener("click", () => {
					// set the data in the object store to open
					let requestedID = 0
					let allOpen = true
					while (true) {
						// continue until no tab is found
						let tab = currentData.find((tab) => tab.id == requestedID)

						if (tab) {
							requestedID++
							allOpen = allOpen && tab.open == "true"
						} else {
							break
						}
					}
					if (allOpen) {
						// if possible, don't use the tabID parameter
						window.open(".", "_blank")
					} else {
						window.open(".?tabID=" + requestedID, "_blank")
					}
				})

				document.getElementById("storageUsed").innerHTML = sizeString(totalSize)
			}
		})

		document.getElementById("probeRefresh").addEventListener("click", () => {
			// set all open states in indexedDB to false, then send a probe message to all tabs
			let tabsObjectStore = MainController.instance.db.transaction("tabs", "readwrite").objectStore("tabs")
			tabsObjectStore.getAll().onsuccess = function (event) {
				let allTabs: TabState[] = (event.target as IDBRequest).result

				let requests: IDBRequest[] = []
				for (const tab of allTabs) {
					if (tab.id == MainController.instance.tabID) {
						// skip this tab
						continue
					}
					if (tab.open == "true") {
						// set the tab to closed in the db, but keep the data (even if the tab is empty)
						tab.open = "false"
						requests.push(tabsObjectStore.put(tab))
					} else {
						// if the tab is already closed and has no data, delete the entry (keeps the db clean)
						if (tab.data.components.length == 0) {
							requests.push(tabsObjectStore.delete(tab.id))
						}
					}
				}
				Promise.all(
					requests.map(
						(r) =>
							new Promise((res, rej) => {
								r.onsuccess = () => res(true)
								r.onerror = () => rej()
							})
					)
				).then(() => {
					// after all tabs are closed (in the db, not the tab in the browser), send a probe message to all tabs
					// this will cause all open tabs to set their state to open=true again
					settingsModalEl.dispatchEvent(new Event("show.bs.modal"))
					setTimeout(() => {
						MainController.instance.sendBroadcastMessage("probe")
					}, 10)
				})
			}
		})

		const favicon = document.getElementById("favicon") as HTMLLinkElement
		const faviconLink = favicon.href
		const faviconAlternate = document.getElementById("faviconAlternate") as HTMLLinkElement
		const alternateLink = faviconAlternate.href
		faviconAlternate.href = " "
		faviconAlternate.disabled = true

		this.broadcastChannel.onmessage = (event) => {
			const msg = event.data as MessageData

			if (msg.type == "show") {
				const tabID = parseInt(msg.payload) // get the tabID
				if (tabID == MainController.instance.tabID) {
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

					// Stop flashing if tab becomes visible
					document.addEventListener("visibilitychange", () => {
						if (!document.hidden) {
							clearInterval(interval)
							darkMode = false
							switchFavicon()
						}
					})
				}
			} else if (msg.type == "update") {
				if (settingsModalEl.classList.contains("show")) {
					settingsModalEl.dispatchEvent(new Event("show.bs.modal"))
				}
			} else if (msg.type == "clipboard") {
				CopyPaste.setClipboard(msg.payload)
			} else if (msg.type == "probe") {
				// also respond with the orginal sender as the payload
				this.sendBroadcastMessage("probe-response", msg.from)
			} else if (msg.type == "probe-response") {
				if (msg.payload != this.tabID) {
					// only handle response if the orignal probe message came from this tab
					return
				}

				// set the indexedDB entry with tabID msg.tabID to open=true
				let tabsObjectStore = MainController.instance.db.transaction("tabs", "readwrite").objectStore("tabs")
				tabsObjectStore.get(msg.from).onsuccess = function (event) {
					const data = (event.target as IDBRequest).result as TabState
					if (data) {
						data.open = "true"
						tabsObjectStore.put(data).onsuccess = function () {
							MainController.instance.sendBroadcastMessage("update")
						}
					}
				}
				if (settingsModalEl.classList.contains("show")) {
					settingsModalEl.dispatchEvent(new Event("show.bs.modal"))
				}
			}
			return false
		}

		function sizeString(size: number) {
			if (size < 1024) {
				return size + " B"
			} else if (size < 1024 * 1024) {
				return (size / 1024).toFixed(2) + " KB"
			} else if (size < 1024 * 1024 * 1024) {
				return (size / (1024 * 1024)).toFixed(2) + " MB"
			} else {
				return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB"
			}
		}

		function countComponents(data: ComponentSaveObject[]) {
			let count = 0
			for (const component of data) {
				if (component.type == "group") {
					count += countComponents((component as GroupSaveObject).components)
				}
				count++
			}
			return count
		}
	}

	public sendBroadcastMessage(type: string, payload?: any) {
		const broadcastMessage: MessageData = {
			type: type,
			from: this.tabID,
		}
		if (payload != undefined) {
			broadcastMessage.payload = payload
		}
		this.broadcastChannel.postMessage(broadcastMessage)
	}

	private saveCurrentState(closeTab = true) {
		Undo.addState()
		let tabsObjectStore = MainController.instance.db.transaction("tabs", "readwrite").objectStore("tabs")
		tabsObjectStore.get(this.tabID).onsuccess = function (event) {
			const data = (event.target as IDBRequest).result as TabState
			if (closeTab) {
				data.open = "false"
			}
			data.data = Undo.getCurrentState()
			if (data.data.components.length > 0) {
				data.settings.gridVisible = CanvasController.instance.gridVisible
				data.settings.majorGridSizecm = CanvasController.instance.majorGridSizecm
				data.settings.majorGridSubdivisions = CanvasController.instance.majorGridSubdivisions
				data.settings.viewBox = CanvasController.instance.canvas.viewbox()
				data.settings.viewZoom = CanvasController.instance.currentZoom
				data.designName = MainController.instance.designName.value || undefined
				tabsObjectStore.put(data).onsuccess = function () {
					MainController.instance.sendBroadcastMessage("update")
				}
			} else {
				if (closeTab) {
					// if no data is present, delete the entry (keeps the db clean)
					tabsObjectStore.delete(MainController.instance.tabID).onsuccess = function () {
						MainController.instance.sendBroadcastMessage("update")
					}
				}
			}
		}
	}

	/**
	 * initialises keyboard shortcuts
	 */
	private initShortcuts() {
		// stop reload behaviour
		hotkeys("ctrl+r,command+r", () => false)

		// rotate selection
		hotkeys("ctrl+r,command+r", () => {
			if (this.mode == Modes.COMPONENT) {
				ComponentPlacer.instance.placeRotate(-90)
			} else {
				if (SelectionController.instance.hasSelection()) {
					SelectionController.instance.rotateSelection(-90)
					Undo.addState()
				}
			}
			return false
		})
		hotkeys("ctrl+shift+r,command+shift+r", () => {
			if (this.mode == Modes.COMPONENT) {
				ComponentPlacer.instance.placeRotate(90)
			} else {
				if (SelectionController.instance.hasSelection()) {
					SelectionController.instance.rotateSelection(90)
					Undo.addState()
				}
			}
			return false
		})

		//flip selection
		hotkeys("shift+x", () => {
			if (this.mode == Modes.COMPONENT) {
				ComponentPlacer.instance.placeFlip(true)
			} else {
				if (SelectionController.instance.hasSelection()) {
					SelectionController.instance.flipSelection(true)
					Undo.addState()
				}
			}
			return false
		})
		hotkeys("shift+y", () => {
			if (this.mode == Modes.COMPONENT) {
				ComponentPlacer.instance.placeFlip(false)
			} else {
				if (SelectionController.instance.hasSelection()) {
					SelectionController.instance.flipSelection(false)
					Undo.addState()
				}
			}
			return false
		})

		// select everything
		hotkeys("ctrl+a,command+a", () => {
			SelectionController.instance.selectAll()
			return false
		})

		//undo/redo
		hotkeys("ctrl+z,command+z", () => {
			Undo.undo()
			return false
		})
		hotkeys("ctrl+y,command+y", () => {
			Undo.redo()
			return false
		})
		document.getElementById("undoButton").addEventListener("click", () => Undo.undo())
		document.getElementById("redoButton").addEventListener("click", () => Undo.redo())

		//copy/paste
		hotkeys("ctrl+c,command+c", () => {
			CopyPaste.copy()
			return false
		})
		hotkeys("ctrl+v,command+v", () => {
			CopyPaste.paste()
			return false
		})
		hotkeys("ctrl+x,command+x", () => {
			CopyPaste.cut()
			return false
		})

		//save/load
		hotkeys("ctrl+shift+e,command+shift+e", () => {
			ExportController.instance.exportSVG()
			return false
		})

		// mode change
		hotkeys("q", () => {
			document.getElementById("addComponentButton").dispatchEvent(new MouseEvent("click"))
			return false
		})
		hotkeys("esc", () => {
			this.switchMode(Modes.DRAG_PAN)
			return false
		})
		hotkeys("f", () => {
			if (LiveRenderController.instance.activeTab === "render") {
				LiveRenderController.instance.fitView()
			} else {
				CanvasController.instance.fitView()
			}
			return false
		})
		hotkeys("w", () => {
			this.switchMode(Modes.DRAG_PAN)
			ComponentPlacer.instance.placeComponent(new WireComponent())
			return false
		})
		hotkeys("del, backspace", () => {
			if (!SelectionController.instance.hasSelection()) {
				this.switchMode(Modes.ERASE)
			} else {
				SelectionController.instance.removeSelection()
				Undo.addState()
			}
			return false
		})
		hotkeys("t", () => {
			this.switchMode(Modes.DRAG_PAN)
			ComponentPlacer.instance.placeComponent(new RectangleComponent(true))
			return false
		})

		// handle shortcuts for adding components
		// shortcutDict maps the Shortcut key to the title attribute of the html element where the callback can be found
		var shortcutDict: { shortcut: string; component: string }[] = [
			{ shortcut: "g", component: "Ground" },
			{ shortcut: "alt+g,option+g", component: "Ground (tailless)" },
			{ shortcut: "r", component: "Resistor (american)" },
			{ shortcut: "alt+r,option+r", component: "Resistor (european)" },
			{ shortcut: "c", component: "Capacitor" },
			{ shortcut: "alt+c,option+c", component: "Curved (polarized) capacitor" },
			{ shortcut: "l", component: "Inductor (american)" },
			{ shortcut: "alt+l,option+l", component: "Inductor (cute)" },
			{ shortcut: "d", component: "Empty diode" },
			{ shortcut: "b", component: "NPN" },
			{ shortcut: "alt+b,option+b", component: "PNP" },
			{ shortcut: "n", component: "NMOS" },
			{ shortcut: "alt+n,option+n", component: "PMOS" },
			{ shortcut: "x", component: "Plain style crossing node" },
			{ shortcut: "alt+x,option+x", component: "Jumper-style crossing node" },
			{ shortcut: ".", component: "Connected terminal" },
			{ shortcut: "alt+.,option+.", component: "Unconnected terminal" },
		]
		// when a valid shortcut button is pressed, simulate a click on the corresponding button for the component
		for (const { shortcut, component } of shortcutDict) {
			hotkeys(shortcut, () => {
				this.switchMode(Modes.DRAG_PAN) //switch to standard mode to avoid weird states
				var componentButton = document.querySelector('[title="' + component + '"]')
				var clickEvent = new MouseEvent("mouseup", { view: window, bubbles: true, cancelable: true })
				componentButton?.dispatchEvent(clickEvent)
			})
		}
	}

	/**
	 * Init the canvas controller
	 */
	private async initCanvas() {
		let canvasElement: SVGSVGElement = await waitForElementLoaded("canvas")
		if (canvasElement) this.canvasController = new CanvasController(new SVG.Svg(canvasElement))
	}

	/**
	 * Fetch & parse the symbol(s) svg.
	 */
	private async initSymbolDB() {
		// Fetch symbol DB
		const symbolDBlink: HTMLLinkElement = await waitForElementLoaded("symbolDBlink")
		const response = await fetch(symbolDBlink.href, {
			method: "GET",
			// must match symbolDBlink cors options in order to actually use the preloaded file
			mode: "cors",
			credentials: "same-origin",
		})
		const textContent = await response.text()

		// Parse & add to DOM
		const symbolsDocument: XMLDocument = new DOMParser().parseFromString(textContent, "image/svg+xml")
		const symbolsSVGSVGElement: SVGSVGElement = document.adoptNode(
			symbolsDocument.firstElementChild as SVGSVGElement
		)
		symbolsSVGSVGElement.style.display = "none"
		symbolsSVGSVGElement.setAttribute("id", "symbolDB")
		document.body.appendChild(symbolsSVGSVGElement)

		// Extract symbols
		this.symbolsSVG = new SVG.Svg(symbolsSVGSVGElement)
		const componentsMetadata = Array.from(this.symbolsSVG.node.getElementsByTagName("component"))

		this.symbols = componentsMetadata.flatMap((componentMetadata) => {
			return new ComponentSymbol(componentMetadata)
		})
	}

	/**
	 * Init the mode change buttons.
	 */
	private initModeButtons() {
		this.modeSwitchButtons.modeDragPan = document.getElementById("modeDragPan")
		this.modeSwitchButtons.modeDrawLine = document.getElementById("modeDrawLine")
		this.modeSwitchButtons.modeEraser = document.getElementById("modeEraser")

		this.modeSwitchButtons.modeDragPan.addEventListener("click", () => this.switchMode(Modes.DRAG_PAN), {
			passive: false,
		})
		this.modeSwitchButtons.modeDrawLine.addEventListener(
			"click",
			() => {
				this.switchMode(Modes.DRAG_PAN)
				this.modeSwitchButtons.modeDrawLine.classList.add("selected")
				ComponentPlacer.instance.placeComponent(new WireComponent())
			},
			{ passive: false }
		)
		this.modeSwitchButtons.modeEraser.addEventListener("click", () => this.switchMode(Modes.ERASE), {
			passive: false,
		})
	}

	private addShapeComponentsToOffcanvas(leftOffcanvasAccordion: HTMLDivElement, leftOffcanvasOC: Offcanvas) {
		// Add shapes accordion area
		let groupName = "Basic"
		const collapseGroupID = "collapseGroup-" + groupName.replace(/[^\d\w\-\_]+/gi, "-")

		const accordionGroup = leftOffcanvasAccordion.appendChild(document.createElement("div"))
		accordionGroup.classList.add("accordion-item")

		const accordionItemHeader = accordionGroup.appendChild(document.createElement("h2"))
		accordionItemHeader.classList.add("accordion-header")

		const accordionItemButton = accordionItemHeader.appendChild(document.createElement("button"))
		accordionItemButton.classList.add("accordion-button")
		accordionItemButton.innerText = groupName
		accordionItemButton.setAttribute("aria-controls", collapseGroupID)
		accordionItemButton.setAttribute("aria-expanded", "true")
		accordionItemButton.setAttribute("data-bs-target", "#" + collapseGroupID)
		accordionItemButton.setAttribute("data-bs-toggle", "collapse")
		accordionItemButton.type = "button"

		const accordionItemCollapse = accordionGroup.appendChild(document.createElement("div"))
		accordionItemCollapse.classList.add("accordion-collapse", "collapse", "show")
		accordionItemCollapse.id = collapseGroupID
		accordionItemCollapse.setAttribute("data-bs-parent", "#leftOffcanvasAccordion")

		const accordionItemBody = accordionItemCollapse.appendChild(document.createElement("div"))
		accordionItemBody.classList.add("accordion-body", "iconLibAccordionBody")

		//Add Short
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "short path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Short"

			const listener = (ev: MouseEvent) => {
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new ShortComponent()
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(-1, -14, 30, 15)
			svgIcon.line(0, -7, 29, -7).stroke({ color: defaultStroke, width: 2 })
		}

		//Add Open
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "open path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Open"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new OpenComponent()
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(-1, -14, 30, 15)
			svgIcon.circle(5).fill("none").stroke({ color: defaultStroke, width: 1 }).center(4, -7)
			svgIcon.circle(5).fill("none").stroke({ color: defaultStroke, width: 1 }).center(25, -7)
		}

		//Add Text
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "text node")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Text"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new RectangleComponent(true)
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(-1, -14, 30, 15)
			svgIcon.text((add) => {
				add.tspan("Text").fill({ color: defaultStroke })
			})
		}

		//Add rectangle
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "rect rectangle node")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Rectangle/Text"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new RectangleComponent(false)
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(0, 0, 17, 12)
			svgIcon.rect(15, 10).move(1, 1).fill("none").stroke({
				color: defaultStroke,
				width: 1,
			})
		}
		//Add Ellipse
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "ellipse circle node")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Ellipse"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()
				this.switchMode(Modes.COMPONENT)

				if (ComponentPlacer.instance.component) {
					ComponentPlacer.instance.placeCancel()
				}

				let newComponent = new EllipseComponent()
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(0, 0, 17, 12)
			svgIcon.ellipse(15, 10).move(1, 1).fill("none").stroke({
				color: defaultStroke,
				width: 1,
			})
		}

		//Add Polygon
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "polygon path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Polygon"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()
				this.switchMode(Modes.COMPONENT)

				if (ComponentPlacer.instance.component) {
					ComponentPlacer.instance.placeCancel()
				}

				let newComponent = new PolygonComponent()
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(0, 0, 17, 12)
			svgIcon
				.polygon([
					[1, 1],
					[16, 1],
					[15, 11],
					[11, 9],
					[5, 11],
				])
				.fill("none")
				.stroke({
					color: defaultStroke,
					width: 1,
				})
		}

		//Add straight line
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "straight line path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Straight line"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new WireComponent(true)
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(0, 0, 17, 12)
			svgIcon.line(2, 10, 15, 2).stroke({ color: defaultStroke, width: 1, opacity: 1 })
		}

		//Add straight arrow
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "straight arrow path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Straight arrow"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new WireComponent(true, true)
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(-1, -1, 12, 6)
			svgIcon
				.polygon([
					[6, 0],
					[10, 2],
					[6, 4],
					[6, 2.2],
					[0, 2.2],
					[0, 1.8],
					[6, 1.8],
				])
				.rotate(-30, 5, 2)
				.fill({ color: defaultStroke })
		}

		//Add arrow
		{
			const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.setAttribute("searchData", "arrow path")
			addButton.ariaRoleDescription = "button"
			addButton.title = "Arrow"

			const listener = (ev: MouseEvent) => {
				if (ev.button !== 0) return
				ev.preventDefault()

				this.switchMode(Modes.DRAG_PAN)
				let newComponent = new WireComponent(false, true)
				ComponentPlacer.instance.placeComponent(newComponent)

				leftOffcanvasOC.hide()
			}

			addButton.addEventListener("mouseup", listener)
			addButton.addEventListener("touchstart", listener, { passive: false })

			let svgIcon = SVG.SVG().addTo(addButton)
			svgIcon.viewbox(-1, -2, 12, 8)
			svgIcon
				.polyline([
					[0, 5],
					[5, 5],
					[5, 0],
					[9.1, 0],
				])
				.stroke({ color: defaultStroke, width: 0.5 })
				.fill("none")
			svgIcon
				.polygon([
					[9, -1],
					[10.5, 0],
					[9, 1],
				])
				.fill({ color: defaultStroke })
		}
	}

	/**
	 * Init the left add offcanvas.
	 */
	private async initAddComponentOffcanvas() {
		const leftOffcanvas: HTMLDivElement = document.getElementById("leftOffcanvas") as HTMLDivElement
		const leftOffcanvasOC = new Offcanvas(leftOffcanvas)
		document.getElementById("componentFilterInput").addEventListener("input", this.filterComponents)
		document.getElementById("filterRegexButton").addEventListener("click", this.filterComponents)
		document.getElementById("addCategoryButton").addEventListener("click", async () => {
			const name = await this.openPrompt("New Category", "Please enter a custom category name:")
			if (name) {
				this.addCustomCategory(name)
			}
		})

		const addComponentButton: HTMLAnchorElement = document.getElementById("addComponentButton") as HTMLAnchorElement
		addComponentButton.addEventListener(
			"click",
			((ev: PointerEvent) => {
				this.switchMode(Modes.DRAG_PAN)
				leftOffcanvasOC.toggle()
				if (leftOffcanvas.classList.contains("showing") && ev.pointerType !== "touch") {
					let searchBar = document.getElementById("componentFilterInput")
					const refocus = () => {
						searchBar.focus()
						leftOffcanvas.removeEventListener("shown.bs.offcanvas", refocus)
					}
					refocus()
					leftOffcanvas.addEventListener("shown.bs.offcanvas", refocus)
				}
			}).bind(this),
			{ passive: true }
		)
		const leftOffcanvasAccordion: HTMLDivElement = document.getElementById(
			"leftOffcanvasAccordion"
		) as HTMLDivElement

		const groupedSymbols: Map<string, ComponentSymbol[]> = this.symbols.reduce(
			(
				groupedSymbols: Map<string, ComponentSymbol[]>,
				symbol: ComponentSymbol
			): Map<string, ComponentSymbol[]> => {
				const key = symbol.groupName || "Unsorted components"
				let group = groupedSymbols.get(key)
				if (group) group.push(symbol)
				else groupedSymbols.set(key, [symbol])
				return groupedSymbols
			},
			new Map()
		)

		this.addShapeComponentsToOffcanvas(leftOffcanvasAccordion, leftOffcanvasOC)
		await this.loadAndRenderCustomCategories()

		for (const [groupName, symbols] of groupedSymbols.entries()) {
			const collapseGroupID = "collapseGroup-" + groupName.replace(/[^\d\w\-\_]+/gi, "-")

			const accordionGroup = leftOffcanvasAccordion.appendChild(document.createElement("div"))
			accordionGroup.classList.add("accordion-item")

			const accordionItemHeader = accordionGroup.appendChild(document.createElement("h2"))
			accordionItemHeader.classList.add("accordion-header")

			const accordionItemButton = accordionItemHeader.appendChild(document.createElement("button"))
			accordionItemButton.classList.add("accordion-button", "collapsed")
			accordionItemButton.innerText = groupName
			accordionItemButton.setAttribute("aria-controls", collapseGroupID)
			accordionItemButton.setAttribute("aria-expanded", "false")
			accordionItemButton.setAttribute("data-bs-target", "#" + collapseGroupID)
			accordionItemButton.setAttribute("data-bs-toggle", "collapse")
			accordionItemButton.type = "button"

			const accordionItemCollapse = accordionGroup.appendChild(document.createElement("div"))
			accordionItemCollapse.classList.add("accordion-collapse", "collapse")
			accordionItemCollapse.id = collapseGroupID
			accordionItemCollapse.setAttribute("data-bs-parent", "#leftOffcanvasAccordion")

			const accordionItemBody = accordionItemCollapse.appendChild(document.createElement("div"))
			accordionItemBody.classList.add("accordion-body", "iconLibAccordionBody")

			for (const symbol of symbols) {
				const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
				addButton.classList.add("libComponent")
				addButton.setAttribute(
					"searchData",
					[symbol.tikzName, symbol.isNodeSymbol ? "node" : "path"]
						.concat(
							symbol.possibleOptions
								.map((option) => option.displayName ?? option.name)
								.concat(
									symbol.possibleEnumOptions.flatMap((enumOption) =>
										enumOption.options.map((option) => option.displayName ?? option.name)
									)
								)
						)
						.join(" ")
				)
				addButton.ariaRoleDescription = "button"
				addButton.title = symbol.displayName || symbol.tikzName

				const listener = (ev: MouseEvent) => {
					if (ev.button !== 0) return
					ev.preventDefault()
					this.switchMode(Modes.COMPONENT)

					if (ComponentPlacer.instance.component) {
						ComponentPlacer.instance.placeCancel()
					}

					let newComponent: CircuitComponent
					if (symbol.isNodeSymbol) {
						newComponent = new NodeSymbolComponent(symbol)
					} else {
						newComponent = new PathSymbolComponent(symbol)
					}
					ComponentPlacer.instance.placeComponent(newComponent)

					leftOffcanvasOC.hide()
				}

				addButton.addEventListener("mouseup", listener)
				addButton.addEventListener("touchstart", listener, { passive: false })

				addButton.addEventListener("contextmenu", async (ev) => {
					ev.preventDefault()
					ev.stopPropagation()
					if (!symbol.isCustomSymbol && this.customCategories.length === 0) {
						const name = await this.openPrompt(
							"Create Category",
							"You don't have any custom categories. Please enter a name to create one:"
						)
						if (name) {
							this.addCustomCategory(name).then(() => {
								setTimeout(() => {
									this.addSymbolToCategory(name, symbol.tikzName)
								}, 100)
							})
						}
						return
					}

					let menuEntries: { result: string; text: string; iconText?: string }[] = []
					if (symbol.isCustomSymbol) {
						menuEntries.push(
							{ result: "edit", iconText: "edit", text: "Edit Symbol..." },
							{ result: "rename", iconText: "drive_file_rename_outline", text: "Rename symbol..." }
						)
					}

					this.customCategories.forEach(c => {
						menuEntries.push({
							result: "add:" + c.name,
							text: `Add to "${c.name}"`
						})
					})

					menuEntries.push({ result: "new", text: "Add to new category..." })
					menuEntries.push({ result: "duplicate", text: "Duplicate symbol and customize..." })

					if (symbol.isCustomSymbol) {
						menuEntries.push({ result: "delete", iconText: "delete", text: "Delete from library" })
					}

					const menu = new ContextMenu(menuEntries)
					menu.openForResult(ev.clientX, ev.clientY).then(async (res) => {
						if (res === "edit") {
							SymbolEditorController.instance.open("custom-" + symbol.tikzName)
						} else if (res === "rename") {
							const newName = await this.openRenameModal("Rename Custom Symbol", symbol.tikzName)
							if (newName) this.renameCustomGraphicsSymbol(symbol.tikzName, newName)
						} else if (res === "delete") {
							console.log("[addButton delete] Triggered openConfirm for:", symbol.tikzName);
							const ok = await this.openConfirm(
								"Delete Symbol",
								`Are you sure you want to completely delete custom symbol "${symbol.tikzName}"?\n(Components already placed on the canvas will not be affected)`
							);
							console.log("[addButton delete] openConfirm resolved:", ok);
							if (ok) {
								console.log("[addButton delete] executing deleteCustomGraphicsSymbol for:", symbol.tikzName);
								this.deleteCustomGraphicsSymbol(symbol.tikzName)
							}
						} else if (res === "new") {
							const name = await this.openPrompt("New Category", "Please enter a custom category name:")
							if (name) {
								this.addCustomCategory(name).then(() => {
									setTimeout(() => {
										this.addSymbolToCategory(name, symbol.tikzName)
									}, 100)
								})
							}
						} else if (res.startsWith("add:")) {
							const catName = res.substring(4)
							this.addSymbolToCategory(catName, symbol.tikzName)
						} else if (res === "duplicate") {
							const newName = await this.openPrompt(
								"Duplicate Symbol",
								"Please enter a name for the new custom symbol (e.g., hvnmos):"
							)
							if (!newName) return
							const cleanName = newName.trim()
							if (!cleanName) return

							// 選擇分類
							let catName = ""
							const catOptions = this.customCategories.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
							const catIndexStr = await this.openPrompt(
								"Select Category",
								`Please enter a number to select a category:\n${catOptions}\n\nOr enter a new category name directly:`
							)
							if (!catIndexStr) return
							const inputVal = catIndexStr.trim()
							const index = parseInt(inputVal)
							if (!isNaN(index) && index >= 1 && index <= this.customCategories.length) {
								catName = this.customCategories[index - 1].name
							} else {
								catName = inputVal
								await this.addCustomCategory(catName)
							}

							this.duplicateSymbol(symbol, cleanName, catName)
						}
					}).catch(() => {})
				})

				let svgIcon = SVG.SVG().addTo(addButton)

				let firstVariant = symbol._mapping.values().toArray()[0]
				let viewBox = new SVG.Box(firstVariant ? firstVariant.viewBox : new SVG.Box(0, 0, 30, 15))
				let maxStroke = Number.isFinite(symbol.maxStroke) ? symbol.maxStroke : 0

				//oversize viewbox due to stroke widths
				viewBox.width += maxStroke
				viewBox.height += maxStroke
				viewBox.x -= maxStroke / 2
				viewBox.y -= maxStroke / 2

				if (!Number.isFinite(viewBox.x) || !Number.isFinite(viewBox.y) || !Number.isFinite(viewBox.w) || !Number.isFinite(viewBox.h)) {
					viewBox = new SVG.Box(0, 0, 30, 15)
				}

				// svg icon should have new size
				svgIcon.viewbox(viewBox).width(viewBox.width).height(viewBox.height)

				let use = svgIcon.use(symbol.symbolElement.id())
				use.width(symbol.viewBox.width).height(symbol.viewBox.height) // use should have original size values
				use.stroke(defaultStroke).fill(defaultFill).node.style.color = defaultStroke
			}
		}
	}

	/**
	 * filter the components in the left OffCanvas to only show what matches the search string (in a new accordeon item)
	 */
	private filterComponents(evt: Event) {
		evt.preventDefault()
		evt.stopPropagation()

		const element = document.getElementById("componentFilterInput") as HTMLInputElement
		const feedbacktext = document.getElementById("invalid-feedback-text")
		const filterWithRegex = document.getElementById("filterRegexButton").classList.contains("active")

		let text = element.value
		let regex = null
		if (filterWithRegex) {
			regex = new RegExp(text, "i")
			element.classList.remove("is-invalid")
			feedbacktext.classList.add("d-none")
		} else {
			try {
				regex = new RegExp(".*" + text.split("").join(".*") + ".*", "i")
				element.classList.remove("is-invalid")
				feedbacktext.classList.add("d-none")
			} catch (e) {
				text = ""
				regex = new RegExp(text, "i")
				element.classList.add("is-invalid")
				feedbacktext.classList.remove("d-none")
			}
		}

		const accordion = document.getElementById("leftOffcanvasAccordion")

		const accordionItems = accordion.getElementsByClassName("accordion-item")
		Array.prototype.forEach.call(accordionItems, (accordionItem: HTMLDivElement, index: number) => {
			const libComponents = accordionItem.getElementsByClassName("libComponent")
			let showCount = 0
			Array.prototype.forEach.call(libComponents, (libComponent: HTMLDivElement) => {
				if (text) {
					if (!(regex.test(libComponent.title) || regex.test(libComponent.getAttribute("searchData")))) {
						libComponent.classList.add("d-none")
						return
					}
				}
				libComponent.classList.remove("d-none")
				showCount++
			})
			if (showCount === 0) {
				accordionItem.classList.add("d-none")
			} else {
				accordionItem.classList.remove("d-none")
			}

			if (text) {
				accordionItem.children[0]?.children[0]?.classList.remove("collapsed")
				accordionItem.children[1]?.classList.add("show")
			} else {
				accordionItem.children[0]?.children[0]?.classList.add("collapsed")
				accordionItem.children[1]?.classList.remove("show")
			}

			if (index === 0) {
				accordionItem.children[0]?.children[0]?.classList.remove("collapsed")
				accordionItem.children[1]?.classList.add("show")
			}
		})
	}

	/**
	 * Switches the mode. This deactivates the old controller and activates the new one.
	 */
	public switchMode(newMode: Modes) {
		if (newMode == this.mode) return
		let oldMode = this.mode
		this.mode = newMode

		switch (oldMode) {
			case Modes.DRAG_PAN:
				this.modeSwitchButtons.modeDragPan.classList.remove("selected")
				CanvasController.instance.deactivatePanning()
				SelectionController.instance.deactivateSelection()
				break
			case Modes.ERASE:
				this.modeSwitchButtons.modeEraser.classList.remove("selected")
				EraseController.instance.deactivate()
				break
			case Modes.COMPONENT:
				this.modeSwitchButtons.modeDragPan.classList.remove("selected")
				this.modeSwitchButtons.modeDrawLine.classList.remove("selected")
				ComponentPlacer.instance.placeCancel()
				CanvasController.instance.deactivatePanning()
				break
			default:
				break
		}

		switch (newMode) {
			case Modes.DRAG_PAN:
				this.modeSwitchButtons.modeDragPan.classList.add("selected")
				CanvasController.instance.activatePanning()
				SelectionController.instance.activateSelection()
				break
			case Modes.ERASE:
				this.modeSwitchButtons.modeEraser.classList.add("selected")
				EraseController.instance.activate()
				break
			case Modes.COMPONENT:
				this.modeSwitchButtons.modeDragPan.classList.add("selected")
				CanvasController.instance.activatePanning()
				break
			default:
				break
		}
	}

	public updateTheme() {
		if (this.darkModeLast == this.darkMode) {
			return
		}

		for (const instance of this.circuitComponents) {
			instance.updateTheme()
		}

		this.darkModeLast = this.darkMode
	}

	/**
	 * add missing fill attributes to all symbol db entries where fill is undefined --> needs explicit setting, otherwise the color theme change does strange things.
	 * called once on initialization
	 * @param {Element} node
	 */
	private preprocessSymbolColors(node: Element) {
		//exchange all explicit blacks with defaultStroke and all explicit whites with defaultFill
		node.querySelectorAll("[fill]").forEach((elem) => {
			if (elem.getAttribute("fill") == "#000") {
				elem.setAttribute("fill", defaultStroke)
			} else if (elem.getAttribute("fill") == "#fff") {
				elem.setAttribute("fill", defaultFill)
			}
		})
		node.querySelectorAll("[stroke]").forEach((elem) => {
			if (elem.getAttribute("stroke") == "#000") {
				elem.setAttribute("stroke", defaultStroke)
			} else if (elem.getAttribute("stroke") == "#fff") {
				elem.setAttribute("stroke", defaultFill)
			}
		})

		node.querySelectorAll(".fillable").forEach((elem) => {
			if (elem.getAttribute("fill") == "none") {
				elem.setAttribute("fill", "currentFill")
			}
		})

		if (node.getAttribute("fill") == "#000") {
			node.setAttribute("fill", defaultStroke)
		} else if (node.getAttribute("fill") == "#fff") {
			node.setAttribute("fill", defaultFill)
		}

		if (node.getAttribute("stroke") == "#000") {
			node.setAttribute("stroke", defaultStroke)
		} else if (node.getAttribute("stroke") == "#fff") {
			node.setAttribute("stroke", defaultFill)
		}

		this.addFill(node)
	}

	private addFill(node: Element) {
		let hasFill = node.getAttribute("fill") !== null
		if (hasFill) {
			return
		}
		for (const element of node.children) {
			if (element.nodeName === "g") {
				this.addFill(element)
			} else {
				if (!element.getAttribute("fill")) {
					element.setAttribute("fill", "currentColor")
				}
			}
		}
	}

	/**
	 * Adds a new instance to {@link circuitComponents} and adds its snapping points.
	 */
	public addComponent(circuitComponent: CircuitComponent) {
		this.circuitComponents.push(circuitComponent)
	}

	/**
	 * Removes an instance from {@link instances} and also removes its snapping points.
	 */
	public removeComponent(circuitComponent: CircuitComponent) {
		const idx = this.circuitComponents.indexOf(circuitComponent)
		if (idx > -1) {
			this.circuitComponents.splice(idx, 1)
			circuitComponent.remove()
		}
	}

	public async loadCustomSymbolsIntoSymbolDB() {
		const transaction = this.db.transaction("customSymbols", "readonly")
		const store = transaction.objectStore("customSymbols")
		const syms = await new Promise<any[]>((resolve) => {
			store.getAll().onsuccess = (ev) => resolve((ev.target as IDBRequest).result || [])
		})

		const symbolsSVGElement = document.getElementById("symbolDB")
		if (!symbolsSVGElement) return

		for (const sym of syms) {
			if (sym.isCustomSymbol) {
				// 1. 將它的 symbols XML 插入到 DOM 中
				for (const symId in sym.symbols) {
					const symXml = sym.symbols[symId]
					console.log(`[LoadCustom] Restoring symbol ID: ${symId}, XML length: ${symXml ? symXml.length : 0}`);
					if (!document.getElementById(symId)) {
						const wrapper = `<svg xmlns="http://www.w3.org/2000/svg">${symXml}</svg>`
						const parsed = new DOMParser().parseFromString(wrapper, "image/svg+xml")
						const symbolNode = parsed.querySelector("symbol")
						if (symbolNode) {
							const node = document.adoptNode(symbolNode)
							symbolsSVGElement.appendChild(node)
							console.log(`[LoadCustom] Appended symbol ${symId} to DOM. Exists?`, !!document.getElementById(symId));
						}
					}
				}
				// 2. 將 componentXml 解析並建立 ComponentSymbol
				const compWrapper = `<svg xmlns="http://www.w3.org/2000/svg">${sym.componentXml}</svg>`
				const parsedComp = new DOMParser().parseFromString(compWrapper, "image/svg+xml")
				const compElement = parsedComp.querySelector("component")
				if (compElement) {
					const compNode = document.adoptNode(compElement)
					symbolsSVGElement.appendChild(compNode)
					
					if (!this.symbols.some(s => s.tikzName === sym.tikzName)) {
						const compSymbol = new ComponentSymbol(compNode)
						compSymbol.isCustomSymbol = true
						this.symbols.push(compSymbol)
					}
				}
			}
		}
	}

	public async duplicateSymbol(originalSymbol: ComponentSymbol, newTikzName: string, categoryName: string) {
		const symbolSVGElement = document.getElementById("symbolDB")
		if (!symbolSVGElement) return

		// 1. 取得原 component XML 節點
		const originalComponentNode = Array.from(symbolSVGElement.getElementsByTagName("component"))
			.find(c => c.getAttribute("tikz") === originalSymbol.tikzName)
		if (!originalComponentNode) {
			await this.openAlert("Missing Metadata", "Could not find the metadata for the original symbol!")
			return
		}

		// 2. 複製節點並修改屬性
		const newComponentNode = originalComponentNode.cloneNode(true) as Element
		newComponentNode.setAttribute("tikz", newTikzName)
		newComponentNode.setAttribute("display", newTikzName)

		// 3. 處理 variants 及對應的 `<symbol>`
		const variants = newComponentNode.getElementsByTagName("variant")
		const symbolsMap: { [key: string]: string } = {}

		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i]
			const originalFor = variant.getAttribute("for")
			if (originalFor) {
				let originalSymbolNode = document.getElementById(originalFor)
				if (!originalSymbolNode && symbolSVGElement) {
					originalSymbolNode = symbolSVGElement.querySelector(`symbol[id="${originalFor}"], [id="${originalFor}"]`)
				}
				if (originalSymbolNode) {
					const newSymbolId = `node_custom_${newTikzName}_${i === 0 ? "default" : i}`
					const newSymbolNode = originalSymbolNode.cloneNode(true) as Element
					newSymbolNode.setAttribute("id", newSymbolId)
					
					// 插入到 DOM 中
					symbolSVGElement.appendChild(newSymbolNode)
					
					// 更新 variant 指向
					variant.setAttribute("for", newSymbolId)
					
					// 收集 XML
					symbolsMap[newSymbolId] = newSymbolNode.outerHTML
				} else {
					console.error(`[Duplicate] Could not find original symbol node for ID: ${originalFor}`);
				}
			}
		}

		// 4. 打包儲存至 IndexedDB
		const customSymbolId = "custom-" + newTikzName
		const customSymbolData = {
			id: customSymbolId,
			tikzName: newTikzName,
			displayName: newTikzName,
			isCustomSymbol: true,
			isNodeSymbol: originalSymbol.isNodeSymbol,
			baseSymbol: originalSymbol.tikzName,
			componentXml: newComponentNode.outerHTML,
			symbols: symbolsMap
		}

		// 5. 記憶體中實例化 ComponentSymbol 并推入 lists
		symbolSVGElement.appendChild(newComponentNode)
		console.log(`[Duplicate] Appended component node for ${newTikzName} to DOM. XML:`, newComponentNode.outerHTML)
		const compSymbol = new ComponentSymbol(newComponentNode)
		compSymbol.isCustomSymbol = true
		this.symbols = this.symbols.filter(s => s.tikzName !== newTikzName)
		this.symbols.push(compSymbol)

		// 6. 保存至自訂類別
		await this.addSymbolToCategory(categoryName, newTikzName, customSymbolData)
	}

	public async renameCustomGraphicsSymbol(oldTikzName: string, newTikzName: string) {
		newTikzName = newTikzName.trim()
		if (!newTikzName || newTikzName === oldTikzName) return

		const oldId = "custom-" + oldTikzName
		const newId = "custom-" + newTikzName

		// 1. 更新 customSymbols 物件儲存區
		const symTx = this.db.transaction("customSymbols", "readwrite")
		const symStore = symTx.objectStore("customSymbols")
		symStore.get(oldId).onsuccess = (ev) => {
			const sym = (ev.target as IDBRequest).result
			if (!sym) return

			// 收集舊的 symbol IDs 以便稍後在 DOM 中刪除
			const oldSymbolIds = Object.keys(sym.symbols)

			sym.id = newId
			sym.tikzName = newTikzName
			sym.displayName = newTikzName

			// 更新 componentXml 的 tikz 與 display 屬性
			const parser = new DOMParser()
			const compDoc = parser.parseFromString(sym.componentXml, "image/svg+xml")
			const compNode = compDoc.querySelector("component")!
			compNode.setAttribute("tikz", newTikzName)
			compNode.setAttribute("display", newTikzName)

			// 更新 variants 的 for 屬性及 map 中的 symbol ids
			const variants = compNode.getElementsByTagName("variant")
			const newSymbolsMap: { [key: string]: string } = {}
			for (let i = 0; i < variants.length; i++) {
				const variant = variants[i]
				const oldFor = variant.getAttribute("for")!
				const newFor = oldFor.replace(oldTikzName, newTikzName)
				variant.setAttribute("for", newFor)

				if (sym.symbols[oldFor]) {
					// 替換 symbol id 定義 XML
					const symDoc = parser.parseFromString(sym.symbols[oldFor], "image/svg+xml")
					symDoc.querySelector("symbol")!.setAttribute("id", newFor)
					newSymbolsMap[newFor] = symDoc.querySelector("symbol")!.outerHTML
				}
			}

			sym.componentXml = compNode.outerHTML
			sym.symbols = newSymbolsMap

			symStore.delete(oldId)
			symStore.put(sym)

			symTx.oncomplete = () => {
				// 2. 更新 customCategories 中的 symbolIds
				const catTx = this.db.transaction("customCategories", "readwrite")
				const catStore = catTx.objectStore("customCategories")
				catStore.getAll().onsuccess = (ev) => {
					const cats = (ev.target as IDBRequest).result || []
					for (const cat of cats) {
						const idx = cat.symbolIds.indexOf(oldTikzName)
						if (idx >= 0) {
							cat.symbolIds[idx] = newTikzName
							catStore.put(cat)
						}
					}
					catTx.oncomplete = () => {
						let adoptedComp: Element | null = null;
						// 3. 更新 DOM 中的 `#symbolDB` 節點
						const symbolDB = document.getElementById("symbolDB")
						if (symbolDB) {
							// 刪除舊的 symbols 節點
							for (const oldFor of oldSymbolIds) {
								const oldNode = document.getElementById(oldFor)
								if (oldNode) oldNode.remove()
							}
							// 刪除舊的 component 節點
							const oldCompNode = symbolDB.querySelector(`component[tikz="${oldTikzName}"]`)
							if (oldCompNode) oldCompNode.remove()

							// 加入新 id 節點
							for (const newFor in newSymbolsMap) {
								const parsedSym = parser.parseFromString(newSymbolsMap[newFor], "image/svg+xml")
								const adopted = document.adoptNode(parsedSym.firstElementChild!)
								symbolDB.appendChild(adopted)
							}
							// 加入新的 component 節點到 DOM 中，以維持與它的 symbols 相同的 ownerDocument 綁定
							adoptedComp = document.adoptNode(compNode)
							symbolDB.appendChild(adoptedComp)
						}

						// 4. 更新記憶體中 `this.symbols` 的 ComponentSymbol 實體
						const oldCompSymbolIdx = this.symbols.findIndex(s => s.tikzName === oldTikzName)
						if (oldCompSymbolIdx >= 0) {
							this.symbols.splice(oldCompSymbolIdx, 1)
						}
						const targetNode = adoptedComp || compNode
						const newCompSymbol = new ComponentSymbol(targetNode)
						this.symbols.push(newCompSymbol)

						// 5. 更新畫布上正在使用的元件的 referenceSymbol 與 tikzName 參照，並重新 update
						for (const comp of this.circuitComponents) {
							if (comp.referenceSymbol && comp.referenceSymbol.tikzName === oldTikzName) {
								comp.referenceSymbol = newCompSymbol
								if ((comp as any).displayName === oldTikzName) {
									(comp as any).displayName = newTikzName
								}
								comp.update()
							}
						}

						// 6. 重新載入與渲染左側 Offcanvas
						this.loadAndRenderCustomCategories()
					}
				}
			}
		}
	}

	public async deleteCustomGraphicsSymbol(tikzName: string) {
		const symbolId = "custom-" + tikzName

		// 1. 從所有類別中移除該 symbol id
		const catTx = this.db.transaction("customCategories", "readwrite")
		const catStore = catTx.objectStore("customCategories")
		catStore.getAll().onsuccess = (ev) => {
			const cats = (ev.target as IDBRequest).result || []
			for (const cat of cats) {
				if (cat.symbolIds.includes(tikzName)) {
					cat.symbolIds = cat.symbolIds.filter((id: string) => id !== tikzName)
					catStore.put(cat)
				}
			}

			catTx.oncomplete = () => {
				// 2. 從 customSymbols 中刪除
				const symTx = this.db.transaction("customSymbols", "readwrite")
				symTx.objectStore("customSymbols").delete(symbolId).onsuccess = () => {
					// 3. 從記憶體 `this.symbols` 移除
					this.symbols = this.symbols.filter(s => s.tikzName !== tikzName)

					// 4. 重新載入
					this.loadAndRenderCustomCategories()
				}
			}
		}
	}

	public customCategories: { name: string; symbolIds: string[] }[] = []
	public customSymbols: any[] = []

	public async loadAndRenderCustomCategories() {
		const transaction = this.db.transaction(["customCategories", "customSymbols"], "readonly")
		const catStore = transaction.objectStore("customCategories")
		const symStore = transaction.objectStore("customSymbols")

		const catsPromise = new Promise<{ name: string; symbolIds: string[] }[]>((resolve) => {
			catStore.getAll().onsuccess = (ev) => resolve((ev.target as IDBRequest).result || [])
		})
		const symsPromise = new Promise<any[]>((resolve) => {
			symStore.getAll().onsuccess = (ev) => resolve((ev.target as IDBRequest).result || [])
		})

		this.customCategories = await catsPromise
		this.customSymbols = await symsPromise

		const leftOffcanvasAccordion = document.getElementById("leftOffcanvasAccordion") as HTMLDivElement
		const leftOffcanvas: HTMLDivElement = document.getElementById("leftOffcanvas") as HTMLDivElement
		const leftOffcanvasOC = new Offcanvas(leftOffcanvas)

		// Remove any existing custom category accordion items
		const existingCustoms = leftOffcanvasAccordion.getElementsByClassName("custom-category-accordion-item")
		while (existingCustoms.length > 0) {
			existingCustoms[0].remove()
		}

		// Render each custom category
		for (const cat of this.customCategories) {
			const collapseGroupID = "collapseGroup-custom-" + cat.name.replace(/[^\d\w\-\_]+/gi, "-")

			const accordionGroup = document.createElement("div")
			accordionGroup.classList.add("accordion-item", "custom-category-accordion-item")

			const accordionItemHeader = accordionGroup.appendChild(document.createElement("h2"))
			accordionItemHeader.classList.add("accordion-header")

			// Header button
			const accordionItemButton = accordionItemHeader.appendChild(document.createElement("button"))
			accordionItemButton.classList.add("accordion-button")
			accordionItemButton.innerText = cat.name
			accordionItemButton.setAttribute("aria-controls", collapseGroupID)
			accordionItemButton.setAttribute("aria-expanded", "true")
			accordionItemButton.setAttribute("data-bs-target", "#" + collapseGroupID)
			accordionItemButton.setAttribute("data-bs-toggle", "collapse")
			accordionItemButton.type = "button"

			// Context menu for category header (e.g. Rename / Delete category)
			accordionItemButton.addEventListener("contextmenu", (ev) => {
				ev.preventDefault()
				ev.stopPropagation()
				const menu = new ContextMenu([
					{ result: "rename", iconText: "edit", text: "Rename category..." },
					{ result: "delete", iconText: "delete", text: `Delete category "${cat.name}"` }
				])
				menu.openForResult(ev.clientX, ev.clientY).then(async (res) => {
					if (res === "rename") {
						const newName = await this.openRenameModal("Rename Category", cat.name)
						if (newName) this.renameCustomCategory(cat.name, newName)
					} else if (res === "delete") {
						if (await this.openConfirm("Delete Category", `Are you sure you want to delete category "${cat.name}"?`)) {
							this.deleteCustomCategory(cat.name)
						}
					}
				}).catch(() => {})
			})

			const accordionItemCollapse = accordionGroup.appendChild(document.createElement("div"))
			accordionItemCollapse.classList.add("accordion-collapse", "collapse", "show")
			accordionItemCollapse.id = collapseGroupID
			accordionItemCollapse.setAttribute("data-bs-parent", "#leftOffcanvasAccordion")

			const accordionItemBody = accordionItemCollapse.appendChild(document.createElement("div"))
			accordionItemBody.classList.add("accordion-body", "iconLibAccordionBody")

			for (const symbolId of cat.symbolIds) {
				const standardSymbol = this.symbols.find(s => s.tikzName === symbolId)
				const customSymbol = this.customSymbols.find(s => s.id === symbolId || s.id === "custom-" + symbolId)

				if (!standardSymbol && !customSymbol) continue

				const addButton: HTMLDivElement = accordionItemBody.appendChild(document.createElement("div"))
				addButton.classList.add("libComponent")
				addButton.ariaRoleDescription = "button"

				// Context menu for symbol inside custom category
				addButton.addEventListener("contextmenu", (ev) => {
					ev.preventDefault()
					ev.stopPropagation()
					if (customSymbol) {
						if (customSymbol.isCustomSymbol) {
							// Custom graphics symbol: edit / rename / remove / delete
							const menu = new ContextMenu([
								{ result: "edit", iconText: "edit", text: "Edit Symbol..." },
								{ result: "rename", iconText: "drive_file_rename_outline", text: "Rename symbol..." },
								{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" },
								{ result: "delete", iconText: "delete", text: "Delete custom symbol definition" }
							])
							menu.openForResult(ev.clientX, ev.clientY).then(async (res) => {
								if (res === "edit") {
									SymbolEditorController.instance.open(customSymbol.id)
								} else if (res === "rename") {
									const newName = await this.openRenameModal("Rename Custom Symbol", symbolId)
									if (newName) this.renameCustomGraphicsSymbol(symbolId, newName)
								} else if (res === "remove") {
									this.removeSymbolFromCategory(cat.name, symbolId)
								} else if (res === "delete") {
									if (await this.openConfirm(
										"Delete Symbol",
										`Are you sure you want to completely delete custom symbol "${symbolId}"?\n(Components already placed on the canvas will not be affected)`
									)) {
										this.deleteCustomGraphicsSymbol(symbolId)
									}
								}
							}).catch(() => {})
						} else {
							// Subcircuit: rename / remove / delete all
							const menu = new ContextMenu([
								{ result: "rename", iconText: "edit", text: "Rename subcircuit..." },
								{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" },
								{ result: "delete", iconText: "delete", text: "Delete subcircuit definition" }
							])
							menu.openForResult(ev.clientX, ev.clientY).then(async (res) => {
								if (res === "rename") {
									const newName = await this.openRenameModal("Rename Subcircuit", customSymbol.displayName)
									if (newName) this.renameCustomSymbol(customSymbol.id, newName)
								} else if (res === "remove") {
									this.removeSymbolFromCategory(cat.name, symbolId)
								} else if (res === "delete") {
									if (await this.openConfirm(
										"Delete Subcircuit",
										`Are you sure you want to completely delete subcircuit "${customSymbol.displayName}"?\n(Components already placed on the canvas will not be affected)`
									)) {
										this.deleteCustomSymbol(symbolId)
									}
								}
							}).catch(() => {})
						}
					} else {
						// Standard symbol: only remove from category
						const menu = new ContextMenu([
							{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" }
						])
						menu.openForResult(ev.clientX, ev.clientY).then((res) => {
							if (res === "remove") this.removeSymbolFromCategory(cat.name, symbolId)
						}).catch(() => {})
					}
				})

				if (standardSymbol) {
					addButton.setAttribute("searchData", [standardSymbol.tikzName, standardSymbol.isNodeSymbol ? "node" : "path"].join(" "))
					addButton.title = standardSymbol.displayName || standardSymbol.tikzName

					const listener = (ev: MouseEvent) => {
						if (ev.button !== 0) return
						ev.preventDefault()
						this.switchMode(Modes.COMPONENT)
						if (ComponentPlacer.instance.component) {
							ComponentPlacer.instance.placeCancel()
						}
						let newComponent: CircuitComponent
						if (standardSymbol.isNodeSymbol) {
							newComponent = new NodeSymbolComponent(standardSymbol)
						} else {
							newComponent = new PathSymbolComponent(standardSymbol)
						}
						ComponentPlacer.instance.placeComponent(newComponent)
						leftOffcanvasOC.hide()
					}
					addButton.addEventListener("mouseup", listener)
					addButton.addEventListener("touchstart", listener, { passive: false })

					// Visio style double-click to edit custom symbol
					addButton.addEventListener("dblclick", (ev) => {
						ev.preventDefault()
						ev.stopPropagation()
						if (customSymbol && customSymbol.isCustomSymbol) {
							SymbolEditorController.instance.open(customSymbol.id)
						}
					})

					let svgIcon = SVG.SVG().addTo(addButton)
					let firstVariant = standardSymbol._mapping.values().toArray()[0]
					let viewBox = new SVG.Box(firstVariant ? firstVariant.viewBox : new SVG.Box(0, 0, 30, 15))
					let maxStroke = Number.isFinite(standardSymbol.maxStroke) ? standardSymbol.maxStroke : 0
					viewBox.width += maxStroke
					viewBox.height += maxStroke
					viewBox.x -= maxStroke / 2
					viewBox.y -= maxStroke / 2
					if (!Number.isFinite(viewBox.x) || !Number.isFinite(viewBox.y) || !Number.isFinite(viewBox.w) || !Number.isFinite(viewBox.h)) {
						viewBox = new SVG.Box(0, 0, 30, 15)
					}
					svgIcon.viewbox(viewBox).width(viewBox.width).height(viewBox.height)
					let use = svgIcon.use(standardSymbol.symbolElement.id())
					use.width(standardSymbol.viewBox.width).height(standardSymbol.viewBox.height)
					use.stroke(defaultStroke).fill(defaultFill).node.style.color = defaultStroke
				} else if (customSymbol) {
					addButton.setAttribute("searchData", customSymbol.displayName || customSymbol.tikzName)
					addButton.title = customSymbol.displayName

					const listener = (ev: MouseEvent) => {
						if (ev.button !== 0) return
						ev.preventDefault()
						this.switchMode(Modes.COMPONENT)
						if (ComponentPlacer.instance.component) {
							ComponentPlacer.instance.placeCancel()
						}
						const sub = SubcircuitComponent.fromJson(customSymbol.subcircuitData)
						ComponentPlacer.instance.placeComponent(sub)
						leftOffcanvasOC.hide()
					}
					addButton.addEventListener("mouseup", listener)
					addButton.addEventListener("touchstart", listener, { passive: false })

					// Invalidate stale preview (legacy: contained <use> referencing doc-level defs)
					if (customSymbol.svgPreview && customSymbol.svgPreview.includes("<use ")) {
						customSymbol.svgPreview = null
					}
					if (customSymbol.svgPreview) {
						addButton.innerHTML = customSymbol.svgPreview
					} else {
						// Generate preview on the fly and save to DB
						this.generateSubcircuitSvgPreview(customSymbol.subcircuitData).then((preview) => {
							if (preview) {
								customSymbol.svgPreview = preview
								addButton.innerHTML = preview
								const symTx = this.db.transaction("customSymbols", "readwrite")
								symTx.objectStore("customSymbols").put(customSymbol)
							} else {
								// fallback to original placeholder
								let svgIcon = SVG.SVG().addTo(addButton)
								svgIcon.viewbox(0, 0, 30, 15).width(30).height(15)
								// Draw a cute Visio style block
								svgIcon.rect(26, 12).move(2, 1.5).fill("none").stroke({ color: defaultStroke, width: 1 })
								svgIcon.text((add) => {
									add.tspan(customSymbol.displayName.substring(0, 4)).font({ size: 6 }).fill({ color: defaultStroke }).move(5, 9)
								})
							}
						})
					}
				}
			}

			// Prepend custom categories to accordion so they appear at the top of the Symbols drawer!
			if (leftOffcanvasAccordion.firstChild) {
				leftOffcanvasAccordion.insertBefore(accordionGroup, leftOffcanvasAccordion.firstChild)
			} else {
				leftOffcanvasAccordion.appendChild(accordionGroup)
			}
		}
	}

	public async addCustomCategory(name: string) {
		name = name.trim()
		if (!name) return
		const transaction = this.db.transaction("customCategories", "readwrite")
		const store = transaction.objectStore("customCategories")
		store.put({ name, symbolIds: [] }).onsuccess = () => {
			this.loadAndRenderCustomCategories()
		}
	}

	public async deleteCustomCategory(name: string) {
		const transaction = this.db.transaction("customCategories", "readwrite")
		const store = transaction.objectStore("customCategories")
		store.delete(name).onsuccess = () => {
			this.loadAndRenderCustomCategories()
		}
	}

	/**
	 * Opens a Bootstrap Modal for user to input a new name.
	 * Returns the trimmed string, or null if cancelled / empty.
	 */
	private openRenameModal(title: string, currentName: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("renameModal") as HTMLDivElement
			const input = document.getElementById("renameModalInput") as HTMLInputElement
			const label = document.getElementById("renameModalLabel") as HTMLElement
			const confirmBtn = document.getElementById("renameModalConfirm") as HTMLButtonElement

			label.textContent = title
			input.value = currentName

			const bsModal = new Modal(modalEl)
			let isConfirmed = false
			let resolvedValue: string | null = null

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				input.removeEventListener("keydown", onKeydown)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
			}
			const onConfirm = () => {
				resolvedValue = input.value.trim() || null
				isConfirmed = true
				bsModal.hide()
			}
			const onDismiss = () => {
				cleanup()
				resolve(isConfirmed ? resolvedValue : null)
			}
			const onKeydown = (ev: KeyboardEvent) => {
				if (ev.key === "Enter") onConfirm()
			}

			confirmBtn.addEventListener("click", onConfirm)
			input.addEventListener("keydown", onKeydown)
			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })
			modalEl.addEventListener("shown.bs.modal", () => { input.focus(); input.select() }, { once: true })

			bsModal.show()
		})
	}

	/**
	 * Opens a custom Bootstrap Prompt Modal with English UI.
	 */
	public openPrompt(title: string, message: string, defaultValue = ""): Promise<string | null> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("customPromptModal") as HTMLDivElement
			const input = document.getElementById("customPromptModalInput") as HTMLInputElement
			const label = document.getElementById("customPromptModalLabel") as HTMLElement
			const messageEl = document.getElementById("customPromptModalMessage") as HTMLElement
			const confirmBtn = document.getElementById("customPromptModalConfirm") as HTMLButtonElement

			label.textContent = title
			messageEl.textContent = message
			input.value = defaultValue

			const bsModal = new Modal(modalEl)
			let isConfirmed = false
			let resolvedValue: string | null = null

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				input.removeEventListener("keydown", onKeydown)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
			}
			const onConfirm = () => {
				resolvedValue = input.value.trim() || null
				isConfirmed = true
				bsModal.hide()
			}
			const onDismiss = () => {
				cleanup()
				resolve(isConfirmed ? resolvedValue : null)
			}
			const onKeydown = (ev: KeyboardEvent) => {
				if (ev.key === "Enter") onConfirm()
			}

			confirmBtn.addEventListener("click", onConfirm)
			input.addEventListener("keydown", onKeydown)
			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })
			modalEl.addEventListener("shown.bs.modal", () => { input.focus(); input.select() }, { once: true })

			bsModal.show()
		})
	}

	/**
	 * Opens a custom Bootstrap Confirm Modal with English UI.
	 */
	public openConfirm(title: string, message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("customConfirmModal") as HTMLDivElement
			const label = document.getElementById("customConfirmModalLabel") as HTMLElement
			const messageEl = document.getElementById("customConfirmModalMessage") as HTMLElement
			const confirmBtn = document.getElementById("customConfirmModalConfirm") as HTMLButtonElement

			label.textContent = title
			messageEl.textContent = message

			const bsModal = new Modal(modalEl)
			let isConfirmed = false

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
			}
			const onConfirm = () => {
				isConfirmed = true
				bsModal.hide()
			}
			const onDismiss = () => {
				cleanup()
				resolve(isConfirmed)
			}

			confirmBtn.addEventListener("click", onConfirm)
			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })

			bsModal.show()
		})
	}

	/**
	 * Opens a custom Bootstrap message modal for system notifications.
	 */
	public openAlert(title: string, message: string): Promise<void> {
		return new Promise((resolve) => {
			const modalEl = document.getElementById("systemMessageModal") as HTMLDivElement
			const label = document.getElementById("systemMessageModalLabel") as HTMLElement
			const messageEl = document.getElementById("systemMessageModalMessage") as HTMLElement
			const confirmBtn = document.getElementById("systemMessageModalConfirm") as HTMLButtonElement

			label.textContent = title
			messageEl.textContent = message

			const bsModal = new Modal(modalEl)

			const cleanup = () => {
				confirmBtn.removeEventListener("click", onConfirm)
				modalEl.removeEventListener("hidden.bs.modal", onDismiss)
			}
			const onConfirm = () => bsModal.hide()
			const onDismiss = () => {
				cleanup()
				resolve()
			}

			confirmBtn.addEventListener("click", onConfirm)
			modalEl.addEventListener("hidden.bs.modal", onDismiss, { once: true })

			bsModal.show()
		})
	}

	/**
	 * Renames a custom category. Because keyPath = "name", we delete + re-add.
	 * Subcircuit displayNames/tikzNames are NOT changed (category is just a container).
	 */
	public async renameCustomCategory(oldName: string, newName: string) {
		newName = newName.trim()
		if (!newName || newName === oldName) return

		const transaction = this.db.transaction("customCategories", "readwrite")
		const catStore = transaction.objectStore("customCategories")
		catStore.get(oldName).onsuccess = (ev) => {
			const cat = (ev.target as IDBRequest).result
			if (!cat) return
			catStore.delete(oldName)
			cat.name = newName
			catStore.put(cat)
			transaction.oncomplete = () => this.loadAndRenderCustomCategories()
		}
	}

	/**
	 * Renames a custom subcircuit symbol: updates DB record, all category symbolIds,
	 * and any placed SubcircuitComponents on the canvas.
	 */
	public async renameCustomSymbol(symbolId: string, newName: string) {
		newName = newName.trim()
		if (!newName) return

		const symTx = this.db.transaction("customSymbols", "readwrite")
		const symStore = symTx.objectStore("customSymbols")
		symStore.get(symbolId).onsuccess = (ev) => {
			const sym = (ev.target as IDBRequest).result
			if (!sym) return
			const oldName = sym.displayName
			const newId = "subcircuit-" + newName

			sym.displayName = newName
			sym.tikzName = newName
			sym.id = newId
			if (sym.subcircuitData) {
				sym.subcircuitData.displayName = newName
			}

			symStore.delete(symbolId)
			symStore.put(sym)
			symTx.oncomplete = () => {
				this._updateSymbolIdInCategories(symbolId, newId, oldName, newName)
			}
		}
	}

	/** Updates all category symbolIds after a subcircuit rename, then syncs canvas components. */
	private _updateSymbolIdInCategories(oldId: string, newId: string, oldName: string, newName: string) {
		const catTx = this.db.transaction("customCategories", "readwrite")
		const catStore = catTx.objectStore("customCategories")
		catStore.getAll().onsuccess = (ev) => {
			const cats: { name: string; symbolIds: string[] }[] = (ev.target as IDBRequest).result || []
			for (const cat of cats) {
				const idx = cat.symbolIds.indexOf(oldId)
				if (idx >= 0) {
					cat.symbolIds[idx] = newId
					catStore.put(cat)
				}
			}
			// Sync canvas SubcircuitComponents
			for (const comp of this.circuitComponents) {
				if ((comp as any).displayName === oldName) {
					(comp as any).displayName = newName
				}
			}
			catTx.oncomplete = () => this.loadAndRenderCustomCategories()
		}
	}

	/**
	 * Permanently deletes a subcircuit definition:
	 * removes it from all categories and from customSymbols DB.
	 * Canvas components already placed are NOT removed.
	 */
	public async deleteCustomSymbol(symbolId: string) {
		const catTx = this.db.transaction("customCategories", "readwrite")
		const catStore = catTx.objectStore("customCategories")
		catStore.getAll().onsuccess = (ev) => {
			const cats: { name: string; symbolIds: string[] }[] = (ev.target as IDBRequest).result || []
			for (const cat of cats) {
				if (cat.symbolIds.includes(symbolId)) {
					cat.symbolIds = cat.symbolIds.filter((id: string) => id !== symbolId)
					catStore.put(cat)
				}
			}
			catTx.oncomplete = () => {
				const symTx = this.db.transaction("customSymbols", "readwrite")
				symTx.objectStore("customSymbols").delete(symbolId).onsuccess = () => {
					this.loadAndRenderCustomCategories()
				}
			}
		}
	}

	public async addSymbolToCategory(categoryName: string, symbolId: string, customSymbolData?: any) {
		if (customSymbolData && customSymbolData.subcircuitData && !customSymbolData.svgPreview) {
			try {
				const preview = await this.generateSubcircuitSvgPreview(customSymbolData.subcircuitData)
				if (preview) {
					customSymbolData.svgPreview = preview
				}
			} catch (e) {
				console.error("Failed to generate preview during addSymbolToCategory:", e)
			}
		}

		const transaction = this.db.transaction(["customCategories", "customSymbols"], "readwrite")
		const catStore = transaction.objectStore("customCategories")
		const symStore = transaction.objectStore("customSymbols")

		if (customSymbolData) {
			symStore.put(customSymbolData)
		}

		catStore.get(categoryName).onsuccess = (ev) => {
			const cat = (ev.target as IDBRequest).result
			if (cat) {
				if (!cat.symbolIds.includes(symbolId)) {
					cat.symbolIds.push(symbolId)
					catStore.put(cat).onsuccess = () => {
						this.loadAndRenderCustomCategories()
					}
				}
			}
		}
	}

	public async removeSymbolFromCategory(categoryName: string, symbolId: string) {
		const transaction = this.db.transaction("customCategories", "readwrite")
		const store = transaction.objectStore("customCategories")
		store.get(categoryName).onsuccess = (ev) => {
			const cat = (ev.target as IDBRequest).result
			if (cat) {
				cat.symbolIds = cat.symbolIds.filter((id: string) => id !== symbolId)
				store.put(cat).onsuccess = () => {
					this.loadAndRenderCustomCategories()
				}
			}
		}
	}

	public async createSubcircuitFromSelection() {
		let selected = SelectionController.instance.currentlySelectedComponents
		if (selected.length === 0) {
			await this.openAlert("Create Custom Component", "Please select components to create a custom component.")
			return
		}

		let groupComp: GroupComponent
		if (selected.length === 1 && (selected[0] instanceof GroupComponent || selected[0].constructor.name === "GroupComponent" || selected[0].constructor.name === "SubcircuitComponent")) {
			groupComp = selected[0] as GroupComponent
		} else {
			// 先將複數元件進行 Group
			GroupComponent.group(selected)
			const newSelected = SelectionController.instance.currentlySelectedComponents
			if (newSelected.length === 1 && (newSelected[0] instanceof GroupComponent || newSelected[0].constructor.name === "GroupComponent")) {
				groupComp = newSelected[0] as GroupComponent
			} else {
				await this.openAlert("Create Custom Component", "Failed to create a group, cannot save as custom component.")
				return
			}
		}

		this.openSaveSymbolModal(groupComp)
	}

	private openSaveSymbolModal(group: GroupComponent) {
		const modalEl = document.getElementById("saveSymbolModal") as HTMLDivElement
		const nameInput = document.getElementById("saveSymbolNameInput") as HTMLInputElement
		const categorySelect = document.getElementById("saveSymbolCategorySelect") as HTMLSelectElement
		const newCategoryContainer = document.getElementById("saveSymbolNewCategoryContainer") as HTMLDivElement
		const newCategoryInput = document.getElementById("saveSymbolNewCategoryInput") as HTMLInputElement
		const confirmBtn = document.getElementById("saveSymbolModalConfirm") as HTMLButtonElement

		nameInput.value = group.displayName !== "Group" ? group.displayName : ""
		newCategoryInput.value = ""
		newCategoryContainer.classList.add("d-none")

		categorySelect.innerHTML = ""
		for (const cat of this.customCategories) {
			const opt = document.createElement("option")
			opt.value = cat.name
			opt.textContent = cat.name
			categorySelect.appendChild(opt)
		}

		if (this.customCategories.length === 0) {
			const opt = document.createElement("option")
			opt.value = "我的最愛"
			opt.textContent = "我的最愛"
			categorySelect.appendChild(opt)
		}

		const newCatOpt = document.createElement("option")
		newCatOpt.value = "__NEW_CATEGORY__"
		newCatOpt.textContent = "+ 新增分類..."
		categorySelect.appendChild(newCatOpt)

		const onCategoryChange = () => {
			if (categorySelect.value === "__NEW_CATEGORY__") {
				newCategoryContainer.classList.remove("d-none")
			} else {
				newCategoryContainer.classList.add("d-none")
			}
		}
		categorySelect.addEventListener("change", onCategoryChange)

		const bsModal = new Modal(modalEl)

		const cleanup = () => {
			categorySelect.removeEventListener("change", onCategoryChange)
			confirmBtn.onclick = null
		}

		confirmBtn.onclick = async () => {
			let name = nameInput.value.trim()
			if (!name) {
				await this.openAlert("Save Custom Component", "Please enter a component name.")
				return
			}

			let finalName = name
			let suffix = 2
			while (this.customSymbols.some(s => s.displayName === finalName)) {
				finalName = `${name} (${suffix})`
				suffix++
			}

			let categoryName = categorySelect.value
			if (categoryName === "__NEW_CATEGORY__") {
				categoryName = newCategoryInput.value.trim()
				if (!categoryName) {
					await this.openAlert("Save Custom Component", "Please enter a new category name.")
					return
				}
				if (!this.customCategories.some(c => c.name === categoryName)) {
					await this.addCustomCategory(categoryName)
				}
			}

			const idx = this.circuitComponents.indexOf(group)
			if (idx === -1) {
				await this.openAlert("Save Custom Component", "Cannot find the group object; unable to save.")
				bsModal.hide()
				return
			}

			const children = [...group.groupedComponents]
			
			// 移除 GroupComponent，但把子元件先放回 circuitComponents
			this.circuitComponents.splice(idx, 1, ...children)
			group.groupedComponents = []
			group.selectionElement?.remove()
			group.visualization.remove()

			// 建立 SubcircuitComponent
			const sub = new SubcircuitComponent(finalName, children)
			const subJson = sub.toJson()

			const symbolId = "subcircuit-" + finalName
			const customSymbolData = {
				id: symbolId,
				type: "subcircuit",
				tikzName: finalName,
				displayName: finalName,
				isNodeSymbol: false,
				subcircuitData: subJson
			}

			await this.addSymbolToCategory(categoryName, symbolId, customSymbolData)

			Undo.addState()
			bsModal.hide()
		}

		modalEl.addEventListener("hidden.bs.modal", cleanup, { once: true })
		modalEl.addEventListener("shown.bs.modal", () => {
			nameInput.focus()
			nameInput.select()
		}, { once: true })

		bsModal.show()
	}

	private async generateSubcircuitSvgPreview(subcircuitData: any): Promise<string | null> {
		if (!subcircuitData || !subcircuitData.components) return null

		const tempComponents: CircuitComponent[] = []
		const offscreenSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		offscreenSvg.setAttribute("style", "position: absolute; top: -9999px; left: -9999px; visibility: hidden; width: 500px; height: 500px;")
		document.body.appendChild(offscreenSvg)

		try {
			for (const saveObj of subcircuitData.components) {
				const comp = CircuitComponent.fromJson(saveObj)
				if (comp) {
					tempComponents.push(comp)
					comp.update()
				}
			}

			if (tempComponents.length === 0) {
				document.body.removeChild(offscreenSvg)
				return null
			}

			const defsMap = new Map<string, SVG.Element>()
			const innerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
			offscreenSvg.appendChild(innerGroup)

			for (const comp of tempComponents) {
				const clonedNode = comp.toSVG(defsMap).node
				innerGroup.appendChild(clonedNode)
			}

			// Inline all <use> elements so the final SVG is self-contained (no doc-level defs needed)
			const uses = Array.from(innerGroup.querySelectorAll("use"))
			for (const use of uses) {
				const href = use.getAttribute("xlink:href") || use.getAttribute("href")
				if (!href?.startsWith("#")) continue
				const id = href.slice(1)
				// Look in defsMap first (SVG.Element), then fall back to document
				const symbolNode: Element | null = defsMap.has(id)
					? (defsMap.get(id)!.node as Element)
					: document.getElementById(id)
				if (!symbolNode) continue

				// Wrap symbol's children in a <g>, applying the <use>'s transform, position, scale and inherited colors
				const g = document.createElementNS("http://www.w3.org/2000/svg", "g")
				
				let finalTransform = ""
				const ux = parseFloat(use.getAttribute("x") || "0")
				const uy = parseFloat(use.getAttribute("y") || "0")
				if (ux !== 0 || uy !== 0) {
					finalTransform += `translate(${ux}, ${uy}) `
				}
				const transform = use.getAttribute("transform")
				if (transform) {
					finalTransform += transform + " "
				}
				if (symbolNode.tagName.toLowerCase() === "symbol") {
					const viewBoxStr = symbolNode.getAttribute("viewBox")
					if (viewBoxStr) {
						const parts = viewBoxStr.trim().split(/[\s,]+/)
						if (parts.length === 4) {
							const vx = parseFloat(parts[0])
							const vy = parseFloat(parts[1])
							const vw = parseFloat(parts[2])
							const vh = parseFloat(parts[3])
							
							const uwAttr = use.getAttribute("width")
							const uhAttr = use.getAttribute("height")
							const uw = uwAttr ? parseFloat(uwAttr) : vw
							const uh = uhAttr ? parseFloat(uhAttr) : vh
							
							const scaleX = uw / vw
							const scaleY = uh / vh
							
							finalTransform += `scale(${scaleX}, ${scaleY}) translate(${-vx}, ${-vy}) `
						}
					}
				}
				if (finalTransform.trim()) {
					g.setAttribute("transform", finalTransform.trim())
				}

				const cls = use.getAttribute("class")
				if (cls) g.setAttribute("class", cls)

				const stroke = use.getAttribute("stroke") || use.style.stroke
				const fill = use.getAttribute("fill") || use.style.fill
				const color = use.getAttribute("color") || use.style.color
				if (stroke) g.setAttribute("stroke", stroke)
				if (fill) g.setAttribute("fill", fill)
				if (color) g.setAttribute("color", color)

				// Symbol children (skip <title>)
				const source = symbolNode.tagName.toLowerCase() === "symbol" ? symbolNode : symbolNode
				for (const child of Array.from(source.childNodes)) {
					if ((child as Element).tagName === "title") continue
					g.appendChild(child.cloneNode(true))
				}
				use.parentNode?.replaceChild(g, use)
			}

			await new Promise((resolve) => requestAnimationFrame(resolve))
			const bbox = innerGroup.getBBox()

			if (bbox.width === 0 && bbox.height === 0) {
				document.body.removeChild(offscreenSvg)
				return null
			}

			const padding = 5
			const finalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
			finalSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`)
			finalSvg.setAttribute("width", "48")
			finalSvg.setAttribute("height", "48")
			finalSvg.appendChild(innerGroup)

			document.body.removeChild(offscreenSvg)
			return new XMLSerializer().serializeToString(finalSvg)
		} catch (err) {
			console.error("Error generating subcircuit preview:", err)
			if (offscreenSvg.parentNode) document.body.removeChild(offscreenSvg)
			return null
		} finally {
			for (const comp of tempComponents) {
				try {
					this.removeComponent(comp)
				} catch (e) {
					console.error("Error cleaning up temporary component", e)
				}
			}
		}
	}

	public getCustomSubcircuitsTikzset(): string {
		const subs = this.circuitComponents.filter(c => c.constructor.name === "SubcircuitComponent" || (c as any).groupedComponents && (c as any).displayName && c.toTikzString().includes("pic")) as SubcircuitComponent[]
		if (subs.length === 0) return ""

		const processed = new Set<string>()
		const definitions: string[] = []

		for (const sub of subs) {
			if (processed.has(sub.displayName)) continue
			processed.add(sub.displayName)

			const originalPos = sub.position
			const rel = new SVG.Point(0, 0).sub(originalPos)
			for (const component of sub.groupedComponents) {
				component.moveRel(rel)
			}
			const lines = sub.groupedComponents.map(c => "    " + c.toTikzString())
			const relBack = originalPos.sub(new SVG.Point(0, 0))
			for (const component of sub.groupedComponents) {
				component.moveRel(relBack)
			}

			definitions.push(`  ${sub.displayName}/.pic={\n${lines.join("\n")}\n  }`)
		}

		return `\\tikzset{\n${definitions.join(",\n")}\n}`
	}

	public getCustomSymbolsTikzset(): string {
		const customSymbolNames = new Set<string>()
		for (const comp of this.circuitComponents) {
			if ((comp as any).referenceSymbol && (comp as any).referenceSymbol.isCustomSymbol) {
				customSymbolNames.add((comp as any).referenceSymbol.tikzName)
			}
		}

		if (customSymbolNames.size === 0) return ""

		function convertPathDToTikz(d: string, midPoint: SVG.Point): string {
			console.log("[convertPathDToTikz] input d:", d)
			const tokens = d.match(/[a-df-z]|-?\d*\.?\d+(e[-+]?\d+)?/ig) || []
			let tikzPath = ""
			let cx = 0, cy = 0
			let startX = 0, startY = 0
			let currentCmd = ""
			let i = 0

			const toTikzX = (x: number) => ((x - midPoint.x) * (127 / 4800)).toFixed(3)
			const toTikzY = (y: number) => (-(y - midPoint.y) * (127 / 4800)).toFixed(3)

			while (i < tokens.length) {
				const token = tokens[i]
				if (/[a-df-z]/i.test(token)) {
					currentCmd = token
					i++
				} else {
					if (!currentCmd) {
						i++
						continue
					}
				}

				const isRelative = currentCmd === currentCmd.toLowerCase()
				const upperCmd = currentCmd.toUpperCase()

				if (upperCmd === "M") {
					if (i + 1 < tokens.length) {
						let nx = parseFloat(tokens[i])
						let ny = parseFloat(tokens[i+1])
						if (isNaN(nx) || isNaN(ny)) { i += 2; continue; }
						if (isRelative) {
							cx += nx
							cy += ny
						} else {
							cx = nx
							cy = ny
						}
						startX = cx
						startY = cy
						tikzPath += ` (${toTikzX(cx)}, ${toTikzY(cy)})`
						i += 2
						currentCmd = isRelative ? "l" : "L"
					} else {
						i++
					}
				} else if (upperCmd === "L") {
					if (i + 1 < tokens.length) {
						let nx = parseFloat(tokens[i])
						let ny = parseFloat(tokens[i+1])
						if (isNaN(nx) || isNaN(ny)) { i += 2; continue; }
						if (isRelative) {
							cx += nx
							cy += ny
						} else {
							cx = nx
							cy = ny
						}
						tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
						i += 2
					} else {
						i++
					}
				} else if (upperCmd === "H") {
					if (i < tokens.length) {
						let nx = parseFloat(tokens[i])
						if (isNaN(nx)) { i++; continue; }
						if (isRelative) {
							cx += nx
						} else {
							cx = nx
						}
						tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
						i++
					}
				} else if (upperCmd === "V") {
					if (i < tokens.length) {
						let ny = parseFloat(tokens[i])
						if (isNaN(ny)) { i++; continue; }
						if (isRelative) {
							cy += ny
						} else {
							cy = ny
						}
						tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
						i++
					}
				} else if (upperCmd === "C") {
					if (i + 5 < tokens.length) {
						let x1 = parseFloat(tokens[i])
						let y1 = parseFloat(tokens[i+1])
						let x2 = parseFloat(tokens[i+2])
						let y2 = parseFloat(tokens[i+3])
						let x = parseFloat(tokens[i+4])
						let y = parseFloat(tokens[i+5])
						
						if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x) || isNaN(y)) {
							i += 6
							continue
						}

						if (isRelative) {
							x1 += cx; y1 += cy
							x2 += cx; y2 += cy
							x += cx; y += cy
						}
						
						tikzPath += ` .. controls (${toTikzX(x1)}, ${toTikzY(y1)}) and (${toTikzX(x2)}, ${toTikzY(y2)}) .. (${toTikzX(x)}, ${toTikzY(y)})`
						cx = x
						cy = y
						i += 6
					} else {
						i++
					}
				} else if (upperCmd === "Z") {
					tikzPath += " -- cycle"
					cx = startX
					cy = startY
					i++
				} else {
					i++
				}
			}
			const res = tikzPath.trim()
			console.log("[convertPathDToTikz] output tikzPath:", res)
			return res
		}

		const definitions: string[] = []

		for (const tikzName of customSymbolNames) {
			const customSymbol = this.customSymbols.find(s => s.tikzName === tikzName)
			if (!customSymbol) continue

			const baseSymbol = customSymbol.baseSymbol || (tikzName.toLowerCase().includes("pmos") ? "pmos" : "nmos")

			const compSymbol = this.symbols.find(s => s.tikzName === tikzName)
			if (compSymbol) {
				const variants = Array.from(compSymbol._mapping.values())
				const variant = variants[0]
				if (variant && variant.symbol) {
					const mid = variant.mid
					const drawCommands: string[] = []

					const collectDrawCommands = (node: Element) => {
						const tag = node.tagName.toLowerCase()
						const sw = node.getAttribute("stroke-width") || "0.4"
						
						if (tag === "line") {
							const dx1 = (parseFloat(node.getAttribute("x1") || "0") - mid.x) * (127 / 4800)
							const dy1 = -(parseFloat(node.getAttribute("y1") || "0") - mid.y) * (127 / 4800)
							const dx2 = (parseFloat(node.getAttribute("x2") || "0") - mid.x) * (127 / 4800)
							const dy2 = -(parseFloat(node.getAttribute("y2") || "0") - mid.y) * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dx1.toFixed(3)}, ${dy1.toFixed(3)}) -- (${dx2.toFixed(3)}, ${dy2.toFixed(3)});`)
						} else if (tag === "circle") {
							const dcx = (parseFloat(node.getAttribute("cx") || "0") - mid.x) * (127 / 4800)
							const dcy = -(parseFloat(node.getAttribute("cy") || "0") - mid.y) * (127 / 4800)
							const dr = parseFloat(node.getAttribute("r") || "0") * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dcx.toFixed(3)}, ${dcy.toFixed(3)}) circle (${dr.toFixed(3)});`)
						} else if (tag === "rect") {
							if (node.classList.contains("clickBackground")) return
							const rx = parseFloat(node.getAttribute("x") || "0")
							const ry = parseFloat(node.getAttribute("y") || "0")
							const rw = parseFloat(node.getAttribute("width") || "0")
							const rh = parseFloat(node.getAttribute("height") || "0")
							const dx1 = (rx - mid.x) * (127 / 4800)
							const dy1 = -(ry - mid.y) * (127 / 4800)
							const dx2 = (rx + rw - mid.x) * (127 / 4800)
							const dy2 = -(ry + rh - mid.y) * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dx1.toFixed(3)}, ${dy1.toFixed(3)}) rectangle (${dx2.toFixed(3)}, ${dy2.toFixed(3)});`)
						} else if (tag === "path") {
							const d = node.getAttribute("d") || ""
							const tikzPath = convertPathDToTikz(d, mid)
							if (tikzPath) {
								const cmd = `\\draw [line width=${sw}pt] ${tikzPath};`
								console.log("[collectDrawCommands] path push:", cmd)
								drawCommands.push(cmd)
							}
						} else if (tag === "g") {
							for (let i = 0; i < node.children.length; i++) {
								collectDrawCommands(node.children[i])
							}
						}
					}

					const symbolNode = variant.symbol.node as any
					for (let i = 0; i < symbolNode.children.length; i++) {
						collectDrawCommands(symbolNode.children[i])
					}

					if (drawCommands.length > 0) {
						definitions.push(`  ${tikzName}/.style={\n    ${baseSymbol},\n    draw=none,\n    fill=none,\n    append after command={\n      \\begin{scope}[shift={(\\tikzlastnode.center)}]\n        ${drawCommands.join("\n        ")}\n      \\end{scope}\n    }\n  }`)
						continue
					}
				}
			}

			definitions.push(`  ${tikzName}/.style={${baseSymbol}}`)
		}

		return `\\tikzset{\n${definitions.join(",\n")}\n}`
	}
}


