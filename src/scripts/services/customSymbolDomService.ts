import { ComponentSymbol } from "../components/componentSymbol"
import { buildSymbolVariantDiff } from "../utils/symbolVariantDiff"

export type RenameCustomGraphicsSymbolDomResult = {
	updatedRecord: any
	componentNode: Element | null
	oldSymbolIds: string[]
}

export class CustomSymbolDomService {
	private static readonly defaultStroke = "var(--bs-emphasis-color)"

	public loadCustomSymbolsIntoDom(symbols: any[], symbolDB: Element, runtimeSymbols: ComponentSymbol[]): ComponentSymbol[] {
		const loadedSymbols: ComponentSymbol[] = []

		for (const symbolRecord of symbols) {
			if (!symbolRecord.isCustomSymbol) continue

			this.rebuildDerivedCustomSymbolVariants(symbolRecord, symbolDB)

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

	private rebuildDerivedCustomSymbolVariants(symbolRecord: any, symbolDB: Element): void {
		if (!symbolRecord.baseSymbol || !symbolRecord.componentXml || !symbolRecord.symbols) return

		const parser = new DOMParser()
		const compNode = this.parseFirstElement(symbolRecord.componentXml, "component", parser)
		const baseComponentNode = Array.from(symbolDB.getElementsByTagName("component")).find(
			(component) => component.getAttribute("tikz") === symbolRecord.baseSymbol
		)
		if (!compNode || !baseComponentNode) return

		const customVariants = Array.from(compNode.getElementsByTagName("variant"))
		const baseVariants = Array.from(baseComponentNode.getElementsByTagName("variant"))
		if (customVariants.length === 0 || baseVariants.length === 0) return

		const optionKeyForVariant = (variant: Element | undefined | null) => {
			if (!variant) return ""
			return Array.from(variant.getElementsByTagName("option"))
				.map((option) => option.getAttribute("name") || "")
				.filter(Boolean)
				.sort()
				.join("\u0000")
		}
		const baseVariantByOptions = new Map<string, Element>()
		baseVariants.forEach((variant) => baseVariantByOptions.set(optionKeyForVariant(variant), variant))
		const findBaseVariant = (variant: Element | undefined | null, index: number): Element | null => {
			if (!variant) return null
			const baseFor = variant.getAttribute("data-base-for")
			if (baseFor) {
				const matched = baseVariants.find((baseVariant) => baseVariant.getAttribute("for") === baseFor)
				if (matched) return matched
			}

			return baseVariantByOptions.get(optionKeyForVariant(variant)) || baseVariants[index] || null
		}

		const defaultCustomVariant = customVariants[0]
		const defaultCustomSymbolId = defaultCustomVariant.getAttribute("for")
		const defaultCustomSymbolXml = defaultCustomSymbolId ? symbolRecord.symbols[defaultCustomSymbolId] : null
		const defaultCustomSymbolNode = defaultCustomSymbolXml ? this.parseFirstElement(defaultCustomSymbolXml, "symbol", parser) : null
		if (!defaultCustomSymbolNode) return

		const baseElementXml = this.collectEditableLeafXml(defaultCustomSymbolNode)
		const clickRectHtml = defaultCustomSymbolNode.querySelector(".clickBackground")?.outerHTML.trim() || ""
		const defaultBaseVariant = findBaseVariant(defaultCustomVariant, 0) || baseVariants[0]

		customVariants.forEach((customVariant, index) => {
			const baseVariant = findBaseVariant(customVariant, index)
			const baseFor = baseVariant?.getAttribute("for")
			if (baseFor && !customVariant.getAttribute("data-base-for")) {
				customVariant.setAttribute("data-base-for", baseFor)
			}
			if (index === 0 || !baseVariant || !defaultBaseVariant) return

			const customSymbolId = customVariant.getAttribute("for")
			const baseSymbolId = defaultBaseVariant.getAttribute("for")
			const variantSymbolId = baseVariant.getAttribute("for")
			const baseSymbolNode = baseSymbolId ? document.getElementById(baseSymbolId) : null
			const variantSymbolNode = variantSymbolId ? document.getElementById(variantSymbolId) : null
			if (!customSymbolId || !baseSymbolNode || !variantSymbolNode) return

			const diff = buildSymbolVariantDiff(baseSymbolNode, variantSymbolNode)
			const filteredBaseElements = baseElementXml.filter((xmlStr) => {
				const match = xmlStr.match(/data-orig-index="(\d+)"/)
				return !match || !diff.deletedBaseIndices.has(Number.parseInt(match[1], 10))
			})

			symbolRecord.symbols[customSymbolId] =
				`<symbol id="${customSymbolId}">\n` +
				`<g fill="none" stroke="${CustomSymbolDomService.defaultStroke}" stroke-miterlimit="10" stroke-width=".4">\n` +
				`${filteredBaseElements.join("\n")}\n` +
				`${diff.decoratorElements.join("\n")}\n` +
				`</g>\n${clickRectHtml}\n</symbol>`
		})

		symbolRecord.componentXml = compNode.outerHTML
	}

	private collectEditableLeafXml(symbolNode: Element): string[] {
		const leafXml: string[] = []
		let leafIndex = 0
		const inheritedAttributes = ["class", "fill", "stroke", "stroke-miterlimit", "stroke-width"]

		const traverse = (node: Element, inherited: Map<string, string>) => {
			const tag = node.tagName.toLowerCase()
			if (tag === "pin" || node.classList.contains("clickBackground")) return

			const nextInherited = new Map(inherited)
			for (const attrName of inheritedAttributes) {
				if (node.hasAttribute(attrName)) {
					nextInherited.set(attrName, node.getAttribute(attrName)!)
				}
			}

			if (tag === "g" || tag === "symbol") {
				Array.from(node.children).forEach((child) => traverse(child, nextInherited))
				return
			}

			const clone = node.cloneNode(true) as Element
			for (const [name, value] of nextInherited) {
				if (!clone.hasAttribute(name)) {
					clone.setAttribute(name, value)
				}
			}
			clone.removeAttribute("data-draggable")
			clone.removeAttribute("style")
			if (!clone.hasAttribute("data-orig-index")) {
				clone.setAttribute("data-orig-index", `${leafIndex}`)
			}
			leafIndex++
			leafXml.push(clone.outerHTML.trim())
		}

		traverse(symbolNode, new Map())
		return leafXml
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
				variant.setAttribute("data-base-for", originalFor)
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
		if (symbolDB) {
			this.rebuildDerivedCustomSymbolVariants(symbolRecord, symbolDB)
		}

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
		const renamedSymbolIds = new Map<string, string>()
		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i]
			const oldFor = variant.getAttribute("for")!
			const newFor = oldFor.replace(oldTikzName, newTikzName)
			variant.setAttribute("for", newFor)
			renamedSymbolIds.set(oldFor, newFor)
		}

		for (const [oldFor, newFor] of renamedSymbolIds) {
			if (updatedRecord.symbols[oldFor]) {
				const symDoc = parser.parseFromString(updatedRecord.symbols[oldFor], "image/svg+xml")
				const symbolNode = symDoc.querySelector("symbol")!
				symbolNode.setAttribute("id", newFor)
				this.renameSymbolReferences(symbolNode, renamedSymbolIds)
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

	private renameSymbolReferences(symbolNode: Element, renamedSymbolIds: Map<string, string>): void {
		const rewriteValue = (value: string | null) => {
			if (!value) return value
			let next = value
			for (const [oldId, newId] of renamedSymbolIds) {
				next = next.replaceAll(`#${oldId}`, `#${newId}`)
				next = next.replaceAll(`url(#${oldId})`, `url(#${newId})`)
			}
			return next
		}

		;[symbolNode, ...Array.from(symbolNode.querySelectorAll("*"))].forEach((element) => {
			for (const attrName of ["href", "xlink:href", "fill", "stroke", "filter", "clip-path", "mask", "style"]) {
				if (element.hasAttribute(attrName)) {
					element.setAttribute(attrName, rewriteValue(element.getAttribute(attrName))!)
				}
			}
		})
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
