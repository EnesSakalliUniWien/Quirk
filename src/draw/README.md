# Rendering responsibilities

Canvas colours come from `src/config/Theme.js` through the `CanvasTheme.js` entry point. Native Pixi objects receive fill,
stroke, alpha and text properties in JavaScript. CSS styles the surrounding HTML controls.

## Directory layout

| Directory    | Responsibility                                                                                                 | Files                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `surface/`   | Canvas and Application lifecycle, frame submission, the renderer shared by surfaces that copy their pixels out | `RenderCanvas.jsx`, `RenderSurface.js`, `SharedRenderer.js`, `SharedPaintSurface.js`, `applicationOptions.js` |
| `scene/`     | React scene descriptions, reconciliation and committed rendering                                               | `DisplayView.js`, `ReactScene.js`                                                                             |
| `shapes/`    | Shape primitives and path construction                                                                         | `ShapeView.js`, `PathGeometry.js`                                                                             |
| `text/`      | Text measurement, fitting and label descriptions                                                               | `TextLayout.js`, `LabelView.js`, `BasisLabels.js`                                                             |
| `tooltips/`  | Tooltip content, positioning and overlay descriptions                                                          | `TooltipView.js`, `MatrixTooltip.js`                                                                          |
| `displays/`  | Scientific displays grouped by Bloch, amplitude, density, complex-cell and probability responsibilities        | See [display responsibilities](displays/README.md)                                                            |
| `gate/`      | Gate grouping, frames, symbols and custom-gate rendering                                                       | Existing gate modules plus `GateView.js`                                                                      |
| `renderers/` | Shared data renderers, operator tiles and raster generation                                                    | Existing renderer modules                                                                                     |

`displays/complex/MatrixView.js` owns complex matrix rendering, and its sibling `ComplexCellGeometry.js`
owns shared amplitude marks. `displays/probability/ProbabilityView.js` owns probability displays,
and `displays/bloch/BlochGeometry.js` owns the Bloch projection axes.
`tooltips/MatrixTooltip.js` maps matrix cells to tooltip content. Circuit viewport coordination lives in
[`src/app/canvas/CircuitViewport.js`](../app/canvas/CircuitViewport.js); circuit composition remains in
[`src/editor/rendering/`](../editor/rendering/README.md). Editor interaction output lives in
[`src/editor/interaction/CircuitTargets.js`](../editor/interaction/CircuitTargets.js).

## Ownership

- `RenderCanvas` declares a presentation element around `@pixi/react`'s `Application`. React owns the canvas attributes and Application,
  reconciliation and scene-object disposal. `RenderSurface` submits frame descriptions through
  a Zustand store and waits for their committed render. Pixi's automatic ticker stays off.
- A surface made for a canvas without an Application of its own - the Bloch figures, the minimap, the
  panels' data views - copies its pixels out. All such surfaces share one renderer and so one WebGL
  context (`SharedRenderer`): a hidden `Application` with Pixi's `multiView`, whose stage holds each
  surface's scene as a container of its own, mounted and reconciled by React like any other. A frame
  request draws only that container, with `renderer.render({container, target: canvas})`, into the 2D
  canvas the page shows, in the commit that resized it, so a cleared canvas is never presented.
  Disposing a surface frees its scene alone; the last surface to go takes the renderer with it, and the
  next one starts a new one. Browsers keep few contexts alive (Chrome 16, Android 8) and drop the least
  recently used, and every context duplicates its textures, shaders and fonts. The visible circuit and
  the circuit figures keep an `Application` each (`RenderCanvas`).
- Every copy out of the shared renderer costs the GPU a snapshot of the whole of the context's canvas,
  with a cost of its own (about a millisecond on the machines measured) and a smaller one for each
  pixel; Pixi's `multiView` takes one for each canvas drawn into and offers no way to copy a part.
  So the number of frames drawn matters more than their sizes, and a panel should draw only what
  can be seen (below). The context's canvas only grows to the largest canvas drawn into, so a
  megapixel or more of it is given back once the frames being drawn need a quarter of it
  (`SharedRenderer.fitToFrames`); below that it is left alone, because resizing it costs more than
  the copies it would save. Drawing several scenes into rectangles of one canvas (an atlas) and copying
  them out together does cut the snapshots to one, but Pixi rounds the positions of labels
  (`roundPixels`) to the grid of the whole render target, not of the rectangle, and a rectangle
  away from the origin moves the vertices by rounding error of its own, so the pictures come out
  a few pixels different from those drawn alone; the surfaces draw one canvas at a time.
- `paintInto` (`SharedPaintSurface`) is how a panel paints a scene into its canvas. Each canvas has a
  surface, hence a scene, of its own, so a panel that repaints reuses its Pixi objects whichever other
  panel painted in between. A panel does not say when its canvas goes, so a scene whose canvas has
  left the page is freed at the next painting. A panel with many such canvases - the Algebra panel
  has two for each of its steps - paints one only while it is on screen (`useOnScreen`, in
  `components/panels/shared`): it is in the viewport and not clipped away by a scroller around it, and
  its dock panel is showing. A canvas that comes into view paints the data it now holds, once.
- `src/app/canvas/CircuitViewport.js` applies viewport position and passes editor state and existing simulation results
  into `editor/rendering/InspectorRendering.js`, which composes the background, circuit and held gate.
  `CircuitRendering` supplies the circuit-specific rendering inputs.
