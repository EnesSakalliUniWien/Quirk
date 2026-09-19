# Light Mode Implementation Plan — Shadow-Quant

**Status:** Draft v2
**Scope:** Add a light colour palette and a startup scheme selector. Dark remains the default. Switching is by page reload.
**ES6+ mandate:** All code in this plan uses `const`/`let` (never `var`), arrow functions, `async`/`await` (never callback patterns or `.then` chains), named exports from ES modules, and the Fetch API for any network operation (none currently exists in the app; if one is introduced, it replaces `XMLHttpRequest`).

---

## Phase 0 — Baseline

**Goal:** Establish a known-good state before any changes.

| # | Milestone | Technical requirement |
|---|-----------|----------------------|
| 0.1 | Record test results | Run `npm test` and `npm run test:e2e`; confirm both pass. Save output for comparison. |
| 0.2 | Snapshot palette state | Commit current `src/appearance/colours.js` so the dark palette is the unchanged baseline. |

---

## Phase 1 — Split Palette Into Scheme-Specific Files

**Goal:** Each scheme has its own colour file with identical keys. No importer changes in this phase.

### 1.1 Move dark palette to `src/appearance/colours/dark.js`

- Copy the current contents of `src/appearance/colours.js` (including uncommitted changes: `stroke.logRing`, `probability.bar`, `amplitude.circle` update) verbatim into `src/appearance/colours/dark.js`.
- Keep the file's structure: `surface`, `text`, `iqp`, `stroke`, `gate`, `probability`, `amplitude`, `operation`, `bloch`, `interaction`, `error`, `ui`, `tape`, `transparent`, each frozen via `Object.freeze` and `colour()` factory.
- Add an `iqpText` map next to `iqp` with keys `hadamard`, `not`, `rotation`, `phase`, `measure` — all set to `text.onBright` for dark (preserving current behaviour where every gate label is on a bright background):

  ```js
  const iqpText = Object.freeze({
      hadamard: text.onBright,
      not: text.onBright,
      rotation: text.onBright,
      phase: text.onBright,
      measure: text.onBright,
  });
  ```

- Include `phase: Object.freeze({lightness: 0.75, chroma: 0.12})` and `colorScheme: 'dark'` at the file level (or inside a metadata record).

### 1.2 Create light palette at `src/appearance/colours/light.js`

