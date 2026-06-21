import * as SVG from "@svgdotjs/svg.js"

export const dashArrayToPattern = (linewidth: SVG.Number, dasharray: number[]): string => {
	let pattern = []
	for (let index = 0; index < dasharray.length - 1; index += 2) {
		const onElement = dasharray[index]
		const offElement = dasharray[index + 1]
		pattern.push("on " + linewidth.times(onElement).toString())
		pattern.push("off " + linewidth.times(offElement).toString())
	}
	return "dash pattern={" + pattern.join(" ") + "}"
}
