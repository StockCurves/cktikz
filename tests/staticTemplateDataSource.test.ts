import { afterEach, describe, expect, it, vi } from "vitest"
import { StaticTemplateDataSource } from "../src/scripts/services/staticTemplateDataSource"

describe("StaticTemplateDataSource", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("lists manifest templates and reads template content from static URLs", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: vi.fn().mockResolvedValue("\\draw (0,0) -- (1,0);"),
		})
		vi.stubGlobal("fetch", fetchMock)

		const dataSource = new StaticTemplateDataSource([
			{ name: "rc-lowpass.tex", url: "/assets/rc-lowpass.tex" },
			{ name: "bridge-rectifier.tex", url: "/assets/bridge-rectifier.tex" },
		])

		expect(await dataSource.listFiles()).toEqual({
			templates: ["rc-lowpass.tex", "bridge-rectifier.tex"],
			works: [],
		})
		expect(await dataSource.readFile("template", "bridge-rectifier.tex")).toBe("\\draw (0,0) -- (1,0);")
		expect(fetchMock).toHaveBeenCalledWith("/assets/bridge-rectifier.tex")
	})

	it("rejects work-file operations because static-manifest mode is read-only for templates", async () => {
		const dataSource = new StaticTemplateDataSource([{ name: "rc-lowpass.tex", url: "/assets/rc-lowpass.tex" }])

		await expect(dataSource.readFile("work", "draft.tex")).rejects.toThrow("Static template source does not provide editable work files.")
		await expect(dataSource.saveWork("draft.tex", "x")).rejects.toThrow("Static template source cannot save work files.")
		await expect(dataSource.deleteWork("draft.tex")).rejects.toThrow("Static template source cannot delete work files.")
	})
})
