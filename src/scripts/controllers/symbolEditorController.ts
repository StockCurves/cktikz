import * as SVG from "@svgdotjs/svg.js"
import "@svgdotjs/svg.draggable.js"
import { Modal } from "bootstrap"
import { MainController } from "./mainController"
import { ComponentSymbol, TikZAnchor } from "../components/componentSymbol"
import { defaultStroke, defaultFill } from "../utils/utils"

export class SymbolEditorController {
	private static _instance: SymbolEditorController
	public static get instance(): SymbolEditorController {
		if (!SymbolEditorController._instance) {
			SymbolEditorController._instance = new SymbolEditorController()
		}
		return SymbolEditorController._instance
	}

	private modal: Modal
	private customSymbol: any // The raw DB custom symbol object
	private tikzName: string

	// SVG Containers
	private svg: SVG.Svg
	private viewport: SVG.G
	private elementsGroup: SVG.G
	private pinsGroup: SVG.G
	private overlayGroup: SVG.G

	// State
	private currentTool: "select" | "line" | "circle" | "rect" | "pin" = "select"
	private selectedElement: SVG.Element | null = null
	private isDrawing = false
	private drawStartPoint: SVG.Point | null = null
	private tempDrawElement: SVG.Element | null = null
	private scale = 8
	private panOffset = new SVG.Point(0, 0)
	private originalViewBox: SVG.Box | null = null

	private constructor() {
		// Initialization deferred until DOM is ready or open is called
	}

	private initDOM() {
		if (this.modal) return

		const modalEl = document.getElementById("symbolEditorModal") as HTMLDivElement
		this.modal = new Modal(modalEl)

		this.svg = SVG.SVG(document.getElementById("symbolEditorSVG")) as SVG.Svg
		this.viewport = SVG.SVG(document.getElementById("symbolEditorViewport")) as SVG.G
		this.elementsGroup = SVG.SVG(document.getElementById("symbolEditorElementsGroup")) as SVG.G
		this.pinsGroup = SVG.SVG(document.getElementById("symbolEditorPinsGroup")) as SVG.G
		this.overlayGroup = SVG.SVG(document.getElementById("symbolEditorOverlayGroup")) as SVG.G

		// Setup event listeners for UI buttons
		this.setupToolbarListeners()
		this.setupPropertiesListeners()
		this.setupCanvasDrawingListeners()
		this.setupKeyboardListeners()
	}

	private setupToolbarListeners() {
		const selectBtn = document.getElementById("editorToolSelect") as HTMLButtonElement
		const lineBtn = document.getElementById("editorToolLine") as HTMLButtonElement
		const circleBtn = document.getElementById("editorToolCircle") as HTMLButtonElement
		const rectBtn = document.getElementById("editorToolRect") as HTMLButtonElement
		const pinBtn = document.getElementById("editorToolPin") as HTMLButtonElement
		const deleteBtn = document.getElementById("editorDeleteShape") as HTMLButtonElement

		const setTool = (tool: typeof this.currentTool, activeBtn: HTMLButtonElement) => {
			this.currentTool = tool
			const buttons = [selectBtn, lineBtn, circleBtn, rectBtn, pinBtn]
			buttons.forEach(btn => btn.classList.remove("active", "btn-outline-primary"))
			buttons.forEach(btn => btn.classList.add("btn-outline-secondary"))
			activeBtn.classList.remove("btn-outline-secondary")
			activeBtn.classList.add("active", "btn-outline-primary")

			// Clear selection when entering drawing tools
			if (tool !== "select") {
				this.deselect()
			}
		}

		selectBtn.addEventListener("click", () => setTool("select", selectBtn))
		lineBtn.addEventListener("click", () => setTool("line", lineBtn))
		circleBtn.addEventListener("click", () => setTool("circle", circleBtn))
		rectBtn.addEventListener("click", () => setTool("rect", rectBtn))
		pinBtn.addEventListener("click", () => setTool("pin", pinBtn))

		deleteBtn.addEventListener("click", () => {
			this.deleteSelected()
		})

		document.getElementById("symbolEditorSaveBtn")?.addEventListener("click", () => {
			this.save()
		})

		document.getElementById("symbolEditorCancelBtn")?.addEventListener("click", () => {
			this.modal.hide()
		})
		
		document.getElementById("symbolEditorCloseBtn")?.addEventListener("click", () => {
			this.modal.hide()
		})
	}

