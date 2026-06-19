import { Modal } from "bootstrap"

export type SaveSymbolModalResult = {
	name: string
	categoryName: string
}

type SaveSymbolModalOptions = {
	initialName: string
	categories: string[]
	fallbackCategoryName?: string
	showAlert: (title: string, body: string) => Promise<void>
}

export class CustomSymbolSaveController {
	private readonly modalElement: HTMLDivElement
	private readonly nameInput: HTMLInputElement
	private readonly categorySelect: HTMLSelectElement
	private readonly newCategoryContainer: HTMLDivElement
	private readonly newCategoryInput: HTMLInputElement
	private readonly confirmButton: HTMLButtonElement

	public constructor() {
		this.modalElement = document.getElementById("saveSymbolModal") as HTMLDivElement
		this.nameInput = document.getElementById("saveSymbolNameInput") as HTMLInputElement
		this.categorySelect = document.getElementById("saveSymbolCategorySelect") as HTMLSelectElement
		this.newCategoryContainer = document.getElementById("saveSymbolNewCategoryContainer") as HTMLDivElement
		this.newCategoryInput = document.getElementById("saveSymbolNewCategoryInput") as HTMLInputElement
		this.confirmButton = document.getElementById("saveSymbolModalConfirm") as HTMLButtonElement
	}

	public open(options: SaveSymbolModalOptions): Promise<SaveSymbolModalResult | null> {
		return new Promise((resolve) => {
			this.nameInput.value = options.initialName
			this.newCategoryInput.value = ""
			this.newCategoryContainer.classList.add("d-none")
			this.populateCategoryOptions(options.categories, options.fallbackCategoryName ?? "My Favorite")

			const modal = new Modal(this.modalElement)
			let confirmed = false
			let resolvedValue: SaveSymbolModalResult | null = null

			const onCategoryChange = () => {
				if (this.categorySelect.value === "__NEW_CATEGORY__") {
					this.newCategoryContainer.classList.remove("d-none")
				} else {
					this.newCategoryContainer.classList.add("d-none")
				}
			}

			const cleanup = () => {
				this.categorySelect.removeEventListener("change", onCategoryChange)
				this.confirmButton.removeEventListener("click", onConfirm)
				this.modalElement.removeEventListener("hidden.bs.modal", onDismiss)
			}

			const onDismiss = () => {
				cleanup()
				resolve(confirmed ? resolvedValue : null)
			}

			const onConfirm = async () => {
				const name = this.nameInput.value.trim()
				if (!name) {
					await options.showAlert("Save Custom Component", "Please enter a component name.")
					return
				}

				let categoryName = this.categorySelect.value
				if (categoryName === "__NEW_CATEGORY__") {
					categoryName = this.newCategoryInput.value.trim()
					if (!categoryName) {
						await options.showAlert("Save Custom Component", "Please enter a new category name.")
						return
					}
				}

				confirmed = true
				resolvedValue = { name, categoryName }
				modal.hide()
			}

			this.categorySelect.addEventListener("change", onCategoryChange)
			this.confirmButton.addEventListener("click", onConfirm)
			this.modalElement.addEventListener("hidden.bs.modal", onDismiss, { once: true })
			this.modalElement.addEventListener("shown.bs.modal", () => {
				this.nameInput.focus()
				this.nameInput.select()
			}, { once: true })

			modal.show()
		})
	}

	private populateCategoryOptions(categories: string[], fallbackCategoryName: string) {
		this.categorySelect.innerHTML = ""
		for (const category of categories) {
			const option = document.createElement("option")
			option.value = category
			option.textContent = category
			this.categorySelect.appendChild(option)
		}

		if (categories.length === 0) {
			const option = document.createElement("option")
			option.value = fallbackCategoryName
			option.textContent = fallbackCategoryName
			this.categorySelect.appendChild(option)
		}

		const newCategoryOption = document.createElement("option")
		newCategoryOption.value = "__NEW_CATEGORY__"
		newCategoryOption.textContent = "+ New category..."
		this.categorySelect.appendChild(newCategoryOption)
	}
}
