# Circuit rendering

`CircuitRendering.js` adapts the public circuit API to explicit rendering inputs.
`CircuitLayers.js` describes React elements in order: playhead, selection, breakpoints, wires, columns,
outputs, captions, then row highlights. `@pixi/react` reconciles the retained objects and PixiJS renders them. The `paintCircuit()` adapter preserves its callable signature; state no longer has a rendering method.

## Responsibilities

- `wires/`: wire segments, initial-state kets, register names and braces, and wire-limit hints.
- `columns/`: gates, control connections, resize regions, disabled reasons and survival annotations.
- `outputs/`: probability/Bloch outputs, amplitudes, basis labels, captions and output warnings.
- `interaction/`: playhead, breakpoints, the selection or the box being dragged, and row/column drag highlights.
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

## Describing what can show

The canvas is a fixed viewport over a scrolling spacer, so a circuit a hundred columns wide is seen
a screen at a time. `CircuitViewport.update` hands the renderer the stretch of the circuit to describe,
as `context.range` ({left, right} in circuit units): the viewport and one viewport's width either side
of it. `columns/ColumnRange.js` says which columns draw within it - a column's own cell, and for a gate
spanning several columns the cells it covers, so a wide gate stays while any part of it is in range -
and `CircuitLayers` describes only those columns, `CircuitTargets` only their hit areas. Keys stay the
columns' own (`column-3`, `gate-3-0`), so a column entering the range is mounted where it stands and the
others are left alone. Wires, the outputs at the right, captions, the playhead and the selection are
described whole: each is a handful of elements. Without a range - previews, tooltips, tests - every
column is described. A wire is described as runs, one to each stretch that is wholly quantum or wholly
classical, not one segment a column (`wires/CircuitWires.js`).

`top.pan` on the root view says what a scroll may move without describing the scene again, and in
`described` how far the viewport may go before a column that was left out would show.
`CircuitViewport.pan` refuses past that, and the next frame describes the circuit around the new view.
A circuit whose columns were all described has no such limit.

## Retention and labels

Named containers preserve scene identity and drawing order. Basis labels retain their content
until wire count, text metrics, pixel ratio or explicit invalidation changes. The coordinator
re-exports `invalidateCircuitLabelCache()` for font-loading updates. Pixi text measurements determine
label height; row/column bit ordering, ellipsis notation and orientation remain unchanged.

Disabled reasons use one opaque background, one border and one wrapped text pass. They stay visible
while hovered, with no diagonal stroke across the text. Colours come from `CanvasTheme`.

## Verification

Focused behavior tests live under `test/editor/rendering/`, with the range's under `columns/` and `wires/`. The browser tests also cover shared
rendering primitives; E2E tests cover circuit editing, registers, resizing, zoom and playback.
Run `npm run check` and `npm run screenshot` after changes, and inspect the affected visuals at
normal/reduced zoom and different device-pixel ratios.
