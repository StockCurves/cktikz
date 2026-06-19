import * as SVG from "@svgdotjs/svg.js"
import { ContextMenu } from "./contextMenu"

export type CustomCategory = { name: string; symbolIds: string[] }
export type DrawerRuntimeSymbol = {
	tikzName: string
	displayName?: string
	isNodeSymbol?: boolean
	maxStroke?: number
	viewBox: { width: number; height: number }
	symbolElement: { id(): string }
	_mapping: { values(): { toArray(): Array<{ viewBox: SVG.Box | { x: number; y: number; width: number; height: number; w?: number; h?: number } }> } }
}
export type DrawerCustomSymbolRecord = {
	id: string
	tikzName: string
	displayName: string
	isCustomSymbol: boolean
	subcircuitData?: any
	svgPreview?: string | null
}

const defaultStroke = "var(--bs-emphasis-color)"
const defaultFill = "var(--bs-body-bg)"

type CustomSymbolDrawerActions = {
	hideDrawer: () => void
	openRenameModal: (title: string, currentName: string) => Promise<string | null>
	openConfirm: (title: string, body: string) => Promise<boolean>
	renameCategory: (oldName: string, newName: string) => void
	deleteCategory: (name: string) => void
	removeSymbolFromCategory: (categoryName: string, symbolId: string) => void
	openSymbolEditor: (symbolId: string) => void
	renameGraphicsSymbol: (oldName: string, newName: string) => void
	deleteGraphicsSymbol: (symbolId: string) => void
	renameSubcircuit: (symbolId: string, newName: string) => void
	deleteSubcircuit: (symbolId: string) => void
	placeStandardSymbol: (symbol: DrawerRuntimeSymbol) => void
	placeSubcircuit: (symbol: DrawerCustomSymbolRecord) => void
	generateSubcircuitPreview: (subcircuitData: any) => Promise<string | null>
	persistCustomSymbol: (customSymbol: DrawerCustomSymbolRecord) => Promise<void>
}

export class CustomSymbolDrawerController {
	private readonly accordion: HTMLDivElement

	public constructor() {
		this.accordion = document.getElementById("leftOffcanvasAccordion") as HTMLDivElement
	}

	public render(
		customCategories: CustomCategory[],
		customSymbols: DrawerCustomSymbolRecord[],
		runtimeSymbols: DrawerRuntimeSymbol[],
		actions: CustomSymbolDrawerActions
	) {
		const existingCustoms = this.accordion.getElementsByClassName("custom-category-accordion-item")
		while (existingCustoms.length > 0) {
			existingCustoms[0].remove()
		}

		for (const category of customCategories) {
			const group = this.buildCategoryGroup(category, customSymbols, runtimeSymbols, actions)
			if (this.accordion.firstChild) {
				this.accordion.insertBefore(group, this.accordion.firstChild)
			} else {
				this.accordion.appendChild(group)
			}
		}
	}

