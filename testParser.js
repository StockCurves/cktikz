"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureTikzParserRuntime = configureTikzParserRuntime;
exports.cleanTikzText = cleanTikzText;
exports.cmToPx = cmToPx;
exports.parseTikzset = parseTikzset;
exports.parseTikz = parseTikz;
var SVG = require("@svgdotjs/svg.js");
var internal_1 = require("../internal");
var scale = 127 / 4800;
var defaultTikzParserRuntime = {
    getSymbols: function () { return []; },
    addParsedSubcircuit: function () { },
};
var tikzParserRuntime = defaultTikzParserRuntime;
function configureTikzParserRuntime(runtime) {
    tikzParserRuntime = runtime ? __assign(__assign({}, defaultTikzParserRuntime), runtime) : defaultTikzParserRuntime;
}
function getRuntimeSymbols() {
    return tikzParserRuntime.getSymbols();
}
function cleanTikzText(text) {
    var clean = text.trim();
    while (true) {
        var changed = false;
        if (clean.startsWith("{") && clean.endsWith("}")) {
            clean = clean.substring(1, clean.length - 1).trim();
            changed = true;
        }
        if (clean.startsWith("$") && clean.endsWith("$")) {
            clean = clean.substring(1, clean.length - 1).trim();
            changed = true;
        }
        if (!changed)
            break;
    }
    return clean;
}
function cmToPx(x_cm, y_cm) {
    return new SVG.Point(x_cm / scale, -y_cm / scale);
}
function parseDimension(str, defaultCm) {
    if (!str)
        return defaultCm;
    str = str.trim();
    var val = parseFloat(str);
    if (Number.isNaN(val))
        return defaultCm;
    if (str.endsWith("cm")) {
        return val;
    }
    else if (str.endsWith("pt")) {
        return (val * 2.54) / 72;
    }
    else if (str.endsWith("px")) {
        return val * scale;
    }
    else if (str.endsWith("mm")) {
        return val / 10;
    }
    return val;
}
function parseCoordinate(coordStr) {
    var parts = coordStr.split(",");
    if (parts.length !== 2)
        return new SVG.Point(0, 0);
    var parseVal = function (str) {
        str = str.trim();
        var val = parseFloat(str);
        if (str.endsWith("cm")) {
            // default is cm
        }
        else if (str.endsWith("pt")) {
            val = (val * 2.54) / 72;
        }
        else if (str.endsWith("px")) {
            val = val * scale;
        }
        return val;
    };
    var x_cm = parseVal(parts[0]);
    var y_cm = parseVal(parts[1]);
    return cmToPx(x_cm, y_cm);
}
function parseOptions(optionsStr) {
    var standalone = [];
    var kv = {};
    if (!optionsStr)
        return { standalone: standalone, kv: kv };
    var current = "";
    var braceDepth = 0;
    var bracketDepth = 0;
    var parts = [];
    for (var i = 0; i < optionsStr.length; i++) {
        var char = optionsStr[i];
        if (char === "{")
            braceDepth++;
        else if (char === "}")
            braceDepth--;
        else if (char === "[")
            bracketDepth++;
        else if (char === "]")
            bracketDepth--;
        if (char === "," && braceDepth === 0 && bracketDepth === 0) {
            parts.push(current);
            current = "";
        }
        else {
            current += char;
        }
    }
    if (current)
        parts.push(current);
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        part = part.trim();
        if (!part)
            continue;
        var eqIndex = part.indexOf("=");
        if (eqIndex > 0) {
            var key = part.substring(0, eqIndex).trim();
            var val = part.substring(eqIndex + 1).trim();
            if (val.startsWith("{") && val.endsWith("}")) {
                val = val.substring(1, val.length - 1).trim();
            }
            kv[key] = val;
        }
        else {
            standalone.push(part);
        }
    }
    return { standalone: standalone, kv: kv };
}
function parseStrokeOptions(optionsStr) {
    var _a = parseOptions(optionsStr), standalone = _a.standalone, kv = _a.kv;
    var stroke = {};
    if (kv["line width"] !== undefined) {
        var rawWidth = kv["line width"].trim();
        if (rawWidth) {
            stroke.width = new SVG.Number(rawWidth);
        }
    }
    if (kv["draw opacity"] !== undefined) {
        var rawOpacity = kv["draw opacity"].trim();
        if (rawOpacity) {
            var parsed = rawOpacity.endsWith("%") ? parseFloat(rawOpacity) / 100 : parseFloat(rawOpacity);
            if (!Number.isNaN(parsed)) {
                stroke.opacity = parsed;
            }
        }
    }
    var has = function (name) { return standalone.includes(name); };
    if (has("densely dashed")) {
        stroke.style = "denselydashed";
    }
    else if (has("loosely dashed")) {
        stroke.style = "looselydashed";
    }
    else if (has("dashed")) {
        stroke.style = "dashed";
    }
    else if (has("densely dotted")) {
        stroke.style = "denselydotted";
    }
    else if (has("loosely dotted")) {
        stroke.style = "looselydotted";
    }
    else if (has("dotted")) {
        stroke.style = "dotted";
    }
    else if (has("densely dash dot dot")) {
        stroke.style = "denselydashdotdot";
    }
    else if (has("loosely dash dot dot")) {
        stroke.style = "looselydashdotdot";
    }
    else if (has("dash dot dot")) {
        stroke.style = "dashdotdot";
    }
    else if (has("densely dash dot")) {
        stroke.style = "denselydashdot";
    }
    else if (has("loosely dash dot")) {
        stroke.style = "looselydashdot";
    }
    else if (has("dash dot")) {
        stroke.style = "dashdot";
    }
    return Object.keys(stroke).length > 0 ? { stroke: stroke } : {};
}
function mapPoleShortcut(char) {
    if (char === "*")
        return "circ";
    if (char === "o")
        return "ocirc";
    if (char === "d")
        return "diamondpole";
    return "none";
}
function parsePicDefinitions(content) {
    var current = "";
    var braceDepth = 0;
    var parts = [];
    for (var i = 0; i < content.length; i++) {
        var char = content[i];
        if (char === "{")
            braceDepth++;
        else if (char === "}")
            braceDepth--;
        if (char === "," && braceDepth === 0) {
            parts.push(current.trim());
            current = "";
        }
        else {
            current += char;
        }
    }
    if (current)
        parts.push(current.trim());
    for (var _i = 0, parts_2 = parts; _i < parts_2.length; _i++) {
        var part = parts_2[_i];
        var match = part.match(/^([A-Za-z0-9_]+)\s*\/\.pic\s*=\s*\{(.*)\}$/s);
        if (match) {
            var name = match[1].trim();
            var subCode = match[2].trim();
            var children = parseTikz(subCode);
            var symbolId = "subcircuit-" + name;
            var subComponent = {
                type: "subcircuit",
                displayName: name,
                components: children,
                position: { x: 0, y: 0 }
            };
            var customSymbolData = {
                id: symbolId,
                type: "subcircuit",
                tikzName: name,
                displayName: name,
                isNodeSymbol: false,
                subcircuitData: subComponent
            };
            void tikzParserRuntime.addParsedSubcircuit("我的最愛", symbolId, customSymbolData);
        }
    }
}
function parseTikzset(tikzCode) {
    var index = 0;
    while (true) {
        var start = tikzCode.indexOf("\\tikzset", index);
        if (start === -1)
            break;
        var openBrace = tikzCode.indexOf("{", start);
        if (openBrace === -1) {
            index = start + 8;
            continue;
        }
        var depth = 1;
        var i = openBrace + 1;
        while (i < tikzCode.length && depth > 0) {
            if (tikzCode[i] === "{")
                depth++;
            else if (tikzCode[i] === "}")
                depth--;
            i++;
        }
        if (depth === 0) {
            var content = tikzCode.substring(openBrace + 1, i - 1);
            parsePicDefinitions(content);
        }
        index = i;
    }
}
var TIKZ_NAME_MAP = {
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
    "I": "american current source",
    "V": "american voltage source",
    "vsourcedc": "dcvsource",
    "isourcedc": "dcisource",
    "battery": "battery"
};
function getPinAbsolutePosition(nodeInfo, pinName) {
    if (!nodeInfo.symbol)
        return nodeInfo.pos;
    var variant = nodeInfo.symbol.getVariant([]) || nodeInfo.symbol._mapping.values().next().value;
    if (!variant)
        return nodeInfo.pos;
    var pin = variant.pins.find(function (p) { return p.name === pinName || (p.name && p.name.toLowerCase() === pinName.toLowerCase()); });
    if (!pin)
        return nodeInfo.pos;
    // pin.point is the relative point in local coordinates
    var localPt = pin.point.add(variant.mid);
    var symbolRel = variant.mid;
    var m = new SVG.Matrix({
        scaleX: nodeInfo.scale.x,
        scaleY: nodeInfo.scale.y,
        translate: [-symbolRel.x, -symbolRel.y],
        origin: [symbolRel.x, symbolRel.y],
    }).lmultiply(new SVG.Matrix({
        rotate: -nodeInfo.rotation,
        translate: [nodeInfo.pos.x, nodeInfo.pos.y],
    }));
    return localPt.transform(m);
}
function stripPreambles(code) {
    var clean = code;
    // 1. Replace \tikzset{...} using bracket matching with spaces
    var tikzsetIndex = 0;
    while (true) {
        var start = clean.indexOf("\\tikzset", tikzsetIndex);
        if (start === -1)
            break;
        var openBrace = clean.indexOf("{", start);
        if (openBrace === -1) {
            tikzsetIndex = start + 8;
            continue;
        }
        var depth = 1;
        var i = openBrace + 1;
        while (i < clean.length && depth > 0) {
            if (clean[i] === "{")
                depth++;
            else if (clean[i] === "}")
                depth--;
            i++;
        }
        if (depth === 0) {
            var len = i - start;
            clean = clean.substring(0, start) + " ".repeat(len) + clean.substring(i);
            tikzsetIndex = i;
        }
        else {
            tikzsetIndex = i;
        }
    }
    // 2. Replace other preambles using regex with spaces
    clean = clean.replace(/\\documentclass[^{]*\{[^}]*\}/g, function (match) { return " ".repeat(match.length); });
    clean = clean.replace(/\\usepackage[^{]*\{[^}]*\}/g, function (match) { return " ".repeat(match.length); });
    clean = clean.replace(/\\usetikzlibrary\s*\{[^}]*\}/g, function (match) { return " ".repeat(match.length); });
    clean = clean.replace(/\\ctikzset\s*\{[^}]*\}/g, function (match) { return " ".repeat(match.length); });
    clean = clean.replace(/\\begin\s*\{[^}]*\}\s*(?:\[[^\]]*\])?/g, function (match) { return " ".repeat(match.length); });
    clean = clean.replace(/\\end\s*\{[^}]*\}/g, function (match) { return " ".repeat(match.length); });
    return clean;
}
function buildCleanLinesWithMap(tikzCode) {
    var lines = tikzCode.split("\n");
    var cleanText = "";
    var indexMap = [];
    var currentOriginalIndex = 0;
    for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        var line = lines[lineIdx];
        var commentIndex = line.indexOf("%");
        var codePart = commentIndex >= 0 ? line.substring(0, commentIndex) : line;
        for (var cIdx = 0; cIdx < codePart.length; cIdx++) {
            cleanText += codePart[cIdx];
            indexMap.push(currentOriginalIndex + cIdx);
        }
        if (lineIdx < lines.length - 1) {
            cleanText += " ";
            indexMap.push(currentOriginalIndex + line.length);
        }
        currentOriginalIndex += line.length + 1; // +1 for \n
    }
    var finalCleanText = "";
    var finalIndexMap = [];
    var inWhitespace = false;
    for (var i = 0; i < cleanText.length; i++) {
        var char = cleanText[i];
        if (char === " " || char === "\t" || char === "\r" || char === "\n") {
            if (!inWhitespace) {
                finalCleanText += " ";
                finalIndexMap.push(indexMap[i]);
                inWhitespace = true;
            }
        }
        else {
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
function parseTikz(tikzCode) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    parseTikzset(tikzCode);
    // Build char-to-line mapping for original code
    var charToLine = [];
    var currentLine = 1;
    for (var i = 0; i < tikzCode.length; i++) {
        charToLine.push(currentLine);
        if (tikzCode[i] === "\n") {
            currentLine++;
        }
    }
    var getLine = function (idx) {
        if (idx < 0)
            return 1;
        if (idx >= charToLine.length)
            return currentLine;
        return charToLine[idx];
    };
    var _j = buildCleanLinesWithMap(tikzCode), cleanText = _j.cleanText, indexMap = _j.indexMap;
    var cleanLines = stripPreambles(cleanText);
    // Find commands ending with semicolons, tracking indexes in cleanLines
    var commands = [];
    var currentCommand = "";
    var cmdStartIdx = 0;
    var braceDepth = 0;
    for (var i = 0; i < cleanLines.length; i++) {
        var char = cleanLines[i];
        if (char === "{")
            braceDepth++;
        else if (char === "}")
            braceDepth--;
        if (char === ";" && braceDepth === 0) {
            commands.push({
                text: currentCommand.trim(),
                startIdx: cmdStartIdx,
                endIdx: i
            });
            currentCommand = "";
            cmdStartIdx = i + 1;
        }
        else {
            if (currentCommand === "") {
                cmdStartIdx = i;
            }
            currentCommand += char;
        }
    }
    var throwParseError = function (message, startLine, endLine) {
        components.push({
            type: "parse_error",
            message: message,
            lines: [startLine, endLine]
        });
    };
    var components = [];
    var labelNodesToProcess = [];
    var nodeMap = new Map();
    // 1. Scan all commands to parse and register nodes, and strip node syntax from the commands
    var cleanedCommands = [];
    for (var _i = 0, commands_1 = commands; _i < commands_1.length; _i++) {
        var cmdObj = commands_1[_i];
        if (!cmdObj.text)
            continue;
        var startLine = getLine(indexMap[cmdObj.startIdx]);
        var endLine = getLine(indexMap[cmdObj.endIdx]);
        var cleanedCmd = "";
        var lastIndex = 0;
        var nodeRegex = /(?:\\node|node)\s*(?:\[([^\]]*)\])?\s*(?:\(([^)]*)\))?\s*(?:at\s*\(([^)]*)\))?\s*\{/g;
        var nodeMatch = void 0;
        var _loop_1 = function () {
            cleanedCmd += cmdObj.text.substring(lastIndex, nodeMatch.index);
            var optionsStr = nodeMatch[1] || "";
            var name = nodeMatch[2] || "";
            var coordStr = nodeMatch[3] || "";
            var matchIndex = nodeMatch.index;
            var openBraceIndex = nodeMatch.index + nodeMatch[0].length - 1;
            var braceDepth_1 = 1;
            var i = openBraceIndex + 1;
            while (i < cmdObj.text.length && braceDepth_1 > 0) {
                if (cmdObj.text[i] === "{")
                    braceDepth_1++;
                else if (cmdObj.text[i] === "}")
                    braceDepth_1--;
                i++;
            }
            var content = cmdObj.text.substring(openBraceIndex + 1, i - 1);
            lastIndex = i;
            nodeRegex.lastIndex = i;
            // Compute position
            var pos = new SVG.Point(0, 0);
            if (coordStr) {
                pos = parseCoordinate(coordStr);
            }
            else {
                // Find the last coordinate preceding this node
                var prevStr = cmdObj.text.substring(0, matchIndex);
                var coordRegex = /\(([^)]+)\)/g;
                var cMatch = void 0;
                var lastCoordStr = "";
                while ((cMatch = coordRegex.exec(prevStr)) !== null) {
                    lastCoordStr = cMatch[1];
                }
                if (lastCoordStr) {
                    if (lastCoordStr.includes(",")) {
                        pos = parseCoordinate(lastCoordStr);
                    }
                    else {
                        // If the previous coordinate was also a node reference, like (opamp.out) node[...]
                        var parts = lastCoordStr.trim().split(".");
                        var refNodeName = parts[0].trim();
                        var refPinName = parts[1] ? parts[1].trim() : "";
                        var refNode = nodeMap.get(refNodeName);
                        if (refNode) {
                            pos = getPinAbsolutePosition(refNode, refPinName);
                        }
                    }
                }
            }
            var _r = parseOptions(optionsStr), standalone = _r.standalone, kv = _r.kv;
            // Find matching symbol
            var symbolId = "";
            var matchedSymbol = null;
            var _loop_4 = function (opt) {
                var found = getRuntimeSymbols().find(function (s) { return s.tikzName === opt; });
                if (found) {
                    matchedSymbol = found;
                    symbolId = opt;
                    return "break";
                }
            };
            for (var _s = 0, standalone_1 = standalone; _s < standalone_1.length; _s++) {
                var opt = standalone_1[_s];
                var state_1 = _loop_4(opt);
                if (state_1 === "break")
                    break;
            }
            var rotation = 0;
            var scaleX = 1;
            var scaleY = 1;
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
            var labelRefMatch = coordStr.match(/^\s*(?:\[[^\]]*\])?\s*([A-Za-z0-9_]+)\.([a-z]+)\s*$/);
            if (labelRefMatch && content) {
                var labelClean = cleanTikzText(content);
                labelNodesToProcess.push({
                    referencedName: labelRefMatch[1],
                    labelVal: labelClean,
                    anchorKey: kv["anchor"] || "default",
                    posKey: labelRefMatch[2]
                });
                return "continue";
            }
            var finalNodePos = pos;
            if (matchedSymbol) {
                var variant = matchedSymbol.getVariant([]) || matchedSymbol._mapping.values().next().value;
                if (variant && variant.defaultAnchor) {
                    var offset = variant.defaultAnchor.point.clone();
                    offset.x *= scaleX;
                    offset.y *= scaleY;
                    var rotatedOffset = offset.rotate(-rotation);
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
                    options: standalone.filter(function (o) { return o !== symbolId; }),
                    lines: [startLine, endLine]
                });
                if (name) {
                    nodeMap.set(name, {
                        pos: finalNodePos,
                        rotation: rotation,
                        scale: { x: scaleX, y: scaleY },
                        symbol: matchedSymbol
                    });
                }
            }
            else {
                if (content || optionsStr) {
                    var isCircle = standalone.includes("circle") || kv["shape"] === "circle";
                    var isEllipse = standalone.includes("ellipse") || kv["shape"] === "ellipse";
                    var shapeType = (isCircle || isEllipse) ? "ellipse" : "rect";
                    var widthCm = parseDimension(kv["minimum width"] || kv["minimum size"], shapeType === "ellipse" ? 1.0 : 1.5);
                    var heightCm = parseDimension(kv["minimum height"] || kv["minimum size"], 1.0);
                    if (kv["inner sep"]) {
                        var innerSepCm = parseDimension(kv["inner sep"], 0.1);
                        if (!kv["minimum width"] && !kv["minimum size"]) {
                            widthCm = innerSepCm * 2;
                        }
                        if (!kv["minimum height"] && !kv["minimum size"]) {
                            heightCm = innerSepCm * 2;
                        }
                    }
                    if (isCircle) {
                        var size_1 = Math.max(widthCm, heightCm);
                        widthCm = size_1;
                        heightCm = size_1;
                    }
                    var widthPx = widthCm / scale;
                    var heightPx = heightCm / scale;
                    var textClean = cleanTikzText(content);
                    var trimmedContent = content.trim();
                    var innerContent = trimmedContent;
                    if (innerContent.startsWith("{") && innerContent.endsWith("}")) {
                        innerContent = innerContent.substring(1, innerContent.length - 1).trim();
                    }
                    var isMath = innerContent.startsWith("$") && innerContent.endsWith("$");
                    // Parse anchor direction to reconstruct the original center position
                    var anchorName = kv["anchor"] || "";
                    if (!anchorName) {
                        for (var _t = 0, standalone_2 = standalone; _t < standalone_2.length; _t++) {
                            var opt = standalone_2[_t];
                            if (opt === "left") {
                                anchorName = "east";
                                break;
                            }
                            else if (opt === "right") {
                                anchorName = "west";
                                break;
                            }
                            else if (opt === "above") {
                                anchorName = "south";
                                break;
                            }
                            else if (opt === "below") {
                                anchorName = "north";
                                break;
                            }
                            else if (opt === "above left" || opt === "left above") {
                                anchorName = "south east";
                                break;
                            }
                            else if (opt === "above right" || opt === "right above") {
                                anchorName = "south west";
                                break;
                            }
                            else if (opt === "below left" || opt === "left below") {
                                anchorName = "north east";
                                break;
                            }
                            else if (opt === "below right" || opt === "right below") {
                                anchorName = "north west";
                                break;
                            }
                        }
                    }
                    if (!anchorName) {
                        anchorName = "north west";
                    }
                    var dir = new SVG.Point(0, 0);
                    if (anchorName === "north")
                        dir = new SVG.Point(0, -1);
                    else if (anchorName === "south")
                        dir = new SVG.Point(0, 1);
                    else if (anchorName === "east")
                        dir = new SVG.Point(1, 0);
                    else if (anchorName === "west")
                        dir = new SVG.Point(-1, 0);
                    else if (anchorName === "north east")
                        dir = new SVG.Point(1, -1);
                    else if (anchorName === "north west")
                        dir = new SVG.Point(-1, -1);
                    else if (anchorName === "south east")
                        dir = new SVG.Point(1, 1);
                    else if (anchorName === "south west")
                        dir = new SVG.Point(-1, 1);
                    var size = new SVG.Point(widthPx, heightPx);
                    var actualPos = pos.sub(dir.mul(size.div(2)));
                    var alignVal = 0; // LEFT
                    if (dir.x === 0)
                        alignVal = 1; // CENTER
                    else if (dir.x === 1)
                        alignVal = 2; // RIGHT
                    var justifyVal = -1; // START (Top)
                    if (dir.y === 0)
                        justifyVal = 0; // CENTER (Middle)
                    else if (dir.y === 1)
                        justifyVal = 1; // END (Bottom)
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
                        pos: pos,
                        rotation: 0,
                        scale: { x: 1, y: 1 },
                        symbol: null
                    });
                }
            }
        };
        while ((nodeMatch = nodeRegex.exec(cmdObj.text)) !== null) {
            _loop_1();
        }
        cleanedCmd += cmdObj.text.substring(lastIndex);
        var trimmedCleanedCmd = cleanedCmd.trim();
        if (trimmedCleanedCmd) {
            // Match shape drawing commands: circle or ellipse
            var shapeMatch = trimmedCleanedCmd.match(/^(?:\\(filldraw|fill|draw))\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*(circle|ellipse)\s*(?:\(([^)]+)\)|\[([^\]]+)\])/);
            if (shapeMatch) {
                var cmdType = shapeMatch[1];
                var optionsStr = shapeMatch[2] || "";
                var coordStr = shapeMatch[3];
                var shapeType = shapeMatch[4];
                var dimParens = shapeMatch[5];
                var dimBrackets = shapeMatch[6];
                var pos = new SVG.Point(0, 0);
                if (coordStr.includes(",")) {
                    pos = parseCoordinate(coordStr);
                }
                else {
                    var parts = coordStr.split(".");
                    var nodeName = parts[0].trim();
                    var pinName = parts[1] ? parts[1].trim() : "";
                    var nodeInfo = nodeMap.get(nodeName);
                    if (nodeInfo) {
                        if (nodeInfo.symbol) {
                            pos = getPinAbsolutePosition(nodeInfo, pinName);
                        }
                        else {
                            pos = nodeInfo.pos;
                        }
                    }
                }
                var rx = 0.1;
                var ry = 0.1;
                if (shapeType === "circle") {
                    if (dimParens) {
                        rx = ry = parseDimension(dimParens, 0.1);
                    }
                    else if (dimBrackets) {
                        var kv = parseOptions(dimBrackets).kv;
                        var rStr = kv["radius"] || kv["r"] || kv["x radius"] || kv["y radius"];
                        rx = ry = parseDimension(rStr, 0.1);
                    }
                }
                else {
                    if (dimParens) {
                        var parts = dimParens.split(/\s+and\s+/);
                        rx = parseDimension(parts[0], 0.1);
                        ry = parseDimension(parts[1] || parts[0], 0.1);
                    }
                    else if (dimBrackets) {
                        var kv = parseOptions(dimBrackets).kv;
                        var rxStr = kv["x radius"] || kv["radius"] || kv["r"];
                        var ryStr = kv["y radius"] || kv["radius"] || kv["r"];
                        rx = parseDimension(rxStr, 0.1);
                        ry = parseDimension(ryStr, 0.1);
                    }
                }
                var widthPx = (rx * 2) / scale;
                var heightPx = (ry * 2) / scale;
                var isFill = cmdType === "fill" || cmdType === "filldraw";
                var isDraw = cmdType === "draw" || cmdType === "filldraw";
                var KNOWN_COLORS = ["black", "white", "red", "green", "blue", "cyan", "magenta", "yellow", "gray", "darkgray", "lightgray", "brown", "lime", "olive", "orange", "pink", "purple", "teal", "violet"];
                var COLOR_HEX = {
                    black: "#000000",
                    white: "#ffffff",
                    red: "#ff0000",
                    green: "#00ff00",
                    blue: "#0000ff",
                    cyan: "#00ffff",
                    magenta: "#ff00ff",
                    yellow: "#ffff00",
                    gray: "#808080",
                    darkgray: "#a9a9a9",
                    lightgray: "#d3d3d3",
                    brown: "#a52a2a",
                    lime: "#00ff00",
                    olive: "#808000",
                    orange: "#ffa500",
                    pink: "#ffc0cb",
                    purple: "#800080",
                    teal: "#008080",
                    violet: "#ee82ee",
                };
                var _k = parseOptions(optionsStr), cmdStandalone = _k.standalone, cmdKv = _k.kv;
                var optColor = undefined;
                for (var _l = 0, cmdStandalone_1 = cmdStandalone; _l < cmdStandalone_1.length; _l++) {
                    var opt = cmdStandalone_1[_l];
                    if (KNOWN_COLORS.includes(opt.toLowerCase())) {
                        optColor = COLOR_HEX[opt.toLowerCase()];
                        break;
                    }
                }
                if (cmdKv["fill"] && KNOWN_COLORS.includes(cmdKv["fill"].toLowerCase())) {
                    optColor = COLOR_HEX[cmdKv["fill"].toLowerCase()];
                }
                var fillColor = "default";
                if (isFill) {
                    fillColor = optColor || "#000000";
                }
                var strokeColor = "default";
                if (isDraw) {
                    if (cmdKv["draw"] && KNOWN_COLORS.includes(cmdKv["draw"].toLowerCase())) {
                        strokeColor = COLOR_HEX[cmdKv["draw"].toLowerCase()];
                    }
                    else if (optColor) {
                        strokeColor = optColor;
                    }
                }
                var strokeOpts = parseStrokeOptions(optionsStr);
                var strokeWidth = isDraw ? (cmdKv["line width"] || "1pt") : "0px";
                var strokeOpacity = (_b = (_a = strokeOpts.stroke) === null || _a === void 0 ? void 0 : _a.opacity) !== null && _b !== void 0 ? _b : 1;
                var strokeStyle = (_d = (_c = strokeOpts.stroke) === null || _c === void 0 ? void 0 : _c.style) !== null && _d !== void 0 ? _d : "solid";
                components.push({
                    type: "ellipse",
                    position: pos.simplifyForJson(),
                    size: { x: widthPx, y: heightPx },
                    rotation: 0,
                    scale: { x: 1, y: 1 },
                    fill: {
                        color: fillColor,
                        opacity: isFill ? 1 : 0
                    },
                    stroke: {
                        width: strokeWidth,
                        color: strokeColor,
                        opacity: strokeOpacity,
                        style: strokeStyle
                    },
                    lines: [startLine, endLine]
                });
                continue;
            }
            // Match shape drawing commands: rectangle
            var rectMatch = trimmedCleanedCmd.match(/^(?:\\(filldraw|fill|draw))\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*rectangle\s*\(([^)]+)\)/);
            if (rectMatch) {
                var cmdType = rectMatch[1];
                var optionsStr = rectMatch[2] || "";
                var coord1Str = rectMatch[3];
                var coord2Str = rectMatch[4];
                var p1 = new SVG.Point(0, 0);
                if (coord1Str.includes(",")) {
                    p1 = parseCoordinate(coord1Str);
                }
                else {
                    var parts = coord1Str.split(".");
                    var nodeName = parts[0].trim();
                    var pinName = parts[1] ? parts[1].trim() : "";
                    var nodeInfo = nodeMap.get(nodeName);
                    if (nodeInfo) {
                        if (nodeInfo.symbol) {
                            p1 = getPinAbsolutePosition(nodeInfo, pinName);
                        }
                        else {
                            p1 = nodeInfo.pos;
                        }
                    }
                }
                var p2 = new SVG.Point(0, 0);
                if (coord2Str.includes(",")) {
                    p2 = parseCoordinate(coord2Str);
                }
                else {
                    var parts = coord2Str.split(".");
                    var nodeName = parts[0].trim();
                    var pinName = parts[1] ? parts[1].trim() : "";
                    var nodeInfo = nodeMap.get(nodeName);
                    if (nodeInfo) {
                        if (nodeInfo.symbol) {
                            p2 = getPinAbsolutePosition(nodeInfo, pinName);
                        }
                        else {
                            p2 = nodeInfo.pos;
                        }
                    }
                }
                var minX = Math.min(p1.x, p2.x);
                var maxX = Math.max(p1.x, p2.x);
                var minY = Math.min(p1.y, p2.y);
                var maxY = Math.max(p1.y, p2.y);
                var widthPx = maxX - minX;
                var heightPx = maxY - minY;
                var center = new SVG.Point(minX + widthPx / 2, minY + heightPx / 2);
                var isFill = cmdType === "fill" || cmdType === "filldraw";
                var isDraw = cmdType === "draw" || cmdType === "filldraw";
                var KNOWN_COLORS = ["black", "white", "red", "green", "blue", "cyan", "magenta", "yellow", "gray", "darkgray", "lightgray", "brown", "lime", "olive", "orange", "pink", "purple", "teal", "violet"];
                var COLOR_HEX = {
                    black: "#000000",
                    white: "#ffffff",
                    red: "#ff0000",
                    green: "#00ff00",
                    blue: "#0000ff",
                    cyan: "#00ffff",
                    magenta: "#ff00ff",
                    yellow: "#ffff00",
                    gray: "#808080",
                    darkgray: "#a9a9a9",
                    lightgray: "#d3d3d3",
                    brown: "#a52a2a",
                    lime: "#00ff00",
                    olive: "#808000",
                    orange: "#ffa500",
                    pink: "#ffc0cb",
                    purple: "#800080",
                    teal: "#008080",
                    violet: "#ee82ee",
                };
                var _m = parseOptions(optionsStr), cmdStandalone = _m.standalone, cmdKv = _m.kv;
                var optColor = undefined;
                for (var _o = 0, cmdStandalone_2 = cmdStandalone; _o < cmdStandalone_2.length; _o++) {
                    var opt = cmdStandalone_2[_o];
                    if (KNOWN_COLORS.includes(opt.toLowerCase())) {
                        optColor = COLOR_HEX[opt.toLowerCase()];
                        break;
                    }
                }
                if (cmdKv["fill"] && KNOWN_COLORS.includes(cmdKv["fill"].toLowerCase())) {
                    optColor = COLOR_HEX[cmdKv["fill"].toLowerCase()];
                }
                var fillColor = "default";
                if (isFill) {
                    fillColor = optColor || "#000000";
                }
                var strokeColor = "default";
                if (isDraw) {
                    if (cmdKv["draw"] && KNOWN_COLORS.includes(cmdKv["draw"].toLowerCase())) {
                        strokeColor = COLOR_HEX[cmdKv["draw"].toLowerCase()];
                    }
                    else if (optColor) {
                        strokeColor = optColor;
                    }
                }
                var strokeOpts = parseStrokeOptions(optionsStr);
                var strokeWidth = isDraw ? (cmdKv["line width"] || "1pt") : "0px";
                var strokeOpacity = (_f = (_e = strokeOpts.stroke) === null || _e === void 0 ? void 0 : _e.opacity) !== null && _f !== void 0 ? _f : 1;
                var strokeStyle = (_h = (_g = strokeOpts.stroke) === null || _g === void 0 ? void 0 : _g.style) !== null && _h !== void 0 ? _h : "solid";
                components.push({
                    type: "rect",
                    position: center.simplifyForJson(),
                    size: { x: widthPx, y: heightPx },
                    rotation: 0,
                    scale: { x: 1, y: 1 },
                    fill: {
                        color: fillColor,
                        opacity: isFill ? 1 : 0
                    },
                    stroke: {
                        width: strokeWidth,
                        color: strokeColor,
                        opacity: strokeOpacity,
                        style: strokeStyle
                    },
                    lines: [startLine, endLine]
                });
                continue;
            }
            if (trimmedCleanedCmd.startsWith("\\draw")) {
                cleanedCommands.push({
                    text: trimmedCleanedCmd,
                    startLine: startLine,
                    endLine: endLine
                });
            }
            else {
                throwParseError("Syntax error or unsupported command: \"" + trimmedCleanedCmd + "\"", startLine, endLine);
            }
        }
    }
    var _loop_2 = function (cmdObj) {
        var picMatch = cmdObj.text.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*pic\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
        if (picMatch) {
            var pos = parseCoordinate(picMatch[2]);
            var name = picMatch[3].trim();
            components.push({
                type: "subcircuit",
                displayName: name,
                components: [],
                position: pos.simplifyForJson(),
                lines: [cmdObj.startLine, cmdObj.endLine]
            });
            return "continue";
        }
        var drawMatch = cmdObj.text.match(/^\\draw\s*(?:\[([^\]]*)\])?\s*(.*)$/);
        if (drawMatch) {
            var drawOptionsStr = drawMatch[1] || "";
            var drawBody = drawMatch[2] || "";
            var globalStandalone = parseOptions(drawOptionsStr).standalone;
            var strokeInfo_1 = parseStrokeOptions(drawOptionsStr);
            // Parse global arrows
            var globalArrows_1 = { start: "none", end: "none" };
            var _loop_5 = function (opt) {
                if (opt.includes("-")) {
                    var parts = opt.split("-");
                    var startTikz_1 = parts[0];
                    var endTikz_1 = parts[1];
                    if (startTikz_1 === "<")
                        startTikz_1 = "latex";
                    if (endTikz_1 === ">")
                        endTikz_1 = "latex";
                    var startArrow = internal_1.arrowTips.find(function (t) { return t.tikz === startTikz_1; });
                    var endArrow = internal_1.arrowTips.find(function (t) { return t.tikz === endTikz_1; });
                    if (startArrow)
                        globalArrows_1.start = startArrow.key;
                    if (endArrow)
                        globalArrows_1.end = endArrow.key;
                }
            };
            for (var _u = 0, globalStandalone_1 = globalStandalone; _u < globalStandalone_1.length; _u++) {
                var opt = globalStandalone_1[_u];
                _loop_5(opt);
            }
            // Tokenize drawing body to extract coordinates and connectors
            var coordRegex = /\(([^)]+)\)/g;
            var match = void 0;
            var coords = [];
            var coordIndices = [];
            var rawCoords = [];
            while ((match = coordRegex.exec(drawBody)) !== null) {
                var prevSub = drawBody.substring(0, match.index).trim();
                if (/(?:^|\s)arc(?:\s*\[[^\]]*\])?\s*$/i.test(prevSub)) {
                    continue;
                }
                var coordStr = match[1].trim();
                var pos = new SVG.Point(0, 0);
                if (coordStr.includes(",")) {
                    pos = parseCoordinate(coordStr);
                }
                else {
                    // Node pin reference, e.g. (opamp.-) or (GND)
                    var parts = coordStr.split(".");
                    var nodeName = parts[0].trim();
                    var pinName = parts[1] ? parts[1].trim() : "";
                    var nodeInfo = nodeMap.get(nodeName);
                    if (nodeInfo) {
                        if (nodeInfo.symbol) {
                            pos = getPinAbsolutePosition(nodeInfo, pinName);
                        }
                        else {
                            pos = nodeInfo.pos;
                        }
                    }
                    else {
                        console.warn("Referenced node not found in nodeMap:", nodeName);
                    }
                }
                coords.push(pos);
                coordIndices.push(match.index);
                rawCoords.push(match[0]);
            }
            if (coords.length >= 2) {
                var currentWire_1 = { points: [coords[0]], directions: [] };
                var flushWire = function () {
                    if (currentWire_1.points.length >= 2) {
                        components.push(__assign(__assign({ type: "wire", points: currentWire_1.points.map(function (p) { return p.simplifyForJson(); }), directions: currentWire_1.directions, startArrow: globalArrows_1.start, endArrow: globalArrows_1.end }, strokeInfo_1), { lines: [cmdObj.startLine, cmdObj.endLine] }));
                    }
                    currentWire_1 = { points: [], directions: [] };
                };
                var _loop_6 = function (i) {
                    var connectorStr = drawBody.substring(coordIndices[i] + rawCoords[i].length, coordIndices[i + 1]).trim();
                    var toMatch = connectorStr.match(/^to\s*\[(.*)\]$/s);
                    if (toMatch) {
                        // Flush any running wire segment
                        flushWire();
                        var toOptionsStr = toMatch[1] || "";
                        var _v = parseOptions(toOptionsStr), toStandalone = _v.standalone, toKv = _v.kv;
                        // Find poles
                        var poles = { start: "none", end: "none" };
                        for (var _w = 0, toStandalone_1 = toStandalone; _w < toStandalone_1.length; _w++) {
                            var opt = toStandalone_1[_w];
                            var poleShortcutMatch = opt.match(/^([*-od])-(?:([*-od])+)$/);
                            if (poleShortcutMatch) {
                                poles.start = mapPoleShortcut(poleShortcutMatch[1]);
                                poles.end = mapPoleShortcut(poleShortcutMatch[2]);
                            }
                            else if (opt.startsWith("bipole nodes=")) {
                                var keyMatch = opt.match(/bipole nodes=\{([^}]+)\}\{([^}]+)\}/);
                                if (keyMatch) {
                                    poles.start = keyMatch[1];
                                    poles.end = keyMatch[2];
                                }
                            }
                        }
                        // Find labels
                        var labelObj = undefined;
                        var labelValue = toKv["l"] || toKv["l_"] || "";
                        var otherSide = toKv["l_"] !== undefined;
                        if (labelValue) {
                            var labelClean = cleanTikzText(labelValue);
                            labelObj = {
                                value: labelClean,
                                otherSide: otherSide || undefined
                            };
                        }
                        // Find symbol
                        var symbolId_1 = "";
                        var isShort = false;
                        var isOpen = false;
                        var _loop_7 = function (opt) {
                            if (TIKZ_NAME_MAP[opt]) {
                                opt = TIKZ_NAME_MAP[opt];
                            }
                            if (opt === "short") {
                                isShort = true;
                                symbolId_1 = "short";
                                return "break";
                            }
                            else if (opt === "open") {
                                isOpen = true;
                                symbolId_1 = "open";
                                return "break";
                            }
                            var found = getRuntimeSymbols().find(function (s) { return s.tikzName === opt; });
                            if (found) {
                                symbolId_1 = opt;
                                return "break";
                            }
                        };
                        for (var _x = 0, toStandalone_2 = toStandalone; _x < toStandalone_2.length; _x++) {
                            var opt = toStandalone_2[_x];
                            var state_2 = _loop_7(opt);
                            if (state_2 === "break")
                                break;
                        }
                        if (!symbolId_1) {
                            for (var _y = 0, _z = Object.keys(TIKZ_NAME_MAP); _y < _z.length; _y++) {
                                var key = _z[_y];
                                if (toKv[key] !== undefined) {
                                    symbolId_1 = TIKZ_NAME_MAP[key];
                                    if (!labelValue) {
                                        labelValue = toKv[key];
                                        var labelClean = cleanTikzText(labelValue);
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
                            components.push(__assign(__assign({ type: "short", points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()], poles: poles, label: labelObj }, strokeInfo_1), { lines: [cmdObj.startLine, cmdObj.endLine] }));
                        }
                        else if (isOpen) {
                            components.push(__assign(__assign({ type: "open", points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()], poles: poles, label: labelObj }, strokeInfo_1), { lines: [cmdObj.startLine, cmdObj.endLine] }));
                        }
                        else if (symbolId_1) {
                            // PathSymbolComponent
                            components.push(__assign(__assign({ type: "path", id: symbolId_1, points: [coords[i].simplifyForJson(), coords[i + 1].simplifyForJson()], options: toStandalone.filter(function (o) { return o !== symbolId_1 && TIKZ_NAME_MAP[o] !== symbolId_1; }), poles: poles, label: labelObj }, strokeInfo_1), { lines: [cmdObj.startLine, cmdObj.endLine] }));
                        }
                        else {
                            throwParseError("Unsupported or unrecognized component in to[...] path: \"" + toMatch[0] + "\" in command \"" + cmdObj.text + "\"", cmdObj.startLine, cmdObj.endLine);
                        }
                        // Start next running wire at the end of the "to" component
                        currentWire_1.points.push(coords[i + 1]);
                    }
                    else {
                        // Wire connector (--, -|, |-)
                        var direction = "--";
                        if (connectorStr === "-|")
                            direction = "-|";
                        else if (connectorStr === "|-")
                            direction = "|-";
                        if (currentWire_1.points.length === 0) {
                            currentWire_1.points.push(coords[i]);
                        }
                        currentWire_1.points.push(coords[i + 1]);
                        currentWire_1.directions.push(direction);
                    }
                };
                for (var i = 0; i < coords.length - 1; i++) {
                    _loop_6(i);
                }
                // Flush remaining wire segments at the end of draw command
                flushWire();
            }
            else {
                var hasConnector = /\bto\b|--|-\||\|-/.test(drawBody);
                if (hasConnector) {
                    throwParseError("Draw command must contain at least two coordinates: \"" + cmdObj.text + "\"", cmdObj.startLine, cmdObj.endLine);
                }
            }
        }
    };
    // 2. Parse remaining path/wire connections
    for (var _p = 0, cleanedCommands_1 = cleanedCommands; _p < cleanedCommands_1.length; _p++) {
        var cmdObj = cleanedCommands_1[_p];
        _loop_2(cmdObj);
    }
    var _loop_3 = function (item) {
        var parent = components.find(function (c) { return c.type === "node" && c.name === item.referencedName; });
        if (parent) {
            parent.label = {
                value: item.labelVal,
                anchor: item.anchorKey,
                position: item.posKey,
                relativeToComponent: true
            };
        }
    };
    // Post-process additional label nodes and bind them back to parent node symbol components
    for (var _q = 0, labelNodesToProcess_1 = labelNodesToProcess; _q < labelNodesToProcess_1.length; _q++) {
        var item = labelNodesToProcess_1[_q];
        _loop_3(item);
    }
    return components;
}
