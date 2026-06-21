export type MainControllerMathJaxBootstrapDependencies = {
	mathJaxSrc?: string
}

const DEFAULT_MATHJAX_SRC = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"

export function initializeMainControllerMathJaxBootstrap(
	dependencies: MainControllerMathJaxBootstrapDependencies = {}
) {
	return new Promise<void>((resolve) => {
		if (!("MathJax" in window)) {
			;(window as any).MathJax = {
				tex: {
					inlineMath: { "[+]": [["$", "$"]] },
				},
			}
		}

		const script = document.createElement("script")
		script.src = dependencies.mathJaxSrc ?? DEFAULT_MATHJAX_SRC
		document.head.appendChild(script)
		script.addEventListener(
			"load",
			() => {
				resolve()
			},
			false
		)
	})
}
