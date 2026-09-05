# App Shell Consolidation — Design

Date: 2026-09-04
Status: approved design, pre-implementation
Branch context: builds on `ui-shell-redesign` (which builds on `dialog-snap-tiling`).

## Goal

Consolidate the app shell from four chrome regions into three, giving the circuit ~44px more
vertical room and each region one clear identity:

- **Top**: one slim toolbar of circuit actions only — Export, Clear Circuit, Undo/Redo,
  Make Gate, Clear All.
- **Left**: the sidebar carries the app identity and entry points — brand, version, the Menu
  trigger — above the existing gate search and palette.
- **Bottom**: a debugger dock — the transport controls (Reset/Prev/Play/Next/End, scrub,
  gate readout) merged with the "State at the playhead" panel into one region, controls above
  the state table (the layout of ket's GUI debugger, which the transport already follows).

The separate transport bar row at the top disappears.

## Non-goals

- No merging of Clear Circuit and Clear All into a split button: `app-toolbar.jsx` documents
  that their adjacency made the two destructive actions easy to confuse; they stay separated.
- No change to the menu dialog's content, the examples, the export/forge/param/Bloch dialogs,
  the palette itself, or any gate behaviour.
- No renamed DOM ids, no removed controls, no keyboard-shortcut changes.
- Mobile (≤920px) keeps the off-canvas drawer; the Menu trigger there lives inside the drawer's
  sidebar header (a deliberate consequence, noted below).

## Hard constraints (from the codebase)

1. **Render-once rule.** The vanilla `src/app` modules mutate `disabled`/`hidden`/text on
   `menu-button`, `export-button`, the playhead controls, etc. by id. Any component that owns
   such elements must never re-render. `AppToolbar` and `TransportBar` already follow this.
   The gate toolbox re-renders freely (search, folding), so the new sidebar header that hosts
   `menu-button` MUST be isolated from those re-renders: a zero-prop `React.memo` component
   (`SidebarHeader`) rendered as the first child of the toolbox — memo with no props never
   re-renders, so React never touches its DOM after mount.
2. **Ids move with their elements.** `menu-button` keeps its id in the sidebar; the playhead
   ids keep theirs at the bottom. No wiring module (`transport.js`, `undo.js`, …) changes —
   with one amendment discovered during implementation: below 920px the sidebar is an
   off-canvas drawer whose content mounts on open and remounts on viewport crossings, so
   `#menu-button` has no stable element identity there. `menu.js` therefore wires the button
   by document-level click delegation and re-queries it for `disabled` writes (with a
   MutationObserver catching up a freshly mounted drawer), instead of holding a reference
   captured at startup.
3. **`dialogSnap._chromeBottom()` currently reads `#transport-bar-root`'s bottom edge** to
   compute the docking safe area. With the transport at the bottom this would break; it must
   read `#app-toolbar-root`'s bottom instead (fallback 0 unchanged).
4. The stash/dialog system, snap-zone tiling, and the state table wiring are untouched.

## Changes by file

- **`quirk.html`**: move the `<div id="transport-bar-root"></div>` element from its slot under
  the toolbar into `#state-panel`, as the panel's first child, wrapped together with the
  existing `.state-panel-header` in a new `.debugger-bar` flex row (transport left,
  heading + `#state-summary` right). No other markup moves.
- **`src/components/app-toolbar.jsx`**: remove the brand block, the `app-version` span, and the
  Menu button (and its ButtonGroup pairing with Export — Export becomes a standalone button).
  The roving-tabindex hook and everything else stays.
- **`src/components/gate-toolbox.jsx`**: add `SidebarHeader` — a zero-prop `React.memo`
  component rendering the brand mark + name, `v2.3` version tag, and the Menu button
  (`id="menu-button"`, BookOpenIcon, same accessible name) — as the first child inside
  `.gate-toolbox`, above the search field. Constraint 1 applies: no props, no state, no hooks.
- **`src/components/transport-bar.jsx`**: component unchanged except its root className gains a
  modifier for the bottom context if styling needs it; mounting stays `flushSync`-render-once
  into the (relocated) `#transport-bar-root`.
- **`src/app/dialogSnap.js`**: `_chromeBottom()` reads `#app-toolbar-root` instead of
  `#transport-bar-root`.
- **CSS** (`toolbar.css`, `transport.css`, `state-panel.css`, `sidebar/shell.css`,
  `layout.css`): slim-toolbar spacing; `.debugger-bar` row (transport controls left, state
  heading/summary right, wrapping under 920px); sidebar header block (brand row + menu
  trigger) sized to the sidebar's 268px width; fixed-height shell math keeps only the toolbar
  as top chrome; `.state-table-scroll` max-height unchanged.

## Consequences to accept (called out for the record)

- Below 920px the Menu trigger is inside the drawer, so opening the menu takes two taps
  (drawer, then Menu). The welcome dialog still opens by itself on first load, and every menu
  action remains reachable.
- `menu-button` leaves the toolbar's roving-tabindex composite and becomes an ordinary tab
  stop in the sidebar — matching how the search field behaves there.
- The docking safe area grows upward by the transport bar's former height; docked dialogs
  simply get taller.

## Testing

- Full suites must stay at 844 unit / 19 e2e / 7 perf, build green.
- e2e updates where assertions encode the old layout, preserving each assertion's meaning:
  `toolbar.test.js` (button inventory no longer includes Menu in the toolbar; Menu found in
  the sidebar instead), `transport.test.js` (controls addressed by id — expected to pass
  unchanged; verify), `harness.js` layout probes (`circuitTopPixel` shifts up ~44px — verify
  the probe still measures what it means to measure), `dialogSnap.test.js` e2e (safe-area top
  now the toolbar bottom).
- One new e2e assertion: the transport controls and the state table are inside the same
  `#state-panel` region, and stepping the playhead still updates the table.
- Manual smoke via `quirk-dev`: menu opens from the sidebar, all five dialogs open/close/dock,
  playhead stepping from the bottom dock, drawer flow at ≤920px, no error banner.

## Risks

- The `SidebarHeader` memo isolation is the load-bearing trick; a prop added later would
  silently re-enable re-renders. A comment in the component must state the rule.
- Layout CSS is the largest surface; the 921px fixed-height shell media query and the drawer
  media query both assume the two-top-bars structure and need careful revisiting.
