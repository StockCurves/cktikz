import { ComponentSymbol } from "../components/componentSymbol"

export type RenameCustomGraphicsSymbolDomResult = {
	updatedRecord: any
	componentNode: Element | null
	oldSymbolIds: string[]
}

export class CustomSymbolDomService {
	public loadCustomSymbolsIntoDom(symbols: any[], symbolDB: Element, runtimeSymbols: ComponentSymbol[]): ComponentSymbol[] {
		const loadedSymbols: ComponentSymbol[] = []

		for (const symbolRecord of symbols) {
			if (!symbolRecord.isCustomSymbol) continue

			for (const symbolId in symbolRecord.symbols) {
				const symbolXml = symbolRecord.symbols[symbolId]
				console.log(`[LoadCustom] Restoring symbol ID: ${symbolId}, XML length: ${symbolXml ? symbolXml.length : 0}`)
				if (!document.getElementById(symbolId)) {
					const symbolNode = this.parseFirstElement(symbolXml, "symbol")
					if (symbolNode) {
						const node = document.adoptNode(symbolNode)
						symbolDB.appendChild(node)
						console.log(`[LoadCustom] Appended symbol ${symbolId} to DOM. Exists?`, !!document.getElementById(symbolId))
					}
				}
			}

			const componentNode = this.parseFirstElement(symbolRecord.componentXml, "component")
			if (componentNode) {
				const adoptedComponent = document.adoptNode(componentNode)
				symbolDB.appendChild(adoptedComponent)

				if (!runtimeSymbols.some((symbol) => symbol.tikzName === symbolRecord.tikzName)) {
					const componentSymbol = new ComponentSymbol(adoptedComponent)
					componentSymbol.isCustomSymbol = true
					loadedSymbols.push(componentSymbol)
				}
			}
		}

		return loadedSymbols
	}

	public duplicateSymbolDom(
		symbolDB: Element,
		originalSymbol: ComponentSymbol,
		newTikzName: string
	): { customSymbolData: any; componentSymbol: ComponentSymbol } | null {
		const originalComponentNode = Array.from(symbolDB.getElementsByTagName("component")).find(
			(component) => component.getAttribute("tikz") === originalSymbol.tikzName
		)
		if (!originalComponentNode) return null

		const newComponentNode = originalComponentNode.cloneNode(true) as Element
		newComponentNode.setAttribute("tikz", newTikzName)
		newComponentNode.setAttribute("display", newTikzName)

		const variants = newComponentNode.getElementsByTagName("variant")
		const symbolsMap: { [key: string]: string } = {}

		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i]
			const originalFor = variant.getAttribute("for")
			if (!originalFor) continue

			const originalSymbolNode =
				document.getElementById(originalFor) || symbolDB.querySelector(`symbol[id="${originalFor}"], [id="${originalFor}"]`)
			if (originalSymbolNode) {
				const newSymbolId = `node_custom_${newTikzName}_${i === 0 ? "default" : i}`
				const newSymbolNode = originalSymbolNode.cloneNode(true) as Element
				newSymbolNode.setAttribute("id", newSymbolId)
				symbolDB.appendChild(newSymbolNode)
				variant.setAttribute("for", newSymbolId)
				symbolsMap[newSymbolId] = newSymbolNode.outerHTML
			} else {
				console.error(`[Duplicate] Could not find original symbol node for ID: ${originalFor}`)
			}
		}

		const customSymbolData = {
			id: "custom-" + newTikzName,
			tikzName: newTikzName,
			displayName: newTikzName,
			isCustomSymbol: true,
			isNodeSymbol: originalSymbol.isNodeSymbol,
			baseSymbol: originalSymbol.tikzName,
			componentXml: newComponentNode.outerHTML,
			symbols: symbolsMap,
		}

		symbolDB.appendChild(newComponentNode)
		console.log(`[Duplicate] Appended component node for ${newTikzName} to DOM. XML:`, newComponentNode.outerHTML)
		const componentSymbol = new ComponentSymbol(newComponentNode)
		componentSymbol.isCustomSymbol = true

		return { customSymbolData, componentSymbol }
	}

	public renameCustomGraphicsSymbolDom(
		oldTikzName: string,
		newTikzName: string,
		symbolRecord: any,
		symbolDB: Element | null = document.getElementById("symbolDB")
	): RenameCustomGraphicsSymbolDomResult {
		const oldSymbolIds = Object.keys(symbolRecord.symbols)
		const updatedRecord = { ...symbolRecord }
		updatedRecord.id = "custom-" + newTikzName
		updatedRecord.tikzName = newTikzName
		updatedRecord.displayName = newTikzName

		const parser = new DOMParser()
		const compDoc = parser.parseFromString(updatedRecord.componentXml, "image/svg+xml")
		const compNode = compDoc.querySelector("component")!
		compNode.setAttribute("tikz", newTikzName)
		compNode.setAttribute("display", newTikzName)

		const variants = compNode.getElementsByTagName("variant")
		const newSymbolsMap: { [key: string]: string } = {}
		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i]
			const oldFor = variant.getAttribute("for")!
			const newFor = oldFor.replace(oldTikzName, newTikzName)
			variant.setAttribute("for", newFor)

			if (updatedRecord.symbols[oldFor]) {
				const symDoc = parser.parseFromString(updatedRecord.symbols[oldFor], "image/svg+xml")
				const symbolNode = symDoc.querySelector("symbol")!
				symbolNode.setAttribute("id", newFor)
				newSymbolsMap[newFor] = symbolNode.outerHTML
			}
		}

		updatedRecord.componentXml = compNode.outerHTML
		updatedRecord.symbols = newSymbolsMap

		let adoptedComponent: Element | null = null
		if (symbolDB) {
			for (const oldFor of oldSymbolIds) {
				document.getElementById(oldFor)?.remove()
			}
			symbolDB.querySelector(`component[tikz="${oldTikzName}"]`)?.remove()

			for (const newFor in newSymbolsMap) {
				const parsedSymbol = parser.parseFromString(newSymbolsMap[newFor], "image/svg+xml")
				const symbolNode = parsedSymbol.firstElementChild
				if (symbolNode) {
					symbolDB.appendChild(document.adoptNode(symbolNode))
				}
			}
			adoptedComponent = document.adoptNode(compNode)
			symbolDB.appendChild(adoptedComponent)
		}

		return { updatedRecord, componentNode: adoptedComponent || compNode, oldSymbolIds }
	}

	public replaceSymbolsInDom(symbolsMap: { [key: string]: string }, symbolDB: Element): void {
		const parser = new DOMParser()
		for (const symbolId in symbolsMap) {
			document.getElementById(symbolId)?.remove()
			const symbolNode = this.parseFirstElement(symbolsMap[symbolId], "symbol", parser)
			if (symbolNode) {
				symbolDB.appendChild(document.adoptNode(symbolNode))
			}
		}
	}

	private parseFirstElement(xml: string, selector: string, parser = new DOMParser()): Element | null {
		const wrapper = `<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`
		return parser.parseFromString(wrapper, "image/svg+xml").querySelector(selector)
	}
}
