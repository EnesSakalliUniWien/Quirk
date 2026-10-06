# Scoped critique fixes — 6 October 2026

Two GPT-6.1 Sol agents applied Ponytail full mode to the two findings from `2026-10-06T15-43-22Z__src-components-app-jsx.md`. Existing unstaged work was preserved; no commits were made.

- Bloch: one set of controls/canvases; narrow order is sphere, State source, supporting projections/layers. Wide panels retain adjacent views and controls. Existing scientific descriptions and readouts remain.
- Toolbar: Inspect owns the six readout destinations; More contains only hidden creation/parameter/export utilities. Desktop shortcuts remain.

Changed application files: `src/components/panels/bloch/bloch-panel.jsx`, `bloch-figures.jsx`, `src/styles/panels/bloch.css`, `src/components/toolbar/app-toolbar.jsx`. Updated existing regressions in `test_e2e/overlays.test.js` and `toolbar.test.js`.

## Verification

- Production build passed; existing large-chunk warning remains.
- Scoped ESLint, Prettier and diff whitespace checks passed.
- Impeccable detector over the three changed JSX files returned `[]`.
- Production E2E selection: all four toolbar tests and fourteen Bloch/related panel tests. First run passed 17/18; the new toolbar test incorrectly used the dock close helper for a floating parameter chooser. Test cleanup was corrected to click the chooser footer Close button. That test then passed against the same production build. No application change or rebuild was needed for the retry.
- Bloch responsive regression also passed at 1440×1000, 1280×720, 1024×768, 390×844 touch emulation, and 320×740 touch emulation.
- Native browser inspection confirmed desktop and 390px layouts. In the inspected 390px state the State source block begins immediately below the sphere (16px gap); supporting projections follow the source controls. More contains Gate Parameter and Export, with Create gate still directly visible.

Screenshots: `bloch-390.jpg`, `menu-390.jpg`, `bloch-1280.jpg`.

This is scoped verification, not a full repository test-suite, dark-theme, real-device, or screen-reader certification.
