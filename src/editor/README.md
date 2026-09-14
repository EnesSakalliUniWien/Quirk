# Editor responsibilities

| Directory | Responsibility |
| --- | --- |
| `state/` | Immutable `CircuitViewState` and `EditorState` snapshots; Zustand editor actions and subscriptions |
| `editing/` | Gate placement, resizing, column and row edits, register selection and temporary wires |
| `geometry/` | Circuit rectangles, layout constants, centering and geometry derivation |
| `interaction/` | Zod-validated pointer operations, Pixi targets and gestures, geometry queries for previews |
| `rendering/` | Circuit and inspector scene descriptions, outputs, warnings and previews |

`CircuitViewState` contains circuit display state and immutable update methods. Editing methods
retain convenient entry points into `CircuitEditing`; the state does not import rendering.
`EditorState` combines circuit state, pointer state and draw area. `withLayout` preserves circuit
identity when layout is unchanged, so pointer updates reuse the WeakMap geometry cache.
`withEdit` applies definition and marker changes together; omitted markers remain unchanged and
explicit `undefined` clears them. Circuit equality still excludes available width; editor equality
includes draw area. Definitions retain their established immutable model-update conventions.

`PointerInteractionState` stores one operation: idle, gate, column, row, resize or wire selection.
Zod strict discriminated unions validate new operations. Validated, frozen operations are reused
across pointer moves. Operation-specific getters support existing editing and scientific renderers.
The Zustand `editorStore` owns pointer publication; selectors can observe circuit or pointer state
independently. Undo and simulation continue to use their existing owners.

`CircuitTargets` describes native Pixi containers with `hitArea`, semantic circuit targets and
cursors. Pixi resolves target containment and ordering. `PixiPointerGestures` tracks one pointer
through release outside or cancellation. Canvas input uses federated Pixi events and native
coordinate conversion. There are no DOM touch-blocker overlays or canvas DOM event handlers.
React owns the canvas presentation element; Pixi owns canvas backing dimensions and rendering.
The surrounding React panels, scroll viewport and DOM toolbox remain UI integration points.

Geometry queries remain available for editing previews without a mounted scene. Insertion
choices belong to gate placement. Renderers consume explicit definition, geometry, pointer and
simulation inputs; they do not run simulations. `paintCircuit` remains the rendering adapter;
`CircuitLayers` orders the circuit's layers. `InspectorRendering` composes background, circuit, held gates
and native interaction targets.

Tests mirror these responsibilities under `test/editor/`. Run `npm run check` and
`npm run screenshot` after changes to rendering or input.
