import * as SVG from "@svgdotjs/svg.js"
import {
	MainController,
	CircuitComponent,
	poleChoices,
	arrowTips
} from "../internal"

const scale = 127 / 4800;

export function cmToPx(x_cm: number, y_cm: number): SVG.Point {
	return new SVG.Point(x_cm / scale, -y_cm / scale);
}

function parseCoordinate(coordStr: string): SVG.Point {
	const parts = coordStr.split(",");
	if (parts.length !== 2) return new SVG.Point(0, 0);

	const parseVal = (str: string): number => {
		str = str.trim();
		let val = parseFloat(str);
		if (str.endsWith("cm")) {
			// default is cm
		} else if (str.endsWith("pt")) {
			val = (val * 2.54) / 72;
		} else if (str.endsWith("px")) {
			val = val * scale;
		}
		return val;
	};

	const x_cm = parseVal(parts[0]);
	const y_cm = parseVal(parts[1]);
	return cmToPx(x_cm, y_cm);
}

function parseOptions(optionsStr: string): { standalone: string[]; kv: { [key: string]: string } } {
	const standalone: string[] = [];
	const kv: { [key: string]: string } = {};
	if (!optionsStr) return { standalone, kv };

	let current = "";
	let braceDepth = 0;
	let bracketDepth = 0;
	const parts: string[] = [];
	for (let i = 0; i < optionsStr.length; i++) {
		const char = optionsStr[i];
		if (char === "{") braceDepth++;
		else if (char === "}") braceDepth--;
		else if (char === "[") bracketDepth++;
		else if (char === "]") bracketDepth--;

		if (char === "," && braceDepth === 0 && bracketDepth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	if (current) parts.push(current);

	for (let part of parts) {
		part = part.trim();
		if (!part) continue;
		const eqIndex = part.indexOf("=");
		if (eqIndex > 0) {
			const key = part.substring(0, eqIndex).trim();
			let val = part.substring(eqIndex + 1).trim();
			if (val.startsWith("{") && val.endsWith("}")) {
				val = val.substring(1, val.length - 1).trim();
			}
			kv[key] = val;
		} else {
			standalone.push(part);
		}
	}
	return { standalone, kv };
}

function mapPoleShortcut(char: string): string {
	if (char === "*") return "circ";
	if (char === "o") return "ocirc";
	if (char === "d") return "diamondpole";
	return "none";
}

function parsePicDefinitions(content: string) {
	let current = "";
	let braceDepth = 0;
	const parts: string[] = [];
	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		if (char === "{") braceDepth++;
		else if (char === "}") braceDepth--;

		if (char === "," && braceDepth === 0) {
			parts.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	if (current) parts.push(current.trim());

	for (const part of parts) {
		const match = part.match(/^([A-Za-z0-9_]+)\s*\/\.pic\s*=\s*\{(.*)\}$/s);
		if (match) {
			const name = match[1].trim();
			const subCode = match[2].trim();
			const children = parseTikz(subCode);

			const symbolId = "subcircuit-" + name;
			const subComponent = {
				type: "subcircuit",
				displayName: name,
				components: children,
				position: { x: 0, y: 0 }
			};
			const customSymbolData = {
				id: symbolId,
				type: "subcircuit",
				tikzName: name,
				displayName: name,
				isNodeSymbol: false,
				subcircuitData: subComponent
			};
			if (MainController.instance) {
				MainController.instance.addSymbolToCategory("我的最愛", symbolId, customSymbolData);
			}
		}
	}
}

export function parseTikzset(tikzCode: string) {
	let index = 0;
	while (true) {
		const start = tikzCode.indexOf("\\tikzset", index);
		if (start === -1) break;
		const openBrace = tikzCode.indexOf("{", start);
		if (openBrace === -1) {
			index = start + 8;
			continue;
		}
		let depth = 1;
		let i = openBrace + 1;
		while (i < tikzCode.length && depth > 0) {
			if (tikzCode[i] === "{") depth++;
			else if (tikzCode[i] === "}") depth--;
			i++;
		}
		if (depth === 0) {
			const content = tikzCode.substring(openBrace + 1, i - 1);
			parsePicDefinitions(content);
		}
		index = i;
	}
}

export function parseTikz(tikzCode: string): any[] {
	parseTikzset(tikzCode);
	// Normalize: remove comments, replace newlines/tabs with spaces
	const cleanLines = tikzCode
		.split("\n")
		.map((line) => {
			const commentIndex = line.indexOf("%");
			if (commentIndex >= 0) {
				return line.substring(0, commentIndex);
			}
			return line;
		})
		.join(" ")
		.replace(/\s+/g, " ");

	// Find commands ending with semicolons
	const commands: string[] = [];
	let currentCommand = "";
	let braceDepth = 0;
	for (let i = 0; i < cleanLines.length; i++) {
		const char = cleanLines[i];
		if (char === "{") braceDepth++;
		else if (char === "}") braceDepth--;

		if (char === ";" && braceDepth === 0) {
			commands.push(currentCommand.trim());
			currentCommand = "";
		} else {
			currentCommand += char;
		}
	}

	const components: any[] = [];
	const labelNodesToProcess: { referencedName: string; labelVal: string; anchorKey: string; posKey: string }[] = [];

	for (const cmd of commands) {
		if (!cmd) continue;

		if (cmd.startsWith("\\node")) {
			// \node[options] (name) at (X, Y) {content};
			const nodeMatch = cmd.match(/^\\node\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?\s*at\s*\(([^)]*)\)\s*\{([^}]*)\}/);
			if (nodeMatch) {
				const optionsStr = nodeMatch[1] || "";
				const name = nodeMatch[2] || "";
				const coordStr = nodeMatch[3] || "";
				const content = nodeMatch[4] || "";

				const pos = parseCoordinate(coordStr);
				const { standalone, kv } = parseOptions(optionsStr);

				// Check if this is an additional label node for another node, like N1.south
				// e.g. at ([yshift=-0.12cm]N1.south)
				const labelRefMatch = coordStr.match(/^\s*(?:\[[^\]]*\])?\s*([A-Za-z0-9_]+)\.([a-z]+)\s*$/);
				if (labelRefMatch && content) {
					let labelClean = content.trim();
					if (labelClean.startsWith("$") && labelClean.endsWith("$")) {
						labelClean = labelClean.substring(1, labelClean.length - 1).trim();
					}
					labelNodesToProcess.push({
						referencedName: labelRefMatch[1],
						labelVal: labelClean,
						anchorKey: kv["anchor"] || "default",
						posKey: labelRefMatch[2]
					});
					continue;
				}

				// Find if there is a matching node symbol from DB
				let symbolId = "";
				let matchedSymbol = null;
				for (const opt of standalone) {
					const found = MainController.instance.symbols.find((s) => s.tikzName === opt);
					if (found) {
						matchedSymbol = found;
						symbolId = opt;
						break;
					}
				}

				let rotation = 0;
				let scaleX = 1;
				let scaleY = 1;
				if (kv["rotate"]) {
					rotation = parseFloat(kv["rotate"]) || 0;
				}
				if (kv["xscale"]) {
					scaleX = parseFloat(kv["xscale"]) || 1;
				}
				if (kv["yscale"]) {
					scaleY = parseFloat(kv["yscale"]) || 1;
				}

				if (matchedSymbol) {
					// NodeSymbolComponent
					components.push({
						type: "node",
						id: symbolId,
						position: pos.simplifyForJson(),
						rotation: rotation,
						scale: { x: scaleX, y: scaleY },
						name: name,
						options: standalone.filter((o) => o !== symbolId)
					});
				} else {
					// Default to RectangleComponent
					const widthCm = kv["minimum width"] ? parseFloat(kv["minimum width"]) : 1.5;
					const heightCm = kv["minimum height"] ? parseFloat(kv["minimum height"]) : 1.0;
					const widthPx = widthCm / scale;
					const heightPx = heightCm / scale;

					let textClean = content.trim();
					if (textClean.startsWith("$") && textClean.endsWith("$")) {
						textClean = textClean.substring(1, textClean.length - 1).trim();
					}

					let alignVal = 0;
					if (kv["align"] === "center") alignVal = 1;
					else if (kv["align"] === "right") alignVal = 2;
					else if (kv["align"] === "justify") alignVal = 3;

					components.push({
						type: "rect",
						position: pos.simplifyForJson(),
						size: { x: widthPx, y: heightPx },
						rotation: rotation,
						text: {
							text: textClean,
							align: alignVal,
							showPlaceholderText: content ? true : false
						}
					});
				}
			}
		} else if (cmd.startsWith("\\draw")) {
			const picMatch = cmd.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*pic\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
			if (picMatch) {
				const pos = parseCoordinate(picMatch[2]);
				const name = picMatch[3].trim();
				components.push({
					type: "subcircuit",
					displayName: name,
					components: [],
					position: pos.simplifyForJson()
				});
				continue;
			}
			// \draw[options] (X1, Y1) connector1 (X2, Y2) ...;
			const drawMatch = cmd.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*(.*)$/);
			if (drawMatch) {
				const drawOptionsStr = drawMatch[1] || "";
				const drawBody = drawMatch[2] || "";

				const { standalone: globalStandalone } = parseOptions(drawOptionsStr);

				// Parse global arrows
				let globalArrows = { start: "none", end: "none" };
				for (const opt of globalStandalone) {
					if (opt.includes("-")) {
						const parts = opt.split("-");
						const startArrow = arrowTips.find((t) => t.tikz === parts[0]);
						const endArrow = arrowTips.find((t) => t.tikz === parts[1]);
						if (startArrow) globalArrows.start = startArrow.key;
						if (endArrow) globalArrows.end = endArrow.key;
					}
				}

				// Tokenize drawing body to extract coordinates and connectors
				const coordRegex = /\(\s*([-+]?[0-9]*\.?[0-9]+[a-z]*)\s*,\s*([-+]?[0-9]*\.?[0-9]+[a-z]*)\s*\)/g;
				let match;
				const coords: SVG.Point[] = [];
				const coordIndices: number[] = [];
				const rawCoords: string[] = [];

				while ((match = coordRegex.exec(drawBody)) !== null) {
					coords.push(parseCoordinate(match[1] + "," + match[2]));
					coordIndices.push(match.index);
					rawCoords.push(match[0]);
				}

				if (coords.length >= 2) {
					let currentWire: { points: SVG.Point[]; directions: string[] } = { points: [coords[0]], directions: [] };

					const flushWire = () => {
						if (currentWire.points.length >= 2) {
							components.push({
								type: "wire",
								points: currentWire.points.map((p) => p.simplifyForJson()),
								directions: currentWire.directions,
								startArrow: globalArrows.start,
								endArrow: globalArrows.end
							});
						}
						currentWire = { points: [], directions: [] };
					};

					for (let i = 0; i < coords.length - 1; i++) {
						const connectorStr = drawBody.substring(coordIndices[i] + rawCoords[i].length, coordIndices[i + 1]).trim();
						const toMatch = connectorStr.match(/^to\s*\[(.*)\]$/s);

						if (toMatch) {
							// Flush any running wire segment
							flushWire();

							const toOptionsStr = toMatch[1] || "";
							const { standalone: toStandalone, kv: toKv } = parseOptions(toOptionsStr);

							// Find poles
							let poles = { start: "none", end: "none" };
							for (const opt of toStandalone) {
								const poleShortcutMatch = opt.match(/^([*-od])-(?:([*-od])+)$/);
								if (poleShortcutMatch) {
									poles.start = mapPoleShortcut(poleShortcutMatch[1]);
									poles.end = mapPoleShortcut(poleShortcutMatch[2]);
								} else if (opt.startsWith("bipole nodes=")) {
									const keyMatch = opt.match(/bipole nodes=\{([^}]+)\}\{([^}]+)\}/);
									if (keyMatch) {
										poles.start = keyMatch[1];
										poles.end = keyMatch[2];
									}
								}
							}

							// Find labels
							let labelObj: any = undefined;
							let labelValue = toKv["l"] || toKv["l_"] || "";
							let otherSide = toKv["l_"] !== undefined;
							if (labelValue) {
								let labelClean = labelValue.trim();
								if (labelClean.startsWith("$") && labelClean.endsWith("$")) {
									labelClean = labelClean.substring(1, labelClean.length - 1).trim();
								}
								labelObj = {
									value: labelClean,
									otherSide: otherSide || undefined
								};
							}

							// Find symbol
							let symbolId = "";
							let isShort = false;
							let isOpen = false;

							for (const opt of toStandalone) {
								if (opt === "short") {
									isShort = true;
									symbolId = "short";
									break;
								} else if (opt === "open") {
									isOpen = true;
									symbolId = "open";
									break;
								}
								const found = MainController.instance.symbols.find((s) => s.tikzName === opt);
								if (found) {
									symbolId = opt;
									break;
								}
							}

							if (isShort) {
								components.push({
									type: "short",
									points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
									poles: poles,
									label: labelObj
								});
							} else if (isOpen) {
								components.push({
									type: "open",
									points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
									poles: poles,
									label: labelObj
								});
							} else if (symbolId) {
								// PathSymbolComponent
								components.push({
									type: "path",
									id: symbolId,
									points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
									options: toStandalone.filter((o) => o !== symbolId),
									poles: poles,
									label: labelObj
								});
							}

							// Start next running wire at the end of the "to" component
							currentWire.points.push(coords[i + 1]);
						} else {
							// Wire connector (--, -|, |-)
							let direction = "Straight";
							if (connectorStr === "-|") direction = "HV";
							else if (connectorStr === "|-") direction = "VH";

							if (currentWire.points.length === 0) {
								currentWire.points.push(coords[i]);
							}
							currentWire.points.push(coords[i + 1]);
							currentWire.directions.push(direction);
						}
					}

					// Flush remaining wire segments at the end of draw command
					flushWire();
				}
			}
		}
	}

	// Post-process additional label nodes and bind them back to parent node symbol components
	for (const item of labelNodesToProcess) {
		const parent = components.find((c) => c.type === "node" && c.name === item.referencedName);
		if (parent) {
			parent.label = {
				value: item.labelVal,
				anchor: item.anchorKey,
				position: item.posKey,
				relativeToComponent: true
			};
		}
	}

	return components;
}
