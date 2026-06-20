# Lesson Learned: Custom Symbol Editing and SVG DOM Manipulation

## Background
In the CircuiTikZ Designer, users can copy standard components (e.g., `nmos`, `pmos`) to create their own custom categories and symbols (e.g., `hvnmos`, `hvpmos`). When a custom symbol is created, the user modifies its visual representation in the Symbol Editor. However, ensuring that the custom visual design perfectly syncs across all component variants (options) while remaining editable has presented several critical challenges.

This document serves as a reference for developers to avoid similar pitfalls when manipulating and parsing SVG DOM nodes, especially when dealing with SVG styling inheritance, compound paths, and deep DOM diffing.

---

## 1. Variant Syncing and Deep Leaf Node Diffing
**Issue:** 
When applying options to a custom symbol (e.g., toggling the `arrowmos` option on an `hvnmos`), the symbol's visual representation would fall back (roll back) to the original base component's look (the default `nmos` look), completely discarding the user's custom edits.

**Root Cause:**
The system attempted a shallow diff to extract the "option decorators" (like the arrow). It compared the outer HTML of the first-level child nodes (which was just `<g>`) of the original base variant with the selected variant. Because the `<g>` of the variant contained extra arrow paths, the entire `<g>` string was deemed "different" and injected as a decorator on top of the user's edited elements, essentially overwriting/hiding the user's edits.

**Solution:**
Implemented **Deep Leaf-Node Diffing**. Instead of comparing grouping nodes (`<g>`), the algorithm traverses the SVG tree until it reaches leaf geometry nodes (e.g., `<path>`, `<rect>`). It compares the normalized `outerHTML` of these leaf nodes between the original base variant and the selected variant. Any unique leaf node found in the variant is extracted as a decorator and safely composited into the user's custom `<g>` structure.

---

## 2. SVG Default Style Evaluation (Invisible Lines & Black Dots)
**Issue:** 
When opening a copied `pmos` symbol in the editor, the lines became invisible, and the gate circle rendered as a solid black dot.

**Root Cause:**
When flattening nested `<g>` elements, the system tried to manually inherit `stroke` and `fill` styles from parent groupings down to the child leaf nodes using the `SVG.js` library: `el.attr("stroke")`. 
However, if a `<path>` does not have an explicit `stroke` attribute, SVG defaults its computed value to `"none"`. Thus, `el.attr("stroke")` returned `"none"`. The logic `if (!el.attr("stroke"))` evaluated to `!"none"` (which is `false`), causing the script to **skip inheriting** the parent's `stroke="#000"`.
Similarly, the default SVG `fill` is `#000000` (black). The gate circle path lacked a `fill` attribute, so `el.attr("fill")` returned `#000000`, turning it into a solid black dot instead of inheriting `"none"`.

**Solution:**
Always use native DOM methods to check for the **explicit existence** of an attribute rather than relying on library functions that might return computed default values. 
Replaced `!el.attr("stroke")` with `!el.node.hasAttribute("stroke")` and `el.node.hasAttribute("fill")`. This ensures styles are inherited exactly as defined in the raw SVG XML.

---

## 3. Compound Path Splitting (Independent Line Selection)
**Issue:** 
When editing a copied `pmos` or `hvnmos`, users attempted to move one vertical line (e.g., the gate line), but multiple lines moved together because they were bound as a single object.

**Root Cause:**
CircuiTikZ components are highly optimized and often combine multiple disconnected subpaths into a single `<path>` element using relative and absolute Move commands (`M` and `m`), such as: `<path d="M19.05 15.08 v29.1 m-4.44 -24.7 v20.3"/>`. The editor treated this single DOM node as a single, un-splittable SVG element.

**Solution:**
During the symbol flattening phase (on `open()`), compound paths with no fill (`fill="none"`) are split into individual `<path>` nodes. 
We leverage `new SVG.PathArray(pathStr)` which automatically normalizes all relative commands (like `m`, `v`, `h`) into absolute commands. The normalized array is then split into sub-arrays every time an `M` (MoveTo) command is encountered. These sub-arrays are rendered into separate `<path>` DOM elements, allowing the user to select, edit, and move lines independently.

---

## 4. DOMParser Supported MimeTypes Typo
**Issue:**
A runtime error occurred when saving a custom symbol: `Failed to execute 'parseFromString' on 'DOMParser': The provided value 'image/xml+xml' is not a valid enum`.

**Root Cause:**
An invalid MIME type (`image/xml+xml`) was passed to `DOMParser`.

**Solution:**
Standardized to `"text/xml"` when parsing custom component XML definitions. `DOMParser` strictness requires exactly one of the supported MIME types (`text/html`, `text/xml`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`).
