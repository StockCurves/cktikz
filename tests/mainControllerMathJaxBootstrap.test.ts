import { describe, expect, it } from "vitest"
import { initializeMainControllerMathJaxBootstrap } from "../src/scripts/controllers/mainControllerMathJaxBootstrap"

describe("mainControllerMathJaxBootstrap", () => {
	it("initializes MathJax config and resolves after script load", async () => {
		delete (window as any).MathJax

		const bootstrapPromise = initializeMainControllerMathJaxBootstrap({
			mathJaxSrc: "https://example.com/mathjax.js",
		})

		const script = document.head.querySelector('script[src="https://example.com/mathjax.js"]') as HTMLScriptElement | null
		expect(script).toBeTruthy()
		expect((window as any).MathJax?.tex?.inlineMath?.["[+]"]?.[0]).toEqual(["$", "$"])

		script?.dispatchEvent(new Event("load"))
		await expect(bootstrapPromise).resolves.toBeUndefined()
	})

	it("preserves existing MathJax object when already present", async () => {
		;(window as any).MathJax = { existing: true }

		const bootstrapPromise = initializeMainControllerMathJaxBootstrap({
			mathJaxSrc: "https://example.com/already-present.js",
		})

		const script = document.head.querySelector('script[src="https://example.com/already-present.js"]') as HTMLScriptElement | null
		expect((window as any).MathJax).toEqual({ existing: true })

		script?.dispatchEvent(new Event("load"))
		await expect(bootstrapPromise).resolves.toBeUndefined()
	})
})
