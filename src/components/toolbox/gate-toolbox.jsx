import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { appStore } from "../../state/appStore.js";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { AtomIcon, BookOpenIcon, SearchIcon, BlocksIcon } from "lucide-react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Drawer } from "@base-ui/react/drawer";

import { Button } from "@/components/ui/button";

import { gateStyle } from "../../config/CanvasTheme.js";
import { Gates } from "../../gates/AllGates.js";
import {
  MysteryGateSymbol,
  MysteryGateMaker,
} from "../../gates/misc/Joke_MysteryGate.js";
import {
  GateTooltip,
  chipPartsOf,
  listNameOf,
  searchTextOf,
} from "./toolbox.js";

/** Below this width the sidebar becomes an off-canvas drawer instead of squeezing the circuit. */
const COMPACT_MEDIA_QUERY = "(max-width: 920px)";

/**
 * The gate palette, structured the way a shadcn sidebar is: a header holding the search, a
 * scrollable content region, and labelled groups of menu buttons - except the buttons are drag
 * sources for the circuit, not navigation. The groups do not fold: 112 gates in one scroll
 * region stay findable, and a fold remembered across sessions only hides gates from the user
 * who forgot they closed it. Search is the way to narrow the list. The painted tooltips stay
 * imperative: they are drawn by the same painter the circuit uses.
 */

/**
 * @param {!Observable.<*>} observable
 * @returns {*} The observable's latest value; Quirk observables emit their current value on
 *     subscribe, so the initial render already has one.
 */
function useObservedValue(observable) {
  const [value, setValue] = useState(() => {
    // Seed synchronously: the effect's subscription would leave the first paint empty.
    let initial = undefined;
    observable.subscribe((latest) => {
      initial = latest;
    })();
    return initial;
  });
  useEffect(() => observable.subscribe(setValue), [observable]);
  return value;
}

/** @returns {!boolean} */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * @param {*} customGateSet
 * @returns {!Array.<!{key: !string, hint: !string, gate: *, search: !string}>}
 */
function buildTileModels(customGateSet) {
  let groups = [...Gates.TopToolboxGroups, ...Gates.BottomToolboxGroups];
  if (customGateSet !== undefined && customGateSet.gates.length > 0) {
    groups = [...groups, { hint: "Custom Gates", gates: customGateSet.gates }];
  }
  const models = [];
  for (const group of groups) {
    group.gates.forEach((gate, index) =>
      models.push({
        key: `${group.hint}:${index}`,
        hint: group.hint,
        gate,
        search: searchTextOf(gate, group.hint),
      }),
    );
  }
  return models;
}

function GateChip({ gate }) {
  const style = gateStyle(gate);
  const { base, sup } = chipPartsOf(gate);
  const length = base.length + sup.length;
  const fit = length <= 3 ? "large" : length <= 6 ? "medium" : "small";
  return (
    <span
      className="gate-chip"
      data-fit={fit}
      style={{ backgroundColor: style.fill, color: style.text }}
    >
      <span className="gate-chip-symbol">
        {base}
        {sup !== "" && <sup>{sup}</sup>}
      </span>
    </span>
  );
}

function GateTile({
  model,
  hidden,
  isStop,
  onGrab,
  onPlace,
  onFocusTile,
  tooltip,
  latestTime,
  registerTile,
}) {
  const gate = model.gate;
  return (
    <button
      type="button"
      className="gate-tile"
      data-slot="sidebar-menu-button"
      data-gate-id={gate.serializedId}
      data-tile-key={model.key}
      aria-label={gate.name || gate.symbol || gate.serializedId}
      hidden={hidden}
      tabIndex={isStop ? 0 : -1}
      ref={(element) => registerTile(model.key, element)}
      onMouseEnter={(ev) => tooltip.show(ev.currentTarget, gate, latestTime())}
      onFocus={(ev) => {
        tooltip.show(ev.currentTarget, gate, latestTime());
        onFocusTile(model.key);
      }}
      onMouseLeave={() => tooltip.hide()}
      onBlur={() => tooltip.hide()}
      onPointerDown={(ev) => {
        if (ev.isPrimary && (ev.pointerType !== "mouse" || ev.button === 0)) {
          tooltip.hide();
          onGrab(model, ev.nativeEvent);
          ev.preventDefault();
        }
      }}
      onClick={(ev) => {
        // Enter and Space arrive as a click with no pointer behind it (detail 0). A pointer
        // press has already gone through the drag path on pointerdown.
        if (ev.detail === 0) {
          onPlace(model);
        }
      }}
    >
      <GateChip gate={gate} />
      <span className="gate-tile-name">{listNameOf(gate)}</span>
    </button>
  );
}

