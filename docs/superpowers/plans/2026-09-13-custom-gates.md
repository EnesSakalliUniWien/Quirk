# Custom Gates Enhancement Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Track the checkboxes. Commits, pushes, and subagent execution are outside this plan.

**Goal:** Make custom gates understandable to construct, inspect, and use, and make the existing Rx/Ry/Rz parameter window easy to edit.

**Architecture:** Dockview continues to own windows. React owns drafts and form controls; Quirk's existing parsers and matrix operations own mathematical meaning; the existing Pixi renderer, OperatorMatrix, and RotationFigure own previews. Validate a draft before previewing or committing it, and commit the operation the user has inspected.

**Tech stack:** Existing React 19.2.8, Base UI 1.7.0, Dockview 8.2.0, Zod 4.6.2, PixiJS 8.20.1, patched @pixi/react 8.0.5, Vite 8.2.2, and Puppeteer 25.8.0. Proposed addition: MathLive 0.110.0 for mathematical entry, after the formula adapter tests pass.

## Global constraints

- Preserve the existing staged, unstaged, and untracked work, including the touch cancellation, renderer initialization/recovery, valueStore, and license repairs.
- This document is a plan. No application or dependency changes are part of this planning task.
- Construction covers Rotation, Matrix, and Circuit. Parameter editing covers existing Rx/Ry/Rz gates; other parameter dialogs retain their existing input contracts.
- Saved custom gates continue to serialize as a matrix or nested circuit. Editing their original construction parameters and adding a metadata format are outside this iteration.
- Keep parser signatures, serialized circuit meanings, gate IDs, and the existing formula-dependent gate footprints. Presentation changes must not change circuit spacing or occupied columns.
- Keep the Google copyright and Apache headers in modified existing files.
- Keep @pixi/react pinned to 8.0.5 and preserve its tracked patch and postinstall enforcement.
- Use CSS for DOM presentation and CanvasTheme/Pixi drawing functions for canvas presentation.
- Never silently replace the entered matrix with a closest unitary matrix.
- New controls must work with keyboard and touch; asynchronous previews must not commit stale drafts.

## Intended windows and construction flow

The Make Gate window has a short header, Rotation / Matrix / Circuit tabs, one active form, an operation preview, a circuit-symbol preview, and a persistent Cancel / Create row. The form and preview stack in narrow panels and sit side by side at a panel width of 720px or more. Large matrices scroll within their own area. Window-level horizontal scrolling is not acceptable.

```text
Make a gate
[ Rotation ] [ Matrix ] [ Circuit ]
┌ Inputs ─────────────────┬ Preview ────────────────┐
│ Active method           │ Operator / circuit     │
│ Units and field errors  │ Rotation, when defined │
│ Circuit symbol          │ Gate as it will appear │
└─────────────────────────┴────────────────────────┘
                         [ Cancel ] [ Create gate ]
```

The Gate Parameter window has a compact gate title, one-based wire and column location, angle input, radians/degrees choice, evaluated value, expandable formula help, and persistent Cancel / Apply controls. Target its existing 420×320 default first; use available content width instead of another fixed 420px child. A preview can expand below the field without displacing the actions.

Creation adds the gate to Custom Gates in the toolbox using the existing revision commit. It does not insert a gate into the circuit automatically. Focus the new toolbox gate after creation so the next action is clear.

## Current evidence and implementation entry points

- `src/components/panels/forge/forge-panel-body.jsx` mounts all three methods and substitutes placeholders for empty fields. Draft ownership must move here before inactive methods unmount.
- `src/styles/forge.css` uses a viewport breakpoint; `src/styles/matrices.css` overrides `.forge-method` with `min-width: min-content`.
- `src/components/panels/forge/matrix-method.jsx` delays parsing by 100ms and can briefly retain the previous buildable state. `inputs.js` concatenates keys with spaces, which can collide.
- `src/components/panels/gate-param/gate-param-panel.jsx` already checks target identity and commits a replacement through Revision. Preserve both behaviours.
- `src/gates/rotations/RotationGates.js` accepts any nonblank angle text on Apply; the later gate disable-reason detector reports invalid formulas.
- `src/serialization/customGateParsing.js` uses degrees for rotation construction, accepts loose matrix input with zero padding, optionally corrects matrices with SVD, and drops partially selected gates from circuit extraction.
- `src/gates/rotations/FormulaGateUtil.js` uses radians and determines occupied width from the formula text. Keep that behaviour in this iteration.
- `src/components/toolbar/app-toolbar.jsx` currently intercepts circuit undo even inside text fields. New draft editing must have local undo.
- `test/test-entry.js` discovers mirrored unit tests. The E2E runner explicitly imports suites, including `test_e2e/overlays.test.js`.

