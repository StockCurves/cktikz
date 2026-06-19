type LeafSnapshot = {
	canonical: string
	xml: string
}

const inheritedPresentationAttributes = [
	"class",
	"clip-rule",
	"fill",
	"fill-opacity",
	"fill-rule",
	"opacity",
	"stroke",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-miterlimit",
	"stroke-opacity",
	"stroke-width",
	"vector-effect",
]

const volatileAttributes = new Set(["data-draggable", "data-orig-index", "style"])

function snapshotLeaf(node: Element, inherited: Map<string, string>): LeafSnapshot {
	const clone = node.cloneNode(true) as Element

	for (const [name, value] of inherited) {
		if (!clone.hasAttribute(name)) {
			clone.setAttribute(name, value)
		}
	}

	for (const attr of Array.from(clone.attributes)) {
		if (volatileAttributes.has(attr.name) || attr.name.startsWith("data-")) {
			clone.removeAttribute(attr.name)
		}
	}

	const canonicalAttributes = Array.from(clone.attributes)
		.map((attr) => [attr.name, attr.value] as const)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, value]) => `${name}=${JSON.stringify(value)}`)
		.join(";")

	return {
		canonical: `${clone.tagName.toLowerCase()}|${canonicalAttributes}|${clone.textContent ?? ""}`,
		xml: clone.outerHTML.trim(),
	}
}

export function collectComparableLeafs(root: Element): LeafSnapshot[] {
	const leafs: LeafSnapshot[] = []

	const traverse = (node: Element, inherited: Map<string, string>) => {
		const tag = node.tagName.toLowerCase()
		if (tag === "pin" || node.classList.contains("clickBackground")) return

		const nextInherited = new Map(inherited)
		for (const attrName of inheritedPresentationAttributes) {
			if (node.hasAttribute(attrName)) {
				nextInherited.set(attrName, node.getAttribute(attrName)!)
			}
		}

		if (tag === "g" || tag === "symbol") {
			Array.from(node.children).forEach((child) => traverse(child, nextInherited))
			return
		}

		leafs.push(snapshotLeaf(node, nextInherited))
	}

	traverse(root, new Map())
	return leafs
}

function decrementCount(counts: Map<string, number>, key: string): boolean {
	const count = counts.get(key) ?? 0
	if (count <= 0) return false
	if (count === 1) counts.delete(key)
	else counts.set(key, count - 1)
	return true
}

function countByCanonical(leafs: LeafSnapshot[]): Map<string, number> {
	const counts = new Map<string, number>()
	for (const leaf of leafs) {
		counts.set(leaf.canonical, (counts.get(leaf.canonical) ?? 0) + 1)
	}
	return counts
}

export function buildSymbolVariantDiff(baseSymbolNode: Element, variantSymbolNode: Element) {
	const baseLeafs = collectComparableLeafs(baseSymbolNode)
	const variantLeafs = collectComparableLeafs(variantSymbolNode)

	const unmatchedVariantCounts = countByCanonical(variantLeafs)
	const deletedBaseIndices = new Set<number>()
	baseLeafs.forEach((leaf, index) => {
		if (!decrementCount(unmatchedVariantCounts, leaf.canonical)) {
			deletedBaseIndices.add(index)
		}
	})

	const unmatchedBaseCounts = countByCanonical(baseLeafs)
	const decoratorElements: string[] = []
	for (const leaf of variantLeafs) {
		if (!decrementCount(unmatchedBaseCounts, leaf.canonical)) {
			decoratorElements.push(leaf.xml)
		}
	}

	return { deletedBaseIndices, decoratorElements }
}