- `DisplayView` describes React elements. Named keys preserve layer and gate identity; unnamed
  marks use their occurrence within that owner. It does not own a Pixi child registry. Its container
  adapter enables Pixi's recursive disposal when React removes a subtree. Scientific drawing callers
  still use `add` and `group`; React components can supply elements directly. Coordinate conversion
  uses the committed native container. There is no separate `finish` step.
- Gate callers import frames from `gate/GateFrame.js`, symbols from `gate/GateSymbol.js`,
  composed renderers from `gate/GateRenderers.js`, the time dial from `gate/TimeDial.js` and
  rectangle helpers from `gate/GateRects.js`. The time dial is a badge 16 units across on its
  gate's top-right corner (`dialPlacement`), the same in the circuit, held and previewed, so it
  belongs to its gate and the gap after the gate stays the wire's; a gate switched off draws none.
- `GateView` groups a gate's description. `GateRenderParams.withPainter` supplies that description
  while preserving gate-context access.
- `GateLabel` arranges symbol and angle-label rows inside their existing gate rectangles with one pure
  function, `layoutGateLabel`: rows stacked and centred, runs centred in their rows, text scaled down
  to fit its box and never up. It reproduces what a flexbox layout (Pixi Layout, and its Yoga engine) gave
  these labels, snapping boxes to whole units as Yoga did, so labels stayed where they were.
  `GateSymbol` owns notation parsing and preferred font sizes; `GateLabel` owns row and text-run positioning.
  Long unbreakable labels still scale down to fit. Frames, circuit positions and hit areas keep their existing owners.
  A label is plain label views in the gate's own container, positioned by numbers, so a frame needs no layout
  pass before tooltip placement or rendering, and offscreen surfaces need no ticker. Nothing imports
  `@pixi/layout`, so no bundle, the operator tile worker's included, carries its mixins or Yoga.
- `ShapeView` and `LabelView` are registered native Pixi primitives. React creates and removes them;
  their property setters avoid rebuilding unchanged graphics and text styles. Labels that look alike
  share one TextStyle, so Pixi shares their texture. `TextLayout` uses CanvasTextMetrics and native
  wrapping, and remembers each measurement until the fonts change. A number that changes every frame
  (`drawText`/`fitText` with `changing: true`: chances, |r| readouts, survival rates) is a bitmap label
  (`BitmapLabelView`, fonts from `BitmapFonts`), so it is not rasterised and uploaded again each frame;
  text outside the bitmap font's characters stays a canvas label. `BasisLabels` uses React containers
  directly and memoizes descriptions by inputs and fonts.
- A scroll only moves the camera (`CircuitViewport.pan`): the scene is described a viewport's width
  past each side of what is shown, and only the columns there (src/editor/rendering/columns/ColumnRange.js),
  so a scroll moves it, with the pinned wire names, and draws again. Past the described columns the
  pan refuses and the scene is described anew around the new view. Layers nothing in which takes
  the pointer are grouped with `{pointer: false}`, so Pixi skips them when it hit-tests a pointer move,
  and surfaces that only copy their pixels out have no event features at all.
- `ReactScene` renders after refs commit. Tooltip placement uses the committed source transforms
  through Pixi's `toGlobal`/`toLocal`. The tooltip overlay retains identity between updates and is
  removed when no longer requested. Rendering failures reject the submitted frame.
- `PathGeometry` only supplies grid, arrowhead and dashed-polyline calculations.
- `CircuitTargets` describes native Pixi hit areas and cursors. Scientific matrix and probability displays
  also expose native hit areas; editor Pixi pointer events provide their focus points. Matrix cell lookup
  uses row and column arithmetic with one target per matrix. Drawing and editing share `CircuitGeometry`.
- `MatrixView` lays a grid out and hands it to `MatrixCells`, which draws its marks as Pixi particles
  and redraws nothing for the same numbers. It snapshots mutable matrix buffers to detect in-place edits.
  Phase hands and logarithmic rings have independent options; the scientific magnitude and phase
  calculations remain in `ComplexCellGeometry` (see [display responsibilities](displays/README.md)).

`SceneView`, its Canvas2D-style interface, and `CachedView` have been removed. The scientific
calculations in the display modules remain application code. The simulator
retains its separate WebGL implementation and textures.

## Updates and disposal

Call `RenderSurface.beginCssFrame(width, height)` for a frame sized and drawn in CSS pixels.
It reads the current device pixel ratio each frame. For custom transforms such as circuit zoom,
call `RenderSurface.resize(width, height)` with backing-pixel dimensions, then `beginFrame` with
the drawing scale. Update the returned view and let the scheduled render present the frame.
The visible canvas is resized only when that frame commits; callers must not assign its width or
height before rendering, because that would clear the previous frame while React is preparing the next.
Native parent containers own transforms and opacity. Opacity changes that affect only later
marks must be assigned to those marks or a dedicated child, not to their shared parent.

Call `RenderSurface.destroy()` when retiring a surface; disposal also works during initialization.
A surface made with `RenderSurface.forCanvas` lives until `RenderSurface.release` for its canvas, and
holds its scene, and the shared renderer's WebGL context, until then.
Page exit destroys surfaces, while the browser's back-forward cache preserves them.

## Verification

Scene tests and their shared helper live in `test/draw/scene/`.

`npm test` checks scientific calculations, raster appearance, retained-object updates, transforms,
tooltip bounds and resource disposal. `npm run test:e2e` exercises the served production app,
including zoom, dragging, DPR, toolbox tooltips, forge and the enlarged Bloch view.
`npm run test:perf` measures the established 16-qubit scene update as well as simulation cases;
the scene test measures simulation and frame-description cost, excluding React commit and GPU presentation.
