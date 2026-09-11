import { memo, useEffect, useMemo, useRef, useState } from "react";

import { AtomIcon, SearchIcon } from "lucide-react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { PreviewCard } from "@base-ui/react/preview-card";

import { GateHoverCard, gateHoverHandle } from "../gate/gate-hover.jsx";


import { useObservedValue } from "../useObservedValue.js";
import { gateStyle } from "../../config/CanvasTheme.js";
import { Gates } from "../../gates/AllGates.js";
import {
  MysteryGateSymbol,
  MysteryGateMaker,
} from "../../gates/misc/Joke_MysteryGate.js";
import {
  chipPartsOf,
  listNameOf,
  searchTextOf,
} from "./toolbox.js";

/** A tile's height and the gap between them, from src/styles/sidebar/tiles.css and groups.css.
 *  Used only to reserve space for a group whose rendering is skipped while it is off screen. */
const TILE_HEIGHT = 32;
const TILE_GAP = 2;

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
  registerTile,
}) {
  const gate = model.gate;
  return (
    <PreviewCard.Trigger
      handle={gateHoverHandle}
      payload={gate}
      render={<button type="button" />}
      className="gate-tile"
      data-slot="sidebar-menu-button"
      data-gate-id={gate.serializedId}
      data-tile-key={model.key}
      aria-label={gate.name || gate.symbol || gate.serializedId}
      hidden={hidden}
      tabIndex={isStop ? 0 : -1}
      ref={(element) => registerTile(model.key, element)}
      onFocus={() => onFocusTile(model.key)}
      onPointerDown={(ev) => {
        if (ev.isPrimary && (ev.pointerType !== "mouse" || ev.button === 0)) {
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
    </PreviewCard.Trigger>
  );
}

// Renders once: memo with zero props keeps React away from this subtree while the toolbox
// re-renders around it.
const SidebarHeader = memo(function SidebarHeader() {
  return (
    <div className="sidebar-brand">
      <span className="app-brand-mark" aria-hidden="true">
        <AtomIcon />
      </span>
      <span className="app-brand-copy">
        <strong>Shadow-Quant</strong>
      </span>
    </div>
  );
});

/**
 * The gate palette, structured the way a shadcn sidebar is: a header holding the search, a
 * scrollable content region, and labelled groups of menu buttons - except the buttons are drag
 * sources for the circuit, not navigation. The groups do not fold: 112 gates in one scroll
 * region stay findable, and a fold remembered across sessions only hides gates from the user
 * who forgot they closed it. Search is the way to narrow the list.
 *
 * It is the content of the gates dock panel (src/components/panels/gates-panel.jsx), which fills.
 */
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

  // Chips are static text, but a card opened on a time-dependent gate describes it at the
  // animation's current phase.
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
          <SearchIcon className="gate-toolbox-search-icon" aria-hidden="true" />
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
                    /* The height this group would have, so one whose rendering is skipped while
                       off screen still takes its real space and the scrollbar means something. */
                    style={{
                      containIntrinsicSize: `auto ${groupModels.length * TILE_HEIGHT + (groupModels.length - 1) * TILE_GAP}px`,
                    }}
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
      {/* One card for every tile: the triggers above drive it through the shared handle. */}
      <GateHoverCard latestTime={latestTime} />
    </aside>
  );
}

export { GateToolbox };
