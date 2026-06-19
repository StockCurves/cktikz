export interface PreparedLatexSource {
	bodyCode: string
	libraries: string[]
}

export function prepareLatexSource(raw: string): PreparedLatexSource {
	let code = raw
	const docMatch = code.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/)
	if (docMatch) code = docMatch[1].trim()

	code = code.replace(/\\documentclass[^{]*\{[^}]*\}/g, "")
	code = code.replace(/\\usepackage[^{]*\{[^}]*\}/g, "")
	code = code.replace(/%.*$/gm, "")
	code = code.replace(/[^\x00-\x7F]/g, "")
	code = code.replace(/,?\s*font=\\[a-zA-Z]+/g, "")
	code = code.replace(/^\s*\n/gm, "").trim()

	const libraries: string[] = ["calc"]
	const libMatches = code.match(/\\usetikzlibrary\{([^}]+)\}/g)
	if (libMatches) {
		libMatches.forEach((m) => {
			const innerMatch = m.match(/\\usetikzlibrary\{([^}]+)\}/)
			if (innerMatch && innerMatch[1]) {
				const libs = innerMatch[1].split(",")
				libs.forEach((l) => {
					const trimmed = l.trim()
					if (trimmed && !libraries.includes(trimmed)) {
						libraries.push(trimmed)
					}
				})
			}
		})
		code = code.replace(/\\usetikzlibrary\{[^}]+\}/g, "")
	}

	return { bodyCode: code, libraries }
}

export class LatexRenderService {
	public constructor(private readonly apiBase: string) {}

	public async renderViaQuickLaTeX(bodyCode: string, libraries: string[]): Promise<HTMLImageElement> {
		const libsStr = libraries.join(",")
		const preamble = `\\usepackage[american]{circuitikz}\n\\usepackage{graphicx}\n\\usetikzlibrary{${libsStr}}`

		const params = [
			"formula=" + encodeURIComponent(bodyCode),
			"fsize=" + encodeURIComponent("20px"),
			"fcolor=000000",
			"mode=0",
			"out=1",
			"remhost=" + encodeURIComponent("quicklatex.com"),
			"preamble=" + encodeURIComponent(preamble),
			"errors=1",
		].join("&")

		const response = await fetch(`${this.apiBase}/api/latex`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params,
		})
		const text = await response.text()
		const lines = text.trim().split("\n")
		const status = parseInt(lines[0], 10)
		if (status !== 0) {
			const errMsg = lines.slice(1).join("\n")
			throw new Error("QuickLaTeX: " + errMsg)
		}
		let imgUrl = lines[1].trim().split(/\s+/)[0]
		if (imgUrl.endsWith(".png")) {
			imgUrl = imgUrl.substring(0, imgUrl.length - 4) + ".svg"
		}
		const img = document.createElement("img")
		img.src = imgUrl
		img.alt = "CircuiTikZ Render"
		return img
	}
}
