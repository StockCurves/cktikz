import * as SVG from "@svgdotjs/svg.js"
import {
	CircuitComponent,
	defaultFill,
	defaultStroke,
	ComponentSymbol,
	NodeSymbolComponent,
	PathSymbolComponent,
} from "../internal"

export type ComponentLibraryCallbacks = {
	hideDrawer: () => void
	switchToComponentMode: () => void
	cancelComponentPlacement: () => void
	placeComponent: (component: CircuitComponent) => void
	openContextMenu: (event: MouseEvent, symbol: ComponentSymbol) => Promise<void>
}

export class ComponentLibraryController {
	public render(leftOffcanvasAccordion: HTMLDivElement, symbols: ComponentSymbol[], callbacks: ComponentLibraryCallbacks): void {
		const groupedSymbols = symbols.reduce(
			(grouped: Map<string, ComponentSymbol[]>, symbol) => {
				const groupName = symbol.groupName || "Unsorted components"
				const group = grouped.get(groupName)
				if (group) {
					group.push(symbol)
				} else {
					grouped.set(groupName, [symbol])
				}
				return grouped
			},
			new Map<string, ComponentSymbol[]>()
		)

		for (const [groupName, groupedSymbolsInGroup] of groupedSymbols.entries()) {
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

			for (const symbol of groupedSymbolsInGroup) {
				this.renderSymbolButton(accordionItemBody, symbol, callbacks)
			}
		}
	}

	public filterComponents(evt: Event): void {
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

	private renderSymbolButton(parent: HTMLDivElement, symbol: ComponentSymbol, callbacks: ComponentLibraryCallbacks) {
		const addButton: HTMLDivElement = parent.appendChild(document.createElement("div"))
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
			callbacks.switchToComponentMode()

			callbacks.cancelComponentPlacement()
			if (symbol.isNodeSymbol) {
				callbacks.placeComponent(new NodeSymbolComponent(symbol))
			} else {
				callbacks.placeComponent(new PathSymbolComponent(symbol))
			}

			callbacks.hideDrawer()
		}

		addButton.addEventListener("mouseup", listener)
		addButton.addEventListener("touchstart", listener, { passive: false })
		addButton.addEventListener("contextmenu", async (ev) => {
			await callbacks.openContextMenu(ev, symbol)
		})

		const svgIcon = SVG.SVG().addTo(addButton)
		const firstVariant = symbol._mapping.values().toArray()[0]
		let viewBox = new SVG.Box(firstVariant ? firstVariant.viewBox : new SVG.Box(0, 0, 30, 15))
		const maxStroke = Number.isFinite(symbol.maxStroke) ? symbol.maxStroke : 0

		viewBox.width += maxStroke
		viewBox.height += maxStroke
		viewBox.x -= maxStroke / 2
		viewBox.y -= maxStroke / 2

		if (
			!Number.isFinite(viewBox.x) ||
			!Number.isFinite(viewBox.y) ||
			!Number.isFinite(viewBox.w) ||
			!Number.isFinite(viewBox.h)
		) {
			viewBox = new SVG.Box(0, 0, 30, 15)
		}

		svgIcon.viewbox(viewBox).width(viewBox.width).height(viewBox.height)

		const use = svgIcon.use(symbol.symbolElement.id())
		use.width(symbol.viewBox.width).height(symbol.viewBox.height)
		use.stroke(defaultStroke).fill(defaultFill).node.style.color = defaultStroke
	}
}
