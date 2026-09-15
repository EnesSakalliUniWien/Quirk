# Shared appearance

`Appearance.js` exports immutable, serializable data. It imports only the files in this directory;
it does not import Pixi, React, browser APIs, stylesheets, or circuit geometry.

| Definition | Representation |
| --- | --- |
| `colours.js` | sRGB `{r, g, b, alpha}` records; channels 0–255 and alpha 0–1 |
| `typography.js` | font-family names, logical sizes and weights |
| `spacing.js` | shared distances in logical pixels |
| `borders.js` | border widths and corner radii in logical pixels |
| `Appearance.phase` | phase-wheel lightness and chroma |
| `Appearance.opacity` | opacity of shared appearance states |

Change these definitions to change shared appearance. Colour roles for probability, amplitude,
phase, operators, axes, errors and interaction remain distinct. Tape colour indices retain their order.

## Consumption

- `formats/` converts data to supported representations: colour strings, font-family strings and
  the phase scale. These functions contain no renderer objects or browser queries.
- `draw/theme/CanvasTheme.js` maps the shared colours to the existing drawing API. It contains no
  Pixi dependency. `config/CanvasTheme.js` preserves the drawing import path without importing DOM mappings.
- `browser/theme/dom.js` produces CSS variables and CSS-only compositions such as gradients.
- `browser/theme/dock.js` maps the browser variables to Dockview's property names.
- `browser/applyTheme.js` applies those properties before React mounts. `config/Theme.js` is the
  browser-facing compatibility aggregate, not the source of appearance definitions.
- HTML components may use CSS Modules, as `components/toolbar/transport-bar.module.css` does.
  CSS Modules must not be imported by appearance, simulation or drawing modules.
  HTML stylesheet entry points import `styles/layers.css` first so module loading cannot reorder
  the base and component layers.

## Renderer responsibilities

Circuit layout stays in `config/Layout.js` and `editor/geometry/`. It derives shared distances from
`Appearance.spacing`; wire locations, matrix cell dimensions and other geometry are implementation.
Drawing, transforms, clipping, hit testing and interaction stay in their existing draw/editor modules.
The renderer converts logical border widths to screen widths according to zoom and device resolution.

A future renderer can import `Appearance.js` directly, including in a worker, and use the numeric
colour channels and sizes. It can replace the drawing implementation without changing this data or
reading CSS variables from the document. Computational WebGL texture channels are simulation data;
they are not UI colour assignments.

The configuration tests cover serialization, immutability and shared units. The browser theme tests
check import boundaries, CSS ownership, startup application and matching HTML/canvas colours.
