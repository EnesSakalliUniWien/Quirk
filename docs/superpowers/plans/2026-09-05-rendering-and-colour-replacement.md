# Rendering and Colour Replacement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute a separately authorised phase task-by-task. Steps use checkboxes. Do not dispatch subagents or commit without user authorisation.

**Goal:** Make canvas colouring explicit, Registers readable, and state visualisations understandable, then replace the drawing implementation where a representative prototype demonstrates a benefit.

**Architecture:** JavaScript owns the canvas theme, CircuitGeometry owns layout, CircuitDefinition/CircuitStats own circuit and simulation data, and a renderer consumes those inputs. Konva is the preferred candidate for the 2D editor. The simulator remains separate; Three.js is an optional subsequent choice for the enlarged Bloch view.

**Tech Stack:** Existing JavaScript ES modules, React 19, Vite 8, Puppeteer and custom browser unit runner. Konva is proposed, not installed. PixiJS is the alternative candidate; Three.js is conditional. No deck.gl or p5.js adoption is proposed.

## Global constraints

- This document is a prioritised migration plan, not authorisation to implement or install dependencies.
- Preserve the existing uncommitted tooltip, resize-tab, formula-button and Bloch layout changes.
- Keep circuit serialization, gate mathematics, controls, undo/redo, and WebGL simulation behavior intact.
- Retain generalised dimensions relative to Layout.UNIT and the existing zoom/scroll/DPR conversion.
- A larger sphere must retain correct click and drag bounds. A minimum text size must have an overflow policy.
- Never replace circuit-specific insertion, resizing or control semantics with generic library dragging.
- Do not keep two competing production renderers after migration. A temporary comparison route must have a removal step.
- Do not impose one rectangular-frame contract on controls, swaps, displays, labels, and ordinary gates.
- No commit, push, release, dependency installation, or persistent service is authorised by this planning request.

## Evidence and priorities before Phase 1

Repository HEAD: `7a0549b`; working tree includes the fixes developed in this conversation. Node v24.10.0, npm 11.6.0 and installed dependencies verified. Current browser baseline: 850/850 unit tests passed. The previous E2E run had transport timeouts that passed direct reruns; these must be reported separately from a clean full-suite result.

1. **Colour ownership and contrast:** Palette/Typography read CSS at module initialization; drawers sometimes capture those values. Bright ink over green/cyan fills has inadequate contrast. Give each meaning an explicit role.
2. **Registers:** both the initial-state wire labels and binary amplitude-grid labels need dedicated space and a readable text policy.
3. **Final amplitudes:** probability fill, probability circle, logarithmic outline and phase line compete. Grid size currently follows wire spacing, which makes it grow when circuit rows grow.
4. **Renderer structure:** Painter combines drawing, cursor state, touch blockers, deferred work and randomness; drawers also use raw canvas context operations.
5. **Optional 3D:** the enlarged Bloch view manually projects coordinates and draws depth-dependent arcs. A 3D library is useful only if it materially simplifies that implementation or provides desired interactions.

## Library decisions and replacement boundaries

| Choice | Proposed responsibility | Replaces | Retains |
| --- | --- | --- | --- |
| JavaScript theme module | Colours and typography with explicit roles | CSS-to-Palette reads and captured fallback values | CSS for the DOM interface; exported variables for shared colours |
| Konva, preferred 2D candidate | Canvas shapes, groups, layers, native pointer targeting and transforms | Painter-based circuit presentation, migrated GatePainting drawers, corresponding pixel-bound targeting | CircuitGeometry, CircuitDefinition, CircuitStats, CircuitEditing, CircuitActions and serialization |
| PixiJS, alternative | Same 2D responsibility if GPU rendering proves necessary or its implementation is clearer | Same presentation boundary as Konva | Same domain and simulation code |
| Three.js, conditional | Enlarged, rotatable Bloch scene | drawBlochScene, strokeGreatCircle and view-only projection logic | blochCoordinates, blochAngles, pureStateText, dialog state and simulation data |
| deck.gl | No current adoption | Nothing | Revisit only for a separate large-dataset visualisation requirement |
| p5.js | No current adoption | Nothing | Its procedural sketch model does not remove the main ownership problems identified here |

Konva's shapes, layers and events suit the editor requirements. PixiJS has GPU renderers and an event system; it is a credible alternative, not an automatic performance upgrade. A rendering-library change does not migrate the existing WebGL 1 simulation or remove GPU-to-JavaScript readbacks.

## Phase 1 — Explicit colouring, independently shippable

**Files:** `src/config/CanvasTheme.js`, `test/config/CanvasTheme.test.js`, `src/config/Typography.js`, `src/main.js`, all former Palette consumers and colour-consuming stylesheets. Delete `src/config/Palette.js` and `src/config/StyleTokens.js`; retain no compatibility module.

