import { defaultFill, defaultStroke } from "./themeDefaults"

function addFill(node: Element) {
	const hasFill = node.getAttribute("fill") !== null
	if (hasFill) {
		return
	}
	for (const element of node.children) {
		if (element.nodeName === "g") {
			addFill(element)
		} else if (!element.getAttribute("fill")) {
			element.setAttribute("fill", "currentColor")
		}
	}
}

export function preprocessSymbolColors(node: Element) {
	node.querySelectorAll("[fill]").forEach((elem) => {
		if (elem.getAttribute("fill") == "#000") {
			elem.setAttribute("fill", defaultStroke)
		} else if (elem.getAttribute("fill") == "#fff") {
			elem.setAttribute("fill", defaultFill)
		}
	})
	node.querySelectorAll("[stroke]").forEach((elem) => {
		if (elem.getAttribute("stroke") == "#000") {
			elem.setAttribute("stroke", defaultStroke)
		} else if (elem.getAttribute("stroke") == "#fff") {
			elem.setAttribute("stroke", defaultFill)
		}
	})

	node.querySelectorAll(".fillable").forEach((elem) => {
		if (elem.getAttribute("fill") == "none") {
			elem.setAttribute("fill", "currentFill")
		}
	})

	if (node.getAttribute("fill") == "#000") {
		node.setAttribute("fill", defaultStroke)
	} else if (node.getAttribute("fill") == "#fff") {
		node.setAttribute("fill", defaultFill)
	}

	if (node.getAttribute("stroke") == "#000") {
		node.setAttribute("stroke", defaultStroke)
	} else if (node.getAttribute("stroke") == "#fff") {
		node.setAttribute("stroke", defaultFill)
	}

	addFill(node)
}
