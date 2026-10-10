import { useColourScheme } from "../useColourScheme.js";
import { observeStore } from "../../base/valueStore.js";
import { useStore } from "zustand";
import { appStore } from "../../state/appStore.js";
import { trackPointerUntilRelease } from "../../browser/PointerDrag.js";
import { clampCell } from "../../circuit/circuitRange.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InfoIcon, SearchIcon } from "lucide-react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { PreviewCard } from "@base-ui/react/preview-card";
import { Popover } from "@base-ui/react/popover";
import { Button } from "../ui/button.jsx";

import {
  GateHoverCard,
  gateHoverHandle,
  gateDetailsHandle,
} from "../gate/gate-hover.jsx";

import { useObservedValue } from "../useObservedValue.js";
import { gateStyle } from "../../config/CanvasTheme.js";
import { Gates } from "../../gates/AllGates.js";
import {
  MysteryGateSymbol,
  MysteryGateMaker,
} from "../../gates/misc/RandomUnitaryGate.js";
import { chipPartsOf, listNameOf, searchTextOf } from "./toolbox.js";

/** A tile's height and the gap between them, from src/styles/gates/toolbox/tiles.css and groups.css:
 *  the taller of its details button and its padded chip, which grows with the browser's text size.
 *  Used only to reserve space for a group whose rendering is skipped while it is off screen. */
const TILE_HEIGHT = "max(32px, 1.625rem + 4px)";
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
  useColourScheme();
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
  const accessibleName = gate.name || gate.symbol || gate.serializedId;
  const stopPress = useRef(undefined);
  const suppressClick = useRef(false);
  useEffect(() => {
    const cancel = () => {
      if (stopPress.current === undefined) return;
      stopPress.current();
      stopPress.current = undefined;
      suppressClick.current = true;
    };
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
    };
  }, []);
  return (
    <div className="gate-tile-row" hidden={hidden}>
      <PreviewCard.Trigger
        handle={gateHoverHandle}
        payload={gate}
        render={<button type="button" />}
        className="gate-tile"
        data-slot="sidebar-menu-button"
        data-gate-id={gate.serializedId}
        data-tile-key={model.key}
        aria-label={accessibleName}
        aria-describedby="gate-toolbox-instructions"
        hidden={hidden}
        tabIndex={isStop ? 0 : -1}
        ref={(element) => registerTile(model.key, element)}
        onFocus={() => onFocusTile(model.key)}
        onPointerDown={(ev) => {
          if (!ev.isPrimary || (ev.pointerType === "mouse" && ev.button !== 0))
            return;
          stopPress.current?.();
          stopPress.current = undefined;
          suppressClick.current = false;
          // Touch keeps native scrolling and tap activation. Only a deliberate mouse movement
          // takes a gate, before revealing a circuit that might share this palette's tab group.
          if (ev.pointerType !== "mouse") return;
          const start = ev.nativeEvent;
          stopPress.current = trackPointerUntilRelease(start, {
            onMove: (pointer) => {
              if (
                Math.hypot(
                  pointer.clientX - start.clientX,
                  pointer.clientY - start.clientY,
                ) < 6
              )
                return;
              stopPress.current();
              stopPress.current = undefined;
              suppressClick.current = true;
              onGrab(model, pointer);
              pointer.preventDefault();
            },
            onRelease: () => {
              stopPress.current = undefined;
            },
            onCancel: () => {
              stopPress.current = undefined;
              suppressClick.current = true;
            },
          });
        }}
        onClick={(ev) => {
          if (ev.detail === 0 || !suppressClick.current) {
            onPlace(model);
          }
        }}
      >
        <GateChip gate={gate} />
        <span className="gate-tile-name">{listNameOf(gate)}</span>
      </PreviewCard.Trigger>
      <Popover.Trigger
        handle={gateDetailsHandle}
        payload={gate}
        render={<Button size="icon" />}
        className="gate-details-trigger"
        aria-label={`Details for ${accessibleName}`}
        tabIndex={isStop ? 0 : -1}
        onFocus={() => onFocusTile(model.key)}
      >
        <InfoIcon aria-hidden="true" />
      </Popover.Trigger>
    </div>
  );
}

/**
 * The gate palette, structured the way a shadcn sidebar is: a header holding the search, a
 * scrollable content region, and labelled groups of menu buttons - except the buttons are drag
 * sources for the circuit, not navigation. The groups do not fold: 112 gates in one scroll
 * region stay findable, and a fold remembered across sessions only hides gates from the user
 * who forgot they closed it. Search is the way to narrow the list.
 *
 * It is the content of the gates dock panel (src/components/panels/gates/gates-panel.jsx), which fills.
 */
