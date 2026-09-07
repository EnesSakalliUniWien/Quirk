# Application shell

`src/app` wires the DOM, the circuit canvas and the engine together. Nothing here is imported by
the engine or the gates. The React components in `src/components` read `state/appStore.js` for
what to show and which model to call, and import the dialog wiring modules that belong to the
panels they render. The toolbar and transport buttons are entirely React components.

```text
app/
├── QuirkApp.js     the composition root: creates every model and calls every init* once
├── state/          the app store and the DOM-free models the rest of the app subscribes to
│   ├── appStore.js         the zustand store the React chrome reads: overlay, zoom, dock modes,
│   │                       and the availability and playhead state mirrored from the models
│   ├── CircuitActions.js   undo, redo and clearing over the circuit revision
│   ├── OverlayState.js     which overlay is open
│   ├── Playhead.js         where the transport controls are parked in the circuit
│   └── Simulator.js        runs circuits against one clock and caches their stats
├── canvas/         the circuit canvas
│   ├── zoom.js             the camera: zoom factor plus scroll offset
│   ├── canvasPointer.js    click, grab, drag and drop editing on the canvas
│   ├── toolboxDrag.js      bridges a grab in the DOM toolbox onto the canvas
│   ├── minimap.js          the schematic overview of a wide circuit
│   └── redrawLoop.js       the frame pipeline: simulate, publish stats, size, paint
├── dialogs/        behaviour behind src/components/dialogs, and the data it shows
│   ├── dialogSnap.js       drag-to-dock tiling for the dialog windows
│   ├── forge.js            the custom gate forge
│   ├── exports.js          the export panel
│   ├── menu.js             the welcome menu
│   ├── exampleCircuits.js  the example circuits the menu links to
│   ├── gateParamDialog.js  the gate parameter editor
│   ├── blochSphereDialog.js the enlarged Bloch sphere
│   └── stateTable.js       the amplitude table
└── session/        document-level lifecycle
    ├── boot.js             first-run welcome and GL context recovery
    ├── url.js              the circuit in the URL hash
    └── title.js            the window title
```

## Conventions

PascalCase files export one class with no DOM access and are unit tested in `test/app/`.
camelCase files export an `init*` function that wires named DOM elements; each carries an
"Interface note" naming the elements and the component that mounts them. Those notes, and the
store, are the contract between this directory and `src/components`.
