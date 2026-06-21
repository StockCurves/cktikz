import { defaultFill } from "./themeDefaults"

const implicitlyFilledTags = new Set(["circle", "ellipse", "polygon", "rect", "text", "tspan"])
const closedPathTolerance = 1e-6

export function resolveEditorFill(tagName: string, explicitFill: string | null, inheritedFill?: string): string {
	if (explicitFill) return explicitFill
	if (inheritedFill) return inheritedFill

	const normalizedTag = tagName.toLowerCase()
	if (implicitlyFilledTags.has(normalizedTag)) return defaultFill

	if (normalizedTag === "path") {
		return "none"
	}

	return "none"
}

export function resolveEditorPathFill(pathData: string | null, explicitFill: string | null, inheritedFill?: string): string {
	if (explicitFill) return explicitFill
	if (inheritedFill) return inheritedFill
	if (pathData && pathHasImplicitFill(pathData)) return defaultFill
	return "none"
}

function pathHasImplicitFill(pathData: string): boolean {
	const commandPattern = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
	let currentX = 0
	let currentY = 0
	let subpathStartX: number | null = null
	let subpathStartY: number | null = null
	let hasDrawnSegment = false

	for (const match of pathData.matchAll(commandPattern)) {
		const command = match[1]
		const args = (match[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number)

		switch (command) {
			case "M":
				currentX = args[0] ?? currentX
				currentY = args[1] ?? currentY
				subpathStartX = currentX
				subpathStartY = currentY
				hasDrawnSegment = false
				for (let i = 2; i + 1 < args.length; i += 2) {
					currentX = args[i]
					currentY = args[i + 1]
					hasDrawnSegment = true
				}
				break
			case "m":
				currentX += args[0] ?? 0
				currentY += args[1] ?? 0
				subpathStartX = currentX
				subpathStartY = currentY
				hasDrawnSegment = false
				for (let i = 2; i + 1 < args.length; i += 2) {
					currentX += args[i]
					currentY += args[i + 1]
					hasDrawnSegment = true
				}
				break
			case "L":
			case "T":
				currentX = args[args.length - 2] ?? currentX
				currentY = args[args.length - 1] ?? currentY
				hasDrawnSegment = args.length >= 2
				break
			case "l":
			case "t":
				currentX += args[args.length - 2] ?? 0
				currentY += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 2
				break
			case "H":
				currentX = args[args.length - 1] ?? currentX
				hasDrawnSegment = args.length >= 1
				break
			case "h":
				currentX += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 1
				break
			case "V":
				currentY = args[args.length - 1] ?? currentY
				hasDrawnSegment = args.length >= 1
				break
			case "v":
				currentY += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 1
				break
			case "C":
				currentX = args[args.length - 2] ?? currentX
				currentY = args[args.length - 1] ?? currentY
				hasDrawnSegment = args.length >= 6
				break
			case "c":
				currentX += args[args.length - 2] ?? 0
				currentY += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 6
				break
			case "S":
			case "Q":
				currentX = args[args.length - 2] ?? currentX
				currentY = args[args.length - 1] ?? currentY
				hasDrawnSegment = args.length >= 4
				break
			case "s":
			case "q":
				currentX += args[args.length - 2] ?? 0
				currentY += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 4
				break
			case "A":
				currentX = args[args.length - 2] ?? currentX
				currentY = args[args.length - 1] ?? currentY
				hasDrawnSegment = args.length >= 7
				break
			case "a":
				currentX += args[args.length - 2] ?? 0
				currentY += args[args.length - 1] ?? 0
				hasDrawnSegment = args.length >= 7
				break
			case "Z":
			case "z":
				return true
		}

		if (
			hasDrawnSegment &&
			subpathStartX !== null &&
			subpathStartY !== null &&
			Math.abs(currentX - subpathStartX) <= closedPathTolerance &&
			Math.abs(currentY - subpathStartY) <= closedPathTolerance
		) {
			return true
		}
	}

	return false
}