	private setupPropertiesListeners() {
		const strokeWidthInput = document.getElementById("editorStrokeWidth") as HTMLInputElement
		const strokeWidthVal = document.getElementById("editorStrokeWidthVal") as HTMLSpanElement
		const strokeColorInput = document.getElementById("editorStrokeColor") as HTMLInputElement
		const fillColorInput = document.getElementById("editorFillColor") as HTMLInputElement
		const fillNoneCheckbox = document.getElementById("editorFillNone") as HTMLInputElement

		strokeWidthInput.addEventListener("input", () => {
			strokeWidthVal.textContent = strokeWidthInput.value
			if (this.selectedElement) {
				this.selectedElement.stroke({ width: parseFloat(strokeWidthInput.value) })
			}
		})

		strokeColorInput.addEventListener("input", () => {
			if (this.selectedElement) {
				this.selectedElement.stroke({ color: strokeColorInput.value })
			}
		})

		fillNoneCheckbox.addEventListener("change", () => {
			fillColorInput.disabled = fillNoneCheckbox.checked
			if (this.selectedElement) {
				if (fillNoneCheckbox.checked) {
					this.selectedElement.fill("none")
				} else {
					this.selectedElement.fill(fillColorInput.value)
				}
			}
		})

		fillColorInput.addEventListener("input", () => {
			if (this.selectedElement && !fillNoneCheckbox.checked) {
				this.selectedElement.fill(fillColorInput.value)
			}
		})

		// Pin edits
		const pinNameInput = document.getElementById("editorPinName") as HTMLInputElement
		const pinXInput = document.getElementById("editorPinX") as HTMLInputElement
		const pinYInput = document.getElementById("editorPinY") as HTMLInputElement
		const pinIsDefaultInput = document.getElementById("editorPinIsDefault") as HTMLInputElement

		pinNameInput.addEventListener("input", () => {
			if (this.selectedElement && this.selectedElement.hasClass("editor-pin")) {
				this.selectedElement.attr("data-pin-name", pinNameInput.value)
				this.selectedElement.node.querySelector("title")!.textContent = pinNameInput.value
			}
		})

		const updatePinPosition = () => {
			if (this.selectedElement && this.selectedElement.hasClass("editor-pin")) {
				const x = parseFloat(pinXInput.value) || 0
				const y = parseFloat(pinYInput.value) || 0
				this.selectedElement.center(x, y)
				this.updateOverlay()
			}
		}

		pinXInput.addEventListener("input", updatePinPosition)
		pinYInput.addEventListener("input", updatePinPosition)

		pinIsDefaultInput.addEventListener("change", () => {
			if (this.selectedElement && this.selectedElement.hasClass("editor-pin")) {
				this.selectedElement.attr("data-is-default", pinIsDefaultInput.checked ? "true" : "false")
				if (pinIsDefaultInput.checked) {
					// Uncheck other pins
					this.pinsGroup.each((index, members) => {
						const otherPin = members[index] as SVG.Element
						if (otherPin !== this.selectedElement) {
							otherPin.attr("data-is-default", "false")
						}
					})
				}
			}
		})
	}

