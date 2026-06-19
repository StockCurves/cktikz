import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("bootstrap", () => ({
	Modal: class {
		public constructor(private readonly element: HTMLElement) {}

		public show() {
			this.element.dispatchEvent(new Event("shown.bs.modal"))
		}

		public hide() {
			this.element.dispatchEvent(new Event("hidden.bs.modal"))
		}
	},
}))

import { CustomSymbolSaveController } from "../src/scripts/controllers/customSymbolSaveController"

describe("CustomSymbolSaveController", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="saveSymbolModal"></div>
			<input id="saveSymbolNameInput" />
			<select id="saveSymbolCategorySelect"></select>
			<div id="saveSymbolNewCategoryContainer" class="d-none"></div>
			<input id="saveSymbolNewCategoryInput" />
			<button id="saveSymbolModalConfirm"></button>
		`
	})

	it("returns a saved name and existing category", async () => {
		const controller = new CustomSymbolSaveController()
		const promise = controller.open({
			initialName: "Amp",
			categories: ["Mine"],
			showAlert: vi.fn(async () => {}),
		})

		const nameInput = document.getElementById("saveSymbolNameInput") as HTMLInputElement
		const categorySelect = document.getElementById("saveSymbolCategorySelect") as HTMLSelectElement
		expect(nameInput.value).toBe("Amp")
		expect(Array.from(categorySelect.options).map((option) => option.value)).toEqual(["Mine", "__NEW_CATEGORY__"])

		;(document.getElementById("saveSymbolModalConfirm") as HTMLButtonElement).click()
		await expect(promise).resolves.toEqual({ name: "Amp", categoryName: "Mine" })
	})

	it("shows new-category input and validates empty form values", async () => {
		const controller = new CustomSymbolSaveController()
		const showAlert = vi.fn(async () => {})
		const promise = controller.open({
			initialName: "",
			categories: [],
			showAlert,
		})

		const nameInput = document.getElementById("saveSymbolNameInput") as HTMLInputElement
		const categorySelect = document.getElementById("saveSymbolCategorySelect") as HTMLSelectElement
		const newCategoryContainer = document.getElementById("saveSymbolNewCategoryContainer") as HTMLDivElement
		const newCategoryInput = document.getElementById("saveSymbolNewCategoryInput") as HTMLInputElement
		const confirmButton = document.getElementById("saveSymbolModalConfirm") as HTMLButtonElement

		expect(Array.from(categorySelect.options).map((option) => option.value)).toEqual(["My Favorite", "__NEW_CATEGORY__"])

		confirmButton.click()
		await Promise.resolve()
		expect(showAlert).toHaveBeenCalledWith("Save Custom Component", "Please enter a component name.")

		nameInput.value = "Osc"
		categorySelect.value = "__NEW_CATEGORY__"
		categorySelect.dispatchEvent(new Event("change"))
		expect(newCategoryContainer.classList.contains("d-none")).toBe(false)

		confirmButton.click()
		await Promise.resolve()
		expect(showAlert).toHaveBeenLastCalledWith("Save Custom Component", "Please enter a new category name.")

		newCategoryInput.value = "Custom"
		confirmButton.click()
		await expect(promise).resolves.toEqual({ name: "Osc", categoryName: "Custom" })
	})
})
