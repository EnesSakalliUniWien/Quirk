# How to Contribute

Contributions are welcome. Fork the repository, make your changes on a branch, and open a pull
request.

Before opening the pull request, keep the checks green:

- `npm run check` — builds each page and runs all three suites in turn. The individual steps are
  `npm test` (browser unit suite), `npm run test:e2e` (end-to-end suite) and `npm run test:perf`
  (performance checks); `npm run build` produces the production bundle on its own.

# Source layout

- `src/main.js` — the page entry; everything else is reached from here.
- `src/app/` — everything the shell owns: the composition root (`QuirkApp.js`) plus the
  modules it wires together once at startup, grouped into `state/` (with the zustand app
  store), `canvas/`, `dialogs/` and `session/`. See [the app directory guide](src/app/README.md).
- `src/editor/` — the canvas circuit editor's model: the displayed circuit, its geometry,
  hit testing, painting, and drag state. Must never import from `src/app/` or
  `src/components/`, and stays DOM-free (no `document`/`window` access).
- `src/components/` — the React chrome (toolbar, transport bar, dialogs, gate toolbox), its
  shadcn primitives under `src/components/ui/`, and `toolbox.js`, the vanilla helper module the
  gate toolbox drives.
- `src/circuit/` — circuit models in `model/` and JSON conversion in `serialization/`.
  See [the circuit directory guide](src/circuit/README.md) for individual file responsibilities.
- `src/gates/` — the gate catalogue, aggregated by `AllGates.js`; a gate missing from its
  lists silently stops serializing and disappears from the toolbox.
- `src/draw/` — canvas painting primitives.
- `src/engine/` — every calculation: pure numerics in `math/`, the WebGL2 abstraction in `webgl/`
  (`webgl/context/issues.js` owns the one shared GL context), and circuit evaluation in `simulation/`
  with its shader and texture utilities in `simulation/gpu/`. See
  [the engine directory guide](src/engine/README.md).
- `src/diagnostics/` — the error banner and global error hooks; anything may report into it,
  it depends only on `src/base/`.
- `src/base/`, `src/geometry/`, `src/browser/`, `src/config/` — dependency-light foundations:
  generic utilities, 2D points and rectangles, browser API wrappers, and shared constants.
- `src/styles/` — all CSS, aggregated by `globals.css`.

Dependencies flow downward: `main → app → (components, editor) → (circuit, gates, draw) →
(engine, diagnostics, browser, config, geometry, base)`. Skipping levels downward is fine (`main`
also imports `components`, `diagnostics`, and `engine` directly). The
`circuit`/`gates`/`draw`/`editor` cluster is mutually entangled for historical reasons (gates
carry their own drawers); do not add new upward imports beyond it.

`test/` mirrors `src/` wherever unit tests exist and discovers suites by the
`test/**/*.test.js` glob, so a test moved outside `test/` silently stops running. `test_perf/`
and `test_e2e/` are flat, feature-named suites; `test_perf/` imports `src/` directly. The unit
and performance suites each ship their own harness page beside them, `test/test.html` and
`test_perf/test_perf.html`, which Vite builds as extra entry points.

`scripts/` holds the Node tooling the npm scripts call: `run-browser-tests.js` drives either
harness page under Puppeteer, `run-e2e-tests.js` runs the end-to-end registry, and
`screenshot-circuit.js` renders the README screenshot. `server/` serves the built `out/`.

All submissions are reviewed through GitHub pull requests. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more information on
using pull requests.

This project is a fork of [Quirk](https://github.com/Strilanc/Quirk); the original code is
Copyright 2017 Google Inc., licensed under Apache 2.0, and the license headers must stay intact.