The earlier live audit and screenshots are in [custom-gates-audit/review.md](/Users/berksakalli/.codex/visualizations/2026/09/13/01a09b64-ce4f-7ea2-b4dc-9e16e7be73e8/custom-gates-audit/review.md). Source inspection for this plan reconfirmed the behaviours above; this planning turn did not repeat the visual audit.

## Execution preflight

- [x] Before application edits, recheck the working tree, applicable instructions, manifests/lockfile, installed runtime and packages, test setup, and the callers named in the next task. Preserve unrelated changes and record the starting diff.
- [x] Run `npm test` and `npm run test:e2e` as the implementation baseline, using the existing runners. Resolve or clearly identify baseline failures before changing the relevant behaviour. Planning-time lint and test discovery do not replace this implementation baseline.

## Task 1: Make the windows fit and preserve drafts

**Modify:** `src/components/panels/forge/forge-panel-body.jsx`, `matrix-method.jsx`, `circuit-method.jsx`, `inputs.js`, `src/components/panels/gate-param/gate-param-panel.jsx`, `src/styles/forge.css`, `src/styles/matrices.css`, `src/styles/panels.css`.

**Test:** `test_e2e/overlays.test.js` and new mirrored `test/components/panels/forge/inputs.test.js`.

**Interfaces:** `ForgePanelBody` owns the active method and all three drafts, including symbols, units, matrix correction choice, and circuit ranges. Child methods receive `{draft, onDraftChange, onCreate}`. Drafts survive method switches and resizing during the open window session. Closing discards the session; do not save unfinished drafts in circuit JSON.

- [x] Replace the three visible cards and “or” dividers with controlled Base UI Tabs. Keep the drafts in the parent; unmount inactive preview components so hidden circuits stop animating.
- [x] Populate real initial values: rotation axis `X+Z`, angle `45`, phase `0`, unit `degrees`; matrix `{{1,0},{0,1}}`; circuit columns and wires `1:∞`. Emptying a required field now makes it incomplete.
- [x] Replace ambiguous debounce keys and test the collision that the old implementation permits:

```js
// src/components/panels/forge/inputs.js
const inputKey = (...values) => JSON.stringify(values);

// Add using Suite/assertThat from test/TestUtil.js.
assertThat(inputKey('a b', 'c') === inputKey('a', 'b c')).isEqualTo(false);
```

- [x] Give only these two panel wrappers `overflow: hidden`; use an internal grid with `grid-template-rows: auto minmax(0, 1fr) auto`, a scrolling content region, and a footer outside it. Keep other panels' scroll ownership unchanged.
- [x] Remove the Forge min-content override. Use `container-type: inline-size` and a 720px container query for the active form/preview columns. Apply `min-width: 0` to grid children and bounded overflow to matrices.
- [x] Replace the E2E assumption that three methods are visible with assertions for three tabs and one visible method. Test draft preservation using Rotation → Matrix → Rotation, including names and invalid text.
- [x] At panel widths 340, 419, 720, and 830px, assert `scrollWidth <= clientWidth + 1`, and assert that the footer stays inside the panel bounds after scrolling. Run `npm run test:e2e` after this behavioural change.

## Task 2: Validate angles before Apply and share angle entry

**Create:** `src/engine/math/formula/AngleExpression.js`, `src/components/math/angle-field.jsx`.

**Modify:** `src/gates/rotations/RotationGates.js`, `src/circuit/model/Gate.js` (paramDialog documentation), `src/components/panels/gate-param/gate-param-panel.jsx`, `src/components/toolbar/app-toolbar.jsx`, `src/styles/panels.css`.

**Test:** new `test/engine/math/formula/AngleExpression.test.js`, `test/gates/rotations/RotationGates.test.js`, `test_e2e/overlays.test.js`, `test_e2e/toolbar.test.js`.

