import { describe, expect, it, vi } from "vitest"
import { PropertiesSelectionService } from "../src/scripts/services/propertiesSelectionService"
import { PropertiesCollection, PropertyCategories } from "../src/scripts/properties/propertiesCollection"

const makeProperty = (id: string, value: unknown) => ({
	id,
	value,
	getMultiEditVersion: vi.fn(function (properties: any[]) {
		return {
			id,
			value: properties[0].value,
			remove: vi.fn(),
			getHTMLElement: vi.fn(() => document.createElement("div")),
		}
	}),
})

describe("PropertiesSelectionService", () => {
	it("returns single-selection properties without creating transient instances", () => {
		const first = { getHTMLElement: vi.fn(() => document.createElement("div")) }
		const component = {
			properties: {
				sorted: vi.fn(() => [first]),
			},
		}

		const result = new PropertiesSelectionService().buildSingleSelectionProperties(component as any)

		expect(result.properties).toEqual([first])
		expect(result.transientProperties).toEqual([])
	})

	it("builds overlap properties only for ids present on every selected component", () => {
		const sharedA = makeProperty("shared", "A")
		const sharedB = makeProperty("shared", "B")
		const exclusive = makeProperty("exclusive", "X")

		const first = new PropertiesCollection()
		first.set(PropertyCategories.options, [sharedA as any, exclusive as any])
		const second = new PropertiesCollection()
		second.set(PropertyCategories.options, [sharedB as any])

		const result = new PropertiesSelectionService().buildMultiSelectionProperties([
			{ properties: first },
			{ properties: second },
		] as any)

		expect(result.properties).toHaveLength(1)
		expect(result.transientProperties).toHaveLength(1)
		expect(sharedA.getMultiEditVersion).toHaveBeenCalledTimes(1)
	})

	it("ignores empty ids during overlap detection", () => {
		const emptyA = makeProperty("", "A")
		const emptyB = makeProperty("", "B")
		const first = new PropertiesCollection()
		first.set(PropertyCategories.options, [emptyA as any])
		const second = new PropertiesCollection()
		second.set(PropertyCategories.options, [emptyB as any])

		const result = new PropertiesSelectionService().buildMultiSelectionProperties([
			{ properties: first },
			{ properties: second },
		] as any)

		expect(result.properties).toEqual([])
		expect(result.transientProperties).toEqual([])
	})
})
