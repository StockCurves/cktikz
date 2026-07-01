// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import * as SVG from "@svgdotjs/svg.js"
import { setupTikzRoundTripRuntime } from "./helpers/tikzCorpusRoundTrip"
import {
	FlowchartDatabaseComponent,
	FlowchartDecisionComponent,
	FlowchartDocumentComponent,
	FlowchartInputOutputComponent,
	FlowchartOffPageConnectorComponent,
	FlowchartSubprocessComponent,
} from "../src/scripts/components/flowchartComponents"

describe("flowchart component visual geometry", () => {
	it("plots polygon-based flowchart shapes during update", () => {
		setupTikzRoundTripRuntime()

		const decision = new FlowchartDecisionComponent()
		decision["size"] = new SVG.Point(120, 80)
		decision["referencePosition"] = new SVG.Point(60, 40)
		decision.update()

		const inputOutput = new FlowchartInputOutputComponent()
		inputOutput["size"] = new SVG.Point(140, 80)
		inputOutput["referencePosition"] = new SVG.Point(70, 40)
		inputOutput.update()

		const offPage = new FlowchartOffPageConnectorComponent()
		offPage["size"] = new SVG.Point(100, 100)
		offPage["referencePosition"] = new SVG.Point(50, 50)
		offPage.update()

		expect((decision.componentVisualization as any).plot).toHaveBeenCalled()
		expect((inputOutput.componentVisualization as any).plot).toHaveBeenCalled()
		expect((offPage.componentVisualization as any).plot).toHaveBeenCalled()
		expect((decision.componentVisualization as any).size).not.toHaveBeenCalled()
		expect((decision.componentVisualization as any).center).not.toHaveBeenCalled()
	})

	it("plots path-based flowchart shapes during update", () => {
		setupTikzRoundTripRuntime()

		const document = new FlowchartDocumentComponent()
		document["size"] = new SVG.Point(140, 90)
		document["referencePosition"] = new SVG.Point(70, 45)
		document.update()

		const database = new FlowchartDatabaseComponent()
		database["size"] = new SVG.Point(120, 90)
		database["referencePosition"] = new SVG.Point(60, 45)
		database.update()

		const subprocess = new FlowchartSubprocessComponent()
		subprocess["size"] = new SVG.Point(150, 80)
		subprocess["referencePosition"] = new SVG.Point(75, 40)
		subprocess.update()

		expect((document.componentVisualization as any).plot).toHaveBeenCalled()
		expect((database.componentVisualization as any).plot).toHaveBeenCalled()
		expect((subprocess.componentVisualization as any).plot).toHaveBeenCalled()
		expect((document.componentVisualization as any).size).not.toHaveBeenCalled()
		expect((document.componentVisualization as any).center).not.toHaveBeenCalled()
	})
})
