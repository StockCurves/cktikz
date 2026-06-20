import type { ComponentSymbol } from "../components/componentSymbol"
import type { CircuitComponent } from "../components/circuitComponent"
import { ComponentLibraryController } from "./componentLibraryController"
import { ShapeLibraryController } from "./shapeLibraryController"
import { SymbolLibraryMenuController } from "./symbolLibraryMenuController"

type AddComponentOffcanvasControllerDependencies = {
	componentLibraryController: ComponentLibraryController
	shapeLibraryController: ShapeLibraryController
	symbolLibraryMenuController: SymbolLibraryMenuController
	hideDrawer: () => void
	switchToPanMode: () => void
	switchToComponentMode: () => void
	cancelComponentPlacement: () => void
	placeComponent: (component: CircuitComponent) => void
	openPrompt: (title: string, message: string, defaultValue?: string) => Promise<string | null>
	openRenameModal: (title: string, currentName: string) => Promise<string | null>
	openConfirm: (title: string, body: string) => Promise<boolean>
	addCustomCategory: (name: string) => Promise<void>
	loadCustomCategories: () => Promise<void>
	getCustomCategoryNames: () => string[]
	getSymbolByName: (symbolName: string) => ComponentSymbol | undefined
	openSymbolEditor: (symbolName: string) => void
	renameCustomGraphicsSymbol: (oldName: string, newName: string) => Promise<void>
	deleteCustomGraphicsSymbol: (symbolName: string) => Promise<void>
	addSymbolToCategory: (categoryName: string, symbolName: string) => Promise<void>
	duplicateSymbol: (symbol: ComponentSymbol, newName: string, categoryName: string) => Promise<void>
}

export class AddComponentOffcanvasController {
	private readonly componentLibraryController: ComponentLibraryController
	private readonly shapeLibraryController: ShapeLibraryController
	private readonly symbolLibraryMenuController: SymbolLibraryMenuController
	private readonly hideDrawer: () => void
	private readonly switchToPanMode: () => void
	private readonly switchToComponentMode: () => void
	private readonly cancelComponentPlacement: () => void
	private readonly placeComponent: (component: CircuitComponent) => void
	private readonly openPrompt: (title: string, message: string, defaultValue?: string) => Promise<string | null>
	private readonly openRenameModal: (title: string, currentName: string) => Promise<string | null>
	private readonly openConfirm: (title: string, body: string) => Promise<boolean>
	private readonly addCustomCategory: (name: string) => Promise<void>
	private readonly loadCustomCategories: () => Promise<void>
	private readonly getCustomCategoryNames: () => string[]
	private readonly getSymbolByName: (symbolName: string) => ComponentSymbol | undefined
	private readonly openSymbolEditor: (symbolName: string) => void
	private readonly renameCustomGraphicsSymbol: (oldName: string, newName: string) => Promise<void>
	private readonly deleteCustomGraphicsSymbol: (symbolName: string) => Promise<void>
	private readonly addSymbolToCategory: (categoryName: string, symbolName: string) => Promise<void>
	private readonly duplicateSymbol: (symbol: ComponentSymbol, newName: string, categoryName: string) => Promise<void>

	public constructor(deps: AddComponentOffcanvasControllerDependencies) {
		this.componentLibraryController = deps.componentLibraryController
		this.shapeLibraryController = deps.shapeLibraryController
		this.symbolLibraryMenuController = deps.symbolLibraryMenuController
		this.hideDrawer = deps.hideDrawer
		this.switchToPanMode = deps.switchToPanMode
		this.switchToComponentMode = deps.switchToComponentMode
		this.cancelComponentPlacement = deps.cancelComponentPlacement
		this.placeComponent = deps.placeComponent
		this.openPrompt = deps.openPrompt
		this.openRenameModal = deps.openRenameModal
		this.openConfirm = deps.openConfirm
		this.addCustomCategory = deps.addCustomCategory
		this.loadCustomCategories = deps.loadCustomCategories
		this.getCustomCategoryNames = deps.getCustomCategoryNames
		this.getSymbolByName = deps.getSymbolByName
		this.openSymbolEditor = deps.openSymbolEditor
		this.renameCustomGraphicsSymbol = deps.renameCustomGraphicsSymbol
		this.deleteCustomGraphicsSymbol = deps.deleteCustomGraphicsSymbol
		this.addSymbolToCategory = deps.addSymbolToCategory
		this.duplicateSymbol = deps.duplicateSymbol
	}

	public async initialize(leftOffcanvas: HTMLDivElement, leftOffcanvasAccordion: HTMLDivElement, symbols: ComponentSymbol[]): Promise<void> {
		this.componentLibraryController.bindToolbar(leftOffcanvas, {
			switchToPanMode: this.switchToPanMode,
			openPrompt: this.openPrompt,
			addCategory: (name) => {
				void this.addCustomCategory(name)
			},
		})

		this.shapeLibraryController.render(leftOffcanvasAccordion, {
			hideDrawer: this.hideDrawer,
			switchToPanMode: this.switchToPanMode,
			switchToComponentMode: this.switchToComponentMode,
			cancelComponentPlacement: this.cancelComponentPlacement,
			placeComponent: this.placeComponent,
		})

		await this.loadCustomCategories()

		this.componentLibraryController.render(leftOffcanvasAccordion, symbols, {
			hideDrawer: this.hideDrawer,
			switchToComponentMode: this.switchToComponentMode,
			cancelComponentPlacement: this.cancelComponentPlacement,
			placeComponent: this.placeComponent,
			openContextMenu: (event, symbol) =>
				this.symbolLibraryMenuController.openAndExecute({
					clientX: event.clientX,
					clientY: event.clientY,
					symbolName: symbol.tikzName,
					isCustomSymbol: !!symbol.isCustomSymbol,
					categoryNames: this.getCustomCategoryNames(),
					openPrompt: this.openPrompt,
					openRenameModal: this.openRenameModal,
					openConfirm: this.openConfirm,
					openEditor: this.openSymbolEditor,
					renameSymbol: (oldName, newName) => this.renameCustomGraphicsSymbol(oldName, newName),
					deleteSymbol: (symbolName) => this.deleteCustomGraphicsSymbol(symbolName),
					addCategory: (categoryName) => this.addCustomCategory(categoryName),
					addToCategory: (categoryName, symbolName) => this.addSymbolToCategory(categoryName, symbolName),
					duplicateSymbol: (symbolName, newName, categoryName) => {
						const menuSymbol = symbolName === symbol.tikzName ? symbol : this.getSymbolByName(symbolName)
						if (!menuSymbol) return Promise.resolve()
						return this.duplicateSymbol(menuSymbol, newName, categoryName)
					},
				}),
		})
	}
}
