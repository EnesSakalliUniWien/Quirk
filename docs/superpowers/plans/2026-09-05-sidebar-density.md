# Sidebar Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the sidebar's persistent header from 298px to ≤140px by turning the six circuit actions into one aligned icon-only ghost row, tightening the brand row, and restoring a divider before the palette.

**Architecture:** Presentation-only changes to the two render-once components (`AppToolbar`, `SidebarHeader`) and their CSS; every DOM id, the stash-adoption of `#app-toolbar-root`, and the vanilla wiring stay untouched. One shadcn primitive gains upstream's `icon` size. Spec: `docs/superpowers/specs/2026-09-05-sidebar-density-design.md`.

**Tech Stack:** React 19 render-once components, shadcn/Base UI `Button` (Tailwind 4 utilities), CSS in `src/styles/`, browser Suite (`npm test`), Puppeteer e2e (`npm run test:e2e`).

## Global Constraints

- No new dependencies; no repo-wide formatting; no DOM id changes; no edits to `src/app/*` wiring modules.
- `AppToolbar` and `SidebarHeader` keep rendering once (SidebarHeader stays a zero-prop `memo` with no state/hooks); `useRovingTabIndex` and the toolbar-root adoption code are byte-identical.
- Every action keeps its former accessible name via `aria-label` (and a `title` tooltip).
- Baselines: 844 unit / 20 e2e / 7 perf, build green. Known flaky e2e pair (Bloch undock drag, toolbox canvas-width) — re-run once if one of those alone fails; any other failure is yours.
- Branch `ui-shell-redesign`; imperative single-line commit subjects; no attribution trailers.

---

### Task 1: Icon-only action row

**Files:**
- Modify: `src/components/ui/button.jsx` (size variants)
- Modify: `src/components/app-toolbar.jsx`
- Modify: `src/styles/toolbar.css`
- Modify: `test_e2e/toolbar.test.js`

**Interfaces:**
- Produces: `Button size="icon"` (32px square); `ToolbarButton({id, icon, label, className})` rendering an icon-only button with `aria-label`/`title` = `label`.

- [ ] **Step 1: Add the icon size to the shadcn button**

In `src/components/ui/button.jsx`, the `size` map currently has only `default`. Make it:

```js
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
      },
```

Then read the base class string above the variants (the first argument to `cva`) and confirm it sizes inner SVGs (a utility like `[&_svg:not([class*='size-'])]:size-4`). If it does not, add `className="size-4"` to the `<Icon>` in Step 2 so icons render at 16px.

- [ ] **Step 2: Rewrite the toolbar as an icon row** (`src/components/app-toolbar.jsx`)

Remove the `ButtonGroup` import. Replace `ToolbarButton` and the JSX returned by `AppToolbar`:

```jsx
function ToolbarButton({id, icon: Icon, label, className}) {
    return (
        <Button id={id} size="icon" variant="ghost" className={className} aria-label={label} title={label}>
            <Icon strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
    );
}
```

```jsx
    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls" ref={toolbarRef}>
            <ToolbarButton id="export-button" icon={DownloadIcon} label="Export" />
            <ToolbarButton id="clear-circuit-button" icon={EraserIcon} label="Clear Circuit" />
            <ToolbarButton id="undo-button" icon={Undo2Icon} label="Undo" />
            <ToolbarButton id="redo-button" icon={Redo2Icon} label="Redo" />
            <ToolbarButton id="gate-forge-button" icon={WandSparklesIcon} label="Make Gate" />
            {/* Last, and pushed clear of the others by its auto margin: it discards custom gates
                as well as the circuit, and sitting flush against the rest made it easy to hit
                by mistake. Distinguished by colour, not by size. */}
            <ToolbarButton
                id="clear-all-button"
                icon={Trash2Icon}
                label="Clear All"
                className="app-toolbar-danger text-destructive" />
        </header>
    );
```

Leave `useRovingTabIndex`, `mountAppToolbar`, and the `ICON_STROKE_WIDTH` constant exactly as they are.

- [ ] **Step 3: Row styles** — replace the whole `@layer components { ... }` body of `src/styles/toolbar.css` with:

