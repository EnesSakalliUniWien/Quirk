# How to Contribute

Contributions are welcome. Fork the repository, make your changes on a branch, and open a pull
request.

Before opening the pull request, keep the checks green:

- `npm test` — the browser unit suite.
- `npm run test:e2e` — the end-to-end suite.
- `npm run build` — the production build.

# Source layout

- `src/main.js` — the page entry; everything else is reached from here.
- `src/app/` — everything the shell owns: the composition root (`QuirkApp.js`) plus the
  modules it wires together once at startup (menu, transport, dialogs, zoom, undo, URL sync,
  the redraw loop, the simulator, and the app-state classes).
- `src/editor/` — the canvas circuit editor's model: the displayed circuit, its geometry,
  hit testing, painting, and drag state. Must never import from `src/app/` or
  `src/components/`, and stays DOM-free (no `document`/`window` access).
- `src/components/` — the React chrome (toolbar, transport bar, dialogs, gate toolbox), its
  shadcn primitives under `src/components/ui/`, and `toolbox.js`, the vanilla helper module the
  gate toolbox drives.
- `src/circuit/` — the circuit domain model, serialization, and GPU-backed evaluation.
- `src/gates/` — the gate catalogue, aggregated by `AllGates.js`; a gate missing from its
  lists silently stops serializing and disappears from the toolbox.
- `src/draw/` — canvas painting primitives.
- `src/webgl/` — the WebGL abstraction; `issues.js` there owns the one shared GL context.
- `src/diagnostics/` — the error banner and global error hooks; anything may report into it,
  it depends only on `src/base/`.
- `src/base/`, `src/math/`, `src/browser/`, `src/config/` — dependency-light foundations:
  generic utilities, pure math, browser API wrappers, and shared constants.
- `src/styles/` — all CSS, aggregated by `globals.css`; `src/lib/` — the shadcn `cn` helper.

Dependencies flow downward: `main → app → (components, editor) → (circuit, gates, draw) →
(webgl, diagnostics, browser, config, math, base)`. Skipping levels downward is fine (`main`
also imports `components`, `diagnostics`, and `webgl` directly). The
`circuit`/`gates`/`draw`/`editor` cluster is mutually entangled for historical reasons (gates
carry their own drawers); do not add new upward imports beyond it.

`test/` mirrors `src/` wherever unit tests exist and discovers suites by the
`test/**/*.test.js` glob, so a test moved outside `test/` silently stops running. `test_perf/`
and `test_e2e/` are flat, feature-named suites; `test_perf/` imports `src/` directly.

All submissions are reviewed through GitHub pull requests. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more information on
using pull requests.

This project is a fork of [Quirk](https://github.com/Strilanc/Quirk); the original code is
Copyright 2017 Google Inc., licensed under Apache 2.0, and the license headers must stay intact.