- Same structure and same keys as `dark.js`. Every role present in dark must appear in light.
- **Surfaces:** `ui.background` → `#F4F5F7`, `surface.background` → `#FFFFFF`, `surface.quiet` → `#FFFFFF`, `surface.gate` → `#E3E6EC`.
- **Text:** `text.primary` → `#0B0F19` (AAA on white: 19.15:1, on bg: 17.55:1), `text.default` → `#1A1F2B` (AAA), `text.muted` → `#4A5263` (AAA: 7.84 on white, 7.19 on bg, 6.27 on gate fill).
- **Lines/marks (3:1 non-text target):** `stroke.grid` → `#7C8494` (3.76 white / 3.45 bg), `stroke.guide` → `#5E6675` (5.78 / 5.30), `stroke.bright` → `#2E3440` (12.49 / 11.45), `iqp.classicalWire` → `#778899` (3.64 / 3.34).
- **Gate colours** (Qiskit light iqp.json pairs): H fill `#FA4D56` label `#000000` (6.26), NOT/Swap fill `#002D9C` label `#FFFFFF` (11.32), Rotation fill `#9F1853` label `#FFFFFF` (7.69), Phase fill `#33B1FF` label `#000000` (8.87), Measure fill `#A8A8A8` label `#000000` (8.83). `iqpText` for each gate uses the label colour above.
- **Data displays:** `probability.fill` → `#15803D`, `probability.bar` → `#166534`, `amplitude.circle` → `#0369A1`, `amplitude.fill` → `#075985`, `operation.fill` → `#6D28D9`, highlight/playhead/outline → `#B45309`, `error.text` → `#9D174D`.
- **Bloch axes:** `axisX` → `#B84A00`, `axisY` → `#00806E` (use marks only, 4.46 on bg), `axisZ` → `#6A3D9A`.
- **Phase wheel:** `phase: {lightness: 0.55, chroma: 0.12}` (≥4.40 vs white; dark's 0.75 would drop to 2.11).
- **Tape colours (order preserved):** `#007C99`, `#B35900`, `#3F7F1A`, `#8E44AD`, `#C0392B`, `#00796B`, `#8A6D00`, `#4F5FD6` (4.83–5.87 on white).
- **Semi-transparent `ui.*` tokens:** Provide light-tuned values for all 16: `tableDivider`, `brandSurface`, `brandBorder`, `brandGlow`, `panelGlow`, `panelOptionSurface`, `panelOptionBorder`, `errorBorder`, `sidebarScrollbar`, `shadowPopup`, `shadowBanner`, `shadowControl`, `border`, `input`, `focusShadow`, `controlBorder`. Each must be tested for contrast after alpha-blending with `#FFFFFF`.

### 1.3 Refactor `src/appearance/colours.js` into a re-export hub

- Replace `src/appearance/colours.js` contents with named re-exports:
  ```js
  export { dark } from './colours/dark.js';
  export { light } from './colours/light.js';
  ```
- This preserves any external import path `src/appearance/colours.js` while delegating to scheme-specific files.

### 1.4 Verify schema parity

- Write a one-time assertion (can be in a temporary script or test) that `Object.keys(dark)` deep-equals `Object.keys(light)` for every top-level group (`surface`, `text`, `iqp`, `stroke`, `gate`, `probability`, `amplitude`, `operation`, `bloch`, `interaction`, `error`, `ui`, `tape`, `transparent`).
- Verify `dark.tape.length === 8` and `light.tape.length === 8`.

**Milestone:** Both palette files exist with identical key shapes, dark is unchanged, all contrast ratios calculated (not estimated).

---

## Phase 2 — Scheme-Aware Appearance and Factories

**Goal:** Expose a function that selects a palette by scheme, and make every theme-mapping module factory-based. The singletons importers use (`Appearance`, `CanvasTheme`, `Theme`) keep their names and follow the scheme chosen at startup, so 69 importers are unaffected.

### 2.1 Create `src/appearance/colourScheme.js`

A pure data module — no browser APIs, no DOM access. It holds a palette name only; the browser resolves a `'system'` preference before setting it (§3.1):

```js
let scheme = 'dark';

export function setColourScheme(next) {
    if (next !== 'light' && next !== 'dark') {
        throw new RangeError(`Unknown colour scheme: ${next}`);
    }
    scheme = next;
}

export function colourScheme() {
    return scheme;
}
```

### 2.2 Refactor `src/appearance/Appearance.js`

- Add `appearanceFor(scheme)`, which returns the full appearance record for `'dark'` or `'light'` and throws a `RangeError` for anything else. `phase` comes from the palette file; `opacity` is shared.
- `Appearance` becomes `appearanceFor(colourScheme())`, so importers see the scheme chosen at startup (dark by default, and in tests and workers).
- No browser APIs in this module: resolving `'system'` belongs to `src/browser/colourSchemePreference.js`.

```js
import {dark, light} from './colours.js';
import {Typography} from './typography.js';
import {Spacing} from './spacing.js';
import {Borders} from './borders.js';
import {setColourScheme, colourScheme} from './colourScheme.js';

const palettes = {dark, light};
const opacity = Object.freeze({forgeRange: 0.08, ghostHover: 0.5, focus: 0.5, matrixActive: 0.22, operatorControl: 0.05});

export function appearanceFor(scheme) {
    if (!Object.hasOwn(palettes, scheme)) throw new RangeError(`Unknown colour scheme: ${scheme}`);
    const palette = palettes[scheme];
    return Object.freeze({colours: palette.colours, typography: Typography, spacing: Spacing, borders: Borders,
        opacity, phase: palette.phase, colorScheme: palette.scheme});
}

export const Appearance = appearanceFor(colourScheme());

export {setColourScheme, colourScheme};
```

### 2.3 Refactor `src/browser/theme/dom.js` into a factory

- Move all value reads (currently lines 5–11) inside a factory function.
- The factory `domFor(scheme)` builds the CSS custom property map by calling `appearanceFor(scheme)` and reading colours from it.
- The `--phase-legend` gradient passes `appearance.phase` to `phaseColor`, so `domFor(scheme)` depends only on its argument.
- No `dom` singleton: `Theme.js` calls `domFor(colourScheme())`.

```js
import {appearanceFor} from '../../appearance/Appearance.js';
import {colourString} from '../../appearance/formats/colour.js';
import {phaseColor} from '../../appearance/formats/phase.js';
import {Typography as typography} from '../../appearance/formats/typography.js';

export function domFor(scheme) {
    const appearance = appearanceFor(scheme);
    const background = colourString(appearance.colours.ui.background);
    const foreground = colourString(appearance.colours.ui.foreground);
    const secondary = colourString(appearance.colours.ui.secondary);
    const controlSurface = colourString(appearance.colours.ui.controlSurface);
    const brandInk = colourString(appearance.colours.ui.brandInk);
    const border = colourString(appearance.colours.ui.border);
    const primary = colourString(appearance.colours.ui.primary);

    return Object.freeze({
        "--forge-range-fill": `color-mix(in srgb, ${foreground} ${appearance.opacity.forgeRange * 100}%, transparent)`,
        "--border-width": `${appearance.borders.width.regular}px`,
        // ... all remaining properties, reading from appearance.colours instead of Appearance.colours
        "--phase-legend": `linear-gradient(to right, ${Array.from({length: 9}, (_, i) => phaseColor(-180 + i * 45, 1, appearance.phase)).join(', ')})`,
        "--background": background,
        "--foreground": foreground,
        // etc.
    });
}
```

### 2.4 Refactor `src/browser/theme/dock.js` into a factory

- `dockPropertiesFor(scheme)` calls `domFor(scheme)` and builds the Dockview property map.
- No `dockProperties` singleton: `Theme.js` calls `dockPropertiesFor(colourScheme())`.

### 2.5 Refactor `src/draw/theme/CanvasTheme.js` into a factory

- `canvasThemeFor(scheme)` maps `appearanceFor(scheme).colours` to string values via `colourString`.
- Keep the `CanvasTheme` export as `canvasThemeFor(colourScheme())`.
- **Critical:** `GateRenderers.js:77` does `CanvasTheme.surface.gate` at module import. This works because the scheme is set before any theme module evaluates (§3.2) and switching reloads the page.

### 2.6 Refactor `src/appearance/formats/phase.js` into a factory

- `phaseRgb(degrees, phase = Appearance.phase)` and `phaseColor(degrees, alpha = 1, phase = Appearance.phase)` take a scheme's `phase` settings, defaulting to the active scheme's.
- Existing callers pass only degrees and keep the active scheme's wheel; scheme-specific mappings such as `domFor` pass `appearanceFor(scheme).phase`.

### 2.7 Update `src/config/Theme.js` to be scheme-aware

- Import `colourScheme` from `appearance/colourScheme.js`.
- Build `Theme` dynamically: `Theme = {colorScheme: colourScheme(), dom: domFor(colourScheme()), dockProperties: dockPropertiesFor(colourScheme()), canvas: canvasThemeFor(colourScheme()), ...}`.
- This ensures `applyTheme.js` (which reads `Theme.colorScheme`, `Theme.dom`, `Theme.dockProperties`) writes the correct values for whichever scheme was selected at startup.

### 2.8 Update `gateStyle.js` for per-gate labels

- Change `gateStyle` to read label colour from `CanvasTheme.iqpText[id]` instead of always `CanvasTheme.text.onBright`.
- For dark (current), all `iqpText` values are `text.onBright` — no visual change.
- For light, each gate gets its prescribed label colour from the light palette.

```js
const id = gate.serializedId || "";
const p = CanvasTheme.iqp;
const label = CanvasTheme.iqpText[id] ?? CanvasTheme.text.primary;
// ... fill selection unchanged ...
return {fill, text: label};
```

**Milestone:** `appearanceFor(scheme)`, `domFor(scheme)`, `dockPropertiesFor(scheme)` and `canvasThemeFor(scheme)` exist, and `phaseRgb`/`phaseColor` accept a scheme's `phase`. `Appearance`, `CanvasTheme` and `Theme` read the active scheme at import.

---

## Phase 3 — Bootstrap and Preference

**Goal:** Choose the scheme before any theme module evaluates, and let users toggle it.

### 3.1 Create `src/browser/colourSchemePreference.js`

Manages the persisted preference: `'system'`, `'light'` or `'dark'`. With nothing valid saved, or storage refused, the preference is `'dark'`, so the app starts dark. Only the `'system'` preference consults `matchMedia`, and it resolves to dark when the browser can't answer:

```js
const STORAGE_KEY = 'shadow-quant.colour-scheme';
const PREFERENCES = ['system', 'light', 'dark'];

export function readColourSchemePreference() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (PREFERENCES.includes(stored)) return stored;
    } catch {
        // Private browsing or storage disabled — fall through to the default
    }
    return 'dark';
}

export function resolveColourScheme(preference) {
    if (preference !== 'system') return preference;
    try {
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

export function writeColourSchemePreference(preference) {
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    } catch {
        // Silently ignore — preference is best-effort
    }
}
```

A change to the OS setting while the app is open applies on the next load.

### 3.2 Create `src/boot.js`

Entry point loaded from `index.html`. Static imports evaluate in order, so `selectColourScheme.js` sets the scheme before `main.jsx` loads any theme module. A dynamic `import('./main.jsx')` would delay mounting, and the e2e harness's `waitForQuirk` fails while `#inspectorDiv` doesn't exist yet:

```js
import './browser/selectColourScheme.js';
import './main.jsx';
```

`src/browser/selectColourScheme.js`:

```js
import {setColourScheme} from '../appearance/colourScheme.js';
import {readColourSchemePreference, resolveColourScheme} from './colourSchemePreference.js';

setColourScheme(resolveColourScheme(readColourSchemePreference()));
```

### 3.3 Update `index.html`

Change the script tag from `/src/main.jsx` to `/src/boot.js`. `applyTheme.js` requires no changes — it reads from `Theme.js`, which is now scheme-aware.

### 3.4 Add colour scheme toggle to toolbar

Create `src/components/toolbar/colour-scheme-menu.jsx`:

- A `Button` with `data-slot="button"` (so the toolbar's `useRovingTabIndex` in `app-toolbar.jsx:46` includes it in arrow-key navigation).
- `aria-label` naming the saved preference (e.g., `"Colour scheme: dark. Open menu to change."`).
- Uses `Menu.Root / Menu.Trigger / Menu.Portal / Menu.Positioner` modelled on `ExamplesMenu` (`src/components/toolbar/examples-menu.jsx`).
- Menu items are Dark, Light and System, using `menuitemradio` role with `aria-checked` on the saved preference.
- On selection: call `writeColourSchemePreference(preference)`, then `location.reload()`.
- Import `readColourSchemePreference` and `writeColourSchemePreference` from `browser/colourSchemePreference.js`.

Insert `<ColourSchemeMenu />` in `app-toolbar.jsx` between `ExamplesMenu` and the first `PanelButton`.

**Milestone:** Page loads dark with nothing saved, or with the saved preference (System follows the OS); toggle saves preference and reloads; arrow keys reach the button.

---

## Phase 4 — Third-Party Styling Audit

**Goal:** Ensure Dockview, Base UI, and MathLive render correctly under light mode.

| # | Check | Action |
|---|-------|--------|
| 4.1 | Dockview theming | Dockview CSS has no `.dark` references (verified). Verify `--dv-*` variables from `dockPropertiesFor('light')` produce visible tabs, sashes, and panels on white background. Run `npm run test:e2e` with light preference and inspect dock panels. |
| 4.2 | Base UI popups | Base UI popups inherit CSS variables from `:root`. Verify Menu, Tooltip, and Popover components use `--popover`, `--popover-foreground`, `--background` correctly. |
| 4.3 | MathLive | `src/components/math/math-field.jsx` renders a `math-field` element. Confirm it inherits colour from CSS variables (not hardcoded). If MathLive uses its own colour tokens, pass them via inline `style` props derived from `domFor(scheme)`, never via CSS overrides. |
| 4.4 | `.dark` class | `applyTheme.js:17` sets `classList.toggle('dark', ...)`. Verify Dockview and Base UI components still render correctly with or without the `.dark` class on `<html>`. |

**Milestone:** All third-party components visually verified in both schemes.

---

## Phase 5 — Testing and Validation

### 5.1 Install validation libraries

```bash
npm install --save-dev culori@4.0.2 axe-core@4.13.0 @axe-core/puppeteer@4.13.0
```

### 5.2 Unit tests

**Update `test/config/Appearance.test.js`:**
- Assert `appearanceFor('dark').colours` and `appearanceFor('light').colours` each contain all expected top-level keys.
- Assert `appearanceFor('light').colours.tape.length === 8`.
- Assert `appearanceFor('dark').colourScheme === 'dark'` and `appearanceFor('light').colourScheme === 'light'`.

**Create `test/config/Contrast.test.js`:**

Use `culori` functions (`wcagContrast`, `differenceEuclidean('oklab')`, `filterDeficiencyProt/Deutan/Trit`) to verify:

| Test | Requirement |
|------|-------------|
| Text contrast | Every text/background pair ≥ 4.5:1. Every AAA-claimed pair ≥ 7:1. |
| Non-text contrast | Every mark/background pair ≥ 3:1. |
| Palette parity | `Object.keys(dark)` ≡ `Object.keys(light)` at every nesting level. |
| Colour-blind separation (ΔE×100, Machado 2009, full severity) | Probability/amplitude/operation/highlight/error group ≥ 10. IQP gates ≥ 10. Bloch axes ≥ 10. Tape < 10 (documented as requiring non-colour cue). |
| Semi-transparent tokens | Blended colour (alpha over `#FFFFFF`) ≥ 3:1 against white for non-text uses, ≥ 4.5:1 for text uses. |

### 5.3 E2E tests

**Update `test_e2e/theme.test.js`:**

The current test asserts `Theme.dom["--card"]` from the Node import. Since `Theme.js` now reads `colourScheme()` at import and the Node default is `'dark'`, dark-mode tests continue as-is. For light-mode tests:

- Add a second test block that runs `withQuirkPage` with `page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'light'}])` and `page.evaluateOnNewDocument(() => localStorage.setItem('shadow-quant.colour-scheme', 'light'))`.
- Assertions must compare against the **page-computed** values, not the Node-side `Theme` singleton (which stays dark). Example:
  ```js
  const lightCard = await page.evaluate(() => document.documentElement.style.getPropertyValue('--card'));
  assert.notEqual(lightCard, Theme.dom['--card']); // Must differ from dark
  ```
- Verify gate chip colours match `appearanceFor('light')` expectations.
- Verify the toggle menu exists, has `menuitemradio` items, and selecting a scheme triggers a reload.

**AXE accessibility audit:** Inside `withQuirkPage`, run:
```js
import axe from 'axe-core';
import {axeCore} from '@axe-core/puppeteer';
await axeCore(page).analyse({runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}});
```
Run once per scheme.

### 5.4 Visual checks

**Extend `scripts/screenshot-circuit.js`** with `--scheme` and `--vision` flags:
- `--scheme light|dark` → set localStorage preference before load.
- `--vision normal|protan|deutan|tritan` → call `page.emulateVisionDeficiency(...)` before load.
- Review example circuits in each combination.

### 5.5 Full suite

`npm run check` must pass with dark mode unchanged: `npm run lint && npm run knip && npm run test && npm run test:e2e`.

**Milestone:** All tests pass in both schemes. Axe reports zero WCAG 2.1 AA violations. Colour-blind separation thresholds verified programmatically.

---

## Phase 6 — Documentation and Cleanup

| # | Task |
|---|------|
| 6.1 | Update `src/appearance/README.md`: document `appearanceFor(scheme)`, `colourScheme()`, the palette file structure, and that `Appearance` remains the dark singleton. |
| 6.2 | Update `src/config/README.md`: document that `Theme.js` reads the active scheme at import, list `boot.js` as the entry point, note reload-based switching. |
| 6.3 | Run `npm run knip` — remove any unused exports now that factories exist alongside singletons. |
| 6.4 | Run `npm run lint` — fix any ESLint errors. |

**Milestone:** Docs current, knip clean, lint clean.

---

## Known Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Reloading drops floating panels (saveLayout strips them). | Confirm undo history and playhead survive via existing persistence. Add user warning before reload if floating panels are open (extend `dock.jsx` saveLayout callback). |
| Values read at import (`dom.js:5-11`, `GateRenderers.js:77`, `tape/colours.js:3`, `phase.js:18`) cache dark values. | Reload-based switching re-executes the module graph with the new scheme. Do not implement live switching until all import-time reads are replaced with dynamic lookups. |
| Semi-transparent `ui.*` tokens tuned for dark may be invisible or muddy on light. | Phase 5.2 includes blended-contrast tests for all 16 tokens. |
| `Theme.js` in Node tests defaults to dark. | `theme.test.js` dark assertions continue unchanged. Light-mode assertions use page-computed values, not the `Theme` singleton. |
| ΔE of 10 threshold is a project rule, not WCAG. | Documented in §5.2. WCAG thresholds (4.5:1 text, 3:1 non-text) are enforced separately. |

---

## ES6+ Conventions Applied Throughout

| Pattern | Rule |
|---------|------|
| Variable declarations | `const` for bindings that never reassign; `let` for counters, flags, and loop variables. Never `var`. |
| Functions | Arrow functions for all callbacks and short utilities. Named functions only for recursive or hoisted declarations. |
| Async control flow | `async`/`await` exclusively. No `.then()` chains, no callback parameters. |
| Modules | Named ESM exports (`export function`, `export const`). Default exports only for React components. |
| Object construction | Object shorthand properties, `Object.freeze` for immutable records, spread for merging. |
| Error handling | `try`/`catch` with specific error types; `finally` for cleanup (e.g., browser close, server close). |
| Network requests | Fetch API only (none currently needed; would replace any future `XMLHttpRequest`). |
