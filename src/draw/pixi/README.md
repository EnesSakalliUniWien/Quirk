# PixiJS canvas rendering

Canvas colours come directly from `src/config/CanvasTheme.js`. Native Pixi objects receive fill,
stroke, alpha and text properties in JavaScript. CSS styles the surrounding HTML controls.

## Ownership

- `RenderSurface` owns the Pixi Application, backing-pixel scale, rendering, initialization and
  disposal. The application redraw loop schedules updates; Pixi's automatic ticker stays off.
- `CircuitScene` applies the viewport position and passes editor state and existing simulation
  results into the circuit. `CircuitPainting` updates named containers for wires, columns, gates,
  probability outputs, Bloch outputs, amplitudes and hints.
- `DisplayView` is a Pixi Container with a small child-lifetime registry. Named children preserve
  gate/layer identity; unnamed marks preserve their occurrence within that owner. Removed children
  are destroyed. It has no drawing-state stack, font state, primitive API or tooltip callbacks.
- `GateView` owns one gate occurrence. Static default symbols retain their complete geometry;
  custom and scientific drawers update from their current inputs. `GateDrawParams.withPainter`
  supplies the owner while preserving gate-context access.
- `ShapeView` updates native Graphics only when a fixed shape's geometry or colours change.
  Free-form scientific paths still rebuild through GraphicsPath. Each halo/foreground stroke
  resubmits the path because Pixi consumes a stroked path.
- `LabelView` owns a native Text. `TextLayout` contains application fitting and alignment rules,
  using CanvasTextMetrics and native word wrapping. Callers pass explicit font properties and
  named placement options. `BasisLabels` retains basis labels until their inputs or fonts change.
- `TooltipLayer` owns the final overlay order; `TooltipView` owns its content and viewport bounds.
  Pixi's toGlobal/toLocal methods convert coordinates. Flushing twice does not remove a tooltip;
  starting a new frame clears tooltips that were not requested again.
- `PathGeometry` only supplies grid, arrowhead and dashed-polyline calculations.
- `InteractionState` belongs to the editor frame. Drawing and hit testing continue to share
  `CircuitGeometry`; rendering does not redefine circuit-editing rules.

`SceneView`, its Canvas2D-style interface, and `CachedView` have been removed. The scientific
calculations in `MathPainter` and the display modules remain application code. The simulator
retains its separate WebGL implementation and textures.

## Updates and disposal

Call `RenderSurface.beginFrame`, update its view, and let the scheduled render present the frame.
Native parent containers own transforms and opacity. Opacity changes that affect only later
marks must be assigned to those marks or a dedicated child, not to their shared parent.

Call `RenderSurface.destroy()` when retiring a surface; disposal also works during initialization.
Page exit destroys surfaces, while the browser's back-forward cache preserves them.

## Verification

`npm test` checks scientific calculations, raster appearance, retained-object updates, transforms,
tooltip bounds and resource disposal. `npm run test:e2e` exercises the served production app,
including zoom, dragging, DPR, toolbox tooltips, forge and the enlarged Bloch view.
`npm run test:perf` measures the established 16-qubit scene update as well as simulation cases;
the scene test measures JavaScript update cost, not GPU presentation.
