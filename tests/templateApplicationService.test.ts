import { describe, expect, it, vi, beforeEach } from "vitest"
import { TemplateApplicationService } from "../src/scripts/services/templateApplicationService"
import { TemplateDataSource, TemplateEditorPort, TemplateNotifierPort } from "../src/scripts/services/templateTypes"

describe("TemplateApplicationService", () => {
	let dataSource: TemplateDataSource
	let editor: TemplateEditorPort
	let notifier: TemplateNotifierPort

	beforeEach(() => {
		dataSource = {
			listFiles: vi.fn().mockResolvedValue({ templates: ["rc-lowpass.tex"], works: ["draft.tex"] }),
			readFile: vi.fn().mockResolvedValue("\\draw (0,0) -- (1,0);"),
			saveWork: vi.fn().mockResolvedValue(undefined),
			deleteWork: vi.fn().mockResolvedValue(undefined),
		}
		editor = {
			getCode: vi.fn().mockReturnValue("\\draw (0,0) -- (2,0);"),
			setCode: vi.fn(),
			applyEditorText: vi.fn(),
		}
		notifier = {
			alert: vi.fn().mockResolvedValue(undefined),
			confirm: vi.fn().mockResolvedValue(true),
		}
	})

	it("bootstrapDefaultFile loads the file list and opens the default template", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)

		const viewModel = await service.bootstrapDefaultFile(true)

		expect(dataSource.listFiles).toHaveBeenCalledTimes(1)
		expect(dataSource.readFile).toHaveBeenCalledWith("work", "blank.tex")
		expect(editor.setCode).toHaveBeenCalledWith("\\draw (0,0) -- (1,0);")
		expect(editor.applyEditorText).toHaveBeenCalledTimes(1)
		expect(viewModel.selectedDisplayName).toBe("blank")
	})

	it("openFile updates editor content and session state", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)

		await service.openFile("work", "draft.tex")

		expect(dataSource.readFile).toHaveBeenCalledWith("work", "draft.tex")
		expect(service.getState().currentDir).toBe("work")
		expect(service.getState().currentName).toBe("draft.tex")
	})

	it("saveWork normalizes extension, refreshes list, and switches to work", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)
		await service.listEntries()

		const viewModel = await service.saveWork("draft")

		expect(dataSource.saveWork).toHaveBeenCalledWith("draft.tex", "\\draw (0,0) -- (2,0);")
		expect(dataSource.listFiles).toHaveBeenCalledTimes(2)
		expect(dataSource.readFile).toHaveBeenCalledWith("work", "draft.tex")
		expect(viewModel.selectedDisplayName).toBe("draft")
		expect(notifier.alert).toHaveBeenCalledWith("Save Complete", "Successfully saved to work/draft.tex")
	})

	it("deleteWork falls back to the default template when deleting the active work file", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)
		await service.openFile("work", "draft.tex")
		await service.listEntries()

		const viewModel = await service.deleteWork("draft.tex")

		expect(notifier.confirm).toHaveBeenCalledWith("Delete Work", 'Are you sure you want to delete "draft"?')
		expect(dataSource.deleteWork).toHaveBeenCalledWith("draft.tex")
		expect(dataSource.readFile).toHaveBeenLastCalledWith("work", "blank.tex")
		expect(viewModel.selectedDisplayName).toBe("blank")
	})

	it("invalid save input is reported through the notifier", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)

		await service.saveWork('bad:name')

		expect(notifier.alert).toHaveBeenCalledWith("Save File", "Invalid filename characters.")
		expect(dataSource.saveWork).not.toHaveBeenCalled()
	})

	it("deleteWork blocks deletion of blank.tex", async () => {
		const service = new TemplateApplicationService(dataSource, editor, notifier)
		await service.listEntries()

		const viewModel = await service.deleteWork("blank.tex")

		expect(notifier.alert).toHaveBeenCalledWith("Delete Work", "The default blank work cannot be deleted.")
		expect(dataSource.deleteWork).not.toHaveBeenCalled()
	})
})