// Opens the welcome menu. Disabled while any overlay is open, like the toolbar buttons; it reads
// that from the app store so a remount of the drawer starts in the right state.
function MenuButton() {
  const overlayOpen = useStore(appStore, (s) => s.activeOverlay !== undefined);
  const openOverlay = useStore(appStore, (s) => s.openOverlay);
  return (
    <Button
      id="menu-button"
      size="icon"
      className="sidebar-menu-button"
      aria-label="Menu"
      title="Menu"
      disabled={overlayOpen}
      onClick={() => openOverlay("menu")}
    >
      <BookOpenIcon strokeWidth={1.5} aria-hidden="true" />
    </Button>
  );
}

// Renders once: memo with zero props keeps React away from this subtree while the toolbox
// re-renders around it, so the adopted toolbar root below is never re-parented. The menu button
// is its own component and re-renders on its own.
const SidebarHeader = memo(function SidebarHeader() {
  // The circuit actions toolbar is its own render-once React island, mounted once into
  // #app-toolbar-root at startup. The sidebar ADOPTS that root here and parks it back in
  // #chrome-stash on unmount, so the drawer's mount-on-open below 920px never recreates the
  // buttons the src/app modules hold by id — the dialog panels' stash pattern, applied to
  // chrome.
  const adoptToolbar = (slot) => {
    if (slot === null) {
      return undefined;
    }
    // Captured, not re-queried: by the time the cleanup runs the sidebar subtree is
    // already detached, so getElementById can no longer find the adopted root.
    const toolbarRoot = document.getElementById("app-toolbar-root");
    slot.appendChild(toolbarRoot);
    return () => {
      document.getElementById("chrome-stash").appendChild(toolbarRoot);
    };
  };

  return (
    <>
      <div className="sidebar-brand">
        <span className="app-brand-mark" aria-hidden="true">
          <AtomIcon strokeWidth={1.5} />
        </span>
        <span className="app-brand-copy">
          <strong>Shadow-Quant</strong>
        </span>
        <MenuButton />
      </div>
      <div className="sidebar-actions" ref={adoptToolbar} />
    </>
  );
});