	private buildCategoryGroup(
		category: CustomCategory,
		customSymbols: DrawerCustomSymbolRecord[],
		runtimeSymbols: DrawerRuntimeSymbol[],
		actions: CustomSymbolDrawerActions
	) {
		const collapseGroupID = `collapseGroup-custom-${category.name.replace(/[^\d\w\-_]+/gi, "-")}`

		const accordionGroup = document.createElement("div")
		accordionGroup.classList.add("accordion-item", "custom-category-accordion-item")

		const accordionItemHeader = accordionGroup.appendChild(document.createElement("h2"))
		accordionItemHeader.classList.add("accordion-header")

		const accordionItemButton = accordionItemHeader.appendChild(document.createElement("button"))
		accordionItemButton.classList.add("accordion-button")
		accordionItemButton.innerText = category.name
		accordionItemButton.setAttribute("aria-controls", collapseGroupID)
		accordionItemButton.setAttribute("aria-expanded", "true")
		accordionItemButton.setAttribute("data-bs-target", `#${collapseGroupID}`)
		accordionItemButton.setAttribute("data-bs-toggle", "collapse")
		accordionItemButton.type = "button"
		accordionItemButton.addEventListener("contextmenu", (event) => {
			event.preventDefault()
			event.stopPropagation()
			const menu = new ContextMenu([
				{ result: "rename", iconText: "edit", text: "Rename category..." },
				{ result: "delete", iconText: "delete", text: `Delete category "${category.name}"` },
			])
			menu.openForResult(event.clientX, event.clientY).then(async (result) => {
				if (result === "rename") {
					const newName = await actions.openRenameModal("Rename Category", category.name)
					if (newName) actions.renameCategory(category.name, newName)
				} else if (result === "delete") {
					if (await actions.openConfirm("Delete Category", `Are you sure you want to delete category "${category.name}"?`)) {
						actions.deleteCategory(category.name)
					}
				}
			}).catch(() => {})
		})

		const accordionItemCollapse = accordionGroup.appendChild(document.createElement("div"))
		accordionItemCollapse.classList.add("accordion-collapse", "collapse", "show")
		accordionItemCollapse.id = collapseGroupID
		accordionItemCollapse.setAttribute("data-bs-parent", "#leftOffcanvasAccordion")

		const accordionItemBody = accordionItemCollapse.appendChild(document.createElement("div"))
		accordionItemBody.classList.add("accordion-body", "iconLibAccordionBody")

		for (const symbolId of category.symbolIds) {
			const standardSymbol = runtimeSymbols.find((symbol) => symbol.tikzName === symbolId)
			const customSymbol = customSymbols.find((symbol) => symbol.id === symbolId || symbol.id === `custom-${symbolId}`)
			if (!standardSymbol && !customSymbol) continue

			const addButton = accordionItemBody.appendChild(document.createElement("div"))
			addButton.classList.add("libComponent")
			addButton.ariaRoleDescription = "button"
			this.bindSymbolContextMenu(addButton, category.name, symbolId, customSymbol, actions)

			if (standardSymbol) {
				this.renderStandardSymbolButton(addButton, standardSymbol, customSymbol, actions)
			} else if (customSymbol) {
				this.renderSubcircuitButton(addButton, customSymbol, actions)
			}
		}

		return accordionGroup
	}

