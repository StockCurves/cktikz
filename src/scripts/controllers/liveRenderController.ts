import { TikzEditorController } from "../internal"
import { getAppRuntime } from "../services/appRuntime"
import { LatexRenderService, prepareLatexSource } from "../services/latexRenderService"

export class LiveRenderController {
	private static _instance: LiveRenderController
	public static get instance(): LiveRenderController {
		if (!LiveRenderController._instance) {
			LiveRenderController._instance = new LiveRenderController()
		}
		return LiveRenderController._instance
	}

	private btnVisualEditor: HTMLButtonElement | null = null
	private btnLiveRender: HTMLButtonElement | null = null
	private visualEditorTab: HTMLDivElement | null = null
	private liveRenderTab: HTMLDivElement | null = null
	private renderLoading: HTMLDivElement | null = null
	private tikzjaxContainer: HTMLDivElement | null = null
	private renderViewport: HTMLDivElement | null = null
	private renderSurface: HTMLDivElement | null = null
	private contentElement: HTMLElement | null = null
	private panScale = 1
	private panOffsetX = 0
	private panOffsetY = 0
	private isPanning = false
	private panStartX = 0
	private panStartY = 0
	private panStartOffsetX = 0
	private panStartOffsetY = 0
	private readonly wheelStep = 1.12

	public activeTab: "visual" | "render" = "visual"
	private renderGeneration = 0
	private debounceTimer: any = null
	private lastRenderedCode = ""
	private readonly latexRenderService: LatexRenderService = getAppRuntime().createLatexRenderService()

	private constructor() {}

	public init() {
		this.btnVisualEditor = document.getElementById("btn-visual-editor") as HTMLButtonElement
		this.btnLiveRender = document.getElementById("btn-live-render") as HTMLButtonElement
		this.visualEditorTab = document.getElementById("visualEditorTab") as HTMLDivElement
		this.liveRenderTab = document.getElementById("liveRenderTab") as HTMLDivElement
		this.renderLoading = document.getElementById("renderLoading") as HTMLDivElement
		this.tikzjaxContainer = document.getElementById("tikzjaxContainer") as HTMLDivElement
		this.ensureViewport()
		this.bindViewportEvents()

		if (this.btnVisualEditor && this.btnLiveRender) {
			this.btnVisualEditor.addEventListener("click", () => this.switchTab("visual"))
			this.btnLiveRender.addEventListener("click", () => this.switchTab("render"))
		}
	}

	public switchTab(tab: "visual" | "render") {
		if (this.activeTab === tab) return
		this.activeTab = tab

		const propertiesContainer = document.getElementById("propertiesContainer")

		if (tab === "visual") {
			this.visualEditorTab?.classList.add("active")
			this.visualEditorTab?.classList.remove("d-none")
			this.liveRenderTab?.classList.add("d-none")
			this.liveRenderTab?.classList.remove("active")

			this.btnVisualEditor?.classList.add("active")
			this.btnVisualEditor?.classList.remove("text-muted")
			this.btnLiveRender?.classList.remove("active")
			this.btnLiveRender?.classList.add("text-muted")

			propertiesContainer?.classList.remove("d-none")
		} else {
			this.visualEditorTab?.classList.remove("active")
			this.visualEditorTab?.classList.add("d-none")
			this.liveRenderTab?.classList.remove("d-none")
			this.liveRenderTab?.classList.add("active")

			this.btnLiveRender?.classList.add("active")
			this.btnLiveRender?.classList.remove("text-muted")
			this.btnVisualEditor?.classList.remove("active")
			this.btnVisualEditor?.classList.add("text-muted")

			propertiesContainer?.classList.add("d-none")

			const currentCode = TikzEditorController.instance.getCode()
			if (currentCode !== this.lastRenderedCode) {
				this.renderTikz()
			} else {
				this.centerViewDeferred()
			}
		}
	}

	private ensureViewport() {
		if (!this.tikzjaxContainer) return
		if (!this.renderViewport) {
			this.renderViewport = document.createElement("div")
			this.renderViewport.style.cssText =
				"position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;cursor:grab;"
			this.tikzjaxContainer.appendChild(this.renderViewport)
		}
		if (!this.renderSurface) {
			this.renderSurface = document.createElement("div")
			this.renderSurface.style.cssText =
				"position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;"
			this.renderViewport.appendChild(this.renderSurface)
		}
	}

