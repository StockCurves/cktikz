import hotkeys from "hotkeys-js"
import FileSaver from "file-saver"
import {
	MainController,
	CircuitComponent,
	EnvironmentVariableController,
	parseTikz,
	Undo
} from "../internal"

export class TikzEditorController {
	private static _instance: TikzEditorController
	public static get instance(): TikzEditorController {
		if (!TikzEditorController._instance) {
			TikzEditorController._instance = new TikzEditorController()
		}
		return TikzEditorController._instance
	}

	private editorContainer: HTMLDivElement
	private editorResizer: HTMLDivElement
	private editorTextArea: HTMLTextAreaElement
	private editorError: HTMLDivElement
	private applyButton: HTMLButtonElement
	private copyCodeButton: HTMLButtonElement
	private saveCodeButton: HTMLButtonElement

	private isResizing = false
	private startX = 0
	private startWidth = 0

	private constructor() {
		this.editorContainer = document.getElementById("tikzEditorContainer") as HTMLDivElement
		this.editorResizer = document.getElementById("tikzEditorResizer") as HTMLDivElement
		this.editorTextArea = document.getElementById("tikzEditorTextArea") as HTMLTextAreaElement
		this.editorError = document.getElementById("tikzEditorError") as HTMLDivElement
		this.applyButton = document.getElementById("applyTikzButton") as HTMLButtonElement
		this.copyCodeButton = document.getElementById("copyTikzCodeButton") as HTMLButtonElement
		this.saveCodeButton = document.getElementById("saveTikzCodeButton") as HTMLButtonElement

		this.initEvents()
	}

	public init() {
		// Initialize global hotkey for Ctrl+B
		hotkeys("ctrl+b,command+b", () => {
			this.toggleVisibility()
			return false
		})

		// Override hotkeys filter to allow Ctrl+B inside textarea
		hotkeys.filter = (event: KeyboardEvent) => {
			const target = (event.target || event.srcElement) as HTMLElement
			const tagName = target.tagName
			const isCtrlB = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b"
			if (isCtrlB) {
				return true
			}
			return !(tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA" || target.isContentEditable)
		}
	}

	private initEvents() {
		// Prevent shortcut propagation inside textarea, except for Ctrl+B
		this.editorTextArea.addEventListener("keydown", (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
				return
			}
			e.stopPropagation()
		})

		// Apply button click
		this.applyButton.addEventListener("click", () => {
			this.applyEditorText()
		})

		// Copy code button click
		this.copyCodeButton.addEventListener("click", () => {
			navigator.clipboard.writeText(this.editorTextArea.value)
		})

		// Save code button click
		this.saveCodeButton.addEventListener("click", () => {
			const filename = (MainController.instance.designName.value || "Circuit").replace(/[^a-z0-9]/gi, "_") || "Circuit"
			FileSaver.saveAs(
				new Blob([this.editorTextArea.value], { type: "text/x-tex;charset=utf-8" }),
				filename + ".tikz"
			)
		})

		// Mouse drag resizing
		this.editorResizer.addEventListener("mousedown", (e: MouseEvent) => {
			e.preventDefault()
			this.isResizing = true
			this.startX = e.clientX
			this.startWidth = this.editorContainer.offsetWidth

			document.addEventListener("mousemove", this.handleMouseMove)
			document.addEventListener("mouseup", this.handleMouseUp)
		})
	}

	private handleMouseMove = (e: MouseEvent) => {
		if (!this.isResizing) return
		const deltaX = e.clientX - this.startX
		const newWidth = Math.max(200, Math.min(600, this.startWidth + deltaX))
		this.editorContainer.style.width = newWidth + "px"
	}

	private handleMouseUp = () => {
		this.isResizing = false
		document.removeEventListener("mousemove", this.handleMouseMove)
		document.removeEventListener("mouseup", this.handleMouseUp)
	}

	public toggleVisibility() {
		if (this.editorContainer.classList.contains("d-none")) {
			this.editorContainer.classList.remove("d-none")
			this.editorContainer.classList.add("d-flex")
			this.editorResizer.classList.remove("d-none")
			this.updateEditorText()
		} else {
			this.editorContainer.classList.add("d-none")
			this.editorContainer.classList.remove("d-flex")
			this.editorResizer.classList.add("d-none")
		}
	}

	public isVisible(): boolean {
		return !this.editorContainer.classList.contains("d-none")
	}

	/**
	 * Generates TikZ code from the canvas and updates the text area.
	 */
	public updateEditorText() {
		if (!this.isVisible()) return

		let circuitElements = []
		let requiredTikzLibraries: Set<string> = new Set<string>()
		for (const circuitElement of MainController.instance.circuitComponents) {
			circuitElement.requiredTikzLibraries().forEach((item) => requiredTikzLibraries.add(item))
			circuitElements.push("\t" + circuitElement.toTikzString())
		}
		let libraryStr =
			requiredTikzLibraries.size > 0 ?
				"\\usetikzlibrary{" + requiredTikzLibraries.values().toArray().join(", ") + "}"
			:	""

		const subcircuitsTikzset = MainController.instance.getCustomSubcircuitsTikzset()
		const customSymbolsTikzset = MainController.instance.getCustomSymbolsTikzset()
		const tikzSettings = EnvironmentVariableController.instance.getTikzSettings()
		let arr = [
			"\\begin{tikzpicture}" + "[" + ["transform shape"].concat(tikzSettings.environment).join(", ") + "]",
			...tikzSettings.ctikzset.map((setting) => "\t\\ctikzset{" + setting + "}"),
			"\t% Paths, nodes and wires:",
			...circuitElements,
			"\\end{tikzpicture}",
		]
		if (customSymbolsTikzset) {
			arr = [customSymbolsTikzset].concat(arr)
		}
		if (subcircuitsTikzset) {
			arr = [subcircuitsTikzset].concat(arr)
		}
		if (libraryStr) {
			arr = [libraryStr].concat(arr)
		}
		this.editorTextArea.value = arr.join("\n")
		this.editorError.style.display = "none"
	}

	/**
	 * Reconstructs the canvas from the parsed TikZ code.
	 */
	public applyEditorText() {
		try {
			const parsedSaveObjects = parseTikz(this.editorTextArea.value)
			this.editorError.style.display = "none"

			// Clear all existing components
			while (MainController.instance.circuitComponents.length > 0) {
				MainController.instance.removeComponent(MainController.instance.circuitComponents[0])
			}

			// Instantiate new ones from the parsed JSON save objects
			for (const obj of parsedSaveObjects) {
				CircuitComponent.fromJson(obj)
			}

			// Save state in undo stack
			Undo.addState()
		} catch (error: any) {
			this.editorError.innerText = "Error parsing TikZ:\n" + error.message
			this.editorError.style.display = "block"
		}
	}
}
