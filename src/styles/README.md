# Stylesheet responsibilities

`globals.css` is the global CSS entry point imported by `src/main.jsx`.

| Directory | Responsibility |
| --- | --- |
| `foundation/` | Scoped resets, document defaults, native elements, focus styles and text for assistive technology only. |
| `shell/` | App sizing, toolbar, Dockview layout, motion preferences and error banner. |
| `ui/` | Shared buttons, popup menus and HTML canvas sizing. |
| `circuit/` | Circuit viewport, zoom controls, minimap, gutter editors, the dial on a rotation gate's wire, the selection's bar, the keyboard's cell cursor and the empty circuit's hint. |
| `gates/` | Gate details and the toolbox, including search, groups and tiles. |
| `math/` | MathML matrices, data views, operator controls and math entry fields. |
| `panels/` | Styles named for their panel: state, Bloch, Tape, export and others. |
| `panels/shared/` | Panel frames, sections, debug headings and responsive rules. |
| `panels/algebra/` | Algebra steps and the evolution chart. |
| `panels/probabilities/` | The step trace: layout tabs, step headers, cells and their marks. |
| `panels/forge/` | Gate construction and operation previews. |

## Import order

`layers.css` establishes `base, components` before any rules. HTML CSS Module entry points
also import it first; `src/components/toolbar/transport-bar.module.css` is an example.
Toast styles live in `src/components/ui/toasts.module.css` and retain their unlayered precedence.
Keep CSS Modules beside the HTML components that import them.

The order in `globals.css` preserves the existing cascade, including rules that span
directories. Do not alphabetize its imports or replace them with a directory glob.
For example, `panels/shared/responsive.css` precedes the Forge-specific layout,
and `math/matrices.css` owns shared MathML rules after the algebra styles.
`shell/layout.css` follows the feature styles so its shell and motion rules take precedence.
Dockview, popup menu and shared canvas sizing rules retain their unlayered precedence.

## Appearance and rendering

CSS consumes the properties supplied by `src/browser/theme/`; shared appearance values
belong to `src/appearance/`. These stylesheets position HTML elements, including canvas
containers. Drawing, transforms and clipping inside a canvas belong to the renderer.

Place a rule with the feature or shared element it styles. Keep its media and container
queries with it. Update imports and source references when moving a stylesheet.

## CSS checks

With Stylelint available on `PATH`, run `stylelint "src/**/*.css"` from the repository root.
The root `.stylelintrc.json` checks invalid properties, duplicate selectors and declarations,
and shorthand overrides. Consecutive different-value fallbacks such as `100vh` then `100dvh`
are intentional. The check is optional tooling; `npm run check` remains self-contained.

PurgeCSS and browser coverage identify removal candidates, not proof of unused CSS.
Keep runtime Bloch axis classes, Base UI state attributes, Dockview selectors, and focus rules
unless their consumers have also been removed. Check theme, viewport, keyboard, and panel
states before deleting rules. PostCSS and JavaScript codemods can move styles with an explicit
component ownership map; CSS Modules then scope their class names.
