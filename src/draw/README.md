# Rendering responsibilities

Canvas colours come from `src/config/Theme.js` through the `CanvasTheme.js` entry point. Native Pixi objects receive fill,
stroke, alpha and text properties in JavaScript. CSS styles the surrounding HTML controls.

## Directory layout

| Directory | Responsibility | Files |
|---|---|---|
| `surface/` | Canvas and Application lifecycle, frame submission, shared surfaces | `RenderCanvas.jsx`, `RenderSurface.js`, `SharedPaintSurface.js` |
| `scene/` | React scene descriptions, reconciliation and committed rendering | `DisplayView.js`, `ReactScene.js` |
| `shapes/` | Shape primitives and path construction | `ShapeView.js`, `PathGeometry.js` |
| `text/` | Text measurement, fitting and label descriptions | `TextLayout.js`, `LabelView.js`, `BasisLabels.js` |
| `tooltips/` | Tooltip content, positioning and overlay descriptions | `TooltipView.js` |
| `displays/` | Amplitude, probability, density, sample and Bloch displays | Scientific display modules |
| `gate/` | Gate grouping, frames, symbols and custom-gate rendering | Existing gate modules plus `GateView.js` |
| `renderers/` | Shared data renderers, operator tiles and raster generation | Existing renderer modules |

`displays/MatrixView.js` owns complex matrix rendering, `ComplexCellGeometry.js` owns shared amplitude marks,
`ProbabilityView.js` owns probability displays, and `BlochGeometry.js` owns the Bloch projection axes.
`tooltips/MatrixTooltip.js` maps matrix cells to tooltip content. Circuit viewport coordination lives in
[`src/app/canvas/CircuitScene.js`](../app/canvas/CircuitScene.js); circuit composition remains in
[`src/editor/rendering/`](../editor/rendering/README.md). Editor interaction output lives in
[`src/editor/interaction/CircuitTargets.js`](../editor/interaction/CircuitTargets.js).

## Ownership

- `RenderCanvas` declares a presentation element around `@pixi/react`'s `Application`. React owns the canvas attributes and Application,
  reconciliation and scene-object disposal. `RenderSurface` submits frame descriptions through
  a Zustand store and waits for their committed render. Shared/offscreen surfaces use the same
  Application component in a detached React root. Pixi's automatic ticker stays off.
- `src/app/canvas/CircuitScene.js` applies viewport position and passes editor state and existing simulation results
  into `editor/rendering/InspectorRendering.js`, which composes the background, circuit and held gate.
  `CircuitRendering` supplies the circuit-specific rendering inputs.
- `DisplayView` describes React elements. Named keys preserve layer and gate identity; unnamed
  marks use their occurrence within that owner. It does not own a Pixi child registry. Its container
  adapter enables Pixi's recursive disposal when React removes a subtree. Scientific drawing callers
  still use `add` and `group`; React components can supply elements directly. Coordinate conversion
  uses the committed native container. There is no separate `finish` step.
- Gate callers import frames from `gate/GateFrame.js`, symbols from `gate/GateSymbol.js`,
  composed renderers from `gate/GateRenderers.js` and rectangle helpers from `gate/GateRects.js`.
- `GateView` groups a gate's description. `GateRenderParams.withPainter` supplies that description
  while preserving gate-context access.
- `ShapeView` and `LabelView` are registered native Pixi primitives. React creates and removes them;
  their property setters avoid rebuilding unchanged graphics and text styles. `TextLayout` uses
  CanvasTextMetrics and native wrapping. `BasisLabels` uses React containers directly and memoizes
  descriptions by inputs and fonts.
- `ReactScene` renders after refs commit. Tooltip placement uses the committed source transforms
  through Pixi's `toGlobal`/`toLocal`. The tooltip overlay retains identity between updates and is
  removed when no longer requested. Rendering failures reject the submitted frame.
- `PathGeometry` only supplies grid, arrowhead and dashed-polyline calculations.
- `CircuitTargets` describes native Pixi hit areas and cursors. Scientific matrix and probability displays
  also expose native hit areas; editor Pixi pointer events provide their focus points. Matrix cell lookup
  uses row and column arithmetic with one target per matrix. Drawing and editing share `CircuitGeometry`.
- `MatrixView` retains its Pixi GraphicsContext instructions until matrix values, geometry or colours change.
  It snapshots mutable matrix buffers to detect in-place edits. Phase hands and logarithmic rings have
  independent options; the scientific magnitude and phase calculations remain in `ComplexCellGeometry`.

`SceneView`, its Canvas2D-style interface, and `CachedView` have been removed. The scientific
calculations in the display modules remain application code. The simulator
retains its separate WebGL implementation and textures.

## Updates and disposal

Call `RenderSurface.resize(width, height)` to request backing-pixel dimensions, then
`RenderSurface.beginFrame`, update its view, and let the scheduled render present the frame.
The visible canvas is resized only when that frame commits; callers must not assign its width or
height before rendering, because that would clear the previous frame while React is preparing the next.
Native parent containers own transforms and opacity. Opacity changes that affect only later
marks must be assigned to those marks or a dedicated child, not to their shared parent.

Call `RenderSurface.destroy()` when retiring a surface; disposal also works during initialization.
Page exit destroys surfaces, while the browser's back-forward cache preserves them.

## Verification

Scene tests and their shared helper live in `test/draw/scene/`.

`npm test` checks scientific calculations, raster appearance, retained-object updates, transforms,
tooltip bounds and resource disposal. `npm run test:e2e` exercises the served production app,
including zoom, dragging, DPR, toolbox tooltips, forge and the enlarged Bloch view.
`npm run test:perf` measures the established 16-qubit scene update as well as simulation cases;
the scene test measures simulation and frame-description cost, excluding React commit and GPU presentation.
