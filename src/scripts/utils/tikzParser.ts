import * as SVG from "@svgdotjs/svg.js"
import {
	CircuitComponent,
	poleChoices,
	arrowTips
} from "../internal"
import type { ComponentSymbol } from "../components/componentSymbol"

const scale = 127 / 4800;

export type TikzParserRuntime = {
	getSymbols: () => ComponentSymbol[]
	addParsedSubcircuit: (categoryName: string, symbolId: string, customSymbolData: any) => void | Promise<void>
}

const defaultTikzParserRuntime: TikzParserRuntime = {
	getSymbols: () => [],
	addParsedSubcircuit: () => {},
}

let tikzParserRuntime: TikzParserRuntime = defaultTikzParserRuntime

export function configureTikzParserRuntime(runtime: Partial<TikzParserRuntime> | null) {
	tikzParserRuntime = runtime ? { ...defaultTikzParserRuntime, ...runtime } : defaultTikzParserRuntime
}

function getRuntimeSymbols(): ComponentSymbol[] {
	return tikzParserRuntime.getSymbols()
}

export function cleanTikzText(text: string): string {
	let clean = text.trim();
	while (true) {
		let changed = false;
		if (clean.startsWith("{") && clean.endsWith("}")) {
			clean = clean.substring(1, clean.length - 1).trim();
			changed = true;
		}
		if (clean.startsWith("$") && clean.endsWith("$")) {
			clean = clean.substring(1, clean.length - 1).trim();
			changed = true;
		}
		if (!changed) break;
	}
	return clean;
}

export function cmToPx(x_cm: number, y_cm: number): SVG.Point {
	return new SVG.Point(x_cm / scale, -y_cm / scale);
}

