# Dialog Snap-Zone Tiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dialogs can be dragged by their headers and snapped to left/right/max zones; a docked dialog becomes non-modal so the circuit stays editable (headline: live Bloch sphere docked beside the circuit).

**Architecture:** A new vanilla module `src/app/dialogSnap.js` owns all pointer/zone/geometry logic and publishes dock state through an `ObservableValue`; `AppDialogs` subscribes and renders docked dialogs non-modal; `QuirkApp` wires it and keeps the canvas focusable while docked. Spec: `docs/superpowers/specs/2026-09-04-dialog-snap-tiling-design.md`.

**Tech Stack:** Vanilla JS (repo's `src/base/Obs.js` observables), React 19 + @base-ui/react Dialog, custom browser test Suite (`npm test`), Puppeteer e2e (`npm run test:e2e`).

## Global Constraints

- No new dependencies (runtime or dev). No repo-wide formatting.
- New source files start with the same Apache-2.0 header block as their siblings (copy from `src/app/OverlayState.js:1-15`).
- Never rename DOM ids; never let `AppToolbar`/`TransportBar` re-render; the `#dialog-stash` adoption in `src/components/app-dialog.jsx` must keep working.
- `src/editor/` must not be touched; do not add `components → app` imports (pass functions as props from `QuirkApp` instead).
- Test baselines must hold: 836 unit (+new), 18 e2e (+1), 7 perf, `npm run build` green.
- Commit style: imperative single-line subject, e.g. `Split the sidebar stylesheet into a module per region`. No attribution trailers.

---

### Task 1: Pure snap geometry

**Files:**
- Create: `src/app/dialogSnap.js`
- Test: `test/app/dialogSnap.test.js`

**Interfaces:**
- Produces: `safeRectFor(viewportWidth, viewportHeight, chromeBottom) -> {x,y,w,h}`; `zoneForPointer(x, y, safeRect) -> 'left'|'right'|'max'|undefined`; `rectForZone(zone, safeRect) -> {x,y,w,h}`; constant `SNAP_EDGE_PX = 40`.

- [ ] **Step 1: Write the failing tests**

Create `test/app/dialogSnap.test.js` (Apache header from `test/app/OverlayState.test.js:1-15`, then):

```js
import {Suite, assertThat} from "../TestUtil.js"
import {safeRectFor, zoneForPointer, rectForZone, SNAP_EDGE_PX} from "../../src/app/dialogSnap.js"

let suite = new Suite("dialogSnap");

const SAFE = safeRectFor(1200, 800, 100);

suite.test("safeRectFor excludes the chrome strip", () => {
    assertThat(SAFE).isEqualTo({x: 0, y: 100, w: 1200, h: 700});
});

suite.test("pointer near the left edge hits the left zone", () => {
    assertThat(zoneForPointer(SNAP_EDGE_PX - 1, 400, SAFE)).isEqualTo('left');
    assertThat(zoneForPointer(SNAP_EDGE_PX + 1, 400, SAFE)).isEqualTo(undefined);
});

suite.test("pointer near the right edge hits the right zone", () => {
    assertThat(zoneForPointer(1200 - SNAP_EDGE_PX + 1, 400, SAFE)).isEqualTo('right');
    assertThat(zoneForPointer(1200 - SNAP_EDGE_PX - 1, 400, SAFE)).isEqualTo(undefined);
});

suite.test("pointer near the safe-area top hits the max zone", () => {
    assertThat(zoneForPointer(600, 100 + SNAP_EDGE_PX - 1, SAFE)).isEqualTo('max');
    assertThat(zoneForPointer(600, 100 + SNAP_EDGE_PX + 1, SAFE)).isEqualTo(undefined);
});

suite.test("corners prefer the side zones over max", () => {
    assertThat(zoneForPointer(2, 101, SAFE)).isEqualTo('left');
    assertThat(zoneForPointer(1198, 101, SAFE)).isEqualTo('right');
});

suite.test("rectForZone splits the safe area", () => {
    assertThat(rectForZone('left', SAFE)).isEqualTo({x: 0, y: 100, w: 600, h: 700});
    assertThat(rectForZone('right', SAFE)).isEqualTo({x: 600, y: 100, w: 600, h: 700});
    assertThat(rectForZone('max', SAFE)).isEqualTo({x: 0, y: 100, w: 1200, h: 700});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -5`
Expected: the run FAILS (the import of `src/app/dialogSnap.js` cannot resolve, so the test build errors — that counts as the red step here).

- [ ] **Step 3: Implement the pure functions**

Create `src/app/dialogSnap.js` (Apache header from `src/app/OverlayState.js:1-15`, then):

```js
/**
 * Snap-zone tiling for the app dialogs, in the spirit of a desktop window manager: drag a
 * dialog by its header, and edge zones dock it into halves of the safe area. Docked dialogs
 * are rendered non-modal by src/components/app-dialogs.jsx, which subscribes to this module's
 * dock state.
 */

import {ObservableValue} from "../base/Obs.js"

/** How close to an edge, in pixels, the pointer must be to activate a zone. */
const SNAP_EDGE_PX = 40;
/** Movement below this many pixels is a click on the header, not a drag. */
const DRAG_THRESHOLD_PX = 6;
/** Matches the dialogs' narrow-viewport breakpoint in src/styles/dialogs.css. */
const MOBILE_BREAKPOINT_PX = 760;

/**
 * The area a docked dialog may occupy: the viewport minus the toolbar/transport strip.
 * @param {!number} viewportWidth
 * @param {!number} viewportHeight
 * @param {!number} chromeBottom The y where the app chrome ends and the safe area begins.
 * @returns {!{x: !number, y: !number, w: !number, h: !number}}
 */
function safeRectFor(viewportWidth, viewportHeight, chromeBottom) {
    return {x: 0, y: chromeBottom, w: viewportWidth, h: viewportHeight - chromeBottom};
}

/**
 * @param {!number} x
 * @param {!number} y
 * @param {!{x: !number, y: !number, w: !number, h: !number}} safeRect
 * @returns {undefined|!string} The zone the pointer activates, side zones winning corners.
 */
function zoneForPointer(x, y, safeRect) {
    if (x <= safeRect.x + SNAP_EDGE_PX) {
        return 'left';
    }
    if (x >= safeRect.x + safeRect.w - SNAP_EDGE_PX) {
        return 'right';
    }
    if (y <= safeRect.y + SNAP_EDGE_PX) {
        return 'max';
    }
    return undefined;
}

/**
 * @param {!string} zone
 * @param {!{x: !number, y: !number, w: !number, h: !number}} safeRect
 * @returns {!{x: !number, y: !number, w: !number, h: !number}}
 */
function rectForZone(zone, safeRect) {
    let half = Math.floor(safeRect.w / 2);
    switch (zone) {
        case 'left': return {x: safeRect.x, y: safeRect.y, w: half, h: safeRect.h};
        case 'right': return {x: safeRect.x + half, y: safeRect.y, w: safeRect.w - half, h: safeRect.h};
        case 'max': return {x: safeRect.x, y: safeRect.y, w: safeRect.w, h: safeRect.h};
        default: throw new Error("Unknown snap zone: " + zone);
    }
}

export {safeRectFor, zoneForPointer, rectForZone, SNAP_EDGE_PX, DRAG_THRESHOLD_PX, MOBILE_BREAKPOINT_PX}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: `Completed 842/842 tests.` (836 + the 6 new), exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/dialogSnap.js test/app/dialogSnap.test.js
git commit -m "Add the pure snap-zone geometry for dialog tiling"
```

---

### Task 2: Dock-state memory and observable

**Files:**
- Modify: `src/app/dialogSnap.js`
- Test: `test/app/dialogSnap.test.js`

**Interfaces:**
- Consumes: Task 1's functions.
- Produces: `dockModes()` returning a subscribable of the same shape as `OverlayState.active()` (seeds each subscriber with the current value, then emits on every change; check `src/base/Obs.js` for whether that is the `ObservableValue` itself or its `.observable()`), carrying a plain object mapping overlay name to zone (e.g. `{bloch: 'right'}`); `setDockMode(name, zone)`; `clearDockMode(name)`; `resetDockModes()`. Every consumer in Tasks 3-4 calls `dockModes().subscribe(...)` or receives the already-called result as a `dockModes` prop and calls `.subscribe(...)` on it — keep that shape consistent.

- [ ] **Step 1: Write the failing tests** (append to `test/app/dialogSnap.test.js`)

```js
import {setDockMode, clearDockMode, resetDockModes, dockModes} from "../../src/app/dialogSnap.js"

suite.test("dock modes are remembered per dialog and observable", () => {
    resetDockModes();
    let seen = [];
    let unsub = dockModes().subscribe(modes => seen.push(modes));

    setDockMode('bloch', 'right');
    setDockMode('menu', 'max');
    clearDockMode('bloch');
    resetDockModes();
    unsub();

    assertThat(seen).isEqualTo([
        {},
        {bloch: 'right'},
        {bloch: 'right', menu: 'max'},
        {menu: 'max'},
        {},
    ]);
});
```

(Note: merge this import line into the existing import block at the top of the file; the suite runs test bodies in order, and `resetDockModes()` at the start keeps the test independent.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -5`
Expected: build failure on the unresolved named exports.

- [ ] **Step 3: Implement** (append to `src/app/dialogSnap.js`)

```js
/** @type {!Map.<!string, !string>} Overlay name -> docked zone, remembered for the session. */
const _dockModes = new Map();
const _dockModesValue = new ObservableValue({});

function _emitDockModes() {
    let snapshot = {};
    for (let [name, zone] of _dockModes.entries()) {
        snapshot[name] = zone;
    }
    _dockModesValue.set(snapshot);
}

/** @returns {!ObservableValue.<!Object.<!string, !string>>} */
function dockModes() {
    return _dockModesValue;
}

/**
 * @param {!string} name
 * @param {!string} zone
 */
function setDockMode(name, zone) {
    _dockModes.set(name, zone);
    _emitDockModes();
}

/** @param {!string} name */
function clearDockMode(name) {
    if (_dockModes.delete(name)) {
        _emitDockModes();
    }
}

function resetDockModes() {
    if (_dockModes.size > 0) {
        _dockModes.clear();
    }
    _emitDockModes();
}
```

Add the new names to the file's `export {...}` line. Check `dockModes().subscribe` seeding: `ObservableValue.observable()` in `src/base/Obs.js` emits the current value on subscribe — if `subscribe` is only available via `.observable().subscribe(...)`, expose `dockModes()` as `_dockModesValue.observable()` instead and adjust the test to match `OverlayState.test.js`'s usage (`overlays.active().subscribe(...)` at `test/app/OverlayState.test.js:48`). Mirror whichever shape `OverlayState.active()` actually returns.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: `Completed 843/843 tests.`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/dialogSnap.js test/app/dialogSnap.test.js
git commit -m "Remember dialog dock modes behind an observable"
```

---

### Task 3: Drag, ghost preview, and dock/undock interaction

**Files:**
- Modify: `src/app/dialogSnap.js`
- Modify: `src/styles/dialogs.css`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `initDialogSnap() -> void` (installs the document-level listeners once; safe to call exactly once from `startQuirk`); `notifyDialogOpened(name, popupElement) -> void` (re-applies a remembered dock rect to a freshly created popup; called from React via a prop chain in Task 4). Popup elements are identified by the id Base UI gives them (`menu-div`, `export-div`, `gate-forge-div`, `gate-param-div`, `bloch-div`).

- [ ] **Step 1: Implement the interaction module** (append to `src/app/dialogSnap.js`)

```js
/** Popup element ids (src/components/app-dialogs.jsx) keyed back to overlay names. */
const _NAME_BY_DIV_ID = new Map([
    ['menu-div', 'menu'],
    ['export-div', 'export'],
    ['gate-forge-div', 'forge'],
    ['gate-param-div', 'gate-param'],
    ['bloch-div', 'bloch'],
]);

let _ghost = undefined;
let _drag = undefined;
let _initialized = false;

function _ghostElement() {
    if (_ghost === undefined) {
        _ghost = document.createElement('div');
        _ghost.className = 'snap-ghost';
        _ghost.hidden = true;
        document.body.appendChild(_ghost);
    }
    return _ghost;
}

function _chromeBottom() {
    let transport = document.getElementById('transport-bar-root');
    return transport === null ? 0 : transport.getBoundingClientRect().bottom;
}

function _safeRect() {
    return safeRectFor(window.innerWidth, window.innerHeight, _chromeBottom());
}

/** @param {!HTMLElement} popup @param {!{x:!number,y:!number,w:!number,h:!number}} rect */
function _applyRect(popup, rect) {
    popup.style.left = rect.x + 'px';
    popup.style.top = rect.y + 'px';
    popup.style.width = rect.w + 'px';
    popup.style.height = rect.h + 'px';
    popup.style.maxWidth = 'none';
    popup.style.maxHeight = 'none';
    popup.style.transform = 'none';
}

/** Returns the popup to CSS-driven sizing, keeping only an explicit position. */
function _clearRect(popup) {
    popup.style.width = '';
    popup.style.height = '';
    popup.style.maxWidth = '';
    popup.style.maxHeight = '';
}

/**
 * Re-applies a remembered dock rect to a freshly created popup. Also drops stale dock state
 * when the viewport has shrunk below the breakpoint since the mode was remembered.
 * @param {!string} name
 * @param {!HTMLElement} popupElement
 */
function notifyDialogOpened(name, popupElement) {
    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        resetDockModes();
        return;
    }
    let zone = _dockModes.get(name);
    if (zone !== undefined) {
        _applyRect(popupElement, rectForZone(zone, _safeRect()));
    }
}

function _onPointerDown(ev) {
    if (ev.button !== 0 || window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        return;
    }
    let handle = ev.target.closest('[data-snap-handle]');
    if (handle === null || ev.target.closest('button, a, input, select, textarea') !== null) {
        return;
    }
    let popup = handle.closest('.dialog-layout');
    if (popup === null || !_NAME_BY_DIV_ID.has(popup.id)) {
        return;
    }
    let bounds = popup.getBoundingClientRect();
    _drag = {
        name: _NAME_BY_DIV_ID.get(popup.id),
        popup,
        startX: ev.clientX,
        startY: ev.clientY,
        startBounds: bounds,
        moved: false,
        zone: undefined,
    };
    window.addEventListener('pointermove', _onPointerMove);
    window.addEventListener('pointerup', _onPointerUp);
    ev.preventDefault();
}

function _onPointerMove(ev) {
    let dx = ev.clientX - _drag.startX;
    let dy = ev.clientY - _drag.startY;
    if (!_drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
            return;
        }
        _drag.moved = true;
        if (_dockModes.has(_drag.name)) {
            // Dragging a docked dialog out: back to modal + CSS sizing, following the pointer.
            clearDockMode(_drag.name);
            _clearRect(_drag.popup);
            _drag.startBounds = _drag.popup.getBoundingClientRect();
        }
    }
    _drag.popup.style.left = (_drag.startBounds.x + dx) + 'px';
    _drag.popup.style.top = (_drag.startBounds.y + dy) + 'px';
    _drag.popup.style.transform = 'none';

    _drag.zone = zoneForPointer(ev.clientX, ev.clientY, _safeRect());
    let ghost = _ghostElement();
    if (_drag.zone === undefined) {
        ghost.hidden = true;
    } else {
        let rect = rectForZone(_drag.zone, _safeRect());
        ghost.style.left = rect.x + 'px';
        ghost.style.top = rect.y + 'px';
        ghost.style.width = rect.w + 'px';
        ghost.style.height = rect.h + 'px';
        ghost.hidden = false;
    }
}

function _onPointerUp() {
    window.removeEventListener('pointermove', _onPointerMove);
    window.removeEventListener('pointerup', _onPointerUp);
    _ghostElement().hidden = true;
    if (_drag !== undefined && _drag.moved && _drag.zone !== undefined) {
        _applyRect(_drag.popup, rectForZone(_drag.zone, _safeRect()));
        setDockMode(_drag.name, _drag.zone);
    }
    _drag = undefined;
}

function _reclampDocked() {
    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        resetDockModes();
        return;
    }
    for (let [divId, name] of _NAME_BY_DIV_ID.entries()) {
        let zone = _dockModes.get(name);
        let popup = document.getElementById(divId);
        if (zone !== undefined && popup !== null) {
            _applyRect(popup, rectForZone(zone, _safeRect()));
        }
    }
}

/** Installs the snap listeners. Must be called exactly once, from startQuirk. */
function initDialogSnap() {
    if (_initialized) {
        throw new Error("initDialogSnap was already called.");
    }
    _initialized = true;
    document.addEventListener('pointerdown', _onPointerDown);
    let reclampQueued = false;
    window.addEventListener('resize', () => {
        if (!reclampQueued) {
            reclampQueued = true;
            requestAnimationFrame(() => {
                reclampQueued = false;
                _reclampDocked();
            });
        }
    });
}
```

Add `initDialogSnap` and `notifyDialogOpened` to the `export {...}` line.

- [ ] **Step 2: Add the ghost and handle styles**

In `src/styles/dialogs.css`, inside the existing `@layer components { ... }` block, after the `.dialog-layout` rule:

```css
    [data-snap-handle] {
        cursor: grab;
        user-select: none;
        touch-action: none;
    }

    .snap-ghost {
        position: fixed;
        z-index: 12;
        pointer-events: none;
        border: 1px solid var(--ring);
        background: color-mix(in oklch, var(--ring), transparent 85%);
        border-radius: 6px;
    }

    @media (prefers-reduced-motion: no-preference) {
        .dialog-layout[data-docked] {
            transition: left 120ms ease-out, top 120ms ease-out,
                width 120ms ease-out, height 120ms ease-out;
        }
    }
```

(`--ring` must exist in `src/styles/tokens.css`; if not, use `--canvas-accent` or another existing token from that file — do not invent a new token.)

- [ ] **Step 3: Run the suite and build**

Run: `npm test 2>&1 | tail -3 && npm run build 2>&1 | tail -3`
Expected: `Completed 843/843 tests.`, build succeeds. (The interaction paths are exercised by the Task 6 e2e test.)

- [ ] **Step 4: Commit**

```bash
git add src/app/dialogSnap.js src/styles/dialogs.css
git commit -m "Add dialog drag, ghost preview, and dock interaction"
```

---

### Task 4: Non-modal docked rendering and app wiring

**Files:**
- Modify: `src/components/app-dialog.jsx`
- Modify: `src/components/app-dialogs.jsx`
- Modify: `src/app/QuirkApp.js`
- Modify: `quirk.html`

**Interfaces:**
- Consumes: `dockModes()`, `initDialogSnap()`, `notifyDialogOpened(name, popupElement)` from Tasks 2-3.
- Produces: `AppDialog` accepts `docked` (zone string or undefined) and `onOpened(popupElement)` props; `mountAppDialogs(overlayState, dockModesObservable, onDialogOpened)`.

- [ ] **Step 1: Extend AppDialog** (`src/components/app-dialog.jsx`)

Change the component signature and body:

```jsx
function AppDialog({name, divId, contentId, labelledBy, initialFocusId, active, overlayState, docked, onOpened}) {
    const adoptContent = popupElement => {
        if (popupElement === null) {
            return undefined;
        }
        const content = document.getElementById(contentId);
        popupElement.appendChild(content);
        onOpened(popupElement);
        return () => {
            document.getElementById("dialog-stash").appendChild(content);
        };
    };

    const isDocked = docked !== undefined;
    return (
        <Dialog.Root
            open={active === name}
            onOpenChange={open => {
                if (!open) {
                    overlayState.close();
                }
            }}
            modal={!isDocked}>
            <Dialog.Portal>
                {isDocked ? null : <Dialog.Backdrop className="dialog-overlay" />}
                <Dialog.Popup
                    id={divId}
                    className="dialog-layout"
                    data-docked={docked}
                    aria-labelledby={labelledBy}
                    initialFocus={initialFocusId === undefined ?
                        undefined :
                        () => document.getElementById(initialFocusId)}
                    ref={adoptContent} />
            </Dialog.Portal>
        </Dialog.Root>
    );
}
```

Then verify the non-modal behaviour against the installed Base UI version: open `node_modules/@base-ui/react/dialog` type definitions and check (a) that `modal={false}` disables the focus trap and outside-pointer blocking, and (b) which prop prevents outside-click dismissal (`dismissible`, `disableOutsidePointerDismiss`, or similar). A docked dialog must NOT close when the user clicks the circuit. If a prop exists, add it conditionally (`{...(isDocked ? {dismissible: false} : {})}` with the real name); if none exists, keep `onOpenChange` but ignore close requests while docked EXCEPT ones from Escape/✕ — Base UI passes an event/reason argument to `onOpenChange`; consult the types for its shape and gate on it. Record what you found in the commit message body.

- [ ] **Step 2: Wire the five dialog wrappers**

Each of `menu-dialog.jsx`, `export-dialog.jsx`, `forge-dialog.jsx`, `gate-param-dialog.jsx`, `bloch-dialog.jsx` forwards props to `AppDialog`. Read one (they are ~16 lines), then thread two new props (`docked`, `onOpened`) through all five the same way, e.g. in `bloch-dialog.jsx`:

```jsx
function BlochDialog({active, overlayState, docked, onOpened}) {
    return <AppDialog
        name="bloch" divId="bloch-div" contentId="bloch-dialog-content"
        labelledBy="bloch-title" active={active} overlayState={overlayState}
        docked={docked} onOpened={onOpened} />;
}
```

(Keep each file's existing name/divId/contentId/labelledBy/initialFocus values exactly — only add the two new props.)

- [ ] **Step 3: Extend AppDialogs** (`src/components/app-dialogs.jsx`)

```jsx
function AppDialogs({overlayState, dockModes, onDialogOpened}) {
    const [active, setActive] = useState(() => overlayState.current());
    useEffect(() => overlayState.active().subscribe(setActive), [overlayState]);
    const [docked, setDocked] = useState({});
    useEffect(() => dockModes.subscribe(setDocked), [dockModes]);

    const dialogProps = name => ({
        active,
        overlayState,
        docked: docked[name],
        onOpened: popupElement => onDialogOpened(name, popupElement),
    });

    return (
        <>
            <MenuDialog {...dialogProps('menu')} />
            <ExportDialog {...dialogProps('export')} />
            <ForgeDialog {...dialogProps('forge')} />
            <GateParamDialog {...dialogProps('gate-param')} />
            <BlochDialog {...dialogProps('bloch')} />
        </>
    );
}
```

`mountAppDialogs(overlayState, dockModes, onDialogOpened)` passes the two new arguments through to the render. (`dockModes` here is whatever `dockModes()` returned in Task 2 — the subscribable; match its actual `.subscribe` shape.)

- [ ] **Step 4: Wire QuirkApp** (`src/app/QuirkApp.js`)

Add the import alongside the other `./` imports (do not reorder existing lines):

```js
import {initDialogSnap, notifyDialogOpened, dockModes} from "./dialogSnap.js"
```

In `startQuirk()`: call `initDialogSnap();` immediately before `mountAppDialogs(...)`, and change that call to `mountAppDialogs(overlayState, dockModes(), notifyDialogOpened);`. Then replace the tabIndex subscription at the end (currently `overlayState.active().subscribe(active => { canvasDiv.tabIndex = active === undefined ? 0 : -1; })`) with two subscriptions that keep local variables and recompute from both:

```js
let activeOverlay = overlayState.current();
let currentDockModes = {};
let updateCanvasFocusability = () => {
    let dockedActive = activeOverlay !== undefined && currentDockModes[activeOverlay] !== undefined;
    canvasDiv.tabIndex = activeOverlay === undefined || dockedActive ? 0 : -1;
};
overlayState.active().subscribe(active => {
    activeOverlay = active;
    updateCanvasFocusability();
});
dockModes().subscribe(modes => {
    currentDockModes = modes;
    updateCanvasFocusability();
});
```

- [ ] **Step 5: Mark the drag handles** (`quirk.html`)

Add `data-snap-handle` to each of the five `<header class="dialog-header">` elements inside `#dialog-stash` (menu, export, forge, gate-param, bloch — e.g. line ~273 for bloch). No other HTML changes.

- [ ] **Step 6: Run suite and build**

Run: `npm test 2>&1 | tail -3 && npm run build 2>&1 | tail -3`
Expected: `Completed 843/843 tests.`, build green. Also run `npm run test:e2e 2>&1 | tail -4` — all 18 existing e2e tests must still pass (they exercise every dialog's modal behaviour).

- [ ] **Step 7: Commit**

```bash
git add src/components src/app/QuirkApp.js quirk.html
git commit -m "Render docked dialogs non-modal and wire the snap module"
```

---

### Task 5: Bloch canvas resize redraw

**Files:**
- Modify: `src/app/blochSphereDialog.js`
- Modify: `src/styles/dialogs.css`

**Interfaces:**
- Consumes: nothing new; internal to the Bloch dialog.

- [ ] **Step 1: Read the redraw structure**

Read `src/app/blochSphereDialog.js:240-366`. The init function looks up `#bloch-canvas` (line ~252) and redraws from subscriptions and pointer drags by calling `drawBlochScene(canvas, <latest vec>, yaw, pitch)`. Identify the local state that holds the latest vector and angles.

- [ ] **Step 2: Add a ResizeObserver**

Inside the init function, after the canvas lookup, introduce (adapting the exact local names found in Step 1 — the pattern is what matters, the redraw must reuse the same latest-state variables the drag handler uses):

```js
// A docked dialog resizes the canvas without a stats tick; redraw so the sphere fills it.
if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => drawBlochScene(canvas, latestVec, yaw, pitch)).observe(canvas);
}
```

If the existing code wraps that draw call in a named closure (e.g. a `redraw()` local), call that closure instead of duplicating the argument list.

- [ ] **Step 3: Let the docked Bloch canvas grow** (`src/styles/dialogs.css`)

The `.bloch-canvas` rule is `width: min(320px, calc(100vw - 96px))` (line ~265). Add after it, inside the same layer:

```css
    .dialog-layout[data-docked] .bloch-canvas {
        width: min(100% - 48px, 60vh);
    }
```

- [ ] **Step 4: Run suite and build**

Run: `npm test 2>&1 | tail -3 && npm run build 2>&1 | tail -3`
Expected: `Completed 843/843 tests.`, build green.

- [ ] **Step 5: Commit**

```bash
git add src/app/blochSphereDialog.js src/styles/dialogs.css
git commit -m "Redraw the Bloch sphere when docking resizes its canvas"
```

---

### Task 6: End-to-end test

**Files:**
- Create: `test_e2e/dialogSnap.test.js`
- Modify: `PuppeteerRunEndToEndTests.js` (the explicit import list at lines 26-31)

**Interfaces:**
- Consumes: `test`, `withQuirkPage`, `waitForCanvasViewport`, `circuitTopForWires` from `test_e2e/harness.js` (see `test_e2e/overlays.test.js:96-121` for the Bloch-open recipe); the `data-docked` attribute and `.dialog-overlay` backdrop from Task 4.

- [ ] **Step 1: Write the e2e spec**

Create `test_e2e/dialogSnap.test.js`:

```js
import assert from 'node:assert/strict';

import {test, withQuirkPage, waitForCanvasViewport, circuitTopForWires} from './harness.js';

async function openBlochDialog(page) {
    const canvasBounds = await page.$eval('#drawCanvas', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x, y: bounds.y};
    });
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        await waitForCanvasViewport(page);
        const circuitTop = await circuitTopForWires(page, 2);
        await page.mouse.click(canvasBounds.x + 50 + 32 + 20, canvasBounds.y + circuitTop + 25);
        opened = await page.waitForSelector('#bloch-div', {visible: true, timeout: 2000}).
            then(() => true, () => false);
    }
    assert.ok(opened, 'The Bloch sphere dialog must open.');
}

async function dragHeaderTo(page, x, y) {
    const header = await page.$eval('#bloch-div [data-snap-handle]', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x + bounds.width / 2, y: bounds.y + 10};
    });
    await page.mouse.move(header.x, header.y);
    await page.mouse.down();
    await page.mouse.move((header.x + x) / 2, (header.y + y) / 2, {steps: 5});
    await page.mouse.move(x, y, {steps: 5});
    await page.mouse.up();
}

test('docks the Bloch view to the right and keeps the circuit editable', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        await openBlochDialog(page);
        const viewport = page.viewport();

        const widthBefore = await page.$eval('#bloch-canvas', e => e.getBoundingClientRect().width);
        await dragHeaderTo(page, viewport.width - 5, viewport.height / 2);

        await page.waitForFunction(
            () => document.getElementById('bloch-div').dataset.docked === 'right',
            {timeout: 2000});
        assert.equal(await page.$('.dialog-overlay'), null,
            'A docked dialog must not render the modal backdrop.');
        const widthAfter = await page.$eval('#bloch-canvas', e => e.getBoundingClientRect().width);
        assert.notEqual(widthBefore, widthAfter, 'Docking must resize the Bloch canvas.');

        // The circuit stays interactive: click the canvas area and confirm focus can reach it.
        const dockedLeftEdge = await page.$eval('#bloch-div', e => e.getBoundingClientRect().x);
        await page.mouse.click(dockedLeftEdge / 2, viewport.height / 2);
        const canvasFocusable = await page.$eval('#canvasDiv', e => e.tabIndex);
        assert.equal(canvasFocusable, 0, 'The canvas must stay focusable while docked.');

        // Dragging back out restores modality.
        await dragHeaderTo(page, viewport.width / 2, viewport.height / 2);
        await page.waitForFunction(
            () => document.getElementById('bloch-div').dataset.docked === undefined,
            {timeout: 2000});
        assert.notEqual(await page.$('.dialog-overlay'), null,
            'An undocked dialog must be modal again.');
    });
});
```

- [ ] **Step 2: Register the spec**

In `PuppeteerRunEndToEndTests.js`, add alongside the six existing spec imports:

```js
import './test_e2e/dialogSnap.test.js';
```

- [ ] **Step 3: Run e2e, expect the new test to pass**

Run: `npm run test:e2e 2>&1 | tail -6`
Expected: `Completed 19/19 end-to-end tests.` If the new test fails, diagnose against Tasks 3-5 (common causes: the `data-docked` attribute not rendered because React didn't re-render — check the dock observable subscription; the backdrop still present — check the `modal`/backdrop conditional; drag not registering — check `[data-snap-handle]` landed in quirk.html). Fix the source, never weaken the assertions.

- [ ] **Step 4: Commit**

```bash
git add test_e2e/dialogSnap.test.js PuppeteerRunEndToEndTests.js
git commit -m "Add an end-to-end test for docking the Bloch view"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run everything**

```bash
npm test && npm run test:e2e && npm run test:perf && npm run build
```

Expected: 843/843 unit, 19/19 e2e, 7/7 perf, build green.

- [ ] **Step 2: Manual smoke via dev server**

Start the preview (`.claude/launch.json` name from that file, port 5173), open `/quirk.html#circuit={"cols":[["H"],["Bloch"]]}`, and check: drag menu dialog freely (stays modal), dock it max, Escape closes it, reopen re-docks; open Bloch view, dock right, drag a gate while docked, sphere updates live; drag Bloch out, modality returns.

- [ ] **Step 3: Commit anything outstanding, report**

Report per-suite counts and any deviations from this plan (especially the Base UI non-modal findings from Task 4 Step 1).
