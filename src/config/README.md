# Shared configuration

These modules contain dependency-light settings and example data. Fixed settings are frozen;
change their definitions and reload the app instead of mutating them at runtime.

- `AppInfo.js`: application title and serialized circuit URL parameter.
- `Layout.js`: circuit dimensions and minimum displayed column count. Derived dimensions are
  calculated before freezing the object so they stay consistent with `UNIT`.
- `Simulation.js`: wire limits and simulation time constants.
- `Playback.js`: the playhead's time per column.
- `Rendering.js`: redraw cooldown and the amplitude drawing detail threshold.
- `Diagnostics.js`: intentionally mutable WebGL debugging switch. `test/TestUtil.js` enables
  hot-path checks for the entire browser test environment; do not freeze this switch.
- `exampleCircuits.js`: named serialized circuits for the examples menu. The array, entries and
  nested circuit data are frozen. The menu commits JSON text, so editing uses deserialized data.
- `Theme.js`, `CanvasTheme.js`, `Typography.js`: compatibility import paths for appearance mappings.

`test/config/` covers theme conversion and example deserialization through the gate catalogue.

## Theme assignments

`appearance/Appearance.js` owns renderer-independent colours, typography, spacing and border widths.
See `appearance/README.md` for units and ownership. The `Theme.js` module aggregates the mappings
for browser consumers; it contains no appearance values. The phase legend and scientific displays
continue to use the same phase conversion.

`browser/applyTheme.js` assigns the DOM and Dockview properties to the document before React
mounts. Floating panels and body-level popovers inherit those assignments. It also assigns the
browser colour scheme and theme-colour metadata. Stylesheets consume the assigned properties
for layout and interaction states; they do not define theme values or override a stock theme.

`CanvasTheme.js` and `Typography.js` keep the existing drawing import paths without loading browser mappings.
The canvas, toolbox chips and drag previews use the same `gateStyle()` function. Tape keeps its
saved numeric colour indices; their presentation values come from `Theme.tape`.
