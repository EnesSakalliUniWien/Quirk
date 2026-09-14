# Circuit editing

`CircuitEditing.js` dispatches grabs, previews and drops, and applies their results through
`CircuitViewState`'s existing immutable update methods. Its public function signatures stay unchanged.
It does not import `CircuitViewState`, so editing no longer creates a circular import with that class.

## Responsibilities

- `gates/GatePlacement.js`: remove, duplicate, alternate and place individual gates.
- `gates/GateResizing.js`: acquire resize tabs, choose the nearest family height and resolve overlaps.
- `columns/ColumnEditing.js`: acquire, shift and insert whole gate columns.
- `wires/RowEditing.js`: move row gates and initial states while updating register boundaries.
- `wires/WireCount.js`: compute required and temporary wires, bounded by the simulator's limits.
- `registers/RegisterSelection.js`: select free wires and preview a new register.

## Inputs and results

Components receive `context.definition`, `context.geometry` and the hand. The coordinator also
supplies the existing hit-test queries (`wireIndexAt`, `findOpHalfColumnAt`,
`toColumnSpaceCoordinate`, `findGateOverlappingPos`) and `highlightStatusAt`. Components never receive
or import the displayed circuit and never read its private fields.

A component returns `undefined` when it proposes no edit. Otherwise it returns an object with
optional `definition`, `hand`, `highlightedSlot`, `compressedColumnIndex` and `extraWireStartIndex`
fields. Omitting a marker preserves it; providing it as `undefined` clears it. Only the coordinator
applies these markers to the displayed circuit. Pure model changes still use `CircuitDefinition`,
`GateColumn` and `Registers`; pointer events and undo/redo stay with their existing owners.

Register selection, row/column movement, gate placement and resizing keep their existing dispatch
priority. A resize tab or wire selection claims the hand before a gate grab. Native array reduction
selects a size variant with a strict comparison, preserving the first family member on a tie.

Required wire count does not depend on the held gate: placement/resize previews handle expansion. Current callers request
zero or one extra wire; the internal wire-count operation accepts nonnegative extra counts.

## Verification

Existing drag and resize tests remain in `test/editor/state/CircuitViewState.test.js`. Focused tests under
`test/editor/editing/` cover alternate duplication, resize ties, moved row metadata and wire limits.
Run `npm run check` for lint, unused-code checks, browser behavior, E2E interactions and performance.

GatePlacement owns insertion decisions. CircuitEditing applies each result through one `withEdit` update.
The wire-count interface accepts only the extra wire count; pointer state is not used.
