# App Shell Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One slim action toolbar on top, brand + Menu in the sidebar, and the transport controls merged with the state panel into a bottom debugger dock.

**Architecture:** Pure relocation of render-once React chrome and static markup — every DOM id moves with its element so the vanilla `src/app` wiring modules stay untouched; `dialogSnap` re-anchors its safe area to the toolbar. Spec: `docs/superpowers/specs/2026-09-04-shell-consolidation-design.md`.

**Tech Stack:** React 19 render-once components (`flushSync` mounts), vanilla JS wiring by DOM id, CSS in `src/styles/`, browser Suite tests (`npm test`), Puppeteer e2e (`npm run test:e2e`).

## Global Constraints

- No new dependencies; no repo-wide formatting; no DOM id renames; no wiring-module (`src/app/*.js`) changes except `dialogSnap.js`'s `_chromeBottom`.
- `AppToolbar` and `TransportBar` must keep rendering exactly once; the new `SidebarHeader` must be a zero-prop `React.memo` with no state/hooks (spec constraint 1).
- Clear Circuit and Clear All stay non-adjacent groupings (existing code comment).
- Baselines must hold: 844 unit / 19 e2e (+1 new = 20) / 7 perf, `npm run build` green.
- Branch: `ui-shell-redesign`. Commit style: imperative single-line subject, no attribution trailers.
- Never weaken a test; where a test encodes the OLD layout, update it to assert the same MEANING in the new layout.

---

### Task 1: Re-anchor the dialog-snap safe area to the toolbar

**Files:**
- Modify: `src/app/dialogSnap.js` (the `_chromeBottom` function)

**Interfaces:**
- Produces: `_chromeBottom()` returns `#app-toolbar-root`'s bottom edge (fallback 0). Everything else in the module is unchanged.

- [ ] **Step 1: Change the chrome anchor**

Replace the existing `_chromeBottom` in `src/app/dialogSnap.js`:

```js
function _chromeBottom() {
    // The toolbar is the only top chrome; the transport lives in the bottom debugger dock.
    let toolbar = document.getElementById('app-toolbar-root');
    return toolbar === null ? 0 : toolbar.getBoundingClientRect().bottom;
}
```

- [ ] **Step 2: Verify with the suites**

Run: `npm test 2>&1 | tail -3 && npm run test:e2e 2>&1 | tail -4`
Expected: `Completed 844/844 tests.` and `Completed 19/19 end-to-end tests.` (the docking e2e still passes: while the transport is still on top this only enlarges the safe area upward by ~44px, which no assertion pins).

- [ ] **Step 3: Commit**

```bash
git add src/app/dialogSnap.js
git commit -m "Anchor the dialog-snap safe area to the toolbar"
```

---

### Task 2: Move the transport into the bottom debugger dock

**Files:**
- Modify: `quirk.html` (lines ~17-19 and the `#state-panel` section at ~39-63)
- Modify: `src/styles/state-panel.css`, `src/styles/transport.css`, `src/styles/layout.css`
- Modify: `test_e2e/transport.test.js` (one new test appended)

**Interfaces:**
- Consumes: Task 1 (safe area no longer depends on the transport's position).
- Produces: `#transport-bar-root` is the first child of a new `.debugger-bar` row inside `#state-panel`; `TransportBar` mounts there unchanged.

- [ ] **Step 1: Relocate the markup** (`quirk.html`)

Delete these two lines from the top of `#inspectorDiv`:

```html
            <!-- Playhead transport controls -->
            <div id="transport-bar-root"></div>
```

Rewrite the top of the state panel so the transport and the existing header share one row (the
`<header>` element and everything inside it is MOVED VERBATIM, not retyped):

```html
        <!-- The debugger dock: playhead transport above the amplitudes at the playhead -->
        <section id="state-panel" class="state-panel" aria-labelledby="state-panel-heading">
            <div class="debugger-bar">
                <div id="transport-bar-root"></div>
                <header class="state-panel-header">
                    <h2 id="state-panel-heading" class="state-panel-heading">State at the playhead</h2>
                    <span id="state-summary" class="state-summary"></span>
                    <span class="state-legend">
                        <span>phase</span>
                        <span class="state-legend-strip" aria-hidden="true"></span>
                        <span>&#8722;&#960; &#8230; +&#960;</span>
                    </span>
                </header>
            </div>
```

(The `.state-table-scroll` div and the rest of the section stay exactly as they are.)

- [ ] **Step 2: Style the dock**

`src/styles/state-panel.css` — add after the `.state-panel` rule:

```css
    .debugger-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: calc(var(--spacing) * 2) calc(var(--spacing) * 4);
        margin-bottom: calc(var(--spacing) * 3);
    }

    .debugger-bar .state-panel-header {
        margin-bottom: 0;
        margin-left: auto;
    }
```

`src/styles/transport.css` — add after the `.transport-bar` rule (the bar keeps its standalone
styles so nothing else depends on context, and drops its chrome when inside the dock):

```css
    .debugger-bar .transport-bar {
        min-height: 0;
        padding: 0;
        background: transparent;
        border-bottom: 0;
    }
```

`src/styles/layout.css` — in the `@media (min-width: 921px)` block, the selector list
`#app-toolbar-root, #transport-bar-root, .state-panel { flex: 0 0 auto; }` no longer needs the
transport entry: remove `#transport-bar-root,` from that list. Change nothing else in the file.

- [ ] **Step 3: Append the new e2e test** (`test_e2e/transport.test.js`)

Match the file's existing import list (it already imports from `./harness.js` and
`node:assert/strict`); append:

