import * as SVG from "@svgdotjs/svg.js"
import "@svgdotjs/svg.draggable.js"
import { Modal } from "bootstrap"
import { MainController } from "./mainController"
import { ComponentSymbol, TikZAnchor } from "../components/componentSymbol"
import { defaultStroke, defaultFill } from "../utils/utils"
import { buildSymbolVariantDiff } from "../utils/symbolVariantDiff"

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
	private selectionBoxElement: SVG.Rect | null = null
	private handle1: SVG.Circle | null = null
	private handle2: SVG.Circle | null = null

	private isPanning = false
	private lastMousePos: SVG.Point | null = null

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

		this.svg.node.addEventListener("contextmenu", (e) => {
			e.preventDefault()
		})

		this.svg.on("mousedown", async (e: MouseEvent) => {
			if (e.button === 2) {
				// Right click pan
				e.preventDefault()
				this.isPanning = true
				this.lastMousePos = new SVG.Point(e.clientX, e.clientY)
				return
			}
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
					const pinName = await MainController.instance.openPrompt(
						"New Connection Point",
						"Please enter a name for the new connection point (e.g., g, s, d, in, out):"
					)
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
			if (this.isPanning && this.lastMousePos) {
				const dx = e.clientX - this.lastMousePos.x
				const dy = e.clientY - this.lastMousePos.y

				const t = this.viewport.transform()
				this.viewport.transform({
					...t,
					translateX: (t.translateX || 0) + dx / this.scale,
					translateY: (t.translateY || 0) + dy / this.scale
				})

				this.lastMousePos = new SVG.Point(e.clientX, e.clientY)
				return
			}

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
			if (e.button === 2) {
				this.isPanning = false
				this.lastMousePos = null
				return
			}

			if (!this.isDrawing || !this.tempDrawElement) return
			this.isDrawing = false

			// Move drawing to active elements group and apply interactions
			const finalElement = this.tempDrawElement.clone().addTo(this.elementsGroup)
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

		this.svg.on("wheel", (e: WheelEvent) => {
			e.preventDefault()
			const zoomFactor = 1.1
			const zoomDirection = e.deltaY < 0 ? 1 : -1
			const oldScale = this.scale
			const newScale = zoomDirection > 0 ? oldScale * zoomFactor : oldScale / zoomFactor
			
			if (newScale < 1 || newScale > 50) return
			
			this.scale = newScale
			
			const rect = this.svg.node.getBoundingClientRect()
			const cx = e.clientX - rect.left
			const cy = e.clientY - rect.top
			
			const t = this.viewport.transform()
			const tx = t.translateX || 0
			const ty = t.translateY || 0
			
			const newTx = tx + cx / newScale - cx / oldScale
			const newTy = ty + cy / newScale - cy / oldScale
			
			this.viewport.transform({
				...t,
				scale: this.scale,
				translateX: newTx,
				translateY: newTy
			})
		})
	}

	private setupKeyboardListeners() {
		window.addEventListener("keydown", (e: KeyboardEvent) => {
			// Only intercept keydowns if modal is visible
			const modalEl = document.getElementById("symbolEditorModal") as HTMLDivElement
			if (!modalEl || !modalEl.classList.contains("show")) return

			if (e.target instanceof HTMLInputElement) return // Avoid intercepting input fields

			const key = e.key.toLowerCase()
			if (key === "v" || key === "escape") {
				const btn = document.getElementById("editorToolSelect") as HTMLButtonElement
				if (btn) btn.click()
				e.preventDefault()
			} else if (key === "l" || key === "w") {
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

	public async open(symbolId: string) {
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
			let rawLeafIndex = 0

			const collectFlatElements = (el: SVG.Element, inheritedStyles: { stroke?: string; strokeWidth?: string; fill?: string; className?: string }) => {
				if (el.node.tagName.toLowerCase() === "g") {
					const currentStyles = {
						stroke: el.node.hasAttribute("stroke") ? el.attr("stroke") : inheritedStyles.stroke,
						strokeWidth: el.node.hasAttribute("stroke-width") ? el.attr("stroke-width") : inheritedStyles.strokeWidth,
						fill: el.node.hasAttribute("fill") ? el.attr("fill") : inheritedStyles.fill,
						className: el.node.hasAttribute("class") ? el.attr("class") : inheritedStyles.className
					}
					const children = el.children()
					for (const child of children) {
						collectFlatElements(child, currentStyles)
					}
				} else {
					// Inherit styles if not set on the leaf node
					if (inheritedStyles.stroke && !el.node.hasAttribute("stroke")) el.attr("stroke", inheritedStyles.stroke)
					if (inheritedStyles.strokeWidth && !el.node.hasAttribute("stroke-width")) el.attr("stroke-width", inheritedStyles.strokeWidth)
					
					const finalFill = el.node.hasAttribute("fill") ? el.attr("fill") : (inheritedStyles.fill || "none")
					el.attr("fill", finalFill)

					if (inheritedStyles.className) {
						const childClass = el.attr("class")
						el.attr("class", childClass ? `${childClass} ${inheritedStyles.className}` : inheritedStyles.className)
					}
					if (el.node.tagName.toLowerCase() === "path" && finalFill === "none") {
						const pathStr = el.attr("d")
						if (pathStr) {
							const pathArr = new SVG.PathArray(pathStr)
							let currentSubpath: any[] = []
							const subpaths: any[][] = []
							
							for (const cmd of pathArr as any) {
								if (cmd[0] === 'M' || cmd[0] === 'm') {
									if (currentSubpath.length > 0) {
										subpaths.push(currentSubpath)
									}
									currentSubpath = [cmd]
								} else {
									currentSubpath.push(cmd)
								}
							}
							if (currentSubpath.length > 0) {
								subpaths.push(currentSubpath)
							}

							if (subpaths.length > 1) {
								for (const sub of subpaths) {
									const clonedEl = SVG.adopt(el.node.cloneNode(true) as HTMLElement) as SVG.Path
									clonedEl.plot(new SVG.PathArray(sub).toString())
									clonedEl.attr("data-orig-index", rawLeafIndex)
									flatElements.push(clonedEl)
								}
								rawLeafIndex++
							} else {
								el.attr("data-orig-index", rawLeafIndex++)
								flatElements.push(el)
							}
						} else {
							el.attr("data-orig-index", rawLeafIndex++)
							flatElements.push(el)
						}
					} else {
						el.attr("data-orig-index", rawLeafIndex++)
						flatElements.push(el)
					}
				}
			}

			for (const childNode of symbolNode.childNodes) {
				const node = childNode as SVGElement
				// Skip the click background and empty text nodes
				if (node.nodeType === Node.ELEMENT_NODE) {
					const tag = node.tagName.toLowerCase()
					if (tag === "rect" && node.classList.contains("clickBackground")) continue
					
					const adopted = SVG.adopt(node.cloneNode(true) as HTMLElement)
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
			await MainController.instance.openAlert("Error Opening Editor", err.stack || String(err))
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
		this.selectionBoxElement = null
		this.handle1 = null
		this.handle2 = null
		
		const deleteBtn = document.getElementById("editorDeleteShape") as HTMLButtonElement
		if (deleteBtn) deleteBtn.disabled = true

		const shapeStyleSection = document.getElementById("shapeStyleSection")
		const pinPropertySection = document.getElementById("pinPropertySection")
		const infoContent = document.getElementById("elementInfoContent")

		if (shapeStyleSection) shapeStyleSection.classList.add("d-none")
		if (pinPropertySection) pinPropertySection.classList.add("d-none")
		if (infoContent) infoContent.innerHTML = `Select a tool on the left.<br/>• Click a shape or pin to edit it.`
	}

	private updateOverlay() {
		if (!this.selectedElement) return

		if (!this.selectionBoxElement) {
			this.selectionBoxElement = this.overlayGroup.rect()
				.fill("none")
				.stroke({ color: "#007fff", width: 0.5, dasharray: "2, 1" })
		}

		// Draw bounding box border dash highlighting
		const box = this.selectedElement.bbox()
		this.selectionBoxElement.size(box.w + 1, box.h + 1).center(box.cx, box.cy)

		if (this.selectedElement instanceof SVG.Line) {
			const line = this.selectedElement as SVG.Line
			const snapStep = 0.5

			const t = line.transform()
			const tx = t.translateX || 0
			const ty = t.translateY || 0

			if (!this.handle1) {
				this.handle1 = this.overlayGroup.circle(3)
					.fill("#ffffff")
					.stroke({ color: "#007fff", width: 0.5 })
					.draggable()
				this.handle1.node.style.cursor = "crosshair"
				
				this.handle1.on("dragmove", (e: any) => {
					const cx = Math.round(this.handle1!.cx() / snapStep) * snapStep
					const cy = Math.round(this.handle1!.cy() / snapStep) * snapStep
					this.handle1!.center(cx, cy)
					
					const localX = cx - (line.transform().translateX || 0)
					const localY = cy - (line.transform().translateY || 0)
					line.plot(localX, localY, line.attr("x2"), line.attr("y2"))
					this.updateOverlayBoxOnly()
				})
			}
			if (!this.handle2) {
				this.handle2 = this.overlayGroup.circle(3)
					.fill("#ffffff")
					.stroke({ color: "#007fff", width: 0.5 })
					.draggable()
				this.handle2.node.style.cursor = "crosshair"
				
				this.handle2.on("dragmove", (e: any) => {
					const cx = Math.round(this.handle2!.cx() / snapStep) * snapStep
					const cy = Math.round(this.handle2!.cy() / snapStep) * snapStep
					this.handle2!.center(cx, cy)

					const localX = cx - (line.transform().translateX || 0)
					const localY = cy - (line.transform().translateY || 0)
					line.plot(line.attr("x1"), line.attr("y1"), localX, localY)
					this.updateOverlayBoxOnly()
				})
			}

			// Sync positions when the line itself is dragged or selected
			this.handle1.center(line.attr("x1") + tx, line.attr("y1") + ty)
			this.handle2.center(line.attr("x2") + tx, line.attr("y2") + ty)
		} else {
			if (this.handle1) { this.handle1.remove(); this.handle1 = null }
			if (this.handle2) { this.handle2.remove(); this.handle2 = null }
		}
	}

	private updateOverlayBoxOnly() {
		if (!this.selectedElement || !this.selectionBoxElement) return
		const box = this.selectedElement.bbox()
		this.selectionBoxElement.size(box.w + 1, box.h + 1).center(box.cx, box.cy)
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

		const box = this.originalViewBox || new SVG.Box(0, 0, 40, 40)
		const clickRectHtml = `<rect width="${box.w}" height="${box.h}" cx="${box.cx}" cy="${box.cy}" fill="transparent" stroke="none" class="clickBackground"></rect>`

		const parser = new DOMParser()
		const compDoc = parser.parseFromString(this.customSymbol.componentXml, "text/xml")
		const compNode = compDoc.querySelector("component")!

		const symbolDB = document.getElementById("symbolDB")
		const baseSymbolName = this.customSymbol.baseSymbol || "nmos"

		// Locate original base component to perform SVG/pins diffing
		const baseComponentNode = symbolDB ? 
			Array.from(symbolDB.getElementsByTagName("component")).find(c => c.getAttribute("tikz") === baseSymbolName) : 
			null
		
		const baseVariants = baseComponentNode ? Array.from(baseComponentNode.getElementsByTagName("variant")) : []

		const compVariants = compNode.getElementsByTagName("variant")
		const newSymbolsMap: { [key: string]: string } = {}
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
		const findBaseVariantForCustomVariant = (variant: Element | undefined | null, index: number): Element | null => {
			if (!variant) return null
			const baseFor = variant.getAttribute("data-base-for")
			if (baseFor) {
				const matched = baseVariants.find((baseVariant) => baseVariant.getAttribute("for") === baseFor)
				if (matched) return matched
			}

			const matchedByOptions = baseVariantByOptions.get(optionKeyForVariant(variant))
			if (matchedByOptions) return matchedByOptions

			return baseVariants[index] ?? null
		}
		const origBaseVariant = findBaseVariantForCustomVariant(compVariants[0], 0) || baseVariants[0]

		// Rebuild all variant symbol definitions
		for (let i = 0; i < compVariants.length; i++) {
			const variantNode = compVariants[i]
			const newSymbolId = variantNode.getAttribute("for")!
			const origVarVariant = findBaseVariantForCustomVariant(variantNode, i)

			// 1. Rebuild pins list for this variant (keep edited base pins, merge variant-specific original pins)
			const existingPinNodes = variantNode.querySelectorAll("pin")
			existingPinNodes.forEach(node => node.remove())

			let variantPins: TikZAnchor[] = []
			if (i === 0) {
				variantPins = pins
			} else {
				variantPins = [...pins]
				const basePinNames = new Set(
					origBaseVariant ? 
					Array.from(origBaseVariant.getElementsByTagName("pin")).map(p => p.getAttribute("name")) : 
					[]
				)

				if (origVarVariant) {
					Array.from(origVarVariant.getElementsByTagName("pin")).forEach(p => {
						const pinName = p.getAttribute("name")
						if (pinName && !basePinNames.has(pinName)) {
							const px = parseFloat(p.getAttribute("x") || "0")
							const py = parseFloat(p.getAttribute("y") || "0")
							const isDefault = p.getAttribute("isDefault") === "true" || p.getAttribute("isdefault") === "true"
							
							if (!variantPins.some(vp => vp.name === pinName)) {
								variantPins.push({
									name: pinName,
									x: new SVG.Number(px),
									y: new SVG.Number(py),
									isDefault,
									point: new SVG.Point(px, py)
								})
							}
						}
					})
				}
			}

			// Append new merged pin nodes to variant metadata
			for (const vp of variantPins) {
				const pinEl = compDoc.createElement("pin")
				pinEl.setAttribute("name", vp.name!)
				pinEl.setAttribute("x", vp.x.toString())
				pinEl.setAttribute("y", vp.y.toString())
				if (vp.isDefault) {
					pinEl.setAttribute("isDefault", "true")
				}
				variantNode.appendChild(pinEl)
			}

			// 2. Diffing original SVG elements to build composed SVG graphic
			let newSymbolXml = ""
			if (i === 0) {
				newSymbolXml = `<symbol id="${newSymbolId}">\n<g fill="none" stroke="${defaultStroke}" stroke-miterlimit="10" stroke-width=".4">\n${elementsXmlArr.join("\n")}\n</g>\n${clickRectHtml}\n</symbol>`
			} else {
				const origBaseSymId = origBaseVariant?.getAttribute("for")
				const origVarSymId = origVarVariant?.getAttribute("for")
				const origBaseSymNode = origBaseSymId ? document.getElementById(origBaseSymId) : null
				const origVarSymNode = origVarSymId ? document.getElementById(origVarSymId) : null

				const decoratorElements: string[] = []
				const deletedBaseIndices = new Set<number>()

				if (origBaseSymNode && origVarSymNode) {
					const diff = buildSymbolVariantDiff(origBaseSymNode, origVarSymNode)
					diff.deletedBaseIndices.forEach((idx) => deletedBaseIndices.add(idx))
					decoratorElements.push(...diff.decoratorElements)
				}

				// Filter edited elements array to remove deleted base leaves
				const filteredElementsXml = elementsXmlArr.filter(xmlStr => {
					const match = xmlStr.match(/data-orig-index="(\d+)"/);
					if (match) {
						const idx = parseInt(match[1], 10);
						return !deletedBaseIndices.has(idx);
					}
					return true;
				})

				newSymbolXml = `<symbol id="${newSymbolId}">\n<g fill="none" stroke="${defaultStroke}" stroke-miterlimit="10" stroke-width=".4">\n${filteredElementsXml.join("\n")}\n${decoratorElements.join("\n")}\n</g>\n${clickRectHtml}\n</symbol>`
			}

			newSymbolsMap[newSymbolId] = newSymbolXml
		}

		// Update database record
		this.customSymbol.componentXml = compNode.outerHTML
		this.customSymbol.symbols = newSymbolsMap

		MainController.instance.putCustomSymbolRecord(this.customSymbol).then(() => {
			console.log("Custom symbol successfully saved in IndexedDB:", this.tikzName)
			
			// Hot-reload DOM `#symbolDB` content
			if (symbolDB) {
				for (const newSymbolId in newSymbolsMap) {
					const oldSymbol = document.getElementById(newSymbolId)
					if (oldSymbol) oldSymbol.remove()

					const wrapper = `<svg xmlns="http://www.w3.org/2000/svg">${newSymbolsMap[newSymbolId]}</svg>`
					const parsedSymbol = parser.parseFromString(wrapper, "image/svg+xml")
					const symbolNode = parsedSymbol.querySelector("symbol")
					if (symbolNode) {
						const adoptedSymbol = document.adoptNode(symbolNode)
						symbolDB.appendChild(adoptedSymbol)
					}
				}
			}

			// Update runtime memory `ComponentSymbol` instance mapping
			const compSymbol = MainController.instance.symbols.find(s => s.tikzName === this.tikzName)
			if (compSymbol) {
				const variantNodes = compNode.getElementsByTagName("variant")
				for (let i = 0; i < variantNodes.length; i++) {
					const vNode = variantNodes[i]
					const currentSymbolId = vNode.getAttribute("for")!
					
					// Resolve options key to update target variantObj in memory map
					const options = compSymbol.getOptionsFromOptionNames(
						Array.from(vNode.getElementsByTagName("option")).map(o => o.getAttribute("name")!)
					)
					const mappingKey = compSymbol.optionsToStringArray(options).join(", ")
					
					const variantObj = compSymbol._mapping.get(mappingKey)
					if (variantObj) {
						const symElement = document.getElementById(currentSymbolId)
						if (symElement) {
							variantObj.symbol = new SVG.Symbol(symElement as any)
							
							// Re-preprocess symbol colors on the newly appended DOM element
							const g = symElement.querySelector("g")
							if (g) {
								(MainController.instance as any).preprocessSymbolColors(g)
							}
						}

						// Update mapping pins structure from newly updated componentXml
						const pinElements = Array.from(vNode.getElementsByTagName("pin"))
						variantObj.pins = pinElements.map(p => {
							const name = p.getAttribute("name") || p.getAttribute("anchorname") || undefined
							const px = parseFloat(p.getAttribute("x") || "0")
							const py = parseFloat(p.getAttribute("y") || "0")
							const isDefault = p.getAttribute("isDefault") === "true" || p.getAttribute("isdefault") === "true"
							return {
								name,
								x: new SVG.Number(px),
								y: new SVG.Number(py),
								isDefault,
								point: new SVG.Point(px, py)
							}
						})
					}
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
		})
	}
}
