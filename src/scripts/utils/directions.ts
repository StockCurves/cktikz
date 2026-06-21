import * as SVG from "@svgdotjs/svg.js"
import type { ChoiceEntry } from "../properties/choiceProperty"

export type DirectionInfo = ChoiceEntry & {
	direction: SVG.Point
	pointer?: string
}

export const basicDirections: DirectionInfo[] = [
	{ key: "default", name: "default", direction: new SVG.Point(NaN, NaN) },
	{ key: "center", name: "center", direction: new SVG.Point() },
	{ key: "north", name: "north", direction: new SVG.Point(0, -1), pointer: "ns-resize" },
	{ key: "south", name: "south", direction: new SVG.Point(0, 1), pointer: "ns-resize" },
	{ key: "east", name: "east", direction: new SVG.Point(1, 0), pointer: "ew-resize" },
	{ key: "west", name: "west", direction: new SVG.Point(-1, 0), pointer: "ew-resize" },
	{ key: "northeast", name: "north east", direction: new SVG.Point(1, -1), pointer: "nesw-resize" },
	{ key: "northwest", name: "north west", direction: new SVG.Point(-1, -1), pointer: "nwse-resize" },
	{ key: "southeast", name: "south east", direction: new SVG.Point(1, 1), pointer: "nwse-resize" },
	{ key: "southwest", name: "south west", direction: new SVG.Point(-1, 1), pointer: "nesw-resize" },
]

export const defaultBasicDirection = basicDirections[0]
