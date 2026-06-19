import { ContextMenu } from "./contextMenu"

export type SymbolLibraryMenuAction =
	| { type: "none" }
	| { type: "edit" }
	| { type: "rename"; newName: string }
	| { type: "delete" }
	| { type: "add-to-category"; categoryName: string }
	| { type: "create-category-and-add"; categoryName: string }
	| { type: "duplicate"; newName: string; categoryName: string }

type SymbolLibraryMenuOptions = {
	clientX: number
	clientY: number
	symbolName: string
	isCustomSymbol: boolean
	categoryNames: string[]
	openPrompt: (title: string, message: string, defaultValue?: string) => Promise<string | null>
	openRenameModal: (title: string, currentName: string) => Promise<string | null>
	openConfirm: (title: string, body: string) => Promise<boolean>
}

export class SymbolLibraryMenuController {
	public async openForSymbol(options: SymbolLibraryMenuOptions): Promise<SymbolLibraryMenuAction> {
		if (!options.isCustomSymbol && options.categoryNames.length === 0) {
			const categoryName = await options.openPrompt(
				"Create Category",
				"You don't have any custom categories. Please enter a name to create one:"
			)
			return categoryName ? { type: "create-category-and-add", categoryName } : { type: "none" }
		}

		const entries: { result: string; text: string; iconText?: string }[] = []
		if (options.isCustomSymbol) {
			entries.push(
				{ result: "edit", iconText: "edit", text: "Edit Symbol..." },
				{ result: "rename", iconText: "drive_file_rename_outline", text: "Rename symbol..." }
			)
		}

		for (const categoryName of options.categoryNames) {
			entries.push({ result: `add:${categoryName}`, text: `Add to "${categoryName}"` })
		}

		entries.push({ result: "new", text: "Add to new category..." })
		entries.push({ result: "duplicate", text: "Duplicate symbol and customize..." })

		if (options.isCustomSymbol) {
			entries.push({ result: "delete", iconText: "delete", text: "Delete from library" })
		}

		const result = await new ContextMenu(entries).openForResult(options.clientX, options.clientY).catch(() => null)
		if (!result) return { type: "none" }
		if (result === "edit") return { type: "edit" }
		if (result === "rename") {
			const newName = await options.openRenameModal("Rename Custom Symbol", options.symbolName)
			return newName ? { type: "rename", newName } : { type: "none" }
		}
		if (result === "delete") {
			const ok = await options.openConfirm(
				"Delete Symbol",
				`Are you sure you want to completely delete custom symbol "${options.symbolName}"?\n(Components already placed on the canvas will not be affected)`
			)
			return ok ? { type: "delete" } : { type: "none" }
		}
		if (result === "new") {
			const categoryName = await options.openPrompt("New Category", "Please enter a custom category name:")
			return categoryName ? { type: "create-category-and-add", categoryName } : { type: "none" }
		}
		if (result.startsWith("add:")) {
			return { type: "add-to-category", categoryName: result.substring(4) }
		}
		if (result !== "duplicate") return { type: "none" }

		const newName = await options.openPrompt(
			"Duplicate Symbol",
			"Please enter a name for the new custom symbol (e.g., hvnmos):"
		)
		if (!newName?.trim()) return { type: "none" }

		const categoryOptions = options.categoryNames.map((categoryName, index) => `${index + 1}. ${categoryName}`).join("\n")
		const categoryInput = await options.openPrompt(
			"Select Category",
			`Please enter a number to select a category:\n${categoryOptions}\n\nOr enter a new category name directly:`
		)
		if (!categoryInput?.trim()) return { type: "none" }

		const rawCategory = categoryInput.trim()
		const categoryIndex = Number.parseInt(rawCategory, 10)
		const categoryName = !Number.isNaN(categoryIndex) && categoryIndex >= 1 && categoryIndex <= options.categoryNames.length
			? options.categoryNames[categoryIndex - 1]
			: rawCategory

		return { type: "duplicate", newName: newName.trim(), categoryName }
	}
}
