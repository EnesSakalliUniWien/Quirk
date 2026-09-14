# Circuit rendering

`CircuitRendering.js` adapts the public circuit API to explicit rendering inputs.
`CircuitLayers.js` describes React elements in order: playhead, wires, columns,
outputs, captions, then row highlights. `@pixi/react` reconciles the retained objects and PixiJS renders them. The `paintCircuit()` adapter preserves its callable signature; state no longer has a rendering method.

## Responsibilities

- `wires/`: wire segments, initial-state kets, register names and braces, and wire-limit hints.
- `columns/`: gates, control connections, resize regions, disabled reasons and survival annotations.
- `outputs/`: probability/Bloch outputs, amplitudes, basis labels, captions and output warnings.
- `interaction/`: playhead and row/column drag highlights.
- `previews/`: circuit thumbnails and custom-gate rendering without editor state.

The coordinator supplies `context.definition`, `context.geometry`, `context.highlightedSlot`,
`context.highlightStatusAt(col, row, points)` and `context.outputStateAsMatrix()`. Components
receive the hand and existing simulation results as arguments where needed. The adapter reads display state; scene components never import `CircuitViewState`, editing or the adapter.
Shared hover/resize queries live in `../interaction/CircuitHighlightStatus.js`; output matrix
conversion lives in `outputs/CircuitOutputState.js`. App and test entry points explicitly register
the custom-gate renderer. Importing `CircuitViewState` does not register a renderer.

`CircuitWires` uses `CircuitGutter`. `CircuitColumns` uses controls, warnings and column highlights.
`CircuitOutputs` uses amplitudes and captions; amplitudes use basis labels. Shared Pixi primitives
are grouped by responsibility under `src/draw/` ([directory guide](../../draw/README.md)), scientific rendering stays with its existing owners, and `CircuitGeometry`
remains the source for rendering and hit-test coordinates. Rendering does not run the simulation.

## Retention and labels

Named containers preserve scene identity and drawing order. Basis labels retain their content
until wire count, text metrics, pixel ratio or explicit invalidation changes. The coordinator
re-exports `invalidateCircuitLabelCache()` for font-loading updates. Pixi text measurements determine
label height; row/column bit ordering, ellipsis notation and orientation remain unchanged.

Disabled reasons use one opaque background, one border and one wrapped text pass. They stay visible
while hovered, with no diagonal stroke across the text. Colours come from `CanvasTheme`.

## Verification

Focused behavior tests live under `test/editor/rendering/`. The browser tests also cover shared
rendering primitives; E2E tests cover circuit editing, registers, resizing, zoom and playback.
Run `npm run check` and `npm run screenshot` after changes, and inspect the affected visuals at
normal/reduced zoom and different device-pixel ratios.