**Interfaces:**

```js
// New pure function; unit is 'radians' or 'degrees'.
parseAngleExpression(text, unit) // -> {value, radians, degrees}; throws Error

// Shared React control; does not commit to the circuit.
AngleField({id, label, value, unit, onChange, onUnitChange, error})

// Optional metadata for Rx/Ry/Rz only; retain applyText(oldGate, text).
paramDialog.angleUnit = 'radians';
```

- [x] Implement `parseAngleExpression` using `ComplexFormula.parse`, with the selected existing angle-unit constant, no variables, and explicit checks for blank input, finite real and imaginary components, and a real result. Preserve formula-gate numerical tolerance for tiny imaginary roundoff (0.0001); reject a non-finite result regardless of tolerance. Use ordinary field errors such as “Enter an angle”, “Angle must be real”, and “Angle must be finite”.
- [x] Add unit cases and invalid inputs before integrating the control:

```js
assertThat(parseAngleExpression('pi/3', 'radians').degrees).isApproximatelyEqualTo(60);
assertThat(parseAngleExpression('60', 'degrees').radians).isApproximatelyEqualTo(Math.PI / 3);
assertThat(parseAngleExpression('sin(90)', 'degrees').value).isApproximatelyEqualTo(1);
for (const text of ['', 'i', '1/0', 'not_an_angle', 't']) {
    assertThrows(() => parseAngleExpression(text, 'radians'));
}
```

- [x] Validate in `radianAngleDialog.applyText` as well as the UI. Invalid Apply returns `{error}` and makes no revision. Retain the old gate on an unchanged or blank legacy callback input; the visible form treats blank input as incomplete and disables Apply.
- [x] Keep entered radians text unchanged when committing, including `3pi/4`. For degree entry, evaluate with degree semantics, then serialize the finite radian number as an expression string. Never reinterpret `sin(90)` with radian trig rules by merely wrapping its original text in `*pi/180`.
- [x] Switching units preserves the evaluated angle. Cache the exact text per unit while no edits intervene, so switching away and back restores it; invalid text must be corrected before conversion. No unit change commits to the circuit.
- [x] Display the evaluated radian/degree values and move the long function reference into native expandable help. Use Base UI Field for native inputs, with linked labels, descriptions, and errors. Keep non-angle gate parameter dialogs on their generic text path.
- [x] Make Enter apply only a valid, current draft and respect IME composition. Escape first closes math/help popovers, then cancels the window. Restore focus to the opening control or the circuit toolbar if its target disappeared.
- [x] In the global undo handler, return when `event.defaultPrevented` or `event.composedPath()` contains an input, textarea, editable element, or `math-field`. Verify typing undo leaves the circuit JSON unchanged and circuit undo still works after leaving the field.
- [x] Test invalid Apply, valid correction after an error, Cancel, unchanged Apply, target deletion/replacement, one undo for a successful Apply, and radians/degree equivalence. Run `npm test` and `npm run test:e2e`.

## Task 3: Make rotation construction explicit

**Create:** `src/components/panels/forge/rotation-method.jsx`, `src/components/panels/forge/construction.js`.

**Modify:** `forge-panel-body.jsx`, `matrix-method.jsx`, `operation-preview.jsx`, `src/styles/forge.css`.

**Test:** new `test/components/panels/forge/construction.test.js`, `test_e2e/overlays.test.js`; retain `test/serialization/customGateParsing.test.js` unchanged in meaning.

**Interfaces:** `parseRotationDraft({axis, angle, phase, unit}) -> Matrix`, in `construction.js`. It consumes `parseAngleExpression`, `Axis.parse`, and `parseUserRotation(angleText, phaseText, axisText)`; it does not replace the existing parser.

- [x] Provide X, Y, Z presets and a Custom axis field. Show the normalized vector for a custom axis; require finite components and nonzero length. Use the shared angle control for rotation and global phase with one explicit unit choice.
- [x] Parse angle and phase in the chosen unit, then pass their numeric degree values to the existing rotation constructor. Preserve its matrix rounding and the global-phase factor. The operation remains `exp(i*phase) * (cos(angle/2)*I - i*sin(angle/2)*(nx*X + ny*Y + nz*Z))`.
- [x] Test the construction with known operators and degenerate input:

