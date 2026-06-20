import type { ComponentSymbol } from "../components/componentSymbol"
import type { CircuitComponent } from "../components/circuitComponent"
import { CustomSymbolApplicationService } from "../services/customSymbolApplicationService"
import { CustomSymbolWorkspaceController } from "./customSymbolWorkspaceController"

type CustomSymbolGraphicsControllerDependencies = {
	applicationService: CustomSymbolApplicationService
	workspaceController: CustomSymbolWorkspaceController
	runtimeSymbols: ComponentSymbol[]
	circuitComponents: CircuitComponent[]
	getSymbolDbElement: () => Element | null
	showAlert: (title: string, body: string) => Promise<void>
}

export class CustomSymbolGraphicsController {
	private readonly applicationService: CustomSymbolApplicationService
	private readonly workspaceController: CustomSymbolWorkspaceController
	private readonly runtimeSymbols: ComponentSymbol[]
	private readonly circuitComponents: CircuitComponent[]
	private readonly getSymbolDbElement: () => Element | null
	private readonly showAlert: (title: string, body: string) => Promise<void>

	public constructor(deps: CustomSymbolGraphicsControllerDependencies) {
		this.applicationService = deps.applicationService
		this.workspaceController = deps.workspaceController
		this.runtimeSymbols = deps.runtimeSymbols
		this.circuitComponents = deps.circuitComponents
		this.getSymbolDbElement = deps.getSymbolDbElement
		this.showAlert = deps.showAlert
	}

	public async loadCustomSymbolsIntoSymbolDB(): Promise<void> {
		const symbolsDBElement = this.getSymbolDbElement()
		if (!symbolsDBElement) return

		const state = await this.applicationService.loadRuntimeSymbols(symbolsDBElement, this.runtimeSymbols)
		this.workspaceController.applyState(state)
	}

	public async duplicateSymbol(originalSymbol: ComponentSymbol, newTikzName: string, categoryName: string): Promise<void> {
		const state = await this.applicationService.duplicateGraphicsSymbol(
			this.getSymbolDbElement(),
			this.runtimeSymbols,
			this.workspaceController.customSymbols,
			originalSymbol,
			newTikzName,
			categoryName
		)
		if (state === "missing-dom") return
		if (state === "missing-metadata") {
			await this.showAlert("Missing Metadata", "Could not find the metadata for the original symbol!")
			return
		}

		this.workspaceController.applyAndRender(state, this.runtimeSymbols)
	}

	public async renameCustomGraphicsSymbol(oldTikzName: string, newTikzName: string): Promise<void> {
		const state = await this.applicationService.renameGraphicsSymbol(
			oldTikzName,
			newTikzName,
			this.getSymbolDbElement(),
			this.runtimeSymbols,
			this.workspaceController.customSymbols,
			this.circuitComponents
		)
		if (state === "no-op" || state === "missing-dom") return

		this.workspaceController.applyAndRender(state, this.runtimeSymbols)
	}

	public async deleteCustomGraphicsSymbol(tikzName: string): Promise<void> {
		const state = await this.applicationService.deleteGraphicsSymbol(
			tikzName,
			this.runtimeSymbols,
			this.workspaceController.customSymbols
		)
		this.workspaceController.applyAndRender(state, this.runtimeSymbols)
	}
}
