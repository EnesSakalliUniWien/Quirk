# Dialog Snap-Zone Tiling — Design

Date: 2026-09-04
Status: approved design, pre-implementation

## Goal

Any of the five app dialogs (menu, export, gate forge, gate-param, Bloch sphere) can be dragged
by its header. Dragging near a screen edge shows a translucent ghost preview and, on release,
docks the dialog into one of three zones:

- **left** — left half of the safe area;
- **right** — right half of the safe area;
- **max** — the whole safe area.

A **docked dialog is non-modal**: the backdrop and focus trap are removed and the circuit stays
interactive underneath. The motivating use case is docking the enlarged Bloch sphere view beside
the circuit and watching it update live while editing. Dragging a docked dialog out of its zone
restores its pre-snap geometry and modal behaviour. Free-form dragging without hitting a zone
just moves the (still modal) dialog.

The "safe area" is the viewport minus the app toolbar and transport bar, so a docked dialog
never covers the chrome.

## Non-goals (recorded future work)

- Multiple simultaneously docked dialogs (one overlay at a time remains the rule).
- Persisting snap state across page reloads (session-only).
- Keyboard-driven snapping.
- Snapping on mobile (disabled at the existing ≤760px breakpoint; swipe/tap behaviour unchanged).
- Document Picture-in-Picture for the Bloch view.
- No new runtime dependencies. Research compared WinBox, jsPanel, Dockview, interact.js,
  react-rnd/Moveable and the Document-PiP API; every library either replaces the Base UI dialog
  primitive or fights the render-once architecture, so the mechanism is hand-rolled, in the
  style of Odysseus's `tileManager.js`.

## Architecture

### New: `src/app/dialogSnap.js` (vanilla, ~250 lines)

Owns all snapping behaviour:

- One delegated `pointerdown` listener; a drag starts on a `[data-snap-handle]` element inside
  an open dialog popup, after a 6px movement threshold. Buttons inside the header (the close ✕)
  do not start drags.
- Free-form dragging moves the popup via inline transform. Zone hit-testing runs per
  `pointermove`; entering a zone shows the ghost preview (one reusable fixed-position div),
  leaving it hides it. Release inside a zone applies the dock geometry as inline styles.
- Pre-snap geometry is stashed once per dock so dragging a docked dialog out restores the
  original position and size (re-docking keeps the original stash).
- The safe rect is computed from the live `#app-toolbar-root` / `#transport-bar-root` heights.
  A viewport `resize` listener re-clamps any docked dialog (throttled via rAF); shrinking under
  760px resets all snap state and disables dragging.
- Snap state is a session-only `Map<dialogName, mode>`, re-applied when a dialog reopens
  (the popup element is recreated by Base UI on every open, so geometry is re-applied on adopt).
- Public API: `initDialogSnap()` called once from `QuirkApp.startQuirk()`; returns an
  `ObservableValue` (`src/base/Obs.js`) of the current dock state
  (`undefined` or `{name, mode}`), consumed by React and by QuirkApp.
- Pure geometry helpers are exported for unit tests: `zoneForPointer(point, safeRect)`,
  `rectForZone(mode, safeRect)`, `safeRectFor(viewport, toolbarH, transportH)`.

### Changed: `src/components/app-dialogs.jsx`, `src/components/app-dialog.jsx`

`AppDialogs` already re-renders on `OverlayState` changes; it additionally subscribes to the
dock observable. `AppDialog` gains a `docked` prop:

- docked → `modal={false}`, no `<Dialog.Backdrop>`, outside pointer interaction must neither
  dismiss the dialog nor be blocked (exact Base UI props verified at implementation time;
  fallback is controlled-open handling), `data-docked="<mode>"` on the popup for CSS.
- undocked → today's markup exactly.

The `#dialog-stash` adoption invariant is untouched: content nodes are adopted per open and
survive re-renders; ids and legacy listeners stay alive.

### Changed: `src/app/QuirkApp.js`, `quirk.html`, `src/styles/dialogs.css`

- QuirkApp passes the dock observable into `mountAppDialogs` and extends the
  `canvasDiv.tabIndex` subscription: the canvas stays focusable while the active overlay is
  docked.
- The five panel headers in `quirk.html` get `data-snap-handle` (no id changes, no structural
  DOM changes).
- `dialogs.css` gains ghost-preview and docked styles (grab cursor on handles, snap transition
  under a `prefers-reduced-motion` guard). Dock geometry itself is inline styles from JS.

### Changed: `src/app/blochSphereDialog.js`

A `ResizeObserver` on `#bloch-canvas` triggers a redraw when dock geometry changes the canvas
size. The canvas already derives its backing store from `clientWidth` per draw, so only the
nudge is needed.

## Data flow

Pointer events → `dialogSnap` (threshold, zone math, inline geometry, ghost) → dock
`ObservableValue` → `AppDialogs` re-render (modal/backdrop toggle) and QuirkApp (canvas
tabIndex). `OverlayState` semantics are unchanged: one overlay at a time, open/close as today;
Escape and ✕ close a docked dialog too.

## Edge cases

- Undocking happens only by dragging out of the zone; it restores the pre-snap geometry and
  modality, and focus returns into the dialog when the focus trap re-engages.
- Closing a docked dialog keeps its remembered mode: reopening it re-docks it (non-modal) in
  the same zone. The remembered mode is cleared only by dragging out or by the <=760px reset.
- The transport Space shortcut already gates on event target; a docked dialog does not hijack it.
- Zone changes while dragging only ever show one ghost.
- A docked dialog reopened after viewport changes re-clamps to the current safe rect.

## Testing

- **Unit** (`test/app/dialogSnap.test.js`, auto-discovered by the `test/**/*.test.js` glob):
  `zoneForPointer`, `rectForZone`, `safeRectFor`, and the session state-machine transitions
  (free → docked → restored; breakpoint reset).
- **E2E** (`test_e2e/dialogSnap.test.js` + the required explicit import line in
  `PuppeteerRunEndToEndTests.js`): open the Bloch view from a Bloch display gate, drag its
  header to the right edge, assert the ghost appeared, release, assert the backdrop is gone and
  the popup has `data-docked="right"`, drag a gate onto a wire (circuit interactive), assert
  the Bloch canvas width changed, then drag the dialog out and assert modality returned.
- **Baselines** must hold: 836 unit / 18+1 e2e / 7 perf, `npm run build` green.

## Risks

- Base UI non-modal behaviour (outside-click dismissal, focus management) is the main unknown;
  the design isolates it in `AppDialog` so a fallback (controlled open state) stays local.
- `AppToolbar`/`TransportBar` never re-render — nothing in this design touches them.