function parseDimension(str: string | undefined, defaultCm: number): number {
	if (!str) return defaultCm;
	str = str.trim();
	let val = parseFloat(str);
	if (Number.isNaN(val)) return defaultCm;
	if (str.endsWith("cm")) {
		return val;
	} else if (str.endsWith("pt")) {
		return (val * 2.54) / 72;
	} else if (str.endsWith("px")) {
		return val * scale;
	} else if (str.endsWith("mm")) {
		return val / 10;
	}
	return val;
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

function parseStrokeOptions(optionsStr: string): { stroke?: { width?: SVG.Number; opacity?: number; style?: string } } {
	const { standalone, kv } = parseOptions(optionsStr);
	const stroke: { width?: SVG.Number; opacity?: number; style?: string } = {};

	if (kv["line width"] !== undefined) {
		const rawWidth = kv["line width"].trim();
		if (rawWidth) {
			stroke.width = new SVG.Number(rawWidth);
		}
	}

	if (kv["draw opacity"] !== undefined) {
		const rawOpacity = kv["draw opacity"].trim();
		if (rawOpacity) {
			const parsed = rawOpacity.endsWith("%") ? parseFloat(rawOpacity) / 100 : parseFloat(rawOpacity);
			if (!Number.isNaN(parsed)) {
				stroke.opacity = parsed;
			}
		}
	}

	const has = (name: string) => standalone.includes(name);
	if (has("densely dashed")) {
		stroke.style = "denselydashed";
	} else if (has("loosely dashed")) {
		stroke.style = "looselydashed";
	} else if (has("dashed")) {
		stroke.style = "dashed";
	} else if (has("densely dotted")) {
		stroke.style = "denselydotted";
	} else if (has("loosely dotted")) {
		stroke.style = "looselydotted";
	} else if (has("dotted")) {
		stroke.style = "dotted";
	} else if (has("densely dash dot dot")) {
		stroke.style = "denselydashdotdot";
	} else if (has("loosely dash dot dot")) {
		stroke.style = "looselydashdotdot";
	} else if (has("dash dot dot")) {
		stroke.style = "dashdotdot";
	} else if (has("densely dash dot")) {
		stroke.style = "denselydashdot";
	} else if (has("loosely dash dot")) {
		stroke.style = "looselydashdot";
	} else if (has("dash dot")) {
		stroke.style = "dashdot";
	}

	return Object.keys(stroke).length > 0 ? { stroke } : {};
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
			void tikzParserRuntime.addParsedSubcircuit("我的最愛", symbolId, customSymbolData)
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

const TIKZ_NAME_MAP: { [key: string]: string } = {
	"R": "american resistor",
	"C": "capacitor",
	"L": "american inductor",
	"D": "empty diode",
	"sD": "stroke diode",
	"g": "generic",
	"vR": "variable american resistor",
	"vC": "variable capacitor",
	"vL": "variable american inductor",
	"vsourcesin": "sinusoidal voltage source",
	"isourcesin": "sinusoidal current source",
	"vsource": "american voltage source",
	"isource": "american current source",
	"vsourcedc": "dcvsource",
	"isourcedc": "dcisource",
	"battery": "battery"
};

function getPinAbsolutePosition(nodeInfo: { pos: SVG.Point; rotation: number; scale: { x: number; y: number }; symbol: ComponentSymbol }, pinName: string): SVG.Point {
	if (!nodeInfo.symbol) return nodeInfo.pos;
	
	const variant = nodeInfo.symbol.getVariant([]) || nodeInfo.symbol._mapping.values().next().value;
	if (!variant) return nodeInfo.pos;

	const pin = variant.pins.find((p) => p.name === pinName || (p.name && p.name.toLowerCase() === pinName.toLowerCase()));
	if (!pin) return nodeInfo.pos;

	// pin.point is the relative point in local coordinates
	const localPt = pin.point.add(variant.mid);

	const symbolRel = variant.mid;
	const m = new SVG.Matrix({
		scaleX: nodeInfo.scale.x,
		scaleY: nodeInfo.scale.y,
		translate: [-symbolRel.x, -symbolRel.y],
		origin: [symbolRel.x, symbolRel.y],
	}).lmultiply(
		new SVG.Matrix({
			rotate: -nodeInfo.rotation,
			translate: [nodeInfo.pos.x, nodeInfo.pos.y],
		})
	);

	return localPt.transform(m);
}

function stripPreambles(code: string): string {
	let clean = code;

	// 1. Replace \tikzset{...} using bracket matching with spaces
	let tikzsetIndex = 0;
	while (true) {
		const start = clean.indexOf("\\tikzset", tikzsetIndex);
		if (start === -1) break;
		const openBrace = clean.indexOf("{", start);
		if (openBrace === -1) {
			tikzsetIndex = start + 8;
			continue;
		}
		let depth = 1;
		let i = openBrace + 1;
		while (i < clean.length && depth > 0) {
			if (clean[i] === "{") depth++;
			else if (clean[i] === "}") depth--;
			i++;
		}
		if (depth === 0) {
			const len = i - start;
			clean = clean.substring(0, start) + " ".repeat(len) + clean.substring(i);
			tikzsetIndex = i;
		} else {
			tikzsetIndex = i;
		}
	}

	// 2. Replace other preambles using regex with spaces
	clean = clean.replace(/\\usetikzlibrary\s*\{[^}]*\}/g, (match) => " ".repeat(match.length));
	clean = clean.replace(/\\ctikzset\s*\{[^}]*\}/g, (match) => " ".repeat(match.length));
	clean = clean.replace(/\\begin\s*\{[^}]*\}\s*(?:\[[^\]]*\])?/g, (match) => " ".repeat(match.length));
	clean = clean.replace(/\\end\s*\{[^}]*\}/g, (match) => " ".repeat(match.length));

	return clean;
}

function buildCleanLinesWithMap(tikzCode: string): { cleanText: string; indexMap: number[] } {
	const lines = tikzCode.split("\n");
	let cleanText = "";
	const indexMap: number[] = [];
	
	let currentOriginalIndex = 0;
	
	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];
		const commentIndex = line.indexOf("%");
		const codePart = commentIndex >= 0 ? line.substring(0, commentIndex) : line;
		
		for (let cIdx = 0; cIdx < codePart.length; cIdx++) {
			cleanText += codePart[cIdx];
			indexMap.push(currentOriginalIndex + cIdx);
		}
		
		if (lineIdx < lines.length - 1) {
			cleanText += " ";
			indexMap.push(currentOriginalIndex + line.length);
		}
		
		currentOriginalIndex += line.length + 1; // +1 for \n
	}
	
	let finalCleanText = "";
	const finalIndexMap: number[] = [];
	let inWhitespace = false;
	
	for (let i = 0; i < cleanText.length; i++) {
		const char = cleanText[i];
		if (char === " " || char === "\t" || char === "\r" || char === "\n") {
			if (!inWhitespace) {
				finalCleanText += " ";
				finalIndexMap.push(indexMap[i]);
				inWhitespace = true;
			}
		} else {
			finalCleanText += char;
			finalIndexMap.push(indexMap[i]);
			inWhitespace = false;
		}
	}
	
	return {
		cleanText: finalCleanText,
		indexMap: finalIndexMap
	};
}