	private bindViewportEvents() {
		if (!this.renderViewport) return
		this.renderViewport.addEventListener(
			"contextmenu",
			(e) => {
				e.preventDefault()
			},
			{ passive: false }
		)
		this.renderViewport.addEventListener(
			"wheel",
			(e) => {
				e.preventDefault()
				const rect = this.renderViewport.getBoundingClientRect()
				const mouseX = e.clientX - rect.left
				const mouseY = e.clientY - rect.top
				const worldX = (mouseX - this.panOffsetX) / this.panScale
				const worldY = (mouseY - this.panOffsetY) / this.panScale
				const factor = e.deltaY < 0 ? this.wheelStep : 1 / this.wheelStep
				const nextScale = Math.min(12, Math.max(0.15, this.panScale * factor))
				this.panOffsetX = mouseX - worldX * nextScale
				this.panOffsetY = mouseY - worldY * nextScale
				this.panScale = nextScale
				this.applyTransform()
			},
			{ passive: false }
		)
		this.renderViewport.addEventListener("dblclick", (e) => {
			e.preventDefault()
			this.fitView()
		})
		this.renderViewport.addEventListener("mousedown", (e) => {
			if (e.button !== 2) return
			e.preventDefault()
			this.isPanning = true
			this.panStartX = e.clientX
			this.panStartY = e.clientY
			this.panStartOffsetX = this.panOffsetX
			this.panStartOffsetY = this.panOffsetY
			this.renderViewport!.style.cursor = "grabbing"
		})
		document.addEventListener("mousemove", (e) => {
			if (!this.isPanning) return
			this.panOffsetX = this.panStartOffsetX + (e.clientX - this.panStartX)
			this.panOffsetY = this.panStartOffsetY + (e.clientY - this.panStartY)
			this.applyTransform()
		})
		document.addEventListener("mouseup", () => {
			if (!this.isPanning) return
			this.isPanning = false
			if (this.renderViewport) this.renderViewport.style.cursor = "grab"
		})
	}

	private applyTransform() {
		if (!this.renderSurface) return
		this.renderSurface.style.transform = `translate(${this.panOffsetX}px, ${this.panOffsetY}px) scale(${this.panScale})`
	}

	private fitViewDeferred() {
		requestAnimationFrame(() => this.fitView())
	}

	private centerViewDeferred() {
		requestAnimationFrame(() => this.centerViewPreserveZoom())
	}

	private clearRenderedContent() {
		if (!this.renderSurface) return
		this.renderSurface.innerHTML = ""
		this.contentElement = null
		this.tikzjaxContainer?.querySelectorAll(":scope > div, :scope > iframe, :scope > img, :scope > .render-badge")
			.forEach((el) => {
				if (el !== this.renderViewport) el.remove()
			})
	}

	public fitView() {
		if (!this.renderViewport || !this.contentElement) return
		const viewportRect = this.renderViewport.getBoundingClientRect()
		if (viewportRect.width <= 0 || viewportRect.height <= 0) return

		let contentRect: DOMRect | null = null
		if (this.contentElement instanceof HTMLIFrameElement) {
			const doc = this.contentElement.contentDocument || this.contentElement.contentWindow?.document
			const svg = doc?.querySelector("svg") as SVGSVGElement | null
			if (svg) contentRect = svg.getBoundingClientRect()
		} else {
			contentRect = this.contentElement.getBoundingClientRect()
		}

		if (!contentRect || contentRect.width <= 0 || contentRect.height <= 0) return

		const padding = 32
		const scaleX = (viewportRect.width - padding * 2) / contentRect.width
		const scaleY = (viewportRect.height - padding * 2) / contentRect.height
		this.panScale = Math.min(scaleX, scaleY)
		if (!Number.isFinite(this.panScale) || this.panScale <= 0) this.panScale = 1
		this.panOffsetX = (viewportRect.width - contentRect.width * this.panScale) / 2
		this.panOffsetY = (viewportRect.height - contentRect.height * this.panScale) / 2
		this.applyTransform()
	}