```js
assertThat(parseRotationDraft({axis:'X+Z', angle:'180', phase:'90', unit:'degrees'}))
    .isApproximatelyEqualTo(QubitMatrix.HADAMARD);
assertThat(parseRotationDraft({axis:'Y', angle:'pi/3', phase:'0', unit:'radians'}))
    .isApproximatelyEqualTo(parseUserRotation('60', '0', 'Y'));
assertThrows(() => parseRotationDraft({axis:'X-X', angle:'45', phase:'0', unit:'degrees'}));
```

- [x] Reuse OperatorMatrix and RotationFigure. Display global phase separately because the Bloch rotation cannot represent it. Label the rotation as an operation; do not imply it is the current circuit's state vector.
- [x] Attach an exact draft key to the preview. Immediately disable Create on a different key, incomplete fields, or errors; show “Updating preview” during the existing 100ms debounce. Revalidate on Create and require agreement with the displayed preview key. An old preview must never authorize a new draft.
- [x] Test rapidly changing valid → invalid → valid input, name changes during preview, unmount during preview, and a single successful creation. Run `npm test` and `npm run test:e2e`.

## Task 4: Make matrix construction inspectable

**Create:** `src/components/panels/forge/matrix-input.jsx`.

**Modify:** `forge-panel-body.jsx`, `matrix-method.jsx`, `construction.js`, `operation-preview.jsx`, `src/styles/forge.css`, `src/styles/matrices.css`.

**Test:** `test/components/panels/forge/construction.test.js`, `test_e2e/overlays.test.js`, `test_e2e/matrixLayout.test.js`.

**Interfaces:** `inspectMatrix(matrix) -> {qubits, unitary, residual}`. Use `matrix.isUnitary(0.009)` for the existing presentation tolerance and `Math.sqrt(matrix.adjoint().times(matrix).minus(Matrix.identity(matrix.width())).norm2())` as the separately labelled residual. A finite matrix with a valid supported dimension can be used even when it is nonunitary.

- [x] Offer Grid / Raw text entry and dimensions 2×2, 4×4, 8×8, and 16×16, with the corresponding one-to-four-qubit label. Each cell has a row/column label and accepts Quirk complex expressions. Large grids scroll locally and keep labels visible.
- [x] Keep raw text as entered. Parse with `parseUserMatrix(text, false)`. Preserve its loose input behaviour, but show the complete effective matrix, dimension, and zero filling before creation. Explicitly state that matrix-cell trigonometric expressions use the existing degree convention.
- [x] Switching to Grid requires valid raw input; initialize cells from that parsed matrix and preserve the raw text for a return without edits. Changing dimension must not silently discard nonzero cells: retain a draft per dimension, with a visible Reset action for replacing it with an identity matrix.
- [x] Replace the default SVD checkbox with **Make unitary**. Calculate the candidate through `parseUserMatrix(text, true)`, show Entered / Corrected operators and their difference norm, and provide **Use corrected matrix** / **Keep entered matrix**. Selection changes the preview and the eventual gate, without overwriting the original text. Editing matrix input invalidates the correction selection.
- [x] Test the original operation, correction, and data preservation:

```js
const original = parseUserMatrix('1,i,i,1', false);
const corrected = parseUserMatrix('1,i,i,1', true);
assertThat(inspectMatrix(original).unitary).isEqualTo(false);
assertThat(inspectMatrix(corrected).unitary).isEqualTo(true);
assertThat(original.cell(0, 0)).isEqualTo(Complex.ONE);
assertThat(inspectMatrix(Matrix.identity(16)).qubits).isEqualTo(4);
```

- [x] Reject NaN and infinite real/imaginary components, unsupported dimensions, and incomplete cells before preview/Create. A nonunitary operation receives a clear status rather than automatic correction or a blanket prohibition.
- [x] Verify that Create without correction serializes the original matrix, Create after explicit acceptance serializes the corrected matrix, and later edits cannot reuse an old correction. Run `npm test` and `npm run test:e2e`.

## Task 5: Make circuit extraction match its selection

**Modify:** `src/components/panels/forge/circuit-method.jsx`, `construction.js`, `forge-panel-body.jsx`, `src/state/appStore.js`, `src/components/panels/circuit/circuit-panel.jsx`, `src/styles/forge.css`, `src/styles/panels.css`.