function GateToolbox({ obsCustomGateSet, mostRecentStats, onGrab, onPlace }) {
  const customGateSet = useObservedValue(obsCustomGateSet);
  const [query, setQuery] = useState("");
  const [stopKey, setStopKey] = useState(undefined);
  // Tile models live in state so taking the mystery gate can swap in a fresh random one.
  const [models, setModels] = useState(() => buildTileModels(customGateSet));
  const builtFor = useRef(customGateSet);
  if (builtFor.current !== customGateSet) {
    builtFor.current = customGateSet;
    setModels(buildTileModels(customGateSet));
  }

  // The tooltip is the circuit's painter drawing into a floating canvas; it stays imperative.
  const [tooltip] = useState(() => new GateTooltip(document.body));
  useEffect(() => () => tooltip._element.remove(), [tooltip]);
  // Chips are static text, but a tooltip opened on a time-dependent gate paints at current time.
  const latestTimeRef = useRef(0);
  useEffect(
    () =>
      mostRecentStats.observable().subscribe((stats) => {
        latestTimeRef.current = stats.time;
      }),
    [mostRecentStats],
  );
  const latestTime = () => latestTimeRef.current;

  const trimmedQuery = query.trim().toLowerCase();
  const matches = (model) =>
    trimmedQuery === "" || model.search.includes(trimmedQuery);
  const hints = useMemo(
    () => [...new Set(models.map((m) => m.hint))],
    [models],
  );
  const anyShown = models.some(matches);

  // The tiles share one tab stop; Up and Down move between the visible ones. Without this the
  // gates are over a hundred tab stops between the search box and the rest of the page.
  const tileElements = useRef(new Map());
  const registerTile = (key, element) => {
    if (element === null) {
      tileElements.current.delete(key);
    } else {
      tileElements.current.set(key, element);
    }
  };
  const visibleKeys = models.filter(matches).map((m) => m.key);
  const effectiveStop = visibleKeys.includes(stopKey)
    ? stopKey
    : visibleKeys[0];
  const onGroupsKeyDown = (ev) => {
    const from = visibleKeys.findIndex(
      (key) => tileElements.current.get(key) === document.activeElement,
    );
    if (from === -1 || visibleKeys.length === 0) {
      return;
    }
    let to;
    switch (ev.key) {
      case "ArrowDown":
        to = Math.min(from + 1, visibleKeys.length - 1);
        break;
      case "ArrowUp":
        to = Math.max(from - 1, 0);
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = visibleKeys.length - 1;
        break;
      default:
        return;
    }
    ev.preventDefault();
    setStopKey(visibleKeys[to]);
    tileElements.current.get(visibleKeys[to]).focus();
  };

  // Taking the mystery gate leaves a different random gate behind it.
  const afterTaking = (model) => {
    if (model.gate.symbol === MysteryGateSymbol) {
      const replacement = MysteryGateMaker();
      setModels((current) =>
        current.map((m) =>
          m.key !== model.key
            ? m
            : {
                ...m,
                gate: replacement,
                search: searchTextOf(replacement, m.hint),
              },
        ),
      );
    }
  };
  const grabModel = (model, pointer) => {
    onGrab(model.gate, pointer);
    afterTaking(model);
  };
  const placeModel = (model) => {
    onPlace(model.gate);
    afterTaking(model);
  };

  // Tiles carry touch-action: none in the stylesheet, so a finger on a tile is a grab rather
  // than a scroll and the pointerdown handler above sees it.
  const groupsRef = useRef(null);

  return (
    <aside className="gate-toolbox" data-slot="sidebar" aria-label="Gates">
      <SidebarHeader />
      <div className="gate-toolbox-header" data-slot="sidebar-header">
        <div className="gate-toolbox-search">
          <SearchIcon
            className="gate-toolbox-search-icon"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            id="gate-search"
            type="search"
            className="gate-toolbox-search-input"
            data-slot="sidebar-input"
            placeholder="Search gates"
            aria-label="Search gates"
            autoComplete="off"
            spellCheck="false"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Escape" && query !== "") {
                setQuery("");
                ev.stopPropagation();
              }
            }}
          />
        </div>
      </div>
      <ScrollArea.Root
        className="gate-toolbox-content"
        data-slot="sidebar-content"
      >
        <ScrollArea.Viewport className="gate-toolbox-viewport">
          <div
            id="gate-toolbox-groups"
            className="gate-toolbox-groups"
            ref={groupsRef}
            onKeyDown={onGroupsKeyDown}
          >
            {hints.map((hint) => {
              const groupModels = models.filter((m) => m.hint === hint);
              const groupShown = groupModels.some(matches);
              return (
                <section
                  key={hint}
                  className="gate-group"
                  data-slot="sidebar-group"
                  hidden={!groupShown}
                >
                  <h3
                    className="gate-group-label"
                    data-slot="sidebar-group-label"
                  >
                    {hint}
                  </h3>
                  <div
                    className="gate-group-tiles"
                    data-slot="sidebar-group-content"
                  >
                    {groupModels.map((model) => (
                      <GateTile
                        key={model.key}
                        model={model}
                        hidden={!matches(model)}
                        isStop={model.key === effectiveStop}
                        onGrab={grabModel}
                        onPlace={placeModel}
                        onFocusTile={setStopKey}
                        tooltip={tooltip}
                        latestTime={latestTime}
                        registerTile={registerTile}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <p
            id="gate-toolbox-empty"
            className="gate-toolbox-empty"
            hidden={anyShown}
          >
            No gate matches that search.
          </p>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          className="gate-toolbox-scrollbar"
          orientation="vertical"
        >
          <ScrollArea.Thumb className="gate-toolbox-scrollbar-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  );
}

/**
 * Wide layouts get the sidebar in the flex row; narrow ones get a floating trigger that opens
 * the same palette as an off-canvas drawer, instead of a band squeezing the circuit down.
 */
function ResponsiveGateToolbox(props) {
  const compact = useMediaQuery(COMPACT_MEDIA_QUERY);
  const [open, setOpen] = useState(false);

  if (!compact) {
    return <GateToolbox {...props} />;
  }

  // A grab has to reach the canvas under the drawer, so taking a gate closes it; the document-
  // level drag tracker keeps following the pointer through the close.
  const grabAndClose = (gate, pointer) => {
    setOpen(false);
    props.onGrab(gate, pointer);
  };
  // The trigger's DOM lands in the circuit area, floating over the canvas's corner, while its
  // React position stays under the drawer root that gives it its behavior.
  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="left">
      {createPortal(
        <Drawer.Trigger
          className="gate-toolbox-drawer-trigger"
          aria-label="Open the gate palette"
        >
          <BlocksIcon strokeWidth={1.5} aria-hidden="true" />
          Gates
        </Drawer.Trigger>,
        document.getElementById("circuit-area"),
      )}
      <Drawer.Portal>
        <Drawer.Backdrop className="dialog-overlay" />
        <Drawer.Viewport className="gate-toolbox-drawer-viewport">
          <Drawer.Popup
            className="gate-toolbox-drawer-popup"
            aria-label="Gate palette"
            initialFocus={() => document.getElementById("gate-search")}
          >
            <GateToolbox {...props} onGrab={grabAndClose} />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

let gateToolboxRoot;

/**
 * @param {!{obsCustomGateSet: !Observable, mostRecentStats: !ObservableValue,
 *     onGrab: !function(!Gate, !PointerEvent): void, onPlace: !function(!Gate): void}} deps
 */
function mountGateToolbox(deps) {
  const container = document.getElementById("gate-toolbox-root");
  if (container === null) {
    throw new Error("Couldn't find 'gate-toolbox-root'");
  }
  if (gateToolboxRoot !== undefined) {
    throw new Error("The gate toolbox has already been mounted.");
  }

  flushSync(() => {
    gateToolboxRoot = createRoot(container);
    gateToolboxRoot.render(<ResponsiveGateToolbox {...deps} />);
  });
}

export { mountGateToolbox };
