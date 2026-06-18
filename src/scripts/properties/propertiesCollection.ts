import { EditableProperty } from "./editableProperty"

export enum PropertyCategories {
	manipulation,
	ordering,
	options,
	fill,
	stroke,
	label,
	voltage,
	current,
	text,
	info,
}

export class PropertiesCollection extends Map<PropertyCategories, EditableProperty<any>[]> {
	public add(category: PropertyCategories, property: EditableProperty<any>) {
		if (this.has(category)) {
			this.get(category)!.push(property)
		} else {
			this.set(category, [property])
		}
	}

	public sorted(): EditableProperty<any>[] {
		const properties: EditableProperty<any>[] = []

		for (const element in PropertyCategories) {
			if (isNaN(Number(element))) {
				const category = PropertyCategories[element as keyof typeof PropertyCategories]
				if (this.has(category)) {
					properties.push(...this.get(category)!)
				}
			}
		}
		return properties
	}
}