**Create:** `src/components/panels/circuit/forge-range-highlight.jsx`.

**Test:** `test/components/panels/forge/construction.test.js`, `test_e2e/overlays.test.js`.

**Interfaces:** `validateCircuitRange(circuit, colsText, rowsText) -> {colStart, colEnd, wireStart, wireEnd}` uses zero-based, end-exclusive coordinates internally. The UI continues to accept one-based inclusive ranges and `∞`. Transient `appStore.forgeRange` contains `{circuitJson, range}` or `undefined`; it is never serialized.

- [x] Validate complete integer tokens and ordered bounds before calling the existing `parseUserGateFromCircuitRange`. Explain `1:3` as “columns 1 through 3” and `1:∞` as “through the last column”. Reject malformed, fractional, reversed, empty, or out-of-bounds selections rather than silently clamping.
- [x] Inspect every gate footprint that intersects the rectangle, including anchors outside it. If any gate is only partly included, disable Create and identify its wire/column. This prevents the existing parser's silent removal from changing the chosen construction.
- [x] Test a partial two-wire gate and the complete selection:

```js
const circuit = new CircuitDefinition(2, [new GateColumn([
    new GateBuilder().setHeight(2).setKnownEffectToMatrix(Matrix.identity(4)).gate,
    undefined,
])]);
assertThrows(() => validateCircuitRange(circuit, '1:1', '1:1'));
assertThat(validateCircuitRange(circuit, '1:1', '1:2'))
    .isEqualTo({colStart:0, colEnd:1, wireStart:0, wireEnd:2});
```

- [x] Draw a non-interactive range highlight in the existing circuit scroll content, following the GutterEditors overlay pattern. Derive bounds from the current displayed circuit's `geometry().gateRect(...)`, current zoom, and selection bounds; use `pointer-events: none`. Do not introduce a second coordinate model or write the highlight into simulation state.
- [x] Clear or recompute the highlight on circuit revision, method switch, target mismatch, and window close. A range from an old circuit JSON must not remain highlighted on a new circuit.
- [x] Enlarge the existing circuit preview to the active panel width. Keep animation only while the visible selected circuit is time dependent, and keep its existing RenderCanvas ownership/disposal.
- [x] Show selected wires/columns, gate count, and required input ranges. Retain “Weight” as a separately explained existing metric; do not rename gate weight to gate count.
- [x] Test selection accuracy at multiple zooms and scroll positions, partial gates, dynamic previews, clearing, circuit edits while Forge is open, and creation from the latest previewed circuit. Run `npm test` and `npm run test:e2e`.

## Task 6: Improve gate appearance and access to editing

**Create:** `src/components/gate/gate-preview.jsx`, `src/draw/gate/AngleGateLabel.js`.

**Modify:** `src/gates/rotations/RotationGates.js`, `src/draw/gate/GateFrame.js`, `src/components/panels/forge/matrix-method.jsx`, `circuit-method.jsx`, `src/components/panels/gate-param/gate-param-panel.jsx`, `src/components/toolbar/app-toolbar.jsx`, `src/components/toolbox/gate-toolbox.jsx`.

**Test:** `test/draw/gate/GateRenderers.test.js`, new `test/draw/gate/AngleGateLabel.test.js`, `test_e2e/overlays.test.js`, `test_e2e/toolbox.test.js`.

**Interfaces:** `GatePreview({gate})` displays a gate through the existing RenderCanvas and registered gate renderer, with no editing or simulation side effects. `angleLabelParts(gate) -> {symbol, parameter}` prepares display text without changing `gate.param`.

