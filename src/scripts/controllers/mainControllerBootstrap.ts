import { GroupComponent } from "../components/groupComponent"
import { configureTikzParserRuntime } from "../utils/tikzParser"
import { SymbolEditorController } from "./symbolEditorController"
import type { ComponentSymbol } from "../components/componentSymbol"
import type { CustomSymbolRecord } from "../services/customSymbolService"
import type { CircuitComponent } from "../components/circuitComponent"

export type MainControllerBootstrapDependencies = {
	openPrompt: (title: string, message: string, defaultValue?: string) => Promise<string | null>
	openAlert: (title: string, message: string) => Promise<void>
	findCustomSymbol: (symbolId: string) => CustomSymbolRecord | undefined
	findRuntimeSymbol: (tikzName: string) => ComponentSymbol | undefined
	getCircuitComponents: () => CircuitComponent[]
	persistCustomSymbol: (customSymbol: CustomSymbolRecord) => Promise<void>
	refreshCustomCategories: () => Promise<void>
	preprocessSymbolColors: (node: Element) => void
	getRuntimeSymbols: () => ComponentSymbol[]
	addParsedSubcircuit: (categoryName: string, symbolId: string, customSymbolData: any) => void | Promise<void>
	createSubcircuitFromSelection: () => void | Promise<void>
}

export function configureMainControllerBootstrap(dependencies: MainControllerBootstrapDependencies) {
	SymbolEditorController.instance.configure({
		openPrompt: dependencies.openPrompt,
		openAlert: dependencies.openAlert,
		findCustomSymbol: dependencies.findCustomSymbol,
		findRuntimeSymbol: dependencies.findRuntimeSymbol,
		getCircuitComponents: dependencies.getCircuitComponents,
		persistCustomSymbol: dependencies.persistCustomSymbol,
		refreshCustomCategories: dependencies.refreshCustomCategories,
		preprocessSymbolColors: dependencies.preprocessSymbolColors,
	})

	configureTikzParserRuntime({
		getSymbols: dependencies.getRuntimeSymbols,
		addParsedSubcircuit: dependencies.addParsedSubcircuit,
	})

	GroupComponent.setCreateSubcircuitHandler(() => {
		void dependencies.createSubcircuitFromSelection()
	})
}
