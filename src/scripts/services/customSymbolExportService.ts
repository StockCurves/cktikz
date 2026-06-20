import * as SVG from "@svgdotjs/svg.js"
import type { CustomSymbolRecord } from "./customSymbolService"

type ExportCircuitComponent = {
	constructor: { name: string }
	displayName?: string
	groupedComponents?: ExportCircuitComponent[]
	position?: SVG.Point
	toTikzString(): string
	moveRel?(point: SVG.Point): void
	referenceSymbol?: {
		isCustomSymbol?: boolean
		tikzName: string
	}
}

type ExportSymbolVariant = {
	mid: SVG.Point
	symbol: {
		node: { children: Element[] }
	}
}

type ExportSymbolRecord = {
	tikzName: string
	_mapping: Map<string, ExportSymbolVariant>
}

export class CustomSymbolExportService {
	public getCustomSubcircuitsTikzset(circuitComponents: ExportCircuitComponent[]): string {
		const subs = circuitComponents.filter((component) =>
			component.constructor.name === "SubcircuitComponent" ||
			(component.groupedComponents && component.displayName && component.toTikzString().includes("pic"))
		)

		if (subs.length === 0) return ""

		const definitions: string[] = []
		const processed = new Set<string>()

		for (const sub of subs) {
			if (!sub.displayName || processed.has(sub.displayName)) continue
			processed.add(sub.displayName)

			const originalPos = sub.position || new SVG.Point(0, 0)
			const rel = new SVG.Point(0, 0).sub(originalPos)
			for (const component of sub.groupedComponents || []) {
				component.moveRel?.(rel)
			}
			const lines = (sub.groupedComponents || []).map((component) => "    " + component.toTikzString())
			const relBack = originalPos.sub(new SVG.Point(0, 0))
			for (const component of sub.groupedComponents || []) {
				component.moveRel?.(relBack)
			}

			definitions.push(`  ${sub.displayName}/.pic={\n${lines.join("\n")}\n  }`)
		}

		return `\\tikzset{\n${definitions.join(",\n")}\n}`
	}

