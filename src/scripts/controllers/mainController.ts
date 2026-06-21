import * as SVG from "@svgdotjs/svg.js"
import { Button as _bootstrapButton, Collapse as _bootstrapCollapse, Offcanvas, Tooltip } from "bootstrap"
import "../utils/impSVGNumber"
import { waitForElementLoaded } from "../utils/domWatcher"
import hotkeys from "hotkeys-js"
import { version } from "../../../package.json"
import { TabManagementController } from "./tabManagementController"
import { CustomSymbolSaveController } from "./customSymbolSaveController"
import { CustomSymbolSelectionController } from "./customSymbolSelectionController"
import { CustomSymbolWorkspaceController } from "./customSymbolWorkspaceController"
import { CustomSymbolSubcircuitSaveController } from "./customSymbolSubcircuitSaveController"
import { CustomSymbolCatalogController } from "./customSymbolCatalogController"
import { CustomSymbolGraphicsController } from "./customSymbolGraphicsController"
import { SymbolLibraryBootstrapController } from "./symbolLibraryBootstrapController"
import { AddComponentOffcanvasController } from "./addComponentOffcanvasController"
import { ComponentLibraryController } from "./componentLibraryController"
import { ShapeLibraryController } from "./shapeLibraryController"
import { SymbolLibraryMenuController } from "./symbolLibraryMenuController"
import { CustomSymbolApplicationService } from "../services/customSymbolApplicationService"
import { CustomSymbolExportService } from "../services/customSymbolExportService"
import type { CustomSymbolRecord } from "../services/customSymbolService"
import { ModalDialogService } from "../services/modalDialogService"
import { getAppRuntime } from "../services/appRuntime"
import type { BroadcastMessage, BroadcastMessageType } from "../services/tabBroadcastService"
import { preprocessSymbolColors } from "../utils/symbolColorTheme"
import { configureTikzParserRuntime } from "../utils/tikzParser"
import { configurePropertyRuntime } from "../properties/propertyRuntime"
import { configureNamingRuntime } from "../mixins/namingRuntime"
import { configureComponentRuntime } from "../components/componentRuntime"
import { SnapDragHandler } from "../snapDrag/dragHandlers"
import { SnapCursorController } from "../snapDrag/snapCursor"
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
	GroupComponent,
	GroupSaveObject,
	memorySizeOf,
	SaveFileFormat,
	emtpySaveState,
	currentSaveVersion,
	loadTextConverter,
	TextProperty,
	TikzEditorController,
	ContextMenu,
	SubcircuitSaveObject,
	SymbolEditorController,
	TemplateController,
	LiveRenderController,
} from "../internal"

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
	symbols: ComponentSymbol[] = []

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
	private readonly tabManagementController = new TabManagementController()
	private readonly customSymbolSaveController = new CustomSymbolSaveController()
	private readonly customSymbolSelectionController = new CustomSymbolSelectionController()
	private readonly modalDialogService = new ModalDialogService()
	private readonly hideLeftOffcanvas = () => {
		const leftOffcanvas = document.getElementById("leftOffcanvas") as HTMLDivElement
		new Offcanvas(leftOffcanvas).hide()
	}
	private readonly cancelActiveComponentPlacement = () => {
		if (ComponentPlacer.instance.component) {
			ComponentPlacer.instance.placeCancel()
		}
	}
	private readonly placeSelectedComponent = (component: CircuitComponent) => {
		ComponentPlacer.instance.placeComponent(component)
	}
	private readonly customSymbolWorkspaceController = new CustomSymbolWorkspaceController({
		hideDrawer: this.hideLeftOffcanvas,
		openRenameModal: (title: string, currentName: string) => this.openRenameModal(title, currentName),
		openConfirm: this.modalDialogService.openConfirm.bind(this.modalDialogService),
		renameCategory: (oldName: string, newName: string) => { void this.customSymbolCatalogController.renameCustomCategory(oldName, newName) },
		deleteCategory: (name: string) => { void this.customSymbolCatalogController.deleteCustomCategory(name) },
		removeSymbolFromCategory: (categoryName: string, symbolId: string) => { void this.customSymbolCatalogController.removeSymbolFromCategory(categoryName, symbolId) },
		openSymbolEditor: (symbolId: string) => SymbolEditorController.instance.open(symbolId),
		renameGraphicsSymbol: (oldName: string, newName: string) => { void this.customSymbolGraphicsController.renameCustomGraphicsSymbol(oldName, newName) },
		deleteGraphicsSymbol: (symbolId: string) => { void this.customSymbolGraphicsController.deleteCustomGraphicsSymbol(symbolId) },
		renameSubcircuit: (symbolId: string, newName: string) => { void this.customSymbolCatalogController.renameCustomSymbol(symbolId, newName) },
		deleteSubcircuit: (symbolId: string) => { void this.customSymbolCatalogController.deleteCustomSymbol(symbolId) },
		switchToComponentMode: () => this.switchMode(Modes.COMPONENT),
		cancelComponentPlacement: this.cancelActiveComponentPlacement,
		placeComponent: this.placeSelectedComponent,
		generateSubcircuitPreview: (subcircuitData: any) => this.generateSubcircuitSvgPreview(subcircuitData),
		persistCustomSymbol: (customSymbol) => this.customSymbolApplicationService.putCustomSymbol(customSymbol),
	})
	private readonly customSymbolCatalogController = new CustomSymbolCatalogController({
		applicationService: this.customSymbolApplicationService,
		workspaceController: this.customSymbolWorkspaceController,
		runtimeSymbols: this.symbols,
		circuitComponents: this.circuitComponents,
	})
	private readonly customSymbolGraphicsController = new CustomSymbolGraphicsController({
		applicationService: this.customSymbolApplicationService,
		workspaceController: this.customSymbolWorkspaceController,
		runtimeSymbols: this.symbols,
		circuitComponents: this.circuitComponents,
		getSymbolDbElement: () => document.getElementById("symbolDB"),
		showAlert: this.modalDialogService.openAlert.bind(this.modalDialogService),
	})
	private readonly customSymbolSubcircuitSaveController = new CustomSymbolSubcircuitSaveController({
		selectionController: this.customSymbolSelectionController,
		saveController: this.customSymbolSaveController,
		workspaceController: this.customSymbolWorkspaceController,
		applicationService: this.customSymbolApplicationService,
		circuitComponents: this.circuitComponents,
		runtimeSymbols: this.symbols,
		showAlert: this.modalDialogService.openAlert.bind(this.modalDialogService),
		addUndoState: () => Undo.addState(),
	})
	private readonly customSymbolExportService = new CustomSymbolExportService()

	public designName: TextProperty
	public pendingLoadData: SaveFileFormat | null = null

	private db: IDBDatabase
	private readonly symbolLibraryBootstrapController = new SymbolLibraryBootstrapController({
		symbolLibraryService: this.symbolLibraryService,
		customSymbolGraphicsController: this.customSymbolGraphicsController,
	})
	private readonly addComponentOffcanvasController = new AddComponentOffcanvasController({
		componentLibraryController: new ComponentLibraryController(),
		shapeLibraryController: new ShapeLibraryController(),
		symbolLibraryMenuController: new SymbolLibraryMenuController(),
		hideDrawer: this.hideLeftOffcanvas,
		switchToPanMode: () => this.switchMode(Modes.DRAG_PAN),
		switchToComponentMode: () => this.switchMode(Modes.COMPONENT),
		cancelComponentPlacement: this.cancelActiveComponentPlacement,
		placeComponent: this.placeSelectedComponent,
		openPrompt: this.modalDialogService.openPrompt.bind(this.modalDialogService),
		openRenameModal: (title: string, currentName: string) => this.openRenameModal(title, currentName),
		openConfirm: this.modalDialogService.openConfirm.bind(this.modalDialogService),
		addCustomCategory: (name: string) => this.customSymbolCatalogController.addCustomCategory(name),
		loadCustomCategories: () => this.customSymbolCatalogController.loadAndRenderCustomCategories(),
		getCustomCategoryNames: () => this.customCategories.map((category) => category.name),
		getSymbolByName: (symbolName: string) => this.symbols.find((symbol) => symbol.tikzName === symbolName),
		openSymbolEditor: (symbolName: string) => {
			SymbolEditorController.instance.open("custom-" + symbolName)
		},
		renameCustomGraphicsSymbol: (oldName: string, newName: string) =>
			this.customSymbolGraphicsController.renameCustomGraphicsSymbol(oldName, newName),
		deleteCustomGraphicsSymbol: (symbolId: string) => this.customSymbolGraphicsController.deleteCustomGraphicsSymbol(symbolId),
		addSymbolToCategory: (categoryName: string, symbolName: string) =>
			this.customSymbolCatalogController.addSymbolToCategory(categoryName, symbolName),
		duplicateSymbol: (symbol: ComponentSymbol, newName: string, categoryName: string) =>
			this.customSymbolGraphicsController.duplicateSymbol(symbol, newName, categoryName),
	})

	/**
	 * Init the app.
	 */
	private constructor() {
		MainController._instance = this
		this.isMac = window.navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
		this.broadcastChannel = new BroadcastChannel("circuitikz-designer")
		configurePropertyRuntime({
			enterDragPanMode: () => this.switchMode(Modes.DRAG_PAN),
			markDraggingInput: (element) => {
				if (CanvasController.instance) {
					CanvasController.instance.draggingFromInput = element
				}
			},
			addUndoState: () => Undo.addState(),
		})
		configureNamingRuntime({
			isNameTaken: (text, self) =>
				this.circuitComponents.some((component) => {
					if (component === self || !("name" in component)) {
						return false
					}
					const otherName = (component as CircuitComponent & { name?: TextProperty }).name
					return text !== "" && otherName?.value === text
			}),
			createExportId: (prefix) => ExportController.instance.createExportID(prefix),
		})
		configureComponentRuntime({
			registerComponent: (component) => this.addComponent(component as CircuitComponent),
			removeComponent: (component) => this.removeComponent(component as CircuitComponent),
			createSelectionElement: () => CanvasController.instance.canvas.rect(0, 0),
			createVisualizationGroup: () => CanvasController.instance.canvas.group(),
			putSelectionElement: (element) => CanvasController.instance.canvas.put(element),
			setSnapCursorVisible: (visible) => { SnapCursorController.instance.visible = visible },
			snapDrag: (component, enable, dragElement) =>
				SnapDragHandler.snapDrag(component as CircuitComponent, enable, dragElement),
			bringToForeground: (components) => CanvasController.instance.componentsToForeground(components as CircuitComponent[]),
			sendToBackground: (components) => CanvasController.instance.componentsToBackground(components as CircuitComponent[]),
			moveForward: (components) => CanvasController.instance.moveComponentsForward(components as CircuitComponent[]),
			moveBackward: (components) => CanvasController.instance.moveComponentsBackward(components as CircuitComponent[]),
			addUndoState: () => Undo.addState(),
			getSelectionReference: () => SelectionController.instance.referenceComponent,
			setSelectionReference: (component) => {
				SelectionController.instance.referenceComponent = component as CircuitComponent | null
			},
		})

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

		SymbolEditorController.instance.configure({
			openPrompt: this.modalDialogService.openPrompt.bind(this.modalDialogService),
			openAlert: this.modalDialogService.openAlert.bind(this.modalDialogService),
			findCustomSymbol: (symbolId) => this.customSymbols.find((symbol) => symbol.id === symbolId),
			findRuntimeSymbol: (tikzName) => this.symbols.find((symbol) => symbol.tikzName === tikzName),
			getCircuitComponents: () => this.circuitComponents,
			persistCustomSymbol: (customSymbol) => this.customSymbolCatalogController.putCustomSymbolRecord(customSymbol),
			refreshCustomCategories: () => this.customSymbolCatalogController.loadAndRenderCustomCategories(),
			preprocessSymbolColors,
		})

		configureTikzParserRuntime({
			getSymbols: () => this.symbols,
			addParsedSubcircuit: (categoryName, symbolId, customSymbolData) =>
				this.customSymbolCatalogController.addSymbolToCategory(categoryName, symbolId, customSymbolData),
		})

		GroupComponent.setCreateSubcircuitHandler(() => {
			void this.customSymbolSubcircuitSaveController.createSubcircuitFromSelection()
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
				preprocessSymbolColors(g)
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
		const loadedLibrary = await this.symbolLibraryBootstrapController.initializeSymbolLibrary()
		this.symbolsSVG = loadedLibrary.symbolsSVG
		this.symbols.splice(0, this.symbols.length, ...loadedLibrary.symbols)
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

	/**
	 * Init the left add offcanvas.
	 */
	private async initAddComponentOffcanvas() {
		const leftOffcanvas: HTMLDivElement = document.getElementById("leftOffcanvas") as HTMLDivElement
		const leftOffcanvasAccordion: HTMLDivElement = document.getElementById(
			"leftOffcanvasAccordion"
		) as HTMLDivElement

		await this.addComponentOffcanvasController.initialize(leftOffcanvas, leftOffcanvasAccordion, this.symbols)
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
		await this.symbolLibraryBootstrapController.loadCustomSymbolsIntoSymbolDB()
	}

	public async duplicateSymbol(originalSymbol: ComponentSymbol, newTikzName: string, categoryName: string) {
		await this.customSymbolGraphicsController.duplicateSymbol(originalSymbol, newTikzName, categoryName)
	}

	public async renameCustomGraphicsSymbol(oldTikzName: string, newTikzName: string) {
		await this.customSymbolGraphicsController.renameCustomGraphicsSymbol(oldTikzName, newTikzName)
	}

	public async deleteCustomGraphicsSymbol(tikzName: string) {
		await this.customSymbolGraphicsController.deleteCustomGraphicsSymbol(tikzName)
	}

	public get customCategories() {
		return this.customSymbolWorkspaceController.customCategories
	}

	public get customSymbols() {
		return this.customSymbolWorkspaceController.customSymbols
	}

	public async addCustomCategory(name: string) {
		await this.customSymbolCatalogController.addCustomCategory(name)
	}

	public async deleteCustomCategory(name: string) {
		await this.customSymbolCatalogController.deleteCustomCategory(name)
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
		await this.customSymbolCatalogController.renameCustomCategory(oldName, newName)
	}

	/**
	 * Renames a custom subcircuit symbol: updates DB record, all category symbolIds,
	 * and any placed SubcircuitComponents on the canvas.
	 */
	public async renameCustomSymbol(symbolId: string, newName: string) {
		await this.customSymbolCatalogController.renameCustomSymbol(symbolId, newName)
	}

	/**
	 * Permanently deletes a subcircuit definition:
	 * removes it from all categories and from customSymbols DB.
	 * Canvas components already placed are NOT removed.
	 */
	public async deleteCustomSymbol(symbolId: string) {
		await this.customSymbolCatalogController.deleteCustomSymbol(symbolId)
	}

	public async addSymbolToCategory(categoryName: string, symbolId: string, customSymbolData?: CustomSymbolRecord) {
		await this.customSymbolCatalogController.addSymbolToCategory(categoryName, symbolId, customSymbolData)
	}

	public async removeSymbolFromCategory(categoryName: string, symbolId: string) {
		await this.customSymbolCatalogController.removeSymbolFromCategory(categoryName, symbolId)
	}

	public async createSubcircuitFromSelection() {
		await this.customSymbolSubcircuitSaveController.createSubcircuitFromSelection()
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