```js
test('houses the transport in the bottom debugger dock', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X']]}, async page => {
        const inPanel = await page.evaluate(() =>
            document.getElementById('state-panel').contains(
                document.getElementById('transport-bar-root')));
        assert.ok(inPanel, 'The transport controls must live inside the state panel.');

        await page.click('#playhead-next-button');
        await page.waitForFunction(
            () => document.getElementById('playhead-position').textContent.startsWith('gate 1'),
            {timeout: 2000});
    });
});
```

If `withQuirkPage` is not already imported in this file, extend the import to include it.

- [ ] **Step 4: Verify**

Run: `npm test 2>&1 | tail -3 && npm run test:e2e 2>&1 | tail -5`
Expected: `Completed 844/844 tests.`, `Completed 20/20 end-to-end tests.` If a transport or
layout e2e fails, the harness's layout probes (`test_e2e/harness.js`, `canvasLayout`/
`circuitTopPixel`) may encode the old chrome height — read the failing assertion and update the
probe or expectation so it measures the same meaning in the new layout; report any such change.

- [ ] **Step 5: Commit**

```bash
git add quirk.html src/styles/state-panel.css src/styles/transport.css src/styles/layout.css test_e2e/transport.test.js
git commit -m "Merge the playhead transport into the bottom debugger dock"
```

---

### Task 3: Slim the toolbar and give the sidebar the brand and Menu

**Files:**
- Modify: `src/components/app-toolbar.jsx`
- Modify: `src/components/gate-toolbox.jsx`
- Modify: `src/styles/toolbar.css`, `src/styles/sidebar/shell.css`
- Modify: `test_e2e/toolbar.test.js`

**Interfaces:**
- Produces: `SidebarHeader` — zero-prop `React.memo` component owning `#menu-button`, the brand, and the version, rendered as the first child of `.gate-toolbox`.

- [ ] **Step 1: Slim `AppToolbar`** (`src/components/app-toolbar.jsx`)

Remove the `AtomIcon` and `BookOpenIcon` imports and the `Separator` import (and its
`@/components/ui/separator` line). Replace the `AppToolbar` function's JSX with:

```jsx
    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls" ref={toolbarRef}>
            <div className="app-toolbar-actions">
                <ToolbarButton id="export-button" icon={DownloadIcon}>Export</ToolbarButton>
                <ToolbarButton id="clear-circuit-button" icon={EraserIcon} variant="outline">
                    Clear Circuit
                </ToolbarButton>
                <ButtonGroup aria-label="History actions">
                    <ToolbarButton id="undo-button" icon={Undo2Icon}>Undo</ToolbarButton>
                    <ToolbarButton id="redo-button" icon={Redo2Icon}>Redo</ToolbarButton>
                </ButtonGroup>
                <ToolbarButton id="gate-forge-button" icon={WandSparklesIcon} variant="outline">
                    Make Gate
                </ToolbarButton>
                {/* Last, and pushed clear of the others: it discards custom gates as well as the
                    circuit, and sitting flush against Clear Circuit made the two easy to confuse. */}
                <ToolbarButton
                    id="clear-all-button"
                    icon={Trash2Icon}
                    variant="destructive"
                    className="app-toolbar-danger">
                    Clear All
                </ToolbarButton>
            </div>
        </header>
    );
```

Everything else in the file (roving tabindex hook, mount) stays byte-identical.

- [ ] **Step 2: Add `SidebarHeader`** (`src/components/gate-toolbox.jsx`)

Extend the react import with `memo`, the lucide import with `AtomIcon, BookOpenIcon`, and add
`import {Button} from "@/components/ui/button";`. Add above the toolbox component:

