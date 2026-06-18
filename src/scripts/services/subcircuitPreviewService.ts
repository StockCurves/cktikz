import * as SVG from "@svgdotjs/svg.js"
import { CircuitComponent } from "../components/circuitComponent"

export class SubcircuitPreviewService {
	public async generatePreview(subcircuitData: any): Promise<string | null> {
		if (!subcircuitData || !subcircuitData.components) return null

		const tempComponents: CircuitComponent[] = []
		const offscreenSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		offscreenSvg.setAttribute(
			"style",
			"position: absolute; top: -9999px; left: -9999px; visibility: hidden; width: 500px; height: 500px;"
		)
		document.body.appendChild(offscreenSvg)

		try {
			for (const saveObj of subcircuitData.components) {
				const comp = CircuitComponent.fromJson(saveObj)
				if (comp) {
					tempComponents.push(comp)
					comp.update()
				}
			}

			if (tempComponents.length === 0) {
				document.body.removeChild(offscreenSvg)
				return null
			}

			const defsMap = new Map<string, SVG.Element>()
			const innerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
			offscreenSvg.appendChild(innerGroup)

			for (const comp of tempComponents) {
				const clonedNode = comp.toSVG(defsMap).node
				innerGroup.appendChild(clonedNode)
			}

			const uses = Array.from(innerGroup.querySelectorAll("use"))
			for (const use of uses) {
				const href = use.getAttribute("xlink:href") || use.getAttribute("href")
				if (!href?.startsWith("#")) continue
				const id = href.slice(1)
				const symbolNode: Element | null = defsMap.has(id)
					? (defsMap.get(id)!.node as Element)
					: document.getElementById(id)
				if (!symbolNode) continue

				const g = document.createElementNS("http://www.w3.org/2000/svg", "g")

				let finalTransform = ""
				const ux = parseFloat(use.getAttribute("x") || "0")
				const uy = parseFloat(use.getAttribute("y") || "0")
				if (ux !== 0 || uy !== 0) {
					finalTransform += `translate(${ux}, ${uy}) `
				}
				const transform = use.getAttribute("transform")
				if (transform) {
					finalTransform += transform + " "
				}
				if (symbolNode.tagName.toLowerCase() === "symbol") {
					const viewBoxStr = symbolNode.getAttribute("viewBox")
					if (viewBoxStr) {
						const parts = viewBoxStr.trim().split(/[\s,]+/)
						if (parts.length === 4) {
							const vx = parseFloat(parts[0])
							const vy = parseFloat(parts[1])
							const vw = parseFloat(parts[2])
							const vh = parseFloat(parts[3])

							const uwAttr = use.getAttribute("width")
							const uhAttr = use.getAttribute("height")
							const uw = uwAttr ? parseFloat(uwAttr) : vw
							const uh = uhAttr ? parseFloat(uhAttr) : vh

							const scaleX = uw / vw
							const scaleY = uh / vh

							finalTransform += `scale(${scaleX}, ${scaleY}) translate(${-vx}, ${-vy}) `
						}
					}
				}
				if (finalTransform.trim()) {
					g.setAttribute("transform", finalTransform.trim())
				}

				const cls = use.getAttribute("class")
				if (cls) g.setAttribute("class", cls)

				const stroke = use.getAttribute("stroke") || use.style.stroke
				const fill = use.getAttribute("fill") || use.style.fill
				const color = use.getAttribute("color") || use.style.color
				if (stroke) g.setAttribute("stroke", stroke)
				if (fill) g.setAttribute("fill", fill)
				if (color) g.setAttribute("color", color)

				for (const child of Array.from(symbolNode.childNodes)) {
					if ((child as Element).tagName === "title") continue
					g.appendChild(child.cloneNode(true))
				}
				use.parentNode?.replaceChild(g, use)
			}

			await new Promise((resolve) => requestAnimationFrame(resolve))
			const bbox = innerGroup.getBBox()

			if (bbox.width === 0 && bbox.height === 0) {
				document.body.removeChild(offscreenSvg)
				return null
			}

			const padding = 5
			const finalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
			finalSvg.setAttribute(
				"viewBox",
				`${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
			)
			finalSvg.setAttribute("width", "48")
			finalSvg.setAttribute("height", "48")
			finalSvg.appendChild(innerGroup)

			document.body.removeChild(offscreenSvg)
			return new XMLSerializer().serializeToString(finalSvg)
		} catch (err) {
			console.error("Error generating subcircuit preview:", err)
			if (offscreenSvg.parentNode) document.body.removeChild(offscreenSvg)
			return null
		} finally {
			for (const comp of tempComponents) {
				try {
					comp.remove()
				} catch (e) {
					console.error("Error cleaning up temporary component", e)
				}
			}
		}
	}
}