function GateToolbox({ obsCustomGateSet, mostRecentStats, onGrab, onPlace }) {
  const panelDeps = useStore(appStore, (state) => state.panelDeps);
  const customGateSet = useObservedValue(obsCustomGateSet);
  const [query, setQuery] = useState("");
  const [stopKey, setStopKey] = useState(undefined);
  // Tile models live in state so taking the random unitary gate can swap in a fresh random one.
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
      observeStore(mostRecentStats).subscribe((stats) => {
        latestTimeRef.current = stats.time;
      }),
    [mostRecentStats],
  );
  const latestTime = () => latestTimeRef.current;

  const trimmedQuery = query.trim().toLowerCase();
  const matches = useCallback(
    (model) => trimmedQuery === "" || model.search.includes(trimmedQuery),
    [trimmedQuery],
  );
  const hints = useMemo(
    () => [...new Set(models.map((m) => m.hint))],
    [models],
  );
  const anyShown = models.some(matches);

  // The active row has a placement stop and a details stop; Up and Down move between rows.
  // This avoids hundreds of tab stops between search and the rest of the page.
  const tileElements = useRef(new Map());
  const customGateFocus = useStore(appStore, (state) => state.customGateFocus);
  useEffect(() => {
    if (!customGateFocus) return;
    const model = models.find(
      (model) => model.gate.serializedId === customGateFocus,
    );
    if (!model) return;
    // A search that already shows the new gate stays; only one that hides it is cleared.
    if (!matches(model)) {
      setQuery("");
      return;
    }
    const element = tileElements.current.get(model.key);
    if (!element) return;
    setStopKey(model.key);
    element.scrollIntoView({ block: "nearest" });
    element.focus();
    appStore.setState({ customGateFocus: undefined });
  }, [customGateFocus, models, matches]);
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
    const focusedTile = document.activeElement
      .closest(".gate-tile-row")
      ?.querySelector(".gate-tile");
    const from = visibleKeys.findIndex(
      (key) => tileElements.current.get(key) === focusedTile,
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

  // Taking the random unitary gate leaves a different random gate behind it.
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

  const groupsRef = useRef(null);

  return (
    <aside className="gate-toolbox" data-slot="sidebar" aria-label="Gates">
      <h2 className="visually-hidden">Gates</h2>
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
              if (ev.nativeEvent.isComposing) {
                ev.stopPropagation();
                return;
              }
              if (ev.key === "Escape" && query !== "") {
                setQuery("");
                ev.stopPropagation();
              }
            }}
          />
        </div>
        {panelDeps === undefined ? (
          <p
            id="gate-toolbox-instructions"
            className="gate-toolbox-instructions"
          >
            Arrow keys browse. Click, tap or Enter adds at the selected circuit
            cell, or the end of the top wire.
          </p>
        ) : (
          <PlacementInstruction deps={panelDeps} />
        )}
      </div>
      <ScrollArea.Root
        className="gate-toolbox-content"
        data-slot="sidebar-content"
      >
        <ScrollArea.Viewport className="gate-toolbox-viewport">
          {/* eslint-disable-next-line jsx-a11y-x/no-static-element-interactions -- Delegate roving arrow navigation from focusable gate buttons; this layout wrapper has no independent action. */}
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
                      containIntrinsicSize: `auto calc(${groupModels.length} * ${TILE_HEIGHT} + ${(groupModels.length - 1) * TILE_GAP}px)`,
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
            role="status"
            hidden={anyShown}
          >
            No gate matches that search. Press Escape in search to clear it.
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

function PlacementInstruction({ deps }) {
  const cursor = useStore(appStore, (state) => state.circuitCursor);
  const circuit = useStore(
    deps.displayed,
    (state) => state.value.displayedCircuit.circuitDefinition,
  );
  const cell = cursor === undefined ? undefined : clampCell(circuit, cursor);
  const destination =
    cell === undefined
      ? "the end of the top wire"
      : `column ${cell.col + 1}, q${cell.row}`;
  return (
    <p id="gate-toolbox-instructions" className="gate-toolbox-instructions">
      Arrow keys browse. Click, tap or Enter adds at {destination}.
    </p>
  );
}

export { GateToolbox };