	public getCustomSymbolsTikzset(
		circuitComponents: ExportCircuitComponent[],
		customSymbols: CustomSymbolRecord[],
		symbols: ExportSymbolRecord[]
	): string {
		const customSymbolNames = new Set<string>()
		for (const comp of circuitComponents) {
			if (comp.referenceSymbol?.isCustomSymbol) {
				customSymbolNames.add(comp.referenceSymbol.tikzName)
			}
		}

		if (customSymbolNames.size === 0) return ""

		function parsePathDToTikz(d: string, midPoint: SVG.Point): string {
			const tokens = d.match(/[a-df-z]|-?\d*\.?\d+(e[-+]?\d+)?/ig) || []
			let tikzPath = ""
			let cx = 0
			let cy = 0
			let startX = 0
			let startY = 0
			let currentCmd = ""
			let i = 0

			const toTikzX = (x: number) => ((x - midPoint.x) * (127 / 4800)).toFixed(3)
			const toTikzY = (y: number) => (-(y - midPoint.y) * (127 / 4800)).toFixed(3)

			while (i < tokens.length) {
				const token = tokens[i]
				if (/[a-df-z]/i.test(token)) {
					currentCmd = token
					i++
				} else if (!currentCmd) {
					i++
					continue
				}

				const isRelative = currentCmd === currentCmd.toLowerCase()
				const upperCmd = currentCmd.toUpperCase()

				if (upperCmd === "M") {
					if (i + 1 >= tokens.length) {
						i++
						continue
					}

					let nx = parseFloat(tokens[i])
					let ny = parseFloat(tokens[i + 1])
					if (Number.isNaN(nx) || Number.isNaN(ny)) {
						i += 2
						continue
					}

					if (isRelative) {
						cx += nx
						cy += ny
					} else {
						cx = nx
						cy = ny
					}
					startX = cx
					startY = cy
					tikzPath += ` (${toTikzX(cx)}, ${toTikzY(cy)})`
					i += 2
					currentCmd = isRelative ? "l" : "L"
				} else if (upperCmd === "L") {
					if (i + 1 >= tokens.length) {
						i++
						continue
					}

					let nx = parseFloat(tokens[i])
					let ny = parseFloat(tokens[i + 1])
					if (Number.isNaN(nx) || Number.isNaN(ny)) {
						i += 2
						continue
					}

					if (isRelative) {
						cx += nx
						cy += ny
					} else {
						cx = nx
						cy = ny
					}
					tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
					i += 2
				} else if (upperCmd === "H") {
					let nx = parseFloat(tokens[i])
					if (Number.isNaN(nx)) {
						i++
						continue
					}
					if (isRelative) {
						cx += nx
					} else {
						cx = nx
					}
					tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
					i++
				} else if (upperCmd === "V") {
					let ny = parseFloat(tokens[i])
					if (Number.isNaN(ny)) {
						i++
						continue
					}
					if (isRelative) {
						cy += ny
					} else {
						cy = ny
					}
					tikzPath += ` -- (${toTikzX(cx)}, ${toTikzY(cy)})`
					i++
				} else if (upperCmd === "C") {
					if (i + 5 >= tokens.length) {
						i++
						continue
					}

					let x1 = parseFloat(tokens[i])
					let y1 = parseFloat(tokens[i + 1])
					let x2 = parseFloat(tokens[i + 2])
					let y2 = parseFloat(tokens[i + 3])
					let x = parseFloat(tokens[i + 4])
					let y = parseFloat(tokens[i + 5])

					if (Number.isNaN(x1) || Number.isNaN(y1) || Number.isNaN(x2) || Number.isNaN(y2) || Number.isNaN(x) || Number.isNaN(y)) {
						i += 6
						continue
					}

					if (isRelative) {
						x1 += cx
						y1 += cy
						x2 += cx
						y2 += cy
						x += cx
						y += cy
					}

					tikzPath += ` .. controls (${toTikzX(x1)}, ${toTikzY(y1)}) and (${toTikzX(x2)}, ${toTikzY(y2)}) .. (${toTikzX(x)}, ${toTikzY(y)})`
					cx = x
					cy = y
					i += 6
				} else if (upperCmd === "Z") {
					tikzPath += " -- cycle"
					cx = startX
					cy = startY
					i++
				} else {
					i++
				}
			}

			return tikzPath.trim()
		}

		const definitions: string[] = []

		for (const tikzName of customSymbolNames) {
			const customSymbol = customSymbols.find((symbol) => symbol.tikzName === tikzName)
			if (!customSymbol) continue

			const baseSymbol = customSymbol.baseSymbol || (tikzName.toLowerCase().includes("pmos") ? "pmos" : "nmos")
			const compSymbol = symbols.find((symbol) => symbol.tikzName === tikzName)
			if (compSymbol) {
				const variants = Array.from(compSymbol._mapping.values())
				const variant = variants[0]
				if (variant?.symbol) {
					const mid = variant.mid
					const drawCommands: string[] = []

					const collectDrawCommands = (node: Element) => {
						const tag = node.tagName.toLowerCase()
						const sw = node.getAttribute("stroke-width") || "0.4"

						if (tag === "line") {
							const dx1 = (parseFloat(node.getAttribute("x1") || "0") - mid.x) * (127 / 4800)
							const dy1 = -(parseFloat(node.getAttribute("y1") || "0") - mid.y) * (127 / 4800)
							const dx2 = (parseFloat(node.getAttribute("x2") || "0") - mid.x) * (127 / 4800)
							const dy2 = -(parseFloat(node.getAttribute("y2") || "0") - mid.y) * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dx1.toFixed(3)}, ${dy1.toFixed(3)}) -- (${dx2.toFixed(3)}, ${dy2.toFixed(3)});`)
						} else if (tag === "circle") {
							const dcx = (parseFloat(node.getAttribute("cx") || "0") - mid.x) * (127 / 4800)
							const dcy = -(parseFloat(node.getAttribute("cy") || "0") - mid.y) * (127 / 4800)
							const dr = parseFloat(node.getAttribute("r") || "0") * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dcx.toFixed(3)}, ${dcy.toFixed(3)}) circle (${dr.toFixed(3)});`)
						} else if (tag === "rect") {
							if (node.classList.contains("clickBackground")) return
							const rx = parseFloat(node.getAttribute("x") || "0")
							const ry = parseFloat(node.getAttribute("y") || "0")
							const rw = parseFloat(node.getAttribute("width") || "0")
							const rh = parseFloat(node.getAttribute("height") || "0")
							const dx1 = (rx - mid.x) * (127 / 4800)
							const dy1 = -(ry - mid.y) * (127 / 4800)
							const dx2 = (rx + rw - mid.x) * (127 / 4800)
							const dy2 = -(ry + rh - mid.y) * (127 / 4800)
							drawCommands.push(`\\draw [line width=${sw}pt] (${dx1.toFixed(3)}, ${dy1.toFixed(3)}) rectangle (${dx2.toFixed(3)}, ${dy2.toFixed(3)});`)
						} else if (tag === "path") {
							const d = node.getAttribute("d") || ""
							const tikzPath = parsePathDToTikz(d, mid)
							if (tikzPath) {
								drawCommands.push(`\\draw [line width=${sw}pt] ${tikzPath};`)
							}
						} else if (tag === "g") {
							for (let i = 0; i < node.children.length; i++) {
								collectDrawCommands(node.children[i])
							}
						}
					}

					const symbolNode = variant.symbol.node as any
					for (let i = 0; i < symbolNode.children.length; i++) {
						collectDrawCommands(symbolNode.children[i])
					}

					if (drawCommands.length > 0) {
						definitions.push(`  ${tikzName}/.style={\n    ${baseSymbol},\n    draw=none,\n    fill=none,\n    append after command={\n      \\begin{scope}[shift={(\\tikzlastnode.center)}]\n        ${drawCommands.join("\n        ")}\n      \\end{scope}\n    }\n  }`)
						continue
					}
				}
			}

			definitions.push(`  ${tikzName}/.style={${baseSymbol}}`)
		}

		return `\\tikzset{\n${definitions.join(",\n")}\n}`
	}
}
