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
import { SnapDragHandler } from "../snapDrag/dragHandlers"
import { SnapCursorController } from "../snapDrag/snapCursor"
import { configureMainControllerRuntime } from "./mainControllerRuntime"
import { configureMainControllerBootstrap } from "./mainControllerBootstrap"
import { initializeMainControllerUiBootstrap } from "./mainControllerUiBootstrap"
import { initializeMainControllerTabBootstrap } from "./mainControllerTabBootstrap"
import { initializeMainControllerShortcutBootstrap } from "./mainControllerShortcutBootstrap"
import { initializeMainControllerModeBootstrap } from "./mainControllerModeBootstrap"
import { initializeMainControllerDocumentBootstrap } from "./mainControllerDocumentBootstrap"
import { initializeMainControllerMathJaxBootstrap } from "./mainControllerMathJaxBootstrap"
import { initializeMainControllerAppBootstrap } from "./mainControllerAppBootstrap"
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
		reorderSymbolsInCategory: (categoryName: string, orderedIds: string[]) => {
			void this.customSymbolApplicationService.reorderSymbolsInCategory(categoryName, orderedIds)
		},
		reorderCategories: (orderedNames: string[]) => {
			void this.customSymbolApplicationService.reorderCategories(orderedNames)
		},
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
		configureMainControllerRuntime({
			switchMode: (mode) => this.switchMode(mode as Modes),
			draggingInputTarget: CanvasController.instance,
			setDraggingInputTarget: (element) => {
				if (CanvasController.instance) {
					CanvasController.instance.draggingFromInput = element
				}
			},
			addUndoState: () => Undo.addState(),
			circuitComponents: this.circuitComponents,
			addComponent: (component) => this.addComponent(component),
			removeComponent: (component) => this.removeComponent(component),
			createSelectionElement: () => CanvasController.instance.canvas.rect(0, 0),
			createVisualizationGroup: () => CanvasController.instance.canvas.group(),
			putSelectionElement: (element) => CanvasController.instance.canvas.put(element),
			setSnapCursorVisible: (visible) => { SnapCursorController.instance.visible = visible },
			snapDrag: (component, enable, dragElement) => SnapDragHandler.snapDrag(component, enable, dragElement),
			bringToForeground: (components) => CanvasController.instance.componentsToForeground(components),
			sendToBackground: (components) => CanvasController.instance.componentsToBackground(components),
			moveForward: (components) => CanvasController.instance.moveComponentsForward(components),
			moveBackward: (components) => CanvasController.instance.moveComponentsBackward(components),
			getSelectionReference: () => SelectionController.instance.referenceComponent,
			setSelectionReference: (component) => {
				SelectionController.instance.referenceComponent = component
			},
			createExportId: (prefix) => ExportController.instance.createExportID(prefix),
			dragPanMode: Modes.DRAG_PAN,
		})

		let mathJaxPromise = this.loadMathJax()
		let canvasPromise = this.initCanvas()
		let symbolsDBPromise = this.initSymbolDB()
		let dbResolve: (db: IDBDatabase) => void
		let dbPromise = new Promise<IDBDatabase>((resolve) => {
			dbResolve = resolve
		})
		let fontPromise = Promise.all([document.fonts.load("1em Computer Modern Serif"), loadTextConverter()])

		MainController.appVersion = version
		this.designName = new TextProperty("Design Name", "")
		initializeMainControllerDocumentBootstrap({
			version,
			designName: this.designName,
			setDarkModeState: (darkMode) => {
				this.darkMode = darkMode
			},
			setDarkModeLastState: (darkMode) => {
				this.darkModeLast = darkMode
			},
			setCurrentTheme: (theme) => {
				this.currentTheme = theme
			},
			updateDesignName: (name) => this.tabApplicationService.updateDesignName(this.tabID, name),
			sendUpdateBroadcast: () => {
				MainController.instance.sendBroadcastMessage("update")
			},
		})

		configureMainControllerBootstrap({
			openPrompt: this.modalDialogService.openPrompt.bind(this.modalDialogService),
			openAlert: this.modalDialogService.openAlert.bind(this.modalDialogService),
			findCustomSymbol: (symbolId) => this.customSymbols.find((symbol) => symbol.id === symbolId),
			findRuntimeSymbol: (tikzName) => this.symbols.find((symbol) => symbol.tikzName === tikzName),
			getCircuitComponents: () => this.circuitComponents,
			persistCustomSymbol: (customSymbol) => this.customSymbolCatalogController.putCustomSymbolRecord(customSymbol),
			refreshCustomCategories: () => this.customSymbolCatalogController.loadAndRenderCustomCategories(),
			preprocessSymbolColors,
			getRuntimeSymbols: () => this.symbols,
			addParsedSubcircuit: (categoryName, symbolId, customSymbolData) =>
				this.customSymbolCatalogController.addSymbolToCategory(categoryName, symbolId, customSymbolData),
			createSubcircuitFromSelection: () => this.customSymbolSubcircuitSaveController.createSubcircuitFromSelection(),
		})

		this.initModeButtons()

		this.updateTooltips()

		ExportController.instance

		canvasPromise.then(() => {
			EraseController.instance
			SelectionController.instance
			PropertyController.instance
			ComponentPlacer.instance
		})
		this.addSaveStateManagement(dbResolve)
		this.initPromise = Promise.all([canvasPromise, symbolsDBPromise, mathJaxPromise, fontPromise, dbPromise]).then(async () => {
			await initializeMainControllerAppBootstrap({
				hideLoadingSpinner: () => {
					document.getElementById("loadingSpinner")?.classList.add("d-none")
				},
				loadCustomSymbolsIntoSymbolDB: () => this.loadCustomSymbolsIntoSymbolDB(),
				initAddComponentOffcanvas: () => this.initAddComponentOffcanvas(),
				initShortcuts: () => this.initShortcuts(),
				initTikzEditor: () => {
					TikzEditorController.instance.init()
				},
				initLiveRender: () => {
					LiveRenderController.instance.init()
				},
				initUiBootstrap: () => {
					initializeMainControllerUiBootstrap({
						toggleTikzEditor: () => TikzEditorController.instance.toggleVisibility(),
						exportSvg: ExportController.instance.exportSVG.bind(ExportController.instance),
						getSelectedComponents: () => SelectionController.instance.currentlySelectedComponents,
						isGroupComponent: (component) =>
							component instanceof GroupComponent ||
							(component as { constructor?: { name?: string } })?.constructor?.name === "GroupComponent" ||
							(component as { constructor?: { name?: string } })?.constructor?.name === "SubcircuitComponent",
						groupSelection: (components) => GroupComponent.group(components as CircuitComponent[]),
						ungroupSelection: (component) => component.ungroup(),
						createSubcircuitFromSelection: () => this.createSubcircuitFromSelection(),
						createContextMenu: (entries) => new ContextMenu(entries),
						preprocessAllSymbolColors: () => {
							for (const g of this.symbolsSVG.defs().node.querySelectorAll("symbol>g")) {
								preprocessSymbolColors(g)
							}
						},
						onThemeChanged: (darkMode) => {
							MainController.instance.darkMode = darkMode
						},
						updateTheme: () => MainController.instance.updateTheme(),
					})
				},
				updatePropertiesPanel: () => {
					PropertyController.instance.update()
				},
				initializeTemplates: () => TemplateController.instance.initialize(),
				loadPendingData: () => {
					if (MainController.instance.pendingLoadData) {
						SaveController.instance.loadFromJSON(MainController.instance.pendingLoadData)
					}
				},
				markInitDone: () => {
					this.isInitDone = true
				},
				reportTemplateInitializeError: (err) => {
					console.error("Error loading templates:", err)
				},
			})
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
		return initializeMainControllerMathJaxBootstrap()
	}

	/**
	 * handle tabs and save state management
	 */
	private addSaveStateManagement(dbResolve: (db: IDBDatabase) => void) {
		const defaultSettings: CanvasSettings = {}

		initializeMainControllerTabBootstrap({
			clearLegacyStorage: (localStorageObject, sessionStorageObject) =>
				this.tabLifecycleService.clearLegacyStorage(localStorageObject, sessionStorageObject),
			openDatabase: () => this.indexedDbService.openDatabase(),
			bindPersistenceHandlers: (windowObject, documentObject, saveCurrentState) =>
				this.tabLifecycleService.bindPersistenceHandlers(windowObject, documentObject, saveCurrentState),
			initializeCurrentTab: (url, defaultData, settings, initializeTab, applySession) =>
				this.tabLifecycleService.initializeCurrentTab(url, defaultData, settings, initializeTab, applySession),
			getTabManagementSummary: (currentTabId, measureSize, countComponents) =>
				this.tabApplicationService.getTabManagementSummary(currentTabId, measureSize, countComponents),
			deleteTab: (tabId) => this.tabApplicationService.deleteTab(tabId),
			markOtherTabsClosedForProbe: (currentTabId) => this.tabApplicationService.markOtherTabsClosedForProbe(currentTabId),
			handleIncomingMessage: (message, currentTabId, markTabOpen) =>
				this.tabBroadcastService.handleIncomingMessage(message, currentTabId, markTabOpen),
			markTabOpen: (tabId) => this.tabApplicationService.markTabOpen(tabId),
			renderTabManagementSummary: (summary, actions) => this.tabManagementController.renderSummary(summary, actions),
			bindTabManagementShow: (loadSummary) => this.tabManagementController.onShow(loadSummary),
			bindProbeRefresh: (refresh) => this.tabManagementController.onProbeRefresh(refresh),
			requestTabManagementRefresh: () => this.tabManagementController.requestRefresh(),
			refreshTabManagementIfOpen: () => this.tabManagementController.refreshIfOpen(),
			postBroadcastMessage: (message) => this.postBroadcastMessage(message),
			createBroadcastMessage: (type, from, payload) => this.tabBroadcastService.createMessage(type as BroadcastMessageType, from, payload),
			setClipboard: (payload) => CopyPaste.setClipboard(payload),
			setBroadcastMessageHandler: (handler) => {
				this.broadcastChannel.onmessage = (event) => {
					void handler(event.data as BroadcastMessage)
					return false
				}
			},
			initializeTab: (requestedId, data, settings) => this.tabApplicationService.initializeTab(requestedId, data, settings),
			applySession: (session) => {
				MainController.instance.tabID = session.tabId
				MainController.instance.designName.updateValue(session.designName ?? "", true, true)
				CanvasController.instance.setSettings(session.settings)
				MainController.instance.pendingLoadData = session.pendingData
			},
			onDatabaseOpened: (db) => {
				MainController.instance.db = db
				dbResolve(MainController.instance.db)
			},
			onInitialized: () => {
				MainController.instance.sendBroadcastMessage("update")
			},
			saveCurrentState: (closeTab = true) => this.saveCurrentState(closeTab),
			openUrl: (url) => window.open(url, "_blank"),
			currentTabId: () => MainController.instance.tabID,
			defaultData: emtpySaveState,
			defaultSettings,
			measureSize: (data) => memorySizeOf(data),
		})
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
		initializeMainControllerShortcutBootstrap({
			registerHotkey: (shortcut, handler) => {
				hotkeys(shortcut, handler)
			},
			switchToDragPanMode: () => this.switchMode(Modes.DRAG_PAN),
			switchToEraseMode: () => this.switchMode(Modes.ERASE),
			isComponentPlacementMode: () => this.mode === Modes.COMPONENT,
			hasSelection: () => SelectionController.instance.hasSelection(),
			rotatePlacement: (angleDeg) => ComponentPlacer.instance.placeRotate(angleDeg),
			rotateSelection: (angleDeg) => SelectionController.instance.rotateSelection(angleDeg),
			flipPlacement: (horizontal) => ComponentPlacer.instance.placeFlip(horizontal),
			flipSelection: (horizontal) => SelectionController.instance.flipSelection(horizontal),
			addUndoState: () => Undo.addState(),
			selectAll: () => SelectionController.instance.selectAll(),
			undo: () => Undo.undo(),
			redo: () => Undo.redo(),
			copy: () => CopyPaste.copy(),
			paste: () => CopyPaste.paste(),
			cut: () => CopyPaste.cut(),
			exportSvg: () => ExportController.instance.exportSVG(),
			clickAddComponentButton: () => {
				document.getElementById("addComponentButton")?.dispatchEvent(new MouseEvent("click"))
			},
			fitActiveView: () => {
				if (LiveRenderController.instance.activeTab === "render") {
					LiveRenderController.instance.fitView()
				} else {
					CanvasController.instance.fitView()
				}
			},
			placeWireComponent: () => ComponentPlacer.instance.placeComponent(new WireComponent()),
			removeSelection: () => SelectionController.instance.removeSelection(),
			placeTextComponent: () => ComponentPlacer.instance.placeComponent(new RectangleComponent(true)),
			activateShortcutComponent: (componentTitle) => {
				const componentButton = document.querySelector(`[title="${componentTitle}"]`)
				const clickEvent = new MouseEvent("mouseup", { view: window, bubbles: true, cancelable: true })
				componentButton?.dispatchEvent(clickEvent)
			},
		})
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
		this.modeSwitchButtons = initializeMainControllerModeBootstrap({
			switchToDragPanMode: () => this.switchMode(Modes.DRAG_PAN),
			switchToEraseMode: () => this.switchMode(Modes.ERASE),
			placeWireMode: () => {
				this.switchMode(Modes.DRAG_PAN)
				ComponentPlacer.instance.placeComponent(new WireComponent())
			},
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
				this.modeSwitchButtons.modeDragPan?.classList.remove("selected")
				CanvasController.instance.deactivatePanning()
				SelectionController.instance.deactivateSelection()
				break
			case Modes.ERASE:
				this.modeSwitchButtons.modeEraser?.classList.remove("selected")
				EraseController.instance.deactivate()
				break
			case Modes.COMPONENT:
				this.modeSwitchButtons.modeDragPan?.classList.remove("selected")
				this.modeSwitchButtons.modeDrawLine?.classList.remove("selected")
				ComponentPlacer.instance.placeCancel()
				CanvasController.instance.deactivatePanning()
				break
			default:
				break
		}

		switch (newMode) {
			case Modes.DRAG_PAN:
				this.modeSwitchButtons.modeDragPan?.classList.add("selected")
				CanvasController.instance.activatePanning()
				SelectionController.instance.activateSelection()
				break
			case Modes.ERASE:
				this.modeSwitchButtons.modeEraser?.classList.add("selected")
				EraseController.instance.activate()
				break
			case Modes.COMPONENT:
				this.modeSwitchButtons.modeDragPan?.classList.add("selected")
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





