# Application shell

`src/app` wires the DOM, the circuit canvas and the engine together. Nothing here is imported by
the engine or the gates. `startQuirk` builds the models and publishes what the UI needs through the store; it mounts
nothing. The React components in `src/components` read `src/state/appStore.js` for what to show
and which model to call.

```text
app/
├── QuirkApp.js     the composition root: creates models and publishes the UI's dependencies
├── state/          the DOM-free models the rest of the app subscribes to (the zustand store
│   │                   they are mirrored into lives in src/state/appStore.js)
│   ├── CircuitActions.js   undo, redo and clearing over the circuit revision
│   ├── RegisterActions.js  edits to the circuit's registers - name, wires, input - each one commit
│   ├── Playhead.js         where the transport controls are parked in the circuit
│   ├── Simulator.js        runs circuits against one clock and publishes completed results
│   └── Recorder.js         records, imports and restores takes; coordinates whole-run batches
├── canvas/         the circuit canvas
│   ├── zoom.js             the camera: zoom factor plus scroll offset
│   ├── canvasPointer.js    click, grab, drag and drop editing on the canvas
│   ├── toolboxDrag.js      bridges a grab in the DOM toolbox onto the canvas
│   ├── minimap.js          the schematic overview of a wide circuit
│   └── redrawLoop.js       the frame pipeline: simulate, publish stats, size, paint
└── session/        document-level lifecycle
    ├── boot.js             the reveal tick and GL context recovery
    ├── url.js              circuit and take URL loading, guarded against stale imports
    └── title.js            the window title
```

There is no `dialogs/` directory any more. The panel system it served has been removed; what it
held that was not DOM wiring now lives with the code it belongs to: `src/engine/math/bloch.js`,
`src/engine/simulation/stateTableRows.js`, `src/serialization/customGateParsing.js` and
`src/config/exampleCircuits.js`.

## Conventions

No model here asks whether a panel is open. `CircuitActions` depends on the revision and `Playhead`
on the circuit's length, and neither has a notion of the app being busy; see the note in
`src/components/panels/panels.jsx` for why, and for what a panel owes instead.

PascalCase files export one class with no DOM access and are unit tested in `test/app/`.
camelCase files export an `init*` function that wires the circuit canvas; each carries an
"Interface note" naming the elements it needs. Those notes, and the store, are the contract
between this directory and `src/components`.

`CircuitPanel` supplies panel-opening callbacks to `startQuirk`, including `openTape` for URL
loading. The app never imports the dock or the panel registry. `Recorder` receives an `onRestore`
callback at construction for repainting the restored result; it has no panel-opening property.
The result format and storage belong to `src/results`, not to the recording workflow.