- [x] Give Rx/Ry/Rz a distinct operator symbol and a smaller angle line; use π for the display token `pi`, preserve grouping, and bound the parameter text to the existing rectangle. Put the complete original expression in the parameter window and accessible name.
- [x] Keep an edit indicator visible on parameter gates while idle, with stronger focus/hover feedback. Retain `gateButtonRect` as the hit-test authority, and preserve the drag area. Other gate types using `paintGateButton` must remain operable and readable.
- [x] Provide a Gate Parameter toolbar entry. When opened without a pointer-selected target, present a keyboard-operable list of circuit gates that have `paramDialog`, labelled by symbol, wire, and column; selection uses the existing `gateParamTarget` identity guard. Static custom gates must not advertise parameter editing they cannot perform.
- [x] Reuse the same rendered gate in the Forge symbol preview. Preserve matrix thumbnails for unnamed matrix gates, nested-circuit rendering for unnamed circuit gates, and existing toolbox colours. Cache a preview gate per validated draft instead of rebuilding it on incidental renders. Create must register one final gate ID and commit once.
- [x] After successful creation, reveal Custom Gates and focus the matching toolbox button through its existing `data-gate-id` and tile registration. Return focus only after the new tile is mounted; respect the toolbox's existing roving tab stop and do not add a second focus-management system.
- [x] Check presentation independently of model dimensions:

```js
const gate = RotationGates.Ry.withParam('pi/3');
const before = {width: gate.width, param: gate.param};
assertThat(angleLabelParts(gate)).isEqualTo({symbol:'Ry', parameter:'π/3'});
assertThat({width: gate.width, param: gate.param}).isEqualTo(before);
```

- [x] Verify symbol/angle readability, full-expression access, pointer edit versus drag, keyboard target selection, toolbox insertion, and preview/circuit consistency at 0.75×, 1×, and 1.5× zoom. Run `npm test` and `npm run test:e2e`.

## Task 7: Add mathematical entry without changing formula meaning

**Create:** `src/components/math/math-field.jsx`, `src/components/math/math-field-value.js`, new mirrored `test/components/math/math-field-value.test.js`.

**Modify:** `src/components/math/angle-field.jsx`, `src/components/panels/forge/matrix-input.jsx`, `src/styles/matrices.css`, `package.json`, `package-lock.json`, `test_e2e/overlays.test.js`.

**Interfaces:** `toQuirkExpression(latex, {allowComplex}) -> {ok:true, text} | {ok:false, error}` and `toMathFieldValue(text) -> {ok:true, latex} | {ok:false, error}`. These translate notation only; the existing Quirk parser performs all evaluation. Keep a Raw expression option for every math field.

- [x] Build and test a bounded notation adapter before enabling rich input. Accept numbers, scientific notation, parentheses, unary signs, arithmetic, powers, fractions, square roots, π, e, and the existing functions `cos`, `sin`, `acos`, `asin`, `tan`, `atan`, `ln`, `sqrt`, and `exp`; allow `i` for matrix cells only. Reject unsupported LaTeX constructs with an input error. Do not strip unknown commands or use a regex-only transformation that loses nested grouping.
- [x] Preserve the exact raw expression when opening, closing, or changing display mode without edits. If an existing raw formula cannot be represented by the bounded adapter, keep it editable in Raw expression mode.
- [x] Test actual conversions and rejection:

```js
const converted = toQuirkExpression(String.raw`\frac{\pi}{3}`, {allowComplex:false});
assertThat(converted.ok).isEqualTo(true);
assertThat(parseAngleExpression(converted.text, 'radians').degrees).isApproximatelyEqualTo(60);
assertThat(toQuirkExpression(String.raw`\int_0^1 x\,dx`, {allowComplex:false}).ok).isEqualTo(false);
```

- [x] Add the exact dependency `mathlive@0.110.0` when implementing this task. Registry metadata checked during planning lists `@cortex-js/compute-engine@0.58.0` as its dependency: account for that transitive package; do not use it as Quirk's evaluator or add another direct math-engine dependency.
- [x] Load MathLive when a mathematical input is requested, keep load failure local to the field, and retain usable raw entry. Serve required fonts/assets from the built application. Use input events and managed refs; release listeners on unmount. Do not reset selection on every React render.
- [x] Keep the virtual keyboard explicitly controlled. It must not cover Cancel, Apply, or Create. Native typing, paste, local undo, focus restoration, and IME composition must remain usable.
- [x] Verify parser equivalence for all supported notation, nested fractions, negative powers, complex matrix cells, unsupported commands, unchanged raw-string round trips, repeated window mounting, and production asset loading. Inspect the production bundle for the actual added cost; no Compute Engine evaluation path may enter gate construction. Run `npm test` and `npm run test:e2e`.

## Task 8: Verify complete construction and document the behaviour