	private setupCanvasDrawingListeners() {
		const getLocalCoords = (e: MouseEvent): SVG.Point => {
			const rect = this.svg.node.getBoundingClientRect()
			const clientPt = new SVG.Point(e.clientX - rect.left, e.clientY - rect.top)
			
			// Transform to viewport coordinates
			const transformMatrix = this.viewport.transform()
			return clientPt.transform(new SVG.Matrix(transformMatrix).inverse())
		}

		const snapVal = (val: number) => {
			// Visio grid snapping (e.g., align to nearest 0.5)
			return Math.round(val * 2) / 2
		}

		const snapPoint = (pt: SVG.Point) => {
			return new SVG.Point(snapVal(pt.x), snapVal(pt.y))
		}

		this.svg.on("mousedown", (e: MouseEvent) => {
			if (e.button !== 0) return // Only left clicks
			
			const localPt = getLocalCoords(e)
			const snappedPt = snapPoint(localPt)

			if (this.currentTool !== "select") {
				e.preventDefault()
				e.stopPropagation()
				this.isDrawing = true
				this.drawStartPoint = snappedPt

				if (this.currentTool === "line") {
					this.tempDrawElement = this.overlayGroup.line(snappedPt.x, snappedPt.y, snappedPt.x, snappedPt.y)
						.stroke({ color: defaultStroke, width: 1, linecap: "round" })
				} else if (this.currentTool === "circle") {
					this.tempDrawElement = this.overlayGroup.circle(0)
						.center(snappedPt.x, snappedPt.y)
						.fill("none")
						.stroke({ color: defaultStroke, width: 1 })
				} else if (this.currentTool === "rect") {
					this.tempDrawElement = this.overlayGroup.rect(0, 0)
						.move(snappedPt.x, snappedPt.y)
						.fill("none")
						.stroke({ color: defaultStroke, width: 1 })
				} else if (this.currentTool === "pin") {
					this.isDrawing = false
					const pinName = prompt("請輸入新連接點的名稱 (例如：g, s, d, in, out)：")
					if (pinName) {
						this.addPinElement(snappedPt.x, snappedPt.y, pinName.trim(), false)
					}
				}
			} else {
				// Mousedown on background deselects
				if (e.target === this.svg.node || e.target?.tagName === "rect") {
					this.deselect()
				}
			}
		})

		this.svg.on("mousemove", (e: MouseEvent) => {
			if (!this.isDrawing || !this.drawStartPoint || !this.tempDrawElement) return

			const localPt = getLocalCoords(e)
			const snappedPt = snapPoint(localPt)

			if (this.currentTool === "line") {
				const line = this.tempDrawElement as SVG.Line
				line.plot(this.drawStartPoint.x, this.drawStartPoint.y, snappedPt.x, snappedPt.y)
			} else if (this.currentTool === "circle") {
				const radius = this.drawStartPoint.distance(snappedPt)
				const circle = this.tempDrawElement as SVG.Circle
				circle.radius(radius)
			} else if (this.currentTool === "rect") {
				const rect = this.tempDrawElement as SVG.Rect
				const x = Math.min(this.drawStartPoint.x, snappedPt.x)
				const y = Math.min(this.drawStartPoint.y, snappedPt.y)
				const w = Math.abs(this.drawStartPoint.x - snappedPt.x)
				const h = Math.abs(this.drawStartPoint.y - snappedPt.y)
				rect.move(x, y).size(w, h)
			}
		})

		this.svg.on("mouseup", (e: MouseEvent) => {
			if (!this.isDrawing || !this.tempDrawElement) return
			this.isDrawing = false

			// Move drawing to active elements group and apply interactions
			const finalElement = this.tempDrawElement.clone(this.elementsGroup)
			this.tempDrawElement.remove()
			this.tempDrawElement = null

			// Filter out degenerate zero-size shapes
			let valid = true
			if (finalElement instanceof SVG.Circle && finalElement.attr("r") === 0) valid = false
			if (finalElement instanceof SVG.Rect && (finalElement.width() === 0 || finalElement.height() === 0)) valid = false

			if (valid) {
				this.makeEditable(finalElement)
				this.select(finalElement)
			} else {
				finalElement.remove()
			}
		})
	}