	private bindSymbolContextMenu(
		button: HTMLDivElement,
		categoryName: string,
		symbolId: string,
		customSymbol: DrawerCustomSymbolRecord | undefined,
		actions: CustomSymbolDrawerActions
	) {
		button.addEventListener("contextmenu", (event) => {
			event.preventDefault()
			event.stopPropagation()

			if (customSymbol?.isCustomSymbol) {
				const menu = new ContextMenu([
					{ result: "edit", iconText: "edit", text: "Edit Symbol..." },
					{ result: "rename", iconText: "drive_file_rename_outline", text: "Rename symbol..." },
					{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" },
					{ result: "delete", iconText: "delete", text: "Delete custom symbol definition" },
				])
				menu.openForResult(event.clientX, event.clientY).then(async (result) => {
					if (result === "edit") {
						actions.openSymbolEditor(customSymbol.id)
					} else if (result === "rename") {
						const newName = await actions.openRenameModal("Rename Custom Symbol", symbolId)
						if (newName) actions.renameGraphicsSymbol(symbolId, newName)
					} else if (result === "remove") {
						actions.removeSymbolFromCategory(categoryName, symbolId)
					} else if (result === "delete") {
						if (await actions.openConfirm(
							"Delete Symbol",
							`Are you sure you want to completely delete custom symbol "${symbolId}"?\n(Components already placed on the canvas will not be affected)`
						)) {
							actions.deleteGraphicsSymbol(symbolId)
						}
					}
				}).catch(() => {})
				return
			}

			if (customSymbol) {
				const menu = new ContextMenu([
					{ result: "rename", iconText: "edit", text: "Rename subcircuit..." },
					{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" },
					{ result: "delete", iconText: "delete", text: "Delete subcircuit definition" },
				])
				menu.openForResult(event.clientX, event.clientY).then(async (result) => {
					if (result === "rename") {
						const newName = await actions.openRenameModal("Rename Subcircuit", customSymbol.displayName)
						if (newName) actions.renameSubcircuit(customSymbol.id, newName)
					} else if (result === "remove") {
						actions.removeSymbolFromCategory(categoryName, symbolId)
					} else if (result === "delete") {
						if (await actions.openConfirm(
							"Delete Subcircuit",
							`Are you sure you want to completely delete subcircuit "${customSymbol.displayName}"?\n(Components already placed on the canvas will not be affected)`
						)) {
							actions.deleteSubcircuit(symbolId)
						}
					}
				}).catch(() => {})
				return
			}

			const menu = new ContextMenu([
				{ result: "remove", iconText: "playlist_remove", text: "Remove from this category" },
			])
			menu.openForResult(event.clientX, event.clientY).then((result) => {
				if (result === "remove") actions.removeSymbolFromCategory(categoryName, symbolId)
			}).catch(() => {})
		})
	}

	private renderStandardSymbolButton(
		button: HTMLDivElement,
		standardSymbol: DrawerRuntimeSymbol,
		customSymbol: DrawerCustomSymbolRecord | undefined,
		actions: CustomSymbolDrawerActions
	) {
		button.setAttribute("searchData", [standardSymbol.tikzName, standardSymbol.isNodeSymbol ? "node" : "path"].join(" "))
		button.title = standardSymbol.displayName || standardSymbol.tikzName

		const listener = (event: MouseEvent) => {
			if (event.button !== 0) return
			event.preventDefault()
			actions.placeStandardSymbol(standardSymbol)
			actions.hideDrawer()
		}
		button.addEventListener("mouseup", listener)
		button.addEventListener("touchstart", listener, { passive: false })
		button.addEventListener("dblclick", (event) => {
			event.preventDefault()
			event.stopPropagation()
			if (customSymbol?.isCustomSymbol) {
				actions.openSymbolEditor(customSymbol.id)
			}
		})

		const svgIcon = SVG.SVG().addTo(button)
		const firstVariant = standardSymbol._mapping.values().toArray()[0]
		let viewBox = new SVG.Box(firstVariant ? firstVariant.viewBox : new SVG.Box(0, 0, 30, 15))
		const maxStroke = Number.isFinite(standardSymbol.maxStroke) ? standardSymbol.maxStroke : 0
		viewBox.width += maxStroke
		viewBox.height += maxStroke
		viewBox.x -= maxStroke / 2
		viewBox.y -= maxStroke / 2
		if (!Number.isFinite(viewBox.x) || !Number.isFinite(viewBox.y) || !Number.isFinite(viewBox.w) || !Number.isFinite(viewBox.h)) {
			viewBox = new SVG.Box(0, 0, 30, 15)
		}
		svgIcon.viewbox(viewBox).width(viewBox.width).height(viewBox.height)
		const use = svgIcon.use(standardSymbol.symbolElement.id())
		use.width(standardSymbol.viewBox.width).height(standardSymbol.viewBox.height)
		use.stroke(defaultStroke).fill(defaultFill).node.style.color = defaultStroke
	}

	private renderSubcircuitButton(button: HTMLDivElement, customSymbol: DrawerCustomSymbolRecord, actions: CustomSymbolDrawerActions) {
		button.setAttribute("searchData", customSymbol.displayName || customSymbol.tikzName)
		button.title = customSymbol.displayName

		const listener = (event: MouseEvent) => {
			if (event.button !== 0) return
			event.preventDefault()
			actions.placeSubcircuit(customSymbol)
			actions.hideDrawer()
		}
		button.addEventListener("mouseup", listener)
		button.addEventListener("touchstart", listener, { passive: false })

		if (customSymbol.svgPreview && customSymbol.svgPreview.includes("<use ")) {
			customSymbol.svgPreview = null
		}
		if (customSymbol.svgPreview) {
			button.innerHTML = customSymbol.svgPreview
			return
		}

		actions.generateSubcircuitPreview(customSymbol.subcircuitData).then(async (preview) => {
			if (preview) {
				customSymbol.svgPreview = preview
				button.innerHTML = preview
				await actions.persistCustomSymbol(customSymbol)
				return
			}

			const svgIcon = SVG.SVG().addTo(button)
			svgIcon.viewbox(0, 0, 30, 15).width(30).height(15)
			svgIcon.rect(26, 12).move(2, 1.5).fill("none").stroke({ color: defaultStroke, width: 1 })
			svgIcon.text((add) => {
				add.tspan(customSymbol.displayName.substring(0, 4)).font({ size: 6 }).fill({ color: defaultStroke }).move(5, 9)
			})
		})
	}
}
