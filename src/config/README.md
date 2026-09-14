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
- `Theme.js`, `CanvasTheme.js`, `Typography.js`: shared theme definitions and their import paths.

`test/config/` covers theme conversion and example deserialization through the gate catalogue.

## Theme assignments

`Theme.js` defines the application's theme values: canvas colours, gate assignments, DOM
surfaces and controls, fonts, Dockview properties and Tape colours. Change values there and
reload the app. Related DOM and canvas roles read the same value; the phase legend is generated
from the same `phaseColor()` function as the scientific displays.

`browser/applyTheme.js` assigns the DOM and Dockview properties to the document before React
mounts. Floating panels and body-level popovers inherit those assignments. It also assigns the
browser colour scheme and theme-colour metadata. Stylesheets consume the assigned properties
for layout and interaction states; they do not define theme values or override a stock theme.

`CanvasTheme.js` and `Typography.js` keep the existing canvas import paths and read `Theme.js`.
The canvas, toolbox chips and drag previews use the same `gateStyle()` function. Tape keeps its
saved numeric colour indices; their presentation values come from `Theme.tape`.