	private setupKeyboardListeners() {
		window.addEventListener("keydown", (e: KeyboardEvent) => {
			// Only intercept keydowns if modal is visible
			const modalEl = document.getElementById("symbolEditorModal") as HTMLDivElement
			if (!modalEl || !modalEl.classList.contains("show")) return

			if (e.target instanceof HTMLInputElement) return // Avoid intercepting input fields

			const key = e.key.toLowerCase()
			if (key === "v") {
				const btn = document.getElementById("editorToolSelect") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (key === "l") {
				const btn = document.getElementById("editorToolLine") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (key === "c") {
				const btn = document.getElementById("editorToolCircle") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (key === "r") {
				const btn = document.getElementById("editorToolRect") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (key === "p") {
				const btn = document.getElementById("editorToolPin") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (e.key === "Delete" || e.key === "Backspace") {
				this.deleteSelected()
				e.preventDefault()
			} else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && this.selectedElement) {
				e.preventDefault()
				const diff = e.shiftKey ? 0.1 : 0.5
				let dx = 0, dy = 0
				if (e.key === "ArrowUp") dy = -diff
				if (e.key === "ArrowDown") dy = diff
				if (e.key === "ArrowLeft") dx = -diff
				if (e.key === "ArrowRight") dx = diff

				const el = this.selectedElement
				if (el.hasClass("editor-pin")) {
					const cx = el.cx() + dx
					const cy = el.cy() + dy
					el.center(cx, cy)
					this.updateOverlay()
					// Update sidebar properties
					const pinXInput = document.getElementById("editorPinX") as HTMLInputElement
					const pinYInput = document.getElementById("editorPinY") as HTMLInputElement
					pinXInput.value = cx.toFixed(1)
					pinYInput.value = cy.toFixed(1)
				} else {
					el.dmove(dx, dy)
					this.updateOverlay()
				}
			}
		})
	}

	public open(symbolId: string) {
		try {
			this.initDOM()

			const customSymbol = MainController.instance.customSymbols.find(s => s.id === symbolId)
			if (!customSymbol) {
				console.error("Custom symbol not found in DB list:", symbolId)
				return
			}

			this.customSymbol = customSymbol
			this.tikzName = customSymbol.tikzName

			document.getElementById("symbolEditorModalLabel")!.textContent = `Symbol Editor - ${customSymbol.displayName}`

			// Clear previous workspace
			this.elementsGroup.clear()
			this.pinsGroup.clear()
			this.overlayGroup.clear()
			this.deselect()

			// Locate standard/custom ComponentSymbol
			const compSymbol = MainController.instance.symbols.find(s => s.tikzName === this.tikzName)
			if (!compSymbol) {
				console.error("ComponentSymbol not initialized in symbols pool for edit:", this.tikzName)
				return
			}

			// Edit the default variant (first variant mapped)
			const variant = compSymbol._mapping.values().toArray()[0]
			this.originalViewBox = variant.viewBox

			// Set viewport transformation to center and scale symbol viewBox
			this.adjustViewport(variant.viewBox)

			// Adopt symbol children
			const symbolNode = variant.symbol.node
			const flatElements: SVG.Element[] = []

			const collectFlatElements = (el: SVG.Element, inheritedStyles: { stroke?: string; strokeWidth?: string; fill?: string; className?: string }) => {
				if (el.node.tagName.toLowerCase() === "g") {
					const currentStyles = {
						stroke: el.attr("stroke") || inheritedStyles.stroke,
						strokeWidth: el.attr("stroke-width") || inheritedStyles.strokeWidth,
						fill: el.attr("fill") || inheritedStyles.fill,
						className: el.attr("class") || inheritedStyles.className
					}
					const children = el.children()
					for (const child of children) {
						collectFlatElements(child, currentStyles)
					}
				} else {
					// Inherit styles if not set on the leaf node
					if (inheritedStyles.stroke && !el.attr("stroke")) el.attr("stroke", inheritedStyles.stroke)
					if (inheritedStyles.strokeWidth && !el.attr("stroke-width")) el.attr("stroke-width", inheritedStyles.strokeWidth)
					
					const finalFill = el.attr("fill") || inheritedStyles.fill || "none"
					el.attr("fill", finalFill)

					if (inheritedStyles.className) {
						const childClass = el.attr("class")
						el.attr("class", childClass ? `${childClass} ${inheritedStyles.className}` : inheritedStyles.className)
					}
					flatElements.push(el)
				}
			}

			for (const childNode of symbolNode.childNodes) {
				const node = childNode as SVGElement
				// Skip the click background and empty text nodes
				if (node.nodeType === Node.ELEMENT_NODE) {
					const tag = node.tagName.toLowerCase()
					if (tag === "rect" && node.classList.contains("clickBackground")) continue
					
					const adopted = SVG.adopt(node.cloneNode(true) as Element)
					collectFlatElements(adopted, {})
				}
			}

			for (const el of flatElements) {
				this.elementsGroup.add(el)
				this.makeEditable(el)
			}

			// Load Pins (Connection Points)
			for (const pin of variant.pins) {
				// Skip START/END pins if this is a path symbol (managed internally, not shown/edited as separate pins)
				if (pin.name === "START" || pin.name === "END") continue
				
				// Note standard pins are relative to component origin/mid. 
				// In Visio symbol coordinate layout, the coordinates mapped to SVG viewBox space.
				this.addPinElement(pin.point!.x, pin.point!.y, pin.name ?? "pin", pin.isDefault)
			}

			// Show Modal
			this.modal.show()
		} catch (err) {
			console.error("Error opening symbol editor modal:", err)
			alert("開啟編輯器出錯，錯誤原因：\n" + (err.stack || err))
		}
	}

	private adjustViewport(box: SVG.Box) {
		// Set scale & center based on container sizing
		const container = document.getElementById("symbolEditorCanvasContainer")!
		const cw = container.clientWidth || 800
		const ch = container.clientHeight || 600

		// Center of viewBox aligned with center of container SVG
		this.scale = Math.min(cw / box.w, ch / box.h) * 0.6
		if (this.scale > 20) this.scale = 20
		if (this.scale < 2) this.scale = 2

		// Compute top-left padding translation
		const tx = (cw / 2) - (box.cx * this.scale)
		const ty = (ch / 2) - (box.cy * this.scale)

		this.viewport.transform({
			scale: this.scale,
			translate: [tx / this.scale, ty / this.scale]
		})
	}

	private makeEditable(el: SVG.Element) {
		el.node.style.cursor = "move"
		
		el.on("mousedown", (e: MouseEvent) => {
			if (this.currentTool !== "select") return
			e.preventDefault()
			e.stopPropagation()
			this.select(el)
		})

		// Make it draggable using the svg.draggable library
		el.draggable()

		el.on("dragmove", (e: any) => {
			// Visio style snapping while dragging
			const snapStep = 0.5
			if (el.hasClass("editor-pin")) {
				const cx = Math.round(el.cx() / snapStep) * snapStep
				const cy = Math.round(el.cy() / snapStep) * snapStep
				el.center(cx, cy)
				
				// Update coordinates in sidebar in real-time
				const pinXInput = document.getElementById("editorPinX") as HTMLInputElement
				const pinYInput = document.getElementById("editorPinY") as HTMLInputElement
				pinXInput.value = cx.toFixed(1)
				pinYInput.value = cy.toFixed(1)
			} else {
				// Regular shapes snap translation or coordinate layout
				// (For simplicity, transform translations can stay free or snap on dragend)
			}
			this.updateOverlay()
		})

		el.on("dragend", (e: any) => {
			if (!el.hasClass("editor-pin")) {
				// Snap final bounding coordinates or path transformation to nearest 0.5 unit
				const snapStep = 0.5
				const trans = el.transform()
				const sx = Math.round(trans.translateX / snapStep) * snapStep
				const sy = Math.round(trans.translateY / snapStep) * snapStep
				el.transform({ translateX: sx, translateY: sy })
			}
			this.updateOverlay()
		})
	}

	private addPinElement(cx: number, cy: number, name: string, isDefault: boolean) {
		// Create a circular handle representing a Pin
		const circle = this.pinsGroup.circle(5)
			.center(cx, cy)
			.fill("red")
			.stroke({ color: "white", width: 0.5 })
			.addClass("editor-pin")
			.attr("data-pin-name", name)
			.attr("data-is-default", isDefault ? "true" : "false")

		// Visio pin name tag tooltips
		circle.node.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title"))
		circle.node.querySelector("title")!.textContent = name

		this.makeEditable(circle)
	}

	private select(el: SVG.Element) {
		this.deselect()
		this.selectedElement = el

		// Add selector overlay highlighting borders
		this.updateOverlay()

		// Enable delete button
		const deleteBtn = document.getElementById("editorDeleteShape") as HTMLButtonElement
		deleteBtn.disabled = false

		// Load properties
		const shapeStyleSection = document.getElementById("shapeStyleSection") as HTMLDivElement
		const pinPropertySection = document.getElementById("pinPropertySection") as HTMLDivElement
		const infoContent = document.getElementById("elementInfoContent") as HTMLDivElement

		if (el.hasClass("editor-pin")) {
			shapeStyleSection.classList.add("d-none")
			pinPropertySection.classList.remove("d-none")
			infoContent.innerHTML = `選取了連接點 (Pin)<br/>名稱：<b>${el.attr("data-pin-name")}</b>`

			const pinNameInput = document.getElementById("editorPinName") as HTMLInputElement
			const pinXInput = document.getElementById("editorPinX") as HTMLInputElement
			const pinYInput = document.getElementById("editorPinY") as HTMLInputElement
			const pinIsDefaultInput = document.getElementById("editorPinIsDefault") as HTMLInputElement

			pinNameInput.value = el.attr("data-pin-name") || ""
			pinXInput.value = el.cx().toFixed(1)
			pinYInput.value = el.cy().toFixed(1)
			pinIsDefaultInput.checked = el.attr("data-is-default") === "true"
		} else {
			pinPropertySection.classList.add("d-none")
			shapeStyleSection.classList.remove("d-none")
			infoContent.innerHTML = `選取了圖案：<b>&lt;${el.node.tagName.toLowerCase()}&gt;</b>`

			const strokeWidthInput = document.getElementById("editorStrokeWidth") as HTMLInputElement
			const strokeWidthVal = document.getElementById("editorStrokeWidthVal") as HTMLSpanElement
			const strokeColorInput = document.getElementById("editorStrokeColor") as HTMLInputElement
			const fillColorInput = document.getElementById("editorFillColor") as HTMLInputElement
			const fillNoneCheckbox = document.getElementById("editorFillNone") as HTMLInputElement

			// Load values from element attributes
			let sw = parseFloat(el.attr("stroke-width")) || 1.0
			strokeWidthInput.value = sw.toString()
			strokeWidthVal.textContent = sw.toFixed(1)

			let strokeColor = el.attr("stroke") || "#000000"
			// Normalize stroke themes to hex for color picker compatibility
			if (strokeColor === defaultStroke) strokeColor = "#000000"
			strokeColorInput.value = strokeColor

			let fill = el.attr("fill")
			if (!fill || fill === "none") {
				fillNoneCheckbox.checked = true
				fillColorInput.disabled = true
				fillColorInput.value = "#ffffff"
			} else {
				fillNoneCheckbox.checked = false
				fillColorInput.disabled = false
				if (fill === defaultFill) fill = "#ffffff"
				fillColorInput.value = fill
			}
		}
	}

	private deselect() {
		this.selectedElement = null
		this.overlayGroup.clear()
		
		const deleteBtn = document.getElementById("editorDeleteShape") as HTMLButtonElement
		if (deleteBtn) deleteBtn.disabled = true

		const shapeStyleSection = document.getElementById("shapeStyleSection")
		const pinPropertySection = document.getElementById("pinPropertySection")
		const infoContent = document.getElementById("elementInfoContent")

		if (shapeStyleSection) shapeStyleSection.classList.add("d-none")
		if (pinPropertySection) pinPropertySection.classList.add("d-none")
		if (infoContent) infoContent.innerHTML = `請在左側選取工具。<br/>• 點擊形狀/連接點進行修改。`
	}

	private updateOverlay() {
		this.overlayGroup.clear()
		if (!this.selectedElement) return

		// Draw bounding box border dash highlighting
		const box = this.selectedElement.bbox()
		this.overlayGroup.rect(box.w + 1, box.h + 1)
			.center(box.cx, box.cy)
			.fill("none")
			.stroke({ color: "#007fff", width: 0.5, dasharray: "2, 1" })
	}

	private deleteSelected() {
		if (!this.selectedElement) return
		this.selectedElement.remove()
		this.deselect()
	}

	private async save() {
		// Assemble child nodes representing shape elements
		const elementsXmlArr: string[] = []
		this.elementsGroup.each((index, members) => {
			const el = members[index] as SVG.Element
			// Disable draggable handler attributes before cloning
			const nodeCopy = el.node.cloneNode(true) as SVGElement
			nodeCopy.removeAttribute("data-draggable")
			nodeCopy.removeAttribute("style") // Clear selection cursor style pointer-events
			
			// Keep custom style fillable classes if present in original element
			elementsXmlArr.push(nodeCopy.outerHTML)
		})

		// Collect revised connection points
		const pins: TikZAnchor[] = []
		this.pinsGroup.each((index, members) => {
			const pinEl = members[index] as SVG.Element
			const name = pinEl.attr("data-pin-name") || `pin${index}`
			const isDefault = pinEl.attr("data-is-default") === "true"
			const x = parseFloat(pinEl.cx().toFixed(3))
			const y = parseFloat(pinEl.cy().toFixed(3))
			
			pins.push({
				name,
				x: new SVG.Number(x),
				y: new SVG.Number(y),
				isDefault,
				point: new SVG.Point(x, y)
			})
		})

		// Rebuild the SVG `<symbol>` definition XML content
		// We'll retain the clickBackground rectangle for standard layout snapping
		const box = this.originalViewBox || new SVG.Box(0, 0, 40, 40)
		const clickRectHtml = `<rect width="${box.w}" height="${box.h}" cx="${box.cx}" cy="${box.cy}" fill="transparent" stroke="none" class="clickBackground"></rect>`
		
		const symbolId = `node_custom_${this.tikzName}_default`
		const newSymbolXml = `<symbol id="${symbolId}">\n<g fill="none" stroke="${defaultStroke}" stroke-miterlimit="10" stroke-width=".4">\n${elementsXmlArr.join("\n")}\n</g>\n${clickRectHtml}\n</symbol>`

		// Parse the custom component xml metadata and replace pins
		const parser = new DOMParser()
		const compDoc = parser.parseFromString(this.customSymbol.componentXml, "image/svg+xml")
		const compNode = compDoc.querySelector("component")!
		
		// Remove existing pins from variant
		const variantNode = compNode.querySelector("variant")!
		const pinNodes = variantNode.querySelectorAll("pin")
		pinNodes.forEach(node => node.remove())

		// Append new pins nodes
		for (const pin of pins) {
			const pinEl = compDoc.createElement("pin")
			pinEl.setAttribute("name", pin.name!)
			pinEl.setAttribute("x", pin.x.toString())
			pinEl.setAttribute("y", pin.y.toString())
			if (pin.isDefault) pinEl.setAttribute("isDefault", "true")
			variantNode.appendChild(pinEl)
		}

		// Update database record
		this.customSymbol.componentXml = compNode.outerHTML
		this.customSymbol.symbols[symbolId] = newSymbolXml

		const transaction = MainController.instance.db.transaction("customSymbols", "readwrite")
		transaction.objectStore("customSymbols").put(this.customSymbol).onsuccess = () => {
			console.log("Custom symbol successfully saved in IndexedDB:", this.tikzName)
			
			// Hot-reload DOM `#symbolDB` content
			const symbolDB = document.getElementById("symbolDB")
			if (symbolDB) {
				const oldSymbol = document.getElementById(symbolId)
				if (oldSymbol) oldSymbol.remove()

				const wrapper = `<svg xmlns="http://www.w3.org/2000/svg">${newSymbolXml}</svg>`
				const parsedSymbol = parser.parseFromString(wrapper, "image/svg+xml")
				const symbolNode = parsedSymbol.querySelector("symbol")
				if (symbolNode) {
					const adoptedSymbol = document.adoptNode(symbolNode)
					symbolDB.appendChild(adoptedSymbol)
				}
			}

			// Update runtime memory `ComponentSymbol` instance mapping
			const compSymbol = MainController.instance.symbols.find(s => s.tikzName === this.tikzName)
			if (compSymbol) {
				const variantKey = compSymbol._mapping.keys().toArray()[0]
				const variantObj = compSymbol._mapping.get(variantKey)!
				
				variantObj.pins = pins
				variantObj.symbol = new SVG.Symbol(document.getElementById(symbolId) as any)
				
				// Re-preprocess symbol colors on the newly appended DOM element
				const g = document.getElementById(symbolId)!.querySelector("g")
				if (g) {
					// We call preprocessSymbolColors from MainController instance.
					// Note preprocessSymbolColors is private in MainController, so we use bracket notation to bypass
					(MainController.instance as any).preprocessSymbolColors(g)
				}
			}

			// Hot-reload all placed instances of this custom symbol on canvas
			for (const comp of MainController.instance.circuitComponents) {
				if ((comp as any).referenceSymbol === compSymbol || (comp as any).referenceSymbol?.tikzName === this.tikzName) {
					// Trigger update options to fetch newly updated SVG layout and snaps
					if (typeof (comp as any).updateOptions === "function") {
						(comp as any).updateOptions()
					} else {
						comp.update()
					}
				}
			}

			// Hide modal
			this.modal.hide()
			
			// Refresh Symbols offcanvas view list
			MainController.instance.loadAndRenderCustomCategories()
		}
	}
}
