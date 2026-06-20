import { CustomSymbolGraphicsController } from "./customSymbolGraphicsController"
import { SymbolLibraryService, type LoadedSymbolLibrary } from "../services/symbolLibraryService"

type SymbolLibraryBootstrapControllerDependencies = {
	symbolLibraryService: SymbolLibraryService
	customSymbolGraphicsController: CustomSymbolGraphicsController
}

export class SymbolLibraryBootstrapController {
	private readonly symbolLibraryService: SymbolLibraryService
	private readonly customSymbolGraphicsController: CustomSymbolGraphicsController

	public constructor(deps: SymbolLibraryBootstrapControllerDependencies) {
		this.symbolLibraryService = deps.symbolLibraryService
		this.customSymbolGraphicsController = deps.customSymbolGraphicsController
	}

	public initializeSymbolLibrary(): Promise<LoadedSymbolLibrary> {
		return this.symbolLibraryService.loadIntoDocument()
	}

	public loadCustomSymbolsIntoSymbolDB(): Promise<void> {
		return this.customSymbolGraphicsController.loadCustomSymbolsIntoSymbolDB()
	}
}