**Modify:** `test_e2e/overlays.test.js`, `test_e2e/toolbox.test.js`, `test_e2e/matrixLayout.test.js`, `doc/README.md`.

- [x] Exercise each completed path: create a rotation, an entered nonunitary matrix, an explicitly corrected matrix, and a circuit-derived gate; locate each in Custom Gates; insert it; undo/redo; export and reopen its circuit JSON. Compare the resulting operator or nested circuit with the previewed construction.
- [x] Use the existing Ry(pi/3), Rz(pi/4) circuit as a visual fixture. Confirm that editing it preserves existing Bloch triangle construction and numerical output.
- [x] Capture the two windows at narrow and wide panel sizes, at 200% browser zoom, and on a 390px viewport. Check long expressions, 16×16 matrices, validation errors, the virtual keyboard, and always-visible actions. Inspect screenshots in addition to DOM measurements.
- [x] Cover keyboard traversal, tab activation, focus restoration, local draft undo, touch cancellation followed by dragging, stale targets, deferred previews, failed renderer initialization, and resource disposal. Keep the previous regression tests.
- [x] Update the manual with one example per construction method, explicit units, the entered/corrected matrix distinction, and creation into the toolbox.
- [x] Run the repository's final gates and wait for completion:

```sh
npm run check
git diff --check
```

- [x] Because Task 7 changes the lockfile, verify an isolated `npm ci` and production build, including successful @pixi/react patch application. Use the existing temporary preview/test commands and close every assistant-started service.
- [x] Report completed behaviour, exited checks, remaining limitations, and the preserved worktree. Do not commit or push.

## Library decisions and documentation

Base UI provides [Tabs](https://base-ui.com/react/components/tabs) and [Field](https://base-ui.com/react/components/field) for method selection and labelled validation. Keep drafts in React rather than keeping hidden rendering work mounted. Context7 documentation was checked for controlled tabs, keyboard activation, and panel mounting; use the installed 1.7.0 declarations when implementing because current online documentation can describe newer releases.

[MathLive's React guide](https://mathlive.io/mathfield/guides/react/) supports a math-field with input events, refs, lifecycle management, and explicit virtual keyboard policy. Its exported notation is not Quirk syntax. The bounded adapter and raw entry are required. Package version and transitive dependency were checked against npm registry metadata on 13 September 2026.

[CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) let the form respond to Dockview's panel width. Reuse the existing Zod dependency for draft structure checks where useful; do not duplicate mathematical parsing in Zod. React Hook Form, CodeMirror, a new window manager, and a new rendering library are unnecessary for this scope.

## Planning verification

Inspected the dirty worktree, package/lockfile, Node floor and CI, installed dependencies, test registration, relevant callers and rendering/serialization boundaries. Local Node is 24.10.0 and npm is 11.6.0 on Darwin arm64. `npm run lint`, read-only overlay test registration (five existing cases), and `git diff --check` completed without errors during planning. Full implementation tests above remain future verification; this document does not claim the enhancements are implemented.

## Implementation verification — 2026-09-13

Implemented in `codex/custom-gates`, preserving the pre-existing work. `npm run check` exited successfully: 704 unit tests, 58 end-to-end tests, and 7 performance tests, plus lint and Knip. The additional browser cases cover construction, insertion, undo/redo, export/reload, invalid parameters, unit conversion, composition, stale targets, matrix correction, wide-gate ranges, and local MathLive load failure. `git diff --check` passed. An isolated `npm ci` and production build passed, including the pinned Pixi patch; the temporary installation was removed.

Visual verification used the existing toolbar steps 0.8×, 1×, and 1.5× (0.75× is not a toolbar step). The 200% layout was emulated with an 800×500 CSS viewport at 2× device density; native browser zoom was not separately exercised. Screenshots also cover 390px, wide construction windows, a 16×16 matrix, and the contained math keyboard. The circuit preview follows saved-gate behaviour by omitting unused trailing wires and reports its resulting qubit count.

MathLive is lazy-loaded; its JavaScript chunk is approximately 801 kB, 221 kB gzipped, plus local font assets. Its transitive Compute Engine is not imported as an evaluator, and MathLive compute-engine evaluation is disabled. Existing locked dependency versions were unchanged. No commits or pushes were made.
