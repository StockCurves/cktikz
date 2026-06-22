import hotkeys from "hotkeys-js"
import FileSaver from "file-saver"
import {
	MainController,
	CircuitComponent,
	EnvironmentVariableController,
	parseTikz,
	Undo,
	TemplateController,
	SelectionController,
	LiveRenderController,
	CanvasController
} from "../internal"

function getEditorText(editor: HTMLDivElement): string {
	const lines: string[] = []
	const childNodes = Array.from(editor.childNodes)
	for (const node of childNodes) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement
			if (el.classList.contains("error-msg")) continue
			
			if (el.tagName === "DIV") {
				let lineText = ""
				el.childNodes.forEach((child) => {
					if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).classList.contains("error-msg")) {
						return
					}
					lineText += child.textContent || ""
				})
				lines.push(lineText)
			} else {
				lines.push(el.textContent || "")
			}
		} else if (node.nodeType === Node.TEXT_NODE) {
			lines.push(node.textContent || "")
		}
	}
	if (lines.length === 0) return editor.innerText || ""
	return lines.join("\n")
}

function setEditorText(editor: HTMLDivElement, text: string) {
	editor.innerHTML = ""
	const lines = text.split("\n")
	for (const line of lines) {
		const lineDiv = document.createElement("div")
		if (line === "") {
			lineDiv.appendChild(document.createElement("br"))
		} else {
			lineDiv.textContent = line
		}
		editor.appendChild(lineDiv)
	}
}

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
	private editorTextArea: HTMLDivElement
	private editorError: HTMLDivElement
	private applyButton: HTMLButtonElement
	private copyCodeButton: HTMLButtonElement
	private saveCodeButton: HTMLButtonElement
	private saveServerButton: HTMLButtonElement

	private isResizing = false
	private startX = 0
	private startWidth = 0

	private constructor() {
		this.editorContainer = document.getElementById("tikzEditorContainer") as HTMLDivElement
		this.editorResizer = document.getElementById("tikzEditorResizer") as HTMLDivElement
		this.editorTextArea = document.getElementById("tikzEditorTextArea") as HTMLDivElement
		this.editorError = document.getElementById("tikzEditorError") as HTMLDivElement
		this.applyButton = document.getElementById("applyTikzButton") as HTMLButtonElement
		this.copyCodeButton = document.getElementById("copyTikzCodeButton") as HTMLButtonElement
		this.saveCodeButton = document.getElementById("saveTikzCodeButton") as HTMLButtonElement
		this.saveServerButton = document.getElementById("saveServerCodeButton") as HTMLButtonElement

		this.initEvents()
	}

	public init() {
		// Initialize global hotkey for Ctrl+B
		hotkeys("ctrl+b,command+b", () => {
			this.toggleVisibility()
			return false
		})

		// Override hotkeys filter to allow Ctrl+B inside editor
		hotkeys.filter = (event: KeyboardEvent) => {
			if (document.getElementById("symbolEditorModal")?.classList.contains("show")) {
				return false
			}
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
		// Prevent shortcut propagation inside editor, except for Ctrl+B
		this.editorTextArea.addEventListener("keydown", (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
				return
			}
			e.stopPropagation()
		})

		// Trigger debounced render on user typing in editor
		this.editorTextArea.addEventListener("input", () => {
			LiveRenderController.instance.triggerDebouncedRender()
		})

		// Apply button click
		this.applyButton.addEventListener("click", () => {
			this.applyEditorText()
		})

		// Copy code button click
		this.copyCodeButton.addEventListener("click", () => {
			navigator.clipboard.writeText(this.getCode())
		})

		// Save code button click
		this.saveCodeButton.addEventListener("click", () => {
			const filename = (MainController.instance.designName.value || "Circuit").replace(/[^a-z0-9]/gi, "_") || "Circuit"
			FileSaver.saveAs(
				new Blob([this.getCode()], { type: "text/x-tex;charset=utf-8" }),
				filename + ".tikz"
			)
		})

		// Save to server button click
		if (this.saveServerButton) {
			this.saveServerButton.addEventListener("click", () => {
				TemplateController.instance.openSaveModal()
			})
		}

		const navbarSaveWork = document.getElementById("navbarSaveWorkButton") as HTMLButtonElement | null
		navbarSaveWork?.addEventListener("click", () => {
			TemplateController.instance.openSaveModal()
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

		requestAnimationFrame(() => {
			CanvasController.instance?.fitView()
			LiveRenderController.instance?.fitView()
		})
	}

	public isVisible(): boolean {
		return !this.editorContainer.classList.contains("d-none")
	}

	public setCode(code: string) {
		setEditorText(this.editorTextArea, code)
		LiveRenderController.instance.triggerDebouncedRender()
	}

	public getCode(): string {
		return getEditorText(this.editorTextArea)
	}

	public clearHighlightsAndErrors() {
		const errorMsgs = this.editorTextArea.querySelectorAll(".error-msg")
		errorMsgs.forEach((el) => el.remove())

		const lines = Array.from(this.editorTextArea.children) as HTMLDivElement[]
		lines.forEach((line) => {
			line.classList.remove("highlight-blue", "highlight-red")
		})
		
		this.editorError.style.display = "none"
	}

	public highlightSelectedComponents() {
		if (!this.isVisible()) return

		this.clearHighlightsAndErrors()

		const selected = SelectionController.instance.currentlySelectedComponents
		if (selected.length === 0) return

		const lineDivs = Array.from(this.editorTextArea.children) as HTMLDivElement[]
		
		for (const comp of selected) {
			if (comp.tikzLines) {
				const [startLine, endLine] = comp.tikzLines
				for (let i = startLine; i <= endLine; i++) {
					const div = lineDivs[i - 1]
					if (div) {
						div.classList.add("highlight-blue")
					}
				}
			}
		}
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
			circuitElements.push("  " + circuitElement.toTikzString())
		}
		let libraryStr =
			requiredTikzLibraries.size > 0 ?
				"\\usetikzlibrary{" + requiredTikzLibraries.values().toArray().join(", ") + "}"
			:	""

		const subcircuitsTikzset = MainController.instance.getCustomSubcircuitsTikzset()
		const customSymbolsTikzset = MainController.instance.getCustomSymbolsTikzset()
		const tikzSettings = EnvironmentVariableController.instance.getTikzSettings()
		
		let currentLineIdx = 0

		if (libraryStr) {
			currentLineIdx++
		}
		if (subcircuitsTikzset) {
			currentLineIdx += subcircuitsTikzset.split("\n").length
		}
		if (customSymbolsTikzset) {
			currentLineIdx += customSymbolsTikzset.split("\n").length
		}

		currentLineIdx++

		currentLineIdx += tikzSettings.ctikzset.length

		currentLineIdx++

		for (let idx = 0; idx < MainController.instance.circuitComponents.length; idx++) {
			const circuitElement = MainController.instance.circuitComponents[idx]
			const tikzStr = circuitElements[idx]
			const lineCount = tikzStr.split("\n").length
			circuitElement.tikzLines = [currentLineIdx + 1, currentLineIdx + lineCount]
			currentLineIdx += lineCount
		}

		let arr = [
			"\\begin{tikzpicture}" + "[" + ["transform shape"].concat(tikzSettings.environment).join(", ") + "]",
			...tikzSettings.ctikzset.map((setting) => "  \\ctikzset{" + setting + "}"),
			"  % Paths, nodes and wires:",
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
		this.setCode(arr.join("\n"))
		this.editorError.style.display = "none"
	}

	/**
	 * Toggles the visibility of the Apply button.
	 */
	public setApplyButtonVisible(visible: boolean) {
		if (this.applyButton) {
			if (visible) {
				this.applyButton.classList.remove("d-none")
			} else {
				this.applyButton.classList.add("d-none")
			}
		}
		if (this.editorTextArea) {
			this.editorTextArea.setAttribute("contenteditable", visible ? "true" : "false")
		}
	}

	/**
	 * Reconstructs the canvas from the parsed TikZ code.
	 */
	public applyEditorText() {
		this.clearHighlightsAndErrors()
		const codeText = this.getCode()

		try {
			const parsedSaveObjects = parseTikz(codeText)

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
			
			this.updateEditorText()
		} catch (error: any) {
			if (error.startLine !== undefined) {
				const lineDivs = Array.from(this.editorTextArea.children) as HTMLDivElement[]
				const targetDiv = lineDivs[error.startLine - 1]
				if (targetDiv) {
					targetDiv.classList.add("highlight-red")
					
					const errorBubble = document.createElement("div")
					errorBubble.className = "error-msg"
					errorBubble.setAttribute("contenteditable", "false")
					errorBubble.innerText = "Error: " + error.message
					
					targetDiv.appendChild(errorBubble)
				}
			} else {
				this.editorError.innerText = "Error parsing TikZ:\n" + error.message
				this.editorError.style.display = "block"
			}
		}
	}
}