```css
    .app-toolbar {
        display: flex;
        align-items: center;
        gap: calc(var(--spacing) * 1);
    }

    /* Keeps the destructive action clear of the others: it takes the row's slack, so it never
       sits flush against Clear Circuit or its neighbour. */
    .app-toolbar-danger {
        margin-left: auto;
    }
```

(Update the file's header comment to say the toolbar is an icon row adopted by the sidebar.)

- [ ] **Step 4: Update the toolbar e2e** (`test_e2e/toolbar.test.js`, test "renders the circuit controls with shadcn buttons")

(a) `assert.equal(toolbar.buttonGroupCount, 1);` → `assert.equal(toolbar.buttonGroupCount, 0);` and change the comment above the id list to "Clear All comes last, away from Clear Circuit; the row has no button groups."

(b) Replace the vertical-gap block with a horizontal one:

```js
        // The destructive action takes the row's slack: never flush against Clear Circuit, and
        // visibly apart from its neighbour.
        const clearGap = await page.evaluate(() => {
            const clearCircuit = document.getElementById('clear-circuit-button').getBoundingClientRect();
            const makeGate = document.getElementById('gate-forge-button').getBoundingClientRect();
            const clearAll = document.getElementById('clear-all-button').getBoundingClientRect();
            return {
                fromClearCircuit: Math.round(clearAll.left - clearCircuit.right),
                fromNeighbour: Math.round(clearAll.left - makeGate.right),
            };
        });
        assert.ok(clearGap.fromClearCircuit >= 100,
            `Clear All must sit well clear of Clear Circuit, gap was ${clearGap.fromClearCircuit}px.`);
        assert.ok(clearGap.fromNeighbour >= 12,
            `Clear All must sit apart from its neighbour, gap was ${clearGap.fromNeighbour}px.`);
```

(c) After the id-list assertion, add the accessible-name check:

```js
        const labels = await page.$$eval('#app-toolbar-root [data-slot="button"]',
            els => els.map(el => el.getAttribute('aria-label')));
        assert.deepEqual(labels, ['Export', 'Clear Circuit', 'Undo', 'Redo', 'Make Gate', 'Clear All']);
```

(d) The typography assertion (`'14px/500/32'`) should still hold — the button keeps `text-sm font-medium` and `size-8` is 32px. If the height reads differently, fix the CSS, not the expectation.

- [ ] **Step 5: Verify**

Run: `npm test 2>&1 | tail -2 && npm run test:e2e 2>&1 | grep -E "FAIL|Completed" && npm run build 2>&1 | grep "built in"`
Expected: `Completed 844/844 tests.`, `Completed 20/20 end-to-end tests.`, build green. (Menu text assertion in the same e2e still reads `'Menu'` via textContent until Task 2 — it must still pass here because Task 1 does not touch the Menu button.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.jsx src/components/app-toolbar.jsx src/styles/toolbar.css test_e2e/toolbar.test.js
git commit -m "Turn the circuit actions into an icon-only row"
```

---

### Task 2: Brand row, Menu icon, divider, version relocation

**Files:**
- Modify: `src/components/gate-toolbox.jsx` (`SidebarHeader`)
- Modify: `src/styles/sidebar/shell.css`
- Modify: `quirk.html` (welcome panel)
- Modify: `src/styles/dialogs.css`
- Modify: `test_e2e/toolbar.test.js` (Menu assertion)

**Interfaces:**
- Consumes: `Button size="icon"` from Task 1.
- Produces: `#app-version` now lives in the welcome panel (`.welcome-version`); `.sidebar-actions` carries the divider.

- [ ] **Step 1: Tighten `SidebarHeader`** (`src/components/gate-toolbox.jsx`) — replace only the returned JSX (keep the memo wrapper, comments, and `adoptToolbar` exactly):

```jsx
    return (
        <>
            <div className="sidebar-brand">
                <span className="app-brand-mark" aria-hidden="true"><AtomIcon strokeWidth={1.5} /></span>
                <span className="app-brand-copy"><strong>Shadow-Quant</strong></span>
                <Button
                    id="menu-button"
                    size="icon"
                    variant="ghost"
                    className="sidebar-menu-button"
                    aria-label="Menu"
                    title="Menu">
                    <BookOpenIcon strokeWidth={1.5} aria-hidden="true" />
                </Button>
            </div>
            <div className="sidebar-actions" ref={adoptToolbar} />
        </>
    );
```

- [ ] **Step 2: Sidebar styles** (`src/styles/sidebar/shell.css`)

Replace the `.sidebar-brand`, `.sidebar-brand .app-version`, and `.sidebar-brand .sidebar-menu-button` rules with:

```css
    .sidebar-brand {
        display: flex;
        align-items: center;
        gap: calc(var(--spacing) * 2);
    }

    .sidebar-brand .sidebar-menu-button {
        margin-left: auto;
    }

    /* The chrome (brand + actions) ends here; the palette (search + groups) starts below. */
    .sidebar-actions {
        padding-bottom: calc(var(--spacing) * 3);
        border-bottom: 1px solid var(--sidebar-border);
    }
```

Delete the `.app-brand-copy small` and `.app-version` rules (nothing renders them in the sidebar any more). Keep `.app-brand-mark`, `.app-brand-mark svg`, `.app-brand-copy`, `.app-brand-copy strong`, and `.gate-toolbox-header`. Update the file's header comment ("its brand header" → "its brand row and action row").

- [ ] **Step 3: Version line in the welcome panel** (`quirk.html`)

Directly after the closing `</h1>` of `#welcome-title` (before `<div class="welcome-tagline">`), insert:

```html
                    <div id="app-version" class="welcome-version">v2.3</div>
```

Then run `grep -rn "app-version\|Quantum circuit simulator" test test_e2e src` — nothing in tests may reference the removed sidebar tagline or the old `.app-version` span; if a test does, re-aim it at `#app-version` inside the welcome panel (same meaning: the version is shown).

- [ ] **Step 4: Style the version line** (`src/styles/dialogs.css`)

Find the `.welcome-tagline` rule and add after it:

```css
    .welcome-version {
        margin-top: calc(var(--spacing) * 1);
        color: var(--muted-foreground);
        font-family: var(--font-mono);
        font-size: var(--text-small);
        font-variant-numeric: tabular-nums;
    }
```

- [ ] **Step 5: Menu e2e assertion** (`test_e2e/toolbar.test.js`)

Replace the `menuLabel` block with:

```js
        const menuLabel = await page.$eval('.gate-toolbox #menu-button',
            element => element.getAttribute('aria-label'));
        assert.equal(menuLabel, 'Menu');
```

- [ ] **Step 6: Verify**

Run: `npm test 2>&1 | tail -2 && npm run test:e2e 2>&1 | grep -E "FAIL|Completed" && npm run build 2>&1 | grep "built in"`
Expected: 844/844, 20/20, green build.

- [ ] **Step 7: Commit**

```bash
git add src/components/gate-toolbox.jsx src/styles/sidebar/shell.css quirk.html src/styles/dialogs.css test_e2e/toolbar.test.js
git commit -m "Tighten the sidebar brand row and divide the chrome from the palette"
```

---

### Task 3: Acceptance measurement and smoke

**Files:** none unless the smoke demands a fix.

- [ ] **Step 1: All suites** — `npm test && npm run test:e2e && npm run test:perf && npm run build` → 844 / 20 / 7, green.

- [ ] **Step 2: Measure the acceptance criterion** in the `quirk-dev` preview at 1440×900 after closing the welcome dialog:

```js
const sb = document.querySelector('.gate-toolbox').getBoundingClientRect();
const search = document.querySelector('.gate-toolbox-search').getBoundingClientRect();
Math.round(search.bottom - sb.top)   // must be <= 140 (was 298)
```

Also confirm all six action buttons and the Menu button sit on their intended rows (one action row; Clear All at the right edge, tinted destructive), hovering shows the label tooltips, opening the menu shows `v2.3` under the welcome title, and Undo/Redo still toggle `disabled` when the circuit changes.

- [ ] **Step 3: Drawer check** at 800px width: open the drawer; the same brand row, icon row, and divider appear; no error banner.

- [ ] **Step 4: Report** the measured header height, suite counts, and a screenshot.
