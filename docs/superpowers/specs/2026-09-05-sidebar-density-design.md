# Sidebar Density — Design

Date: 2026-09-05
Status: approved design, pre-implementation
Branch context: `ui-shell-redesign`, after the shell consolidation and the toolbar's move
into the sidebar.

## Goal

Cut the sidebar's persistent header from 298px (40% of a 900px column) to roughly 130px so
the gate palette — the sidebar's actual job — owns the height, and replace the ragged
three-weight action grid with one aligned, single-weight icon row. Measured problems this
fixes (1440×900): header block 298px; action buttons 85/124/76/112/243px wide in a 2-1-2-1
wrap; ghost + outline + destructive weights mixed; no visual grouping since the chrome colour
was unified.

## Target layout (top of the sidebar, 268px wide, 12px padding)

```
[⚛ Shadow-Quant                     (📖)]   brand row: mark + name, Menu as an icon button
[ ⬇  ⌫  ↶  ↷  ✨        🗑 ]                action row: six icon-only buttons, Clear All pushed right
──────────────────────────────────           divider (1px --sidebar-border)
[ 🔍 Search gates                   ]        unchanged
PROBES …                                     unchanged palette
```

## Changes

1. **Action row becomes icon-only.** The six buttons keep their ids and order — Export,
   Clear Circuit, Undo, Redo, Make Gate, Clear All — rendered as shadcn `size="icon"` ghost
   buttons (32px square, matching the app's `h-8` control height) in one flex row,
   `gap: 4px`; Clear All gets `margin-left: auto`, so it sits apart from the others (the
   existing "never flush against Clear Circuit" rule, now horizontal again as it was in the
   original toolbar). Each button carries `aria-label` and `title` with its former label
   text, so the accessible name and hover tooltip are unchanged. Six × 32px + five × 4px =
   212px fits the 244px inner width on one row with slack for the auto margin. The app's
   trimmed `src/components/ui/button.jsx` has only the `default` size, so an `icon` size
   (`"size-8"`, upstream shadcn's icon variant) is added there — the one change to a shadcn
   primitive, kept to the upstream definition.
2. **One visual weight.** Every action is `variant="ghost"`; Clear All alone adds the
   destructive foreground colour (`text-destructive` via className) — distinguished by colour,
   not by a filled full-width bar. The Menu button is also ghost, icon-only.
3. **Grouping restored.** `.sidebar-actions` gets a bottom border in `--sidebar-border` with
   matching padding, separating the app chrome (brand + actions) from the palette
   (search + groups). No caps label: a six-icon row does not need naming.
4. **Brand row tightened.** Mark + name on one line; the "Quantum circuit simulator" tagline
   is removed from the sidebar; the version tag moves into the welcome panel in `quirk.html`
   (a small muted line under the welcome title, as static text with id `app-version`); the
   Menu button becomes an icon button at the row's right edge.

## What does not change

- All DOM ids (`menu-button`, `export-button`, `clear-circuit-button`, `undo-button`,
  `redo-button`, `gate-forge-button`, `clear-all-button`); the render-once `AppToolbar`
  island, its roving-tabindex hook, and the sidebar's stash-adoption of `#app-toolbar-root`;
  the memo'd zero-prop `SidebarHeader`; the drawer behaviour below 920px; the palette, search,
  transport, and dock; the sidebar width (268px is on-guideline).
- Keyboard: the toolbar composite still arrows between the six buttons; Menu is a normal
  tab stop in the brand row.

## Files

- `src/components/ui/button.jsx` — add `size: { icon: "size-8" }` beside `default`.
- `src/components/app-toolbar.jsx` — icon-only buttons (`size="icon"`, `aria-label`,
  `title`), all ghost, Clear All with the destructive text class; drop `ToolbarButton`'s
  children/label rendering and the History `ButtonGroup` (a group border reads as a box in
  an icon row; adjacency is enough).
- `src/components/gate-toolbox.jsx` — `SidebarHeader`: brand row (mark + `<strong>` name +
  icon Menu button), no tagline, no version span.
- `quirk.html` — version line added under `#welcome-title` in the welcome panel.
- `src/styles/toolbar.css`, `src/styles/sidebar/shell.css` — the row layout, auto-margin,
  divider, brand-row alignment; delete the dead `.app-brand-copy small`, `.app-version`
  sidebar rules; style the new welcome version line in `dialogs.css`.
- `test_e2e/toolbar.test.js` — the six ids and one group count become "no groups";
  the destructive-separation assertion returns to a horizontal gap (Clear All's left edge
  at least 24px right of Make Gate's right edge, and well right of Clear Circuit); the
  shadcn-typography check must read the buttons' computed font from their `aria-label`ed
  elements rather than text content if it currently depends on text; the brand assertion
  keeps `.gate-toolbox .app-brand-copy strong === 'Shadow-Quant'`; Menu asserted by
  `aria-label` instead of text.

## Acceptance

- Header block (sidebar top to search bottom) ≤ 140px at 1440×900 (from 298px).
- Every action reachable by pointer and keyboard with its former accessible name.
- 844 unit / 20 e2e / 7 perf, build green; the known flaky pair excepted on a re-run.
- Live smoke: hover tooltips show labels; Undo/Redo/Clear disabled states still toggle
  (the `disabled` writes are untouched); drawer at 800px shows the same header.
