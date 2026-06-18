import type { CircuitComponent } from "../components/circuitComponent"
import type { EditableProperty } from "../properties/editableProperty"
import { PropertiesCollection, PropertyCategories } from "../properties/propertiesCollection"

export type PropertiesAggregationResult = {
	properties: EditableProperty<any>[]
	transientProperties: EditableProperty<any>[]
}

export class PropertiesSelectionService {
	public buildSingleSelectionProperties(component: CircuitComponent): PropertiesAggregationResult {
		return {
			properties: component.properties.sorted(),
			transientProperties: [],
		}
	}

	public buildMultiSelectionProperties(components: CircuitComponent[]): PropertiesAggregationResult {
		const overlappingProperties: PropertiesCollection = new PropertiesCollection()
		const transientProperties: EditableProperty<any>[] = []

		for (const element in PropertyCategories) {
			if (!isNaN(Number(element))) {
				continue
			}
			const category = PropertyCategories[element as keyof typeof PropertyCategories]
			const categoryMap: Map<string, EditableProperty<any>[]> = new Map()

			for (const component of components) {
				const properties = component.properties.get(category)
				if (properties == undefined) {
					continue
				}
				for (const property of properties) {
					if (property.id == "") {
						continue
					}
					if (categoryMap.has(property.id)) {
						categoryMap.get(property.id)!.push(property)
					} else {
						categoryMap.set(property.id, [property])
					}
				}
			}

			const relevantProperties: EditableProperty<any>[] = []
			for (const id of categoryMap.keys()) {
				const properties = categoryMap.get(id)!
				if (properties.length < components.length) {
					continue
				}
				const multi = properties[0].getMultiEditVersion(properties)
				transientProperties.push(multi)
				relevantProperties.push(multi)
			}
			overlappingProperties.set(category, relevantProperties)
		}

		return {
			properties: overlappingProperties.sorted(),
			transientProperties,
		}
	}
}