	private centerViewPreserveZoom() {
		if (!this.renderViewport || !this.contentElement) return
		const viewportRect = this.renderViewport.getBoundingClientRect()
		if (viewportRect.width <= 0 || viewportRect.height <= 0) return

		let contentRect: DOMRect | null = null
		if (this.contentElement instanceof HTMLIFrameElement) {
			const doc = this.contentElement.contentDocument || this.contentElement.contentWindow?.document
			const svg = doc?.querySelector("svg") as SVGSVGElement | null
			if (svg) contentRect = svg.getBoundingClientRect()
		} else {
			contentRect = this.contentElement.getBoundingClientRect()
		}

		if (!contentRect || contentRect.width <= 0 || contentRect.height <= 0) return

		this.panOffsetX = (viewportRect.width - contentRect.width * this.panScale) / 2
		this.panOffsetY = (viewportRect.height - contentRect.height * this.panScale) / 2
		this.applyTransform()
	}

	public triggerDebouncedRender() {
		if (this.activeTab !== "render") return
		clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this.renderTikz(), 1200)
	}

	private renderViaTikZJax(bodyCode: string, libraries: string[]): Promise<HTMLIFrameElement> {
		// Do not include \usetikzlibrary in local TikZJax compilation to avoid WASM unreachable crashes.
		// Standard circuitikz macros are loaded by \usepackage{circuitikz} without extra libraries.
		const texCode = `\\usepackage{circuitikz}\n\\begin{document}\n${bodyCode}\n\\end{document}`

		const iframeSrcdoc =
			"<!DOCTYPE html><html><head>" +
			'<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">' +
			'<script src="https://tikzjax.com/v1/tikzjax.js"><\/script>' +
			"<style>body{margin:0;padding:40px;display:flex;justify-content:center;align-items:center;" +
			"min-height:100vh;background:transparent}svg{max-width:100%;height:auto}<\/style>" +
			"</head><body>" +
			'<script type="text/tikz" data-show-console="true">' +
			texCode.replace(/</g, "\\lt ").replace(/>/g, "\\gt ") +
			"<\/script></body></html>"

		return new Promise((resolve, reject) => {
			const iframe = document.createElement("iframe")
			iframe.style.cssText = "width:100%; height:100%; border:none; background:transparent;"
			iframe.srcdoc = iframeSrcdoc

			let resolved = false
			iframe.addEventListener("load", () => {
				const checkRendered = setInterval(() => {
					try {
						const doc = iframe.contentDocument || iframe.contentWindow?.document
						if (doc && doc.querySelector("svg")) {
							clearInterval(checkRendered)
							if (!resolved) {
								resolved = true
								resolve(iframe)
							}
						}
					} catch (e) {
						/* cross-origin issues, ignore */
					}
				}, 500)

				// 18 seconds timeout
				setTimeout(() => {
					clearInterval(checkRendered)
					if (!resolved) {
						resolved = true
						reject(new Error("TikZJax timeout — circuit too complex for browser TeX engine."))
					}
				}, 18000)
			})

			if (this.tikzjaxContainer) {
				this.tikzjaxContainer.appendChild(iframe)
			} else {
				reject(new Error("tikzjaxContainer is missing"))
			}
		})
	}

	public async renderTikz() {
		clearTimeout(this.debounceTimer)
		const thisGen = ++this.renderGeneration
		const currentCode = TikzEditorController.instance.getCode()

		if (this.renderLoading) this.renderLoading.style.display = "flex"
		this.clearRenderedContent()

		// Remove old errors
		const prevErr = document.getElementById("render-error-overlay")
		if (prevErr) prevErr.remove()

		const { bodyCode, libraries } = prepareLatexSource(currentCode)

		// -- Attempt 1: QuickLaTeX API --
		try {
			const img = await this.latexRenderService.renderViaQuickLaTeX(bodyCode, libraries)
			if (thisGen !== this.renderGeneration) return

			this.lastRenderedCode = currentCode
			if (this.renderLoading) this.renderLoading.style.display = "none"
			if (this.renderSurface) {
				const wrapper = document.createElement("div")
				wrapper.style.cssText =
					"display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;"
				wrapper.appendChild(img)
				this.renderSurface.appendChild(wrapper)
				this.contentElement = wrapper

				const badge = document.createElement("div")
				badge.style.cssText =
					"position:absolute;top:8px;right:12px;font-size:11px;color:var(--text-muted);background:var(--bg-panel);border:1px solid var(--border-color);border-radius:4px;padding:2px 7px;pointer-events:none;z-index:5;"
				badge.textContent = "⚡ QuickLaTeX"
				this.tikzjaxContainer!.style.position = "relative"
				badge.classList.add("render-badge")
				this.tikzjaxContainer!.appendChild(badge)
				this.fitViewDeferred()
			}
			return
		} catch (apiErr: any) {
			if (thisGen !== this.renderGeneration) return

			// If it is a real LaTeX compilation error from QuickLaTeX API, show it directly and do not fallback.
			if (apiErr.message && apiErr.message.startsWith("QuickLaTeX:")) {
				console.warn("[Render] QuickLaTeX compilation failed:", apiErr.message)
				if (this.renderLoading) this.renderLoading.style.display = "none"
				this.showRenderError(apiErr.message.replace("QuickLaTeX: ", ""), "LaTeX Compilation Error")
				return
			}

			console.warn("[Render] QuickLaTeX network failed, falling back to TikZJax:", apiErr.message)
		}

		// -- Attempt 2: TikZJax WASM iframe --
		try {
			const iframe = await this.renderViaTikZJax(bodyCode, libraries)
			if (thisGen !== this.renderGeneration) return

			this.lastRenderedCode = currentCode
			if (this.renderLoading) this.renderLoading.style.display = "none"

			if (this.renderSurface) {
				this.renderSurface.appendChild(iframe)
				this.contentElement = iframe
				const badge = document.createElement("div")
				badge.style.cssText =
					"position:absolute;top:8px;right:12px;font-size:11px;color:var(--text-muted);background:var(--bg-panel);border:1px solid var(--border-color);border-radius:4px;padding:2px 7px;pointer-events:none;z-index:5;"
				badge.textContent = "🔬 TikZJax"
				this.tikzjaxContainer!.style.position = "relative"
				badge.classList.add("render-badge")
				this.tikzjaxContainer!.appendChild(badge)
				this.fitViewDeferred()
			}
			return
		} catch (wasmErr: any) {
			if (thisGen !== this.renderGeneration) return
			console.warn("[Render] TikZJax also failed:", wasmErr.message)
		}

		// -- Both failed: show error --
		if (thisGen !== this.renderGeneration) return
		if (this.renderLoading) this.renderLoading.style.display = "none"
		this.showRenderError(
			"Could not render via QuickLaTeX API (check network / CORS) and the circuit is too " +
			"complex for the browser TeX engine.<br><br>" +
			"<strong>Tip:</strong> Copy the LaTeX code and paste it into " +
			'<a href="https://overleaf.com" target="_blank" style="color:var(--primary)">Overleaf</a> ' +
			"or a local LaTeX installation.",
			"Render Error"
		)
	}

	private showRenderError(msg: string, title = "Render Error") {
		if (this.tikzjaxContainer) {
			this.clearRenderedContent()
			const errDiv = document.createElement("div")
			errDiv.id = "render-error-overlay"
			errDiv.style.cssText =
				"display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:32px; gap:12px; font-family:inherit; text-align:center;"
			errDiv.innerHTML =
				'<div style="font-size:2rem">⚠️</div>' +
				`<div style="font-size:1.1rem;font-weight:700;color:var(--danger)">${title}</div>` +
				`<div style="font-size:0.85rem;color:var(--text-muted);max-width:480px;white-space:pre-wrap;text-align:left;background:rgba(217,56,58,0.05);border:1px solid rgba(217,56,58,0.2);padding:12px;border-radius:6px;font-family:monospace;">${msg}</div>` +
				'<button id="render-retry-btn" style="margin-top:8px;padding:8px 18px;border-radius:8px;' +
				'border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:0.9rem;">Retry</button>'
			this.tikzjaxContainer.appendChild(errDiv)

			const retryBtn = document.getElementById("render-retry-btn")
			retryBtn?.addEventListener("click", () => this.renderTikz())
		}
	}
}