**Selected palette:** IQP-dark, explicitly selected by the user. `gateStyle(gate)` assigns known operations by serialized ID for canvas drawers and toolbox chips. Quirk powers/formulas extend the matching axis assignment; Quirk-only operations and scientific displays retain explicit neutral/data roles because IQP-dark does not prescribe their encodings. Hover preserves gate-family fills and adds an outline. No CSS gate-category assignment remains.

**Implemented interface:** `CanvasTheme` is a plain, immutable JavaScript object. `applyCanvasTheme(root)` publishes its shared values as CSS custom properties before the DOM controls and circuit renderer mount. Drawing consumes JavaScript values directly. Every drawer imports CanvasTheme directly. CSS consumes published variables; all colour literals and colour mixes are defined in JavaScript. Typography owns the shared font definitions. There is no legacy Palette alias or CSS-reading fallback.

### Guide references and application

These references carry forward the earlier plan's useful styling guidance. JavaScript ownership is this project's implementation decision; the references do not prescribe a JavaScript module or a universal quantum-circuit palette.

| Reference | Guidance to apply |
| --- | --- |
| [Qiskit circuit_drawer: style dictionaries and JSON](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.visualization.circuit_drawer) | Use explicit defaults and named overrides, with separate main-label and parameter typography. The user selected IQP-dark. Use its exact operation assignments from [iqp-dark.json](https://github.com/Qiskit/qiskit/blob/main/qiskit/visualization/circuit/styles/iqp-dark.json), including pink Y/Rx/Ry and pale blue Z/Rz. |
| [Quantikz manual, section V: global and per-gate styling](https://mirrors.ibiblio.org/CTAN/graphics/pgf/contrib/quantikz/quantikz.pdf#page=17) | Define defaults by element type, with explicit overrides for individual cases. Quantikz distinguishes `operator`, `meter`, `phase`, `circlewc` for targets, and `crossx2` for swaps. Apply that separation to existing drawers without imposing one shape on every gate. |
| [Azure Quantum circuit-diagram conventions](https://learn.microsoft.com/en-us/azure/quantum/concepts-circuits) | Preserve Register labels and recognisable control, target and measurement symbols when changing colours. Their shapes and text must remain readable without gate-family colouring. This is a notation reference, not a palette specification. |
| [A Design Space for Quantum Circuit Visualizations, sections 3.4 and 5.1](https://arxiv.org/html/2607.24042) | The study describes colour, pattern, stroke, shape, text and legends serving different encodings. Apply this by documenting each colour's meaning, distinguishing gate categories from state data and interaction states, and keeping equivalent encodings consistent across views. It does not establish one mandatory colour scheme. |
| [W3C use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Supply visible text, symbols or line treatments alongside meaningful colours. Check normal text at 4.5:1 and essential graphics at 3:1 against adjacent backgrounds, including composited overlays. These checks alone do not establish full accessibility conformance. |

### Implementation checklist

- [x] Inventory every canvas colour by use: surface, text, wire, gate frame, probability, amplitude, Bloch vector, selection, hover, playhead, disabled state and error.
- [x] Record each role's meaning, foreground/background pairing and non-colour cue beside its JavaScript definition. Keep element defaults and justified overrides explicit; drawers select roles rather than embed colour literals or inspect CSS.
- [x] Apply IQP-dark to the canvas background, quantum/classical wires, H, X, Y, Z, rotations, swap and measurement. Use black labels on its bright gate fills. Preserve symbols and the existing data-display roles.
- [x] Keep IQP-dark gate-family colours independent of probability, phase and interaction colours. Use the same mapping for the same quantity in Final amplitudes and State at the playhead; explain any phase colour scale with a legend and preserve their different state positions in the titles.
- [x] Separate text colours from data fills. Put probability text in its own readable region or use a foreground chosen for the actual fill. Keep phase numbers/directions even if phase colours are used.
- [x] Use the inspected CSS values as the starting point, then revise semantic roles and contrast. The implementation replaces the entire ownership path in this working-tree change; no transitional Palette is retained.
- [x] Replace import-time computed-style reads and migrate drawer factories to immutable JavaScript values. Remove Palette and StyleTokens after migrating every consumer.
- [x] Remove colour declarations and colour mixes from CSS once applyCanvasTheme publishes them. Keep selectors, layout and interaction styling in CSS, consuming named variables.
- [x] Verify the theme imports without a document (Node/E2E runner), publishing to a detached root, representative text/background and essential graphic/background pairs, the phase scale, and composited overlays.
- [x] Check dev and production in a browser before/after font readiness. Use normal-text contrast of at least 4.5:1 and essential graphical contrast of at least 3:1 as design targets; inspect translucent overlays against their composited backgrounds.
- [x] Review representative gates, both Register label groups, Bloch displays and amplitude views in normal, hover, selected, keyboard-focus and error states. Check that monochrome rendering preserves the information carried by colour and that overlays leave labels and state data readable.

**Exit:** one traceable JavaScript source, matching dev/build canvas values, no read-before-CSS dependency, legible normal/hover/selected/error states.

**Completed verification:** 857/857 browser unit tests and 22/22 production E2E tests passed. The first E2E run exposed an amber-specific playhead assertion; it now checks the theme's composited band and the full rerun passed. Development and production values matched both with font requests deliberately held and after font loading. Colour and monochrome views were inspected. Temporary browser servers were closed.

**IQP-dark and left Register verification:** 860/860 browser unit tests and 23/23 production E2E tests passed. Checks cover exact IQP-dark assignments and black ink, hover retention, every supported initial ket and wire index through q15, insertion-preview clearance, ket clicks at 100% and 80% zoom with DPR 2, and matching toolbox colours. Development and production canvas/background values matched; colour and monochrome screenshots were inspected. Fit now uses unshifted circuit width so previous zoom slack cannot prevent fitting. The E2E hash reader preserves literal plus signs in kets. Temporary verification servers were closed.

**Remaining boundary:** Horizontal amplitude-grid labels, amplitude encoding simplification and renderer replacement remain in subsequent phases. The small, rotated grid labels are still a known readability limitation.

## Phase 2 — Registers and final amplitudes, independently shippable

**Files:** `src/editor/CircuitGeometry.js`, `src/editor/CircuitLayoutConstants.js`, `src/editor/CircuitPainting.js`, `src/editor/CircuitHitTesting.js`, `src/draw/MathPainter.js`, `src/draw/CachablePainting.js`, plus geometry, drawing and E2E tests in their existing test directories.

**Interfaces:** extend existing geometry with explicit wire-label and amplitude-view rectangles. The amplitude renderer consumes the existing complex Matrix and basis-state indexing; it does not recompute or modify the state.

- [x] Give each wire an index plus its initial-state ket, with widths and font size derived from Layout.UNIT and verified against every supported initial state and wire index. CircuitGeometry owns the painted and clickable rectangles. Reserve space for the first-column insertion preview, including Bloch bounds, and preserve the ket action.
- [ ] Render amplitude-grid binary labels horizontally. State which bits belong to rows and columns, using the exact bit order of `_outputStateAsMatrix` and existing tooltip indexing.
- [ ] Give the final amplitude view a viewport and cell dimensions independent of wire spacing. Set a readable minimum label/cell size; scroll or show a selected subset instead of shrinking every label indefinitely. Keep zoom as a deliberate user action.
- [ ] In the final amplitude view, use circle area proportional to probability and line angle for phase. Remove the duplicate probability level and logarithmic outline there; do not globally change MathPainter.paintMatrix because other matrix/display drawers use it.
- [ ] For zero amplitude, omit the phase line. For small nonzero amplitudes, preserve exact probability and phase in the tooltip; disclose any display threshold rather than presenting thresholded values as zero.
- [ ] Keep exact complex amplitude, probability and phase accessible by hover and keyboard selection. Name the view “Final amplitudes” and preserve its distinction from “State at the playhead”.
- [ ] Test basis states, equal superpositions, relative phases 0/pi/plus-or-minus-pi/2, mixed local states with a pure full state, zero entries, and larger matrices. Check 2/4/8/12/16-wire labels and indexing without introducing a different bit order.
- [ ] Invalidate cached text after font readiness and theme/font changes, or remove the bitmap cache if measurements show it is unnecessary. Verify zoom, DPR, viewport edges and scrolling.

**Exit:** both Register label groups remain readable; amplitude encoding is explained, the full state remains navigable, and increasing wire gaps no longer changes amplitude-cell size.

## Phase 3 — Bounded Konva prototype and renderer decision

**Files:** proposed prototype modules under `src/editor/`, a temporary prototype entry alongside the existing Vite pages, and a Puppeteer comparison script following the existing static-server lifecycle. Only create these after this phase is authorised, including its dependency installation. Prototype code is not production default.

**Inputs:** existing CircuitGeometry, CircuitDefinition, CircuitStats, Hand/interaction state, CanvasTheme, zoom, scroll and DPR. **Outputs:** rendered shapes and slot/element identities handed back to existing editor actions.

- [ ] Capture baseline render-only frame time, end-to-end interaction latency, heap use and startup for identical circuits and viewport settings. Separate simulation time, readback time, drawing time and text work.
- [ ] Prototype H, control/anti-control, X target, swap, a formula rotation with its change-button, a resizable display, a Bloch display and one amplitude grid. Include a nested custom-circuit preview.
- [ ] Use real Konva groups, shape properties and layers. Do not wrap all old raw-context drawing in one custom Shape and call that a migration.
- [ ] Keep the domain model authoritative. Map library events to CircuitEditing/CircuitActions; retain insertion, compressed-column behavior, resize limits, keyboard placement and undo/redo.
- [ ] Use native pointer targeting for shapes while retaining geometric column/row placement. Confirm drag offsets when grabbing an enlarged Bloch sphere outside its logical gate slot.
- [ ] Check 0.4/0.8/1/1.25/1.5 zoom, horizontal/vertical scroll, DPR 1/2, font arrival, resize, touch and keyboard operations. Test large amplitude data without constructing one interactive node for every decorative primitive.
- [ ] Record exact baseline/prototype numbers on the same browser and machine, plus code ownership and remaining raw-context requirements. Decide whether the improvement justifies migration before porting the complete gate catalogue.
- [ ] If Konva has a measured rendering limitation or leaves comparable custom drawing complexity, run the same bounded comparison with PixiJS. Select one production 2D renderer and remove the rejected prototype.

**Exit:** a documented renderer choice based on working editor behavior, readability, resource use and measured timings. There is no claim of a speedup before measurement.

## Phase 4 — Migrate the selected 2D renderer in tested groups

**Files:** `src/app/redrawLoop.js`, `src/app/canvasPointer.js`, `src/app/zoom.js`, `src/editor/CircuitPainting.js`, `src/editor/CircuitHitTesting.js`, `src/editor/DisplayedInspector.js`, `src/draw/GatePainting.js`, `src/draw/CustomGateCircuitDrawer.js`, and the affected gate drawers. Keep `src/circuit/` and `src/webgl/` out of presentation changes.

- [ ] Migrate wires, labels, ordinary gates, controls and swaps as one circuit-editing slice. Maintain a temporary comparison route while parity is incomplete.
- [ ] Migrate parameter controls, animation, resize tabs, permutation and multi-wire gates, with their own regression cases.
- [ ] Migrate probability/Bloch/amplitude/density/sample displays. Pass already computed display values into drawing; sampling decisions must not depend on paint traversal order.
- [ ] Migrate held gates, nested custom-circuit previews, tooltips, warnings, cursor targeting and touch behavior.
- [ ] Eliminate migrated raw-context entry points and duplicated geometry. Keep specialised symbols as specialised components, rather than forcing every gate into a box.
- [ ] Run the existing browser and E2E suites. Review intentional visual changes against controlled examples; do not update visual expectations merely to make tests pass.
- [ ] After all retained callers are accounted for, delete obsolete Painter/Tracer/TraceAction and GatePainting portions, abandoned adapters and the temporary comparison route. Preserve any independent retained use until its replacement is explicit.

**Exit:** one production drawing implementation, one geometry source, explicit theme input, preserved editing/simulation semantics, and no obsolete parallel renderer.

## Phase 5 — Optional Three.js decision for the enlarged Bloch view

**Files:** `src/app/blochSphereDialog.js`, a proposed `src/app/blochSphereScene.js`, and `test/app/blochSphereDialog.test.js`. A dependency change requires authorisation.

- [ ] First decide whether the enlarged view needs functionality that warrants a 3D library: real camera rotation, consistent depth handling and richer state-vector interaction.
- [ ] If selected, move scene/camera/material ownership into blochSphereScene. Pass the existing conventional Bloch coordinates and CanvasTheme; keep the quantum conversion functions outside Three.js.
- [ ] Replace manual view projection and arc sampling only after tests cover |0>, |1>, |+>, |->, |+i>, |-i> and a maximally mixed state.
- [ ] Keep miniatures in the selected 2D renderer. Avoid a WebGL context per miniature.
- [ ] Dispose graphics resources and render-loop work when the dialog closes; verify reopening, docking, resizing and context loss.

**Exit:** adopt Three.js only if the measured and reviewed result is simpler or provides the selected 3D behavior. Otherwise retain the existing enlarged view.

## Verification and execution order

Run the repository commands directly; the browser runners manage temporary servers and close them:

```sh
npm test
npm run test:e2e
git diff --check
```

Keep builds that write `out/` sequential. No new runner is needed. A timed-out E2E test must be investigated and reported even if its isolated rerun passes.

Recommended execution order: Phase 1, Phase 2, Phase 3, Phase 4 only after the renderer decision, Phase 5 only if separately justified. Colours, labels and amplitude semantics should be settled before evaluating whether a new renderer reproduces them well.

## Sources checked

- [Konva overview: shapes, layers, events and drag support](https://konvajs.org/docs/overview.html)
- [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers)
- [Three.js scenes, geometry and materials](https://threejs.org/manual/en/fundamentals.html)
- [deck.gl data layers](https://deck.gl/docs)
- [p5.js canvas modes](https://p5js.org/reference/p5/createCanvas/)
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