export function parseTikz(tikzCode: string): any[] {
	parseTikzset(tikzCode);

	// Build char-to-line mapping for original code
	const charToLine: number[] = [];
	let currentLine = 1;
	for (let i = 0; i < tikzCode.length; i++) {
		charToLine.push(currentLine);
		if (tikzCode[i] === "\n") {
			currentLine++;
		}
	}
	const getLine = (idx: number) => {
		if (idx < 0) return 1;
		if (idx >= charToLine.length) return currentLine;
		return charToLine[idx];
	};

	const { cleanText, indexMap } = buildCleanLinesWithMap(tikzCode);
	const cleanLines = stripPreambles(cleanText);

	// Find commands ending with semicolons, tracking indexes in cleanLines
	const commands: { text: string; startIdx: number; endIdx: number }[] = [];
	let currentCommand = "";
	let cmdStartIdx = 0;
	let braceDepth = 0;
	for (let i = 0; i < cleanLines.length; i++) {
		const char = cleanLines[i];
		if (char === "{") braceDepth++;
		else if (char === "}") braceDepth--;

		if (char === ";" && braceDepth === 0) {
			commands.push({
				text: currentCommand.trim(),
				startIdx: cmdStartIdx,
				endIdx: i
			});
			currentCommand = "";
			cmdStartIdx = i + 1;
		} else {
			if (currentCommand === "") {
				cmdStartIdx = i;
			}
			currentCommand += char;
		}
	}

	const throwParseError = (message: string, startLine: number, endLine: number) => {
		const err = new Error(message);
		(err as any).startLine = startLine;
		(err as any).endLine = endLine;
		throw err;
	};

	const components: any[] = [];
	const labelNodesToProcess: { referencedName: string; labelVal: string; anchorKey: string; posKey: string }[] = [];
	const nodeMap = new Map<string, { pos: SVG.Point; rotation: number; scale: { x: number; y: number }; symbol: ComponentSymbol }>();

	// 1. Scan all commands to parse and register nodes, and strip node syntax from the commands
	const cleanedCommands: { text: string; startLine: number; endLine: number }[] = [];
	for (const cmdObj of commands) {
		if (!cmdObj.text) continue;

		const startLine = getLine(indexMap[cmdObj.startIdx]);
		const endLine = getLine(indexMap[cmdObj.endIdx]);

		let cleanedCmd = "";
		let lastIndex = 0;
		const nodeRegex = /(?:\\node|node)\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?\s*(?:at\s*\(([^)]*)\))?\s*\{/g;
		let nodeMatch;
		
		while ((nodeMatch = nodeRegex.exec(cmdObj.text)) !== null) {
			cleanedCmd += cmdObj.text.substring(lastIndex, nodeMatch.index);
			
			const optionsStr = nodeMatch[1] || "";
			const name = nodeMatch[2] || "";
			const coordStr = nodeMatch[3] || "";
			const matchIndex = nodeMatch.index;
			const openBraceIndex = nodeMatch.index + nodeMatch[0].length - 1;

			let braceDepth = 1;
			let i = openBraceIndex + 1;
			while (i < cmdObj.text.length && braceDepth > 0) {
				if (cmdObj.text[i] === "{") braceDepth++;
				else if (cmdObj.text[i] === "}") braceDepth--;
				i++;
			}
			const content = cmdObj.text.substring(openBraceIndex + 1, i - 1);
			lastIndex = i;
			nodeRegex.lastIndex = i;

			// Compute position
			let pos = new SVG.Point(0, 0);
			if (coordStr) {
				pos = parseCoordinate(coordStr);
			} else {
				// Find the last coordinate preceding this node
				const prevStr = cmdObj.text.substring(0, matchIndex);
				const coordRegex = /\(([^)]+)\)/g;
				let cMatch;
				let lastCoordStr = "";
				while ((cMatch = coordRegex.exec(prevStr)) !== null) {
					lastCoordStr = cMatch[1];
				}
				if (lastCoordStr) {
					if (lastCoordStr.includes(",")) {
						pos = parseCoordinate(lastCoordStr);
					} else {
						// If the previous coordinate was also a node reference, like (opamp.out) node[...]
						const parts = lastCoordStr.trim().split(".");
						const refNodeName = parts[0].trim();
						const refPinName = parts[1] ? parts[1].trim() : "";
						const refNode = nodeMap.get(refNodeName);
						if (refNode) {
							pos = getPinAbsolutePosition(refNode, refPinName);
						}
					}
				}
			}

			const { standalone, kv } = parseOptions(optionsStr);

			// Find matching symbol
			let symbolId = "";
			let matchedSymbol = null;
			for (const opt of standalone) {
				const found = getRuntimeSymbols().find((s) => s.tikzName === opt);
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

			// Check if this is an additional label node for another node, like N1.south
			const labelRefMatch = coordStr.match(/^\s*(?:\[[^\]]*\])?\s*([A-Za-z0-9_]+)\.([a-z]+)\s*$/);
			if (labelRefMatch && content) {
				let labelClean = cleanTikzText(content);
				labelNodesToProcess.push({
					referencedName: labelRefMatch[1],
					labelVal: labelClean,
					anchorKey: kv["anchor"] || "default",
					posKey: labelRefMatch[2]
				});
				continue;
			}

			let finalNodePos = pos;
			if (matchedSymbol) {
				const variant = matchedSymbol.getVariant([]) || matchedSymbol._mapping.values().next().value;
				if (variant && variant.defaultAnchor) {
					const offset = variant.defaultAnchor.point.clone();
					offset.x *= scaleX;
					offset.y *= scaleY;
					const rotatedOffset = offset.rotate(-rotation);
					finalNodePos = pos.sub(rotatedOffset);
				}
			}

			if (matchedSymbol) {
				// NodeSymbolComponent
				components.push({
					type: "node",
					id: symbolId,
					position: finalNodePos.simplifyForJson(),
					rotation: rotation,
					scale: { x: scaleX, y: scaleY },
					name: name,
					options: standalone.filter((o) => o !== symbolId),
					lines: [startLine, endLine]
				});

				if (name) {
					nodeMap.set(name, {
						pos: finalNodePos,
						rotation,
						scale: { x: scaleX, y: scaleY },
						symbol: matchedSymbol
					});
				}
			} else {
				if (content || optionsStr) {
					let isCircle = standalone.includes("circle") || kv["shape"] === "circle";
					let isEllipse = standalone.includes("ellipse") || kv["shape"] === "ellipse";
					let shapeType = (isCircle || isEllipse) ? "ellipse" : "rect";

					let widthCm = parseDimension(kv["minimum width"] || kv["minimum size"], shapeType === "ellipse" ? 1.0 : 1.5);
					let heightCm = parseDimension(kv["minimum height"] || kv["minimum size"], 1.0);

					if (kv["inner sep"]) {
						const innerSepCm = parseDimension(kv["inner sep"], 0.1);
						if (!kv["minimum width"] && !kv["minimum size"]) {
							widthCm = innerSepCm * 2;
						}
						if (!kv["minimum height"] && !kv["minimum size"]) {
							heightCm = innerSepCm * 2;
						}
					}

					if (isCircle) {
						const size = Math.max(widthCm, heightCm);
						widthCm = size;
						heightCm = size;
					}

					const widthPx = widthCm / scale;
					const heightPx = heightCm / scale;

					let textClean = cleanTikzText(content);

					const trimmedContent = content.trim();
					let innerContent = trimmedContent;
					if (innerContent.startsWith("{") && innerContent.endsWith("}")) {
						innerContent = innerContent.substring(1, innerContent.length - 1).trim();
					}
					const isMath = innerContent.startsWith("$") && innerContent.endsWith("$");

					// Parse anchor direction to reconstruct the original center position
					let anchorName = kv["anchor"] || "";
					if (!anchorName) {
						for (const opt of standalone) {
							if (opt === "left") { anchorName = "east"; break; }
							else if (opt === "right") { anchorName = "west"; break; }
							else if (opt === "above") { anchorName = "south"; break; }
							else if (opt === "below") { anchorName = "north"; break; }
							else if (opt === "above left" || opt === "left above") { anchorName = "south east"; break; }
							else if (opt === "above right" || opt === "right above") { anchorName = "south west"; break; }
							else if (opt === "below left" || opt === "left below") { anchorName = "north east"; break; }
							else if (opt === "below right" || opt === "right below") { anchorName = "north west"; break; }
						}
					}
					if (!anchorName) {
						anchorName = "north west";
					}

					let dir = new SVG.Point(0, 0);
					if (anchorName === "north") dir = new SVG.Point(0, -1);
					else if (anchorName === "south") dir = new SVG.Point(0, 1);
					else if (anchorName === "east") dir = new SVG.Point(1, 0);
					else if (anchorName === "west") dir = new SVG.Point(-1, 0);
					else if (anchorName === "north east") dir = new SVG.Point(1, -1);
					else if (anchorName === "north west") dir = new SVG.Point(-1, -1);
					else if (anchorName === "south east") dir = new SVG.Point(1, 1);
					else if (anchorName === "south west") dir = new SVG.Point(-1, 1);

					const size = new SVG.Point(widthPx, heightPx);
					const actualPos = pos.sub(dir.mul(size.div(2)));

					let alignVal = 0; // LEFT
					if (dir.x === 0) alignVal = 1; // CENTER
					else if (dir.x === 1) alignVal = 2; // RIGHT

					let justifyVal = -1; // START (Top)
					if (dir.y === 0) justifyVal = 0; // CENTER (Middle)
					else if (dir.y === 1) justifyVal = 1; // END (Bottom)

					components.push({
						type: shapeType,
						position: actualPos.simplifyForJson(),
						size: { x: widthPx, y: heightPx },
						rotation: rotation,
						text: {
							text: textClean,
							align: alignVal,
							justify: justifyVal,
							showPlaceholderText: content ? true : false,
							isMath: isMath
						},
						lines: [startLine, endLine]
					});
				}

				if (name) {
					nodeMap.set(name, {
						pos,
						rotation: 0,
						scale: { x: 1, y: 1 },
						symbol: null as any
					});
				}
			}
		}

		cleanedCmd += cmdObj.text.substring(lastIndex);
		
		const trimmedCleanedCmd = cleanedCmd.trim();
		if (trimmedCleanedCmd) {
			if (trimmedCleanedCmd.startsWith("\\draw")) {
				cleanedCommands.push({
					text: trimmedCleanedCmd,
					startLine: startLine,
					endLine: endLine
				});
			} else {
				throwParseError("Syntax error or unsupported command: \"" + trimmedCleanedCmd + "\"", startLine, endLine);
			}
		}
	}

	// 2. Parse remaining path/wire connections
	for (const cmdObj of cleanedCommands) {
		const picMatch = cmdObj.text.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*pic\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
		if (picMatch) {
			const pos = parseCoordinate(picMatch[2]);
			const name = picMatch[3].trim();
			components.push({
				type: "subcircuit",
				displayName: name,
				components: [],
				position: pos.simplifyForJson(),
				lines: [cmdObj.startLine, cmdObj.endLine]
			});
			continue;
		}

		const drawMatch = cmdObj.text.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*(.*)$/);
		if (drawMatch) {
			const drawOptionsStr = drawMatch[1] || "";
			const drawBody = drawMatch[2] || "";

			const { standalone: globalStandalone } = parseOptions(drawOptionsStr);
			const strokeInfo = parseStrokeOptions(drawOptionsStr);

			// Parse global arrows
			let globalArrows = { start: "none", end: "none" };
			for (const opt of globalStandalone) {
				if (opt.includes("-")) {
					const parts = opt.split("-");
					let startTikz = parts[0];
					let endTikz = parts[1];
					if (startTikz === "<") startTikz = "latex";
					if (endTikz === ">") endTikz = "latex";
					const startArrow = arrowTips.find((t) => t.tikz === startTikz);
					const endArrow = arrowTips.find((t) => t.tikz === endTikz);
					if (startArrow) globalArrows.start = startArrow.key;
					if (endArrow) globalArrows.end = endArrow.key;
				}
			}

			// Tokenize drawing body to extract coordinates and connectors
			const coordRegex = /\(([^)]+)\)/g;
			let match;
			const coords: SVG.Point[] = [];
			const coordIndices: number[] = [];
			const rawCoords: string[] = [];

			while ((match = coordRegex.exec(drawBody)) !== null) {
				const prevSub = drawBody.substring(0, match.index).trim();
				if (/(?:^|\s)arc(?:\s*\[[^\]]*\])?\s*$/i.test(prevSub)) {
					continue;
				}
				const coordStr = match[1].trim();
				let pos = new SVG.Point(0, 0);

				if (coordStr.includes(",")) {
					pos = parseCoordinate(coordStr);
				} else {
					// Node pin reference, e.g. (opamp.-) or (GND)
					const parts = coordStr.split(".");
					const nodeName = parts[0].trim();
					const pinName = parts[1] ? parts[1].trim() : "";

					const nodeInfo = nodeMap.get(nodeName);
					if (nodeInfo) {
						if (nodeInfo.symbol) {
							pos = getPinAbsolutePosition(nodeInfo, pinName);
						} else {
							pos = nodeInfo.pos;
						}
					} else {
						console.warn("Referenced node not found in nodeMap:", nodeName);
					}
				}

				coords.push(pos);
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
							endArrow: globalArrows.end,
							...strokeInfo,
							lines: [cmdObj.startLine, cmdObj.endLine]
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
							let labelClean = cleanTikzText(labelValue);
							labelObj = {
								value: labelClean,
								otherSide: otherSide || undefined
							};
						}

						// Find symbol
						let symbolId = "";
						let isShort = false;
						let isOpen = false;

						for (let opt of toStandalone) {
							if (TIKZ_NAME_MAP[opt]) {
								opt = TIKZ_NAME_MAP[opt];
							}
							if (opt === "short") {
								isShort = true;
								symbolId = "short";
								break;
							} else if (opt === "open") {
								isOpen = true;
								symbolId = "open";
								break;
							}
							const found = getRuntimeSymbols().find((s) => s.tikzName === opt);
							if (found) {
								symbolId = opt;
								break;
							}
						}

						if (!symbolId) {
							for (const key of Object.keys(TIKZ_NAME_MAP)) {
								if (toKv[key] !== undefined) {
									symbolId = TIKZ_NAME_MAP[key];
									if (!labelValue) {
										labelValue = toKv[key];
										let labelClean = cleanTikzText(labelValue);
										labelObj = {
											value: labelClean,
											otherSide: otherSide || undefined
										};
									}
									break;
								}
							}
						}

						if (isShort) {
							components.push({
								type: "short",
								points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
								poles: poles,
								label: labelObj,
								...strokeInfo,
								lines: [cmdObj.startLine, cmdObj.endLine]
							});
						} else if (isOpen) {
							components.push({
								type: "open",
								points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
								poles: poles,
								label: labelObj,
								...strokeInfo,
								lines: [cmdObj.startLine, cmdObj.endLine]
							});
						} else if (symbolId) {
							// PathSymbolComponent
							components.push({
								type: "path",
								id: symbolId,
								points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()],
								options: toStandalone.filter((o) => o !== symbolId && TIKZ_NAME_MAP[o] !== symbolId),
								poles: poles,
								label: labelObj,
								...strokeInfo,
								lines: [cmdObj.startLine, cmdObj.endLine]
							});
						} else {
							throwParseError("Unsupported or unrecognized component in to[...] path: \"" + toMatch[0] + "\" in command \"" + cmdObj.text + "\"", cmdObj.startLine, cmdObj.endLine);
						}

						// Start next running wire at the end of the "to" component
						currentWire.points.push(coords[i + 1]);
					} else {
						// Wire connector (--, -|, |-)
						let direction = "--";
						if (connectorStr === "-|") direction = "-|";
						else if (connectorStr === "|-") direction = "|-";

						if (currentWire.points.length === 0) {
							currentWire.points.push(coords[i]);
						}
						currentWire.points.push(coords[i + 1]);
						currentWire.directions.push(direction);
					}
				}

				// Flush remaining wire segments at the end of draw command
				flushWire();
			} else {
				const hasConnector = /\bto\b|--|-\||\|-/.test(drawBody);
				if (hasConnector) {
					throwParseError("Draw command must contain at least two coordinates: \"" + cmdObj.text + "\"", cmdObj.startLine, cmdObj.endLine);
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
