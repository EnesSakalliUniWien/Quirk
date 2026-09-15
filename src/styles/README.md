# Stylesheet responsibilities

`globals.css` is the global CSS entry point imported by `src/main.jsx`.

| Directory | Responsibility |
| --- | --- |
| `foundation/` | Scoped resets, document defaults, native elements and focus styles. |
| `shell/` | App sizing, toolbar, Dockview layout, motion preferences and error banner. |
| `ui/` | Shared buttons, popup menus and HTML canvas sizing. |
| `circuit/` | Circuit viewport, zoom controls, minimap and gutter editors. |
| `gates/` | Gate details and the toolbox, including search, groups and tiles. |
| `math/` | MathML matrices, data views, operator controls and math entry fields. |
| `panels/` | Styles named for their panel: state, Bloch, Tape, export and others. |
| `panels/shared/` | Panel frames, sections, debug headings and responsive rules. |
| `panels/algebra/` | Algebra steps and the evolution chart. |
| `panels/probabilities/` | Probability chart sizing and ket labels. |
| `panels/forge/` | Gate construction and operation previews. |

## Import order

`layers.css` establishes `base, components` before any rules. HTML CSS Module entry points
also import it first; `src/components/toolbar/transport-bar.module.css` is an example.
Keep CSS Modules beside the HTML components that import them.

The order in `globals.css` preserves the existing cascade, including rules that span
directories. Do not alphabetize its imports or replace them with a directory glob.
For example, `panels/shared/responsive.css` precedes the Forge-specific layout,
and `math/matrices.css` follows the earlier gate-details and algebra styles.
`shell/layout.css` follows the feature styles so its shell and motion rules take precedence.
Dockview, popup menu and shared canvas sizing rules retain their unlayered precedence.

## Appearance and rendering

CSS consumes the properties supplied by `src/browser/theme/`; shared appearance values
belong to `src/appearance/`. These stylesheets position HTML elements, including canvas
containers. Drawing, transforms and clipping inside a canvas belong to the renderer.

Place a rule with the feature or shared element it styles. Keep its media and container
queries with it. Update imports and source references when moving a stylesheet.
