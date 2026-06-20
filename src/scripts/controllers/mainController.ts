import * as SVG from "@svgdotjs/svg.js"
import { Button as _bootstrapButton, Collapse as _bootstrapCollapse, Offcanvas, Tooltip } from "bootstrap"
import "../utils/impSVGNumber"
import { waitForElementLoaded } from "../utils/domWatcher"
import hotkeys from "hotkeys-js"
import { version } from "../../../package.json"
import { TabManagementController } from "./tabManagementController"
import { CustomSymbolDrawerController } from "./customSymbolDrawerController"
import { CustomSymbolSaveController } from "./customSymbolSaveController"
import { CustomSymbolSelectionController } from "./customSymbolSelectionController"
import { SymbolLibraryMenuController } from "./symbolLibraryMenuController"
import { CustomSymbolApplicationService } from "../services/customSymbolApplicationService"
import { CustomSymbolExportService } from "../services/customSymbolExportService"
import type { CustomSymbolRecord } from "../services/customSymbolService"
import { ModalDialogService } from "../services/modalDialogService"
import { getAppRuntime } from "../services/appRuntime"
import type { BroadcastMessage, BroadcastMessageType } from "../services/tabBroadcastService"
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

const applyAndRenderCustomSymbolState = (
	controller: { applyCustomSymbolState: (state: { customCategories: { name: string; symbolIds: string[] }[]; customSymbols: CustomSymbolRecord[] }) => void; renderCustomCategories: () => void },
	state: { customCategories: { name: string; symbolIds: string[] }[]; customSymbols: CustomSymbolRecord[] }
) => {
	controller.applyCustomSymbolState(state)
	controller.renderCustomCategories()
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
	private readonly tabManagementController = new TabManagementController()
	private readonly customSymbolDrawerController = new CustomSymbolDrawerController()
	private readonly customSymbolSaveController = new CustomSymbolSaveController()
	private readonly customSymbolSelectionController = new CustomSymbolSelectionController()
	private readonly symbolLibraryMenuController = new SymbolLibraryMenuController()
	private readonly modalDialogService = new ModalDialogService()
	private readonly customSymbolExportService = new CustomSymbolExportService()

	public designName: TextProperty
	public pendingLoadData: SaveFileFormat | null = null

	private db: IDBDatabase
	private readonly appRuntime = getAppRuntime()
	private readonly indexedDbService = this.appRuntime.createIndexedDbService()
	private readonly tabApplicationService = this.appRuntime.createTabApplicationService<SaveFileFormat, CanvasSettings>(
		() => this.db,
		(data) => data.components.length > 0
	)
	private readonly tabBroadcastService = this.appRuntime.createTabBroadcastService()
	private readonly tabLifecycleService = this.appRuntime.createTabLifecycleService<SaveFileFormat, CanvasSettings>()
	private readonly customSymbolApplicationService: CustomSymbolApplicationService =
		this.appRuntime.createCustomSymbolApplicationService(() => this.db)
	private readonly symbolLibraryService = this.appRuntime.createSymbolLibraryService()

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

			this.tabApplicationService.updateDesignName(this.tabID, MainController.instance.designName.value || undefined).then((updated) => {
				if (!updated) return
				MainController.instance.sendBroadcastMessage("update")
			})
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
			
			TemplateController.instance.initialize().catch((err) => console.error("Error loading templates:", err))

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
		this.tabLifecycleService.clearLegacyStorage(localStorage, sessionStorage)

		const defaultSettings: CanvasSettings = {}

		this.indexedDbService.openDatabase().then((db) => {
			MainController.instance.db = db
			dbResolve(MainController.instance.db)

			this.tabLifecycleService.bindPersistenceHandlers(window, document, (closeTab = true) => this.saveCurrentState(closeTab))
			this.tabLifecycleService
				.initializeCurrentTab(
					window.location.href,
					emtpySaveState,
					defaultSettings,
					(requestedId, data, settings) => this.tabApplicationService.initializeTab(requestedId, data, settings),
					(session) => {
						MainController.instance.tabID = session.tabId
						MainController.instance.designName.updateValue(session.designName ?? "", true, true)
						CanvasController.instance.setSettings(session.settings)
						MainController.instance.pendingLoadData = session.pendingData
					}
				)
				.then(() => {
					MainController.instance.sendBroadcastMessage("update")
				})
		})

		//settings modal
		this.tabManagementController.onShow(() => {
			this.saveCurrentState(false)
			this.tabApplicationService.getTabManagementSummary(
				MainController.instance.tabID,
				(data) => memorySizeOf(data),
				(data) => countComponents(data.components)
			).then((summary) => {
				this.tabManagementController.renderSummary(summary, {
					openTab: (url) => window.open(url, "_blank"),
					deleteTab: (tabId) => {
						this.tabApplicationService.deleteTab(tabId).then(() => {
							this.tabManagementController.requestRefresh()
							MainController.instance.sendBroadcastMessage("update")
						})
					},
					highlightTab: (tabId) => MainController.instance.sendBroadcastMessage("show", tabId),
					openNewTab: (url) => window.open(url, "_blank"),
				})
			})
		})

		this.tabManagementController.onProbeRefresh(() => {
			// set all open states in indexedDB to false, then send a probe message to all tabs
			this.tabApplicationService.markOtherTabsClosedForProbe(MainController.instance.tabID).then(() => {
				// after all tabs are closed (in the db, not the tab in the browser), send a probe message to all tabs
				// this will cause all open tabs to set their state to open=true again
				this.tabManagementController.requestRefresh()
				setTimeout(() => {
					MainController.instance.sendBroadcastMessage("probe")
				}, 10)
			})
		})

		const favicon = document.getElementById("favicon") as HTMLLinkElement
		const faviconLink = favicon.href
		const faviconAlternate = document.getElementById("faviconAlternate") as HTMLLinkElement
		const alternateLink = faviconAlternate.href
		faviconAlternate.href = " "
		faviconAlternate.disabled = true

		this.broadcastChannel.onmessage = (event) => {
			const msg = event.data as BroadcastMessage

			this.tabBroadcastService
				.handleIncomingMessage(msg, this.tabID, (tabId) => this.tabApplicationService.markTabOpen(tabId))
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

						// Stop flashing if tab becomes visible
						document.addEventListener("visibilitychange", () => {
							if (!document.hidden) {
								clearInterval(interval)
								darkMode = false
								switchFavicon()
							}
						})
					}

					if (reaction.refreshTabManagement) {
						this.tabManagementController.refreshIfOpen()
					}

					if (reaction.clipboardPayload) {
						CopyPaste.setClipboard(reaction.clipboardPayload)
					}

					if (reaction.outgoingMessage) {
						this.postBroadcastMessage(reaction.outgoingMessage)
					}
				})
			return false
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

	public sendBroadcastMessage(type: BroadcastMessageType, payload?: any) {
		this.postBroadcastMessage(this.tabBroadcastService.createMessage(type, this.tabID, payload))
	}

	private postBroadcastMessage(message: BroadcastMessage) {
		this.broadcastChannel.postMessage(message)
	}

	private saveCurrentState(closeTab = true) {
		Undo.addState()
		this.tabApplicationService.persistSnapshot(
			this.tabID,
			{
				data: Undo.getCurrentState(),
				settings: {
					gridVisible: CanvasController.instance.gridVisible,
					majorGridSizecm: CanvasController.instance.majorGridSizecm,
					majorGridSubdivisions: CanvasController.instance.majorGridSubdivisions,
					viewBox: CanvasController.instance.canvas.viewbox(),
					viewZoom: CanvasController.instance.currentZoom,
				},
				designName: MainController.instance.designName.value || undefined,
			},
			closeTab
		).then((result) => {
			if (result === "updated" || result === "deleted") {
				MainController.instance.sendBroadcastMessage("update")
			}
		})
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
		const loadedLibrary = await this.symbolLibraryService.loadIntoDocument()
		this.symbolsSVG = loadedLibrary.symbolsSVG
		this.symbols = loadedLibrary.symbols
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
					await this.handleLibrarySymbolContextMenu(ev, symbol)
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
		const symbolsSVGElement = document.getElementById("symbolDB")
		if (!symbolsSVGElement) return

		const state = await this.customSymbolApplicationService.loadRuntimeSymbols(symbolsSVGElement, this.symbols)
		this.applyCustomSymbolState(state)
	}

	private async handleLibrarySymbolContextMenu(symbolEvent: MouseEvent, symbol: ComponentSymbol) {
		symbolEvent.preventDefault()
		symbolEvent.stopPropagation()

		const categoryNames = this.customCategories.map((category) => category.name)
		const action = await this.symbolLibraryMenuController.openForSymbol({
			clientX: symbolEvent.clientX,
			clientY: symbolEvent.clientY,
			symbolName: symbol.tikzName,
			isCustomSymbol: !!symbol.isCustomSymbol,
			categoryNames,
			openPrompt: (title, message, defaultValue) => this.openPrompt(title, message, defaultValue),
			openRenameModal: (title, currentName) => this.openRenameModal(title, currentName),
			openConfirm: (title, body) => this.openConfirm(title, body),
		})

		await this.symbolLibraryMenuController.executeAction(action, {
			symbolName: symbol.tikzName,
			categoryNames,
			openEditor: (symbolName) => {
				SymbolEditorController.instance.open("custom-" + symbolName)
			},
			renameSymbol: (oldName, newName) => this.renameCustomGraphicsSymbol(oldName, newName),
			deleteSymbol: (symbolName) => this.deleteCustomGraphicsSymbol(symbolName),
			addCategory: (categoryName) => this.addCustomCategory(categoryName),
			addToCategory: (categoryName, symbolName) => this.addSymbolToCategory(categoryName, symbolName),
			duplicateSymbol: (symbolName, newName, categoryName) => {
				const menuSymbol = symbolName === symbol.tikzName ? symbol : this.symbolsDB.get(symbolName)
				if (!menuSymbol) return Promise.resolve()
				return this.duplicateSymbol(menuSymbol, newName, categoryName)
			},
		})
	}

	public async duplicateSymbol(originalSymbol: ComponentSymbol, newTikzName: string, categoryName: string) {
		const state = await this.customSymbolApplicationService.duplicateGraphicsSymbol(
			document.getElementById("symbolDB"),
			this.symbols,
			this.customSymbols,
			originalSymbol,
			newTikzName,
			categoryName
		)
		if (state === "missing-dom") return
		if (state === "missing-metadata") {
			await this.openAlert("Missing Metadata", "Could not find the metadata for the original symbol!")
			return
		}

		applyAndRenderCustomSymbolState(this, state)
	}

	public async renameCustomGraphicsSymbol(oldTikzName: string, newTikzName: string) {
		const state = await this.customSymbolApplicationService.renameGraphicsSymbol(
			oldTikzName,
			newTikzName,
			document.getElementById("symbolDB"),
			this.symbols,
			this.customSymbols,
			this.circuitComponents
		)
		if (state === "no-op" || state === "missing-dom") return

		applyAndRenderCustomSymbolState(this, state)
	}

	public async deleteCustomGraphicsSymbol(tikzName: string) {
		const state = await this.customSymbolApplicationService.deleteGraphicsSymbol(tikzName, this.symbols, this.customSymbols)
		applyAndRenderCustomSymbolState(this, state)
	}

	public customCategories: { name: string; symbolIds: string[] }[] = []
	public customSymbols: CustomSymbolRecord[] = []

	public async loadAndRenderCustomCategories() {
		const state = await this.customSymbolApplicationService.loadState()
		applyAndRenderCustomSymbolState(this, state)
	}

	private applyCustomSymbolState(state: { customCategories: { name: string; symbolIds: string[] }[]; customSymbols: CustomSymbolRecord[] }) {
		this.customCategories = state.customCategories
		this.customSymbols = state.customSymbols
	}

	private renderCustomCategories() {
		const leftOffcanvas = document.getElementById("leftOffcanvas") as HTMLDivElement
		const leftOffcanvasOC = new Offcanvas(leftOffcanvas)
		this.customSymbolDrawerController.render(this.customCategories, this.customSymbols, this.symbols, {
			hideDrawer: () => leftOffcanvasOC.hide(),
			openRenameModal: (title, currentName) => this.openRenameModal(title, currentName),
			openConfirm: (title, body) => this.openConfirm(title, body),
			renameCategory: (oldName, newName) => { void this.renameCustomCategory(oldName, newName) },
			deleteCategory: (name) => { void this.deleteCustomCategory(name) },
			removeSymbolFromCategory: (categoryName, symbolId) => { void this.removeSymbolFromCategory(categoryName, symbolId) },
			openSymbolEditor: (symbolId) => SymbolEditorController.instance.open(symbolId),
			renameGraphicsSymbol: (oldName, newName) => { void this.renameCustomGraphicsSymbol(oldName, newName) },
			deleteGraphicsSymbol: (symbolId) => { void this.deleteCustomGraphicsSymbol(symbolId) },
			renameSubcircuit: (symbolId, newName) => { void this.renameCustomSymbol(symbolId, newName) },
			deleteSubcircuit: (symbolId) => { void this.deleteCustomSymbol(symbolId) },
			placeStandardSymbol: (standardSymbol) => {
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
			},
			placeSubcircuit: (customSymbol) => {
				this.switchMode(Modes.COMPONENT)
				if (ComponentPlacer.instance.component) {
					ComponentPlacer.instance.placeCancel()
				}
				ComponentPlacer.instance.placeComponent(SubcircuitComponent.fromJson(customSymbol.subcircuitData))
			},
			generateSubcircuitPreview: (subcircuitData) => this.generateSubcircuitSvgPreview(subcircuitData),
			persistCustomSymbol: (customSymbol) => this.customSymbolApplicationService.putCustomSymbol(customSymbol),
		})
	}

	public async addCustomCategory(name: string) {
		name = name.trim()
		if (!name) return
		const state = await this.customSymbolApplicationService.addCategory(name)
		applyAndRenderCustomSymbolState(this, state)
	}

	public async deleteCustomCategory(name: string) {
		const state = await this.customSymbolApplicationService.deleteCategory(name)
		applyAndRenderCustomSymbolState(this, state)
	}

	/**
	 * Opens a Bootstrap Modal for user to input a new name.
	 * Returns the trimmed string, or null if cancelled / empty.
	 */
	private openRenameModal(title: string, currentName: string): Promise<string | null> {
		return this.modalDialogService.openRenameModal(title, currentName)
	}

	/**
	 * Opens a custom Bootstrap Prompt Modal with English UI.
	 */
	public openPrompt(title: string, message: string, defaultValue = ""): Promise<string | null> {
		return this.modalDialogService.openPrompt(title, message, defaultValue)
	}

	/**
	 * Opens a custom Bootstrap Confirm Modal with English UI.
	 */
	public openConfirm(title: string, message: string): Promise<boolean> {
		return this.modalDialogService.openConfirm(title, message)
	}

	/**
	 * Opens a custom Bootstrap message modal for system notifications.
	 */
	public openAlert(title: string, message: string): Promise<void> {
		return this.modalDialogService.openAlert(title, message)
	}

	/**
	 * Renames a custom category. Because keyPath = "name", we delete + re-add.
	 * Subcircuit displayNames/tikzNames are NOT changed (category is just a container).
	 */
	public async renameCustomCategory(oldName: string, newName: string) {
		const state = await this.customSymbolApplicationService.renameCategory(oldName, newName)
		if (state === "no-op") return
		applyAndRenderCustomSymbolState(this, state)
	}

	/**
	 * Renames a custom subcircuit symbol: updates DB record, all category symbolIds,
	 * and any placed SubcircuitComponents on the canvas.
	 */
	public async renameCustomSymbol(symbolId: string, newName: string) {
		const state = await this.customSymbolApplicationService.renameCustomSymbol(
			symbolId,
			newName,
			this.customSymbols,
			this.circuitComponents
		)
		if (state === "no-op" || state === "missing") return
		applyAndRenderCustomSymbolState(this, state)
	}

	/**
	 * Permanently deletes a subcircuit definition:
	 * removes it from all categories and from customSymbols DB.
	 * Canvas components already placed are NOT removed.
	 */
	public async deleteCustomSymbol(symbolId: string) {
		const state = await this.customSymbolApplicationService.deleteCustomSymbol(symbolId, this.customSymbols)
		applyAndRenderCustomSymbolState(this, state)
	}

	public async addSymbolToCategory(categoryName: string, symbolId: string, customSymbolData?: CustomSymbolRecord) {
		const state = await this.customSymbolApplicationService.addSymbolToCategory(categoryName, symbolId, customSymbolData)
		applyAndRenderCustomSymbolState(this, state)
	}

	public async removeSymbolFromCategory(categoryName: string, symbolId: string) {
		const state = await this.customSymbolApplicationService.removeSymbolFromCategory(categoryName, symbolId)
		applyAndRenderCustomSymbolState(this, state)
	}

	public async putCustomSymbolRecord(customSymbol: CustomSymbolRecord): Promise<void> {
		await this.customSymbolApplicationService.putCustomSymbol(customSymbol)
	}

	public async createSubcircuitFromSelection() {
		const groupComp = await this.customSymbolSelectionController.resolveGroupSelection({
			selectedComponents: SelectionController.instance.currentlySelectedComponents,
			getCurrentSelection: () => SelectionController.instance.currentlySelectedComponents,
			groupSelection: (selectedComponents) => {
				GroupComponent.group(selectedComponents)
			},
			showAlert: (title, body) => this.openAlert(title, body),
		})
		if (!groupComp) return

		const saveRequest = await this.customSymbolSaveController.open({
			initialName: groupComp.displayName !== "Group" ? groupComp.displayName : "",
			categories: this.customCategories.map((category) => category.name),
			showAlert: (title, body) => this.openAlert(title, body),
		})
		if (!saveRequest) return

		await this.saveGroupedSelectionAsCustomSymbol(groupComp, saveRequest.name, saveRequest.categoryName)
	}
	private async saveGroupedSelectionAsCustomSymbol(group: GroupComponent, name: string, categoryName: string) {
		const children = this.restoreGroupedSelection(group)
		if (!children) {
			return
		}

		const subJson = new SubcircuitComponent(name, children).toJson()
		const state = await this.customSymbolApplicationService.saveSubcircuitRecord(
			categoryName,
			name,
			subJson,
			this.customSymbols,
			this.customCategories.map((category) => category.name)
		)
		applyAndRenderCustomSymbolState(this, state)

		Undo.addState()
	}

	private restoreGroupedSelection(group: GroupComponent): GroupComponent[] | null {
		const idx = this.circuitComponents.indexOf(group)
		if (idx === -1) {
			void this.openAlert("Save Custom Component", "Cannot find the group object; unable to save.")
			return null
		}

		const children = [...group.groupedComponents]
		this.circuitComponents.splice(idx, 1, ...children)
		group.groupedComponents = []
		group.selectionElement?.remove()
		group.visualization.remove()
		return children
	}

	private async generateSubcircuitSvgPreview(subcircuitData: any): Promise<string | null> {
		return this.appRuntime.createSubcircuitPreviewService().generatePreview(subcircuitData)
	}

	public getCustomSubcircuitsTikzset(): string {
		return this.customSymbolExportService.getCustomSubcircuitsTikzset(this.circuitComponents as any)
	}

	public getCustomSymbolsTikzset(): string {
		return this.customSymbolExportService.getCustomSymbolsTikzset(
			this.circuitComponents as any,
			this.customSymbols,
			this.symbols as any
		)
	}
}