```jsx
// Renders once and must never re-render: src/app/menu.js writes `disabled` straight onto
// #menu-button, and any re-render would wipe it. memo with zero props keeps React away from
// this subtree while the toolbox re-renders around it — do not add props, state, or hooks.
const SidebarHeader = memo(function SidebarHeader() {
    return (
        <div className="sidebar-brand">
            <span className="app-brand-mark" aria-hidden="true"><AtomIcon strokeWidth={1.5} /></span>
            <span className="app-brand-copy">
                <strong>Shadow-Quant</strong>
                <small>Quantum circuit simulator</small>
            </span>
            <span className="app-version">v2.3</span>
            <Button id="menu-button" size="default" variant="ghost" className="sidebar-menu-button">
                <BookOpenIcon data-icon="inline-start" strokeWidth={1.5} />
                Menu
            </Button>
        </div>
    );
});
```

Render it as the first child of the `<aside className="gate-toolbox" ...>`, immediately before
the existing `<div className="gate-toolbox-header" ...>`:

```jsx
        <aside className="gate-toolbox" data-slot="sidebar" aria-label="Gates">
            <SidebarHeader />
            <div className="gate-toolbox-header" data-slot="sidebar-header">
```

- [ ] **Step 3: Move the brand styles**

Cut the `.app-brand`, `.app-brand-mark`, `.app-brand-mark svg`, `.app-brand-copy`,
`.app-brand-copy strong`, `.app-brand-copy small`, `.app-version`, and `.app-toolbar-separator`
rules out of `src/styles/toolbar.css` (delete `.app-brand` and `.app-toolbar-separator`
entirely — nothing renders them any more; move the others verbatim). Paste the moved rules into
`src/styles/sidebar/shell.css` inside its `@layer components` block, and add:

```css
    .sidebar-brand {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: calc(var(--spacing) * 2);
    }

    .sidebar-brand .app-version {
        margin-left: auto;
    }

    .sidebar-brand .sidebar-menu-button {
        flex: 1 1 100%;
        justify-content: flex-start;
    }
```

- [ ] **Step 4: Update the toolbar e2e** (`test_e2e/toolbar.test.js`)

Read the file first. Then: (a) the brand assertion at ~line 26/37 moves to the sidebar —
replace the `.app-brand-copy strong` lookup inside `#app-toolbar-root [role="toolbar"]` with:

```js
        const sidebarBrand = await page.$eval('.gate-toolbox .app-brand-copy strong',
            element => element.textContent);
        assert.equal(sidebarBrand, 'Shadow-Quant');
```

(b) remove `'menu-button'` from the expected toolbar button-id list at ~line 40 and add,
in the same test:

```js
        const menuLabel = await page.$eval('.gate-toolbox #menu-button',
            element => element.textContent.trim());
        assert.equal(menuLabel, 'Menu');
```

(c) The roving-tabindex test iterates `#app-toolbar-root [data-slot="button"]` — it needs no
change, but confirm its expected first/last buttons aren't hardcoded to `menu-button`; if they
are, update them to `export-button`.

- [ ] **Step 5: Verify**

Run: `npm test 2>&1 | tail -3 && npm run test:e2e 2>&1 | tail -5 && npm run build 2>&1 | tail -2`
Expected: `Completed 844/844 tests.`, `Completed 20/20 end-to-end tests.`, green build. The menu
e2e flows (open/close, examples, shortcuts) click `#menu-button` by id and must pass with it in
the sidebar — on the default e2e viewport the sidebar is visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-toolbar.jsx src/components/gate-toolbox.jsx src/styles/toolbar.css src/styles/sidebar/shell.css test_e2e/toolbar.test.js
git commit -m "Move the brand and Menu into the sidebar and slim the toolbar"
```

---

### Task 4: Full verification and live smoke

**Files:** none beyond fixes the smoke test demands.

- [ ] **Step 1: All suites**

```bash
npm test && npm run test:e2e && npm run test:perf && npm run build
```

Expected: 844 unit / 20 e2e / 7 perf, build green.

- [ ] **Step 2: Live smoke via the `quirk-dev` preview** (port 5173)

Load `/quirk.html#circuit={"cols":[["H"],["Bloch"]]}` and check, fixing source for anything
broken before finishing: the welcome menu opens on load and closes; Menu reopens from the
sidebar and its `disabled` toggles while a dialog is open; the toolbar shows exactly
Export/Clear Circuit/Undo/Redo/Make Gate/Clear All; playhead stepping works from the bottom
dock and updates the state table beside it; the scrub slider works; docking the Bloch dialog
right still works and the safe area starts under the toolbar; at 800px width the drawer flow
still works and the drawer shows the brand header; no error banner anywhere.

- [ ] **Step 3: Report**

Report per-suite counts, any e2e assertions that had to be re-aimed at the new layout, and a
screenshot of the consolidated shell.
