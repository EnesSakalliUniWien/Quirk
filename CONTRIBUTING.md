# How to Contribute

Contributions are welcome. Fork the repository, make your changes on a branch, and open a pull
request.

Before opening the pull request, keep the checks green:

- `npm run check` — lints, runs knip, then builds each page and runs all three suites in turn.
  The individual steps are `npm run lint` (ESLint: `no-undef`, `eqeqeq`, `prefer-const` and a
  short list of `unicorn` rules for hand-rolled forms of things the platform now has), `npm run
  knip` (unused files, exports and dependencies), `npm test` (browser unit suite), `npm run
  test:e2e` (end-to-end suite) and `npm run test:perf` (performance checks); `npm run build`
  produces the production bundle on its own. Both static checks must be clean; CI runs them first.
- `npm run typecheck` — advisory only. TypeScript checks the JSDoc annotations with `checkJs` and
  implicit `any` allowed; the codebase predates the checker and reports around four thousand
  findings, most of them the Closure-era `int` type and `!Type` names TypeScript cannot resolve.
  Run it on a file you are working in; do not expect it to pass.

# Source layout

- `src/main.jsx` — the page entry; mounts the React shell, whose CircuitPanel starts the app.
- `src/app/` — everything the shell owns: the composition root (`QuirkApp.js`) plus the
  modules it wires together once at startup, grouped into `state/` (the DOM-free models),
  `canvas/` and `session/`. See [the app directory guide](src/app/README.md).
- `src/state/` — `appStore.js`, the zustand store the React chrome reads and the shell writes:
  the active overlay, zoom, dock modes, and the availability and playhead state mirrored from
  the models. It depends only on `src/base/`, so both `app` and `components` import it downward.
- `src/editor/` — the canvas circuit editor: view and pointer state, geometry, interaction,
  editing and rendering; see [the editor guide](src/editor/README.md). Must never import from
  `src/app/` or `src/components/`, and stays DOM-free (no `document`/`window` access).
- `src/components/` — the React chrome (toolbar, transport bar, dialogs, gate toolbox), its
  `Button` and `ButtonGroup` primitives under `src/components/ui/` (styled by
  `src/styles/ui/buttons.css`), and `toolbox.js`, the vanilla helper module the gate toolbox drives.
  Dock panels and their supporting components are grouped by responsibility under
  `src/components/panels/`; see the [panel directory guide](src/components/panels/README.md).
- `src/circuit/` — the circuit model: `CircuitDefinition`, `GateColumn`, `Gate` and
  `GateBuilder`, `Controls`, the registers (`Registers.js`) and their display labels
  (`registerLabels.js`), plus the two vocabularies the gate catalogue builds on
  (`InitialStates.js`, `InputLetters.js`). It never imports the catalogue: where the model has
  to know what a gate does to a wire it reads a flag the builder set (`measureEffect`,
  `isSwapHalf`). See [the circuit directory guide](src/circuit/README.md).
- `src/serialization/` — `Serializer.js`, JSON in and out for circuits, gates and matrices. It
  needs the catalogue to resolve gate ids, so it sits above `circuit` and `gates`.
- `src/results/` — complete takes and albums, file formats and Tape persistence. It reads
  simulation histories through `CircuitStats.snapshotData()` and uses the circuit serializer;
  it does not own playback, recording workflow or browser download operations.
- `src/gates/` — the gate catalogue, aggregated by `AllGates.js`; a gate missing from its
  lists silently stops serializing and disappears from the toolbox.
- `src/editor/editing/` — gate, column, row and register edits, coordinated by `CircuitEditing`;
  see [the editing guide](src/editor/editing/README.md).
- `src/editor/rendering/` — circuit scene updates grouped by wires, columns, outputs and
  interaction; see [the rendering guide](src/editor/rendering/README.md).
- `src/draw/` — rendering grouped into surfaces, scenes, shapes, text, tooltips, scientific
  displays, gates and shared renderers; see [the directory guide](src/draw/README.md).
  Circuit viewport coordination lives in `src/app/canvas/CircuitViewport.js`. Gate renderers
  receive the editor's `PointerInteractionState` as an argument, hit areas and cursors come from
  `src/editor/interaction/CircuitTargets.js`, and there are no touch-blocker overlays. Circuit
  rendering callbacks are supplied through `gate/CustomGateCircuitRenderer.js` and
  `CircuitPreview.js`.
- `src/engine/` — every calculation: pure numerics in `math/`, the WebGL2 abstraction in `webgl/`
  (`webgl/context/issues.js` owns the one shared GL context), and circuit evaluation in `simulation/`
  with its shader and texture utilities in `simulation/gpu/`. `math/` and `webgl/` are leaves;
  `simulation/` evaluates the circuit model with the catalogue's gates, so it sits above both.
  See [the engine directory guide](src/engine/README.md).
- `src/diagnostics/` — the error banner and global error hooks; anything may report into it,
  it depends only on `src/base/`.
- `src/base/`, `src/geometry/`, `src/browser/`, `src/config/` — dependency-light foundations:
  generic utilities, 2D points and rectangles, browser API wrappers, and shared constants.
- `src/styles/` — global CSS grouped by responsibility, aggregated by `globals.css`; see
  `src/styles/README.md`. HTML CSS Modules live beside their components.

Dependencies flow downward:

    main → components → app → (results, editor) → serialization → engine/simulation → (gates, circuit) → draw
         → (engine/math, engine/webgl, diagnostics, browser, config, geometry, base)

`state` sits beside `components` (read by `app` and `components`, depending only on `base`).
Skipping levels downward is fine (`main` also imports `components`, `diagnostics` and
`engine/webgl` directly).

Three pairs import each other, and they are the only upward edges in the tree:
`gates ↔ engine/simulation` (gates build their shaders on the simulation's ket utilities; the
simulation prepares initial states through the catalogue), `circuit ↔ engine/simulation` (the
model delegates execution; the simulation reads the model), and `serialization ↔
engine/simulation` (the serializer rebuilds circuit-backed gates through `CircuitComputeUtil`;
`CircuitStats` serializes display data). Do not add new upward imports beyond these.

`test/` mirrors `src/` wherever unit tests exist and discovers suites by the
`test/**/*.test.js` glob, so a test moved outside `test/` silently stops running. `test_perf/`
and `test_e2e/` are flat, feature-named suites; `test_perf/` imports `src/` directly. The unit
and performance suites each ship their own harness page beside them, `test/test.html` and
`test_perf/test_perf.html`, which Vite builds as extra entry points.

`scripts/` holds the Node tooling the npm scripts call: `run-browser-tests.js` drives either
harness page under Puppeteer, `run-e2e-tests.js` runs the end-to-end registry, and
`screenshot-circuit.js` renders the README screenshot. These scripts use Vite’s `preview()`
API to serve `out/` on a temporary loopback port and close it when finished. Production
deployments publish `out/` to static hosting; Vite preview is only for local verification.

All submissions are reviewed through GitHub pull requests. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more information on
using pull requests.

This project is a fork of [Quirk](https://github.com/Strilanc/Quirk); the original code is
Copyright 2017 Google Inc., licensed under Apache 2.0, and the license headers must stay intact.
