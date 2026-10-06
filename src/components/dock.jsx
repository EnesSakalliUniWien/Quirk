import { DockviewDefaultTab, DockviewReact } from "dockview-react";
import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { Button } from "./ui/button.jsx";

import { AdaptiveDock } from "./adaptive-dock.js";
import { useColourScheme } from "./useColourScheme.js";

import { Theme } from "../config/Theme.js";
import { appStore } from "../state/appStore.js";
import { PANELS, PANEL_COMPONENTS } from "./panels/panels.jsx";

/** Where the dock's arrangement is remembered between visits. */
const LAYOUT_STORAGE_KEY = "shadow-quant.dock-layout";
/** Below this width the dock temporarily shares one tab group, retaining its wide arrangement. */
const NARROW_WIDTH = 920;
const adaptiveDocks = new WeakMap();
/** A side panel opens at this share of the dock's width, within the bounds below. */
const SIDE_SHARE = 0.32;
const SIDE_MIN_WIDTH = 340;
const SIDE_MAX_WIDTH = 480;

/**
 * @param {!Object} api
 * @returns {void}
 */
function saveLayout(api, adaptive) {
  try {
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify(withoutFloatingPanels(adaptive.layout())),
    );
  } catch {
    // A browser that refuses site data just gets the default arrangement next time.
  }
}

/**
 * The arrangement worth remembering is the docked one. A floating panel answers a moment - a
 * greeting, a clicked gate, a clicked sphere - and reopening it on the next visit would be
 * answering a question nobody asked.
 *
 * @param {!Object} layout
 * @returns {!Object}
 */
function withoutFloatingPanels(layout) {
  const floating = new Set(
    (layout.floatingGroups ?? []).flatMap((group) => group.data?.views ?? []),
  );
  if (floating.size === 0) {
    return layout;
  }
  const panels = Object.fromEntries(
    Object.entries(layout.panels ?? {}).filter(([id]) => !floating.has(id)),
  );
  const { floatingGroups: _dropped, ...rest } = layout;
  return { ...rest, panels };
}

/**
 * @returns {undefined|!Object} The remembered arrangement, or undefined for none.
 */
function readLayout() {
  try {
    const text = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Place permanent panels in the initial wide arrangement. AdaptiveDock borrows a single tab group
 * on narrow screens and restores this arrangement when there is room.
 *
 * @param {!{direction: !string, width: !int}} side
 * @returns {!Object} Placement options for dockview's addPanel.
 */
function besideTheCircuitAtWidth({ direction, width }) {
  return {
    position: { referencePanel: "circuit", direction },
    initialWidth: width,
    inactive: true,
  };
}

/**
 * Puts every panel that must always be present back on screen: on a first visit, when a layout
 * saved by an older version is missing one, and when one was floated, since floating panels are
 * not remembered. The circuit and its gate palette are the app rather than views of it.
 *
 * @param {!Object} api
 * @returns {void}
 */
function addMissingPermanentPanels(api) {
  for (const [name, panel] of Object.entries(PANELS)) {
    if (panel.permanent === true && api.getPanel(name) === undefined) {
      api.addPanel({
        id: name,
        component: name,
        title: panel.title,
        renderer: "always",
        ...(panel.side === undefined
          ? {}
          : besideTheCircuitAtWidth(panel.side)),
      });
    }
  }
}

/**
 * Every tab as dockview draws it, with the panel's own mark before its title. Close belongs to
 * the separate group header action, so tabs do not contain nested interactive buttons.
 *
 * @param {!Object} props dockview's tab props.
 */
function DockTab(props) {
  const panel = PANELS[props.api.id];
  const Icon = panel?.icon;
  const middlePointer = useRef(null);
  const cancelMiddleClose = () => {
    middlePointer.current = null;
  };
  return (
    <span className="dock-tab">
      {Icon === undefined ? undefined : (
        <Icon className="dock-tab-icon" aria-hidden="true" />
      )}
      <DockviewDefaultTab
        {...props}
        hideClose
        onPointerDown={(event) => {
          middlePointer.current =
            event.button === 1 && panel?.permanent !== true
              ? event.pointerId
              : null;
        }}
        onPointerUp={(event) => {
          const close =
            event.button === 1 && middlePointer.current === event.pointerId;
          cancelMiddleClose();
          if (close) {
            event.preventDefault();
            closePanel(props.api.id);
          }
        }}
        onPointerLeave={cancelMiddleClose}
        onPointerCancel={cancelMiddleClose}
      />
    </span>
  );
}

/** A close action beside the tab list, so a tab never nests another interactive control. */
function DockGroupActions({ activePanel }) {
  if (activePanel === undefined || PANELS[activePanel.id]?.permanent === true)
    return null;
  return (
    <Button
      className="dock-group-close"
      size="icon"
      data-close-panel-id={activePanel.id}
      aria-label={`Close ${activePanel.title}`}
      title={`Close ${activePanel.title}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => closePanel(activePanel.id)}
    >
      <XIcon aria-hidden="true" />
    </Button>
  );
}

/**
 * Where a newly opened panel goes, unless the caller says otherwise: beside the circuit rather
 * than on top of it. A panel added with no position joins the active group as another tab, which
 * would hide whatever is showing - and what is usually showing is the circuit.
 *
 * The first such panel splits off its own group to the right; the rest join that group, so opening
 * three views does not carve the circuit into three slivers.
 *
 * @param {!Object} api
 * @returns {!Object} A dockview position.
 */
function besideTheCircuit(api) {
  if (adaptiveDocks.get(api)?.narrow)
    return { position: { referencePanel: "circuit" } };
  const sidePanel = api.panels.find(
    (candidate) =>
      PANELS[candidate.id]?.permanent !== true &&
      PANELS[candidate.id]?.floating === undefined,
  );
  // Given a width of its own, the new column takes its room from the circuit. Without one, dockview
  // shares the whole width out evenly, and the gate palette swells to a third of the screen.
  const width = Math.round(
    Math.min(SIDE_MAX_WIDTH, Math.max(SIDE_MIN_WIDTH, api.width * SIDE_SHARE)),
  );
  return sidePanel === undefined
    ? {
        position: { referencePanel: "circuit", direction: "right" },
        initialWidth: width,
      }
    : { position: { referenceGroup: sidePanel.group } };
}

/**
 * Keeps the gate palette at its width while columns come and go. Dockview shares the width out
 * evenly whenever a group is removed, or added without a size: closing the last side panel would
 * hand the palette half the screen. A width the user drags it to is kept the same way.
 *
 * The width is remembered on each layout change, which dockview reports a microtask late, so when a
 * group is added or removed the remembered width is still the one from before.
 *
 * @param {!Object} api
 * @param {AdaptiveDock} adaptive
 * @returns {() => void}
 */
function keepPaletteWidth(api, adaptive) {
  // Only a column of its own: on a narrow screen the palette is a tab in the circuit's group.
  const paletteColumn = () => {
    const group = api.getPanel("gates")?.group;
    return group === undefined ||
      group.api.location.type !== "grid" ||
      group.panels.some((panel) => panel.id === "circuit")
      ? undefined
      : group;
  };
  let width = paletteColumn()?.api.width;
  const layoutSubscription = api.onDidLayoutChange(() => {
    if (!adaptive.narrow && !adaptive.changing)
      width = paletteColumn()?.api.width;
  });
  const restore = () => {
    if (adaptive.narrow || adaptive.changing) return;
    const column = paletteColumn();
    if (
      column !== undefined &&
      width !== undefined &&
      column.api.width !== width
    ) {
      column.api.setSize({ width });
    }
  };
  const added = api.onDidAddGroup(restore);
  const removed = api.onDidRemoveGroup(restore);
  return () => {
    layoutSubscription.dispose();
    added.dispose();
    removed.dispose();
  };
}

/**
 * A floating window that does not fit the dock is worse than a smaller one: it hangs off the edge
 * and takes the circuit with it. Its wanted size is a maximum, not a promise.
 *
 * @param {!{width: !int, height: !int}} wanted
 * @returns {!{width: !int, height: !int, position?: {left: number, top: number}}}
 */
function floatingSizeWithin(wanted) {
  const dock = document.querySelector(".app-dock");
  if (dock === null) {
    return wanted;
  }
  const margin = 32;
  const width = Math.min(wanted.width, Math.max(1, dock.clientWidth - margin));
  const height = Math.min(
    wanted.height,
    Math.max(1, dock.clientHeight - margin),
  );
  return {
    width,
    height,
    position: {
      left: (dock.clientWidth - width) / 2,
      top: (dock.clientHeight - height) / 2,
    },
  };
}

/**
 * Shows a panel by its name in PANELS, or focuses it if it is already open. This is the whole
 * mechanism for making a panel appear: no markup, no mounting, no shell changes.
 *
 * @param {!string} name
 * @param {!Object=} options Passed through to dockview's addPanel, for placement and floating.
 * @returns {void}
 */
function openPanel(name, options = {}) {
  const api = appStore.getState().dock;
  const panel = PANELS[name];
  if (api === undefined || panel === undefined) {
    return;
  }
  const existing = api.getPanel(name);
  if (existing !== undefined) {
    existing.api.setActive();
    return;
  }
  api.addPanel({
    id: name,
    component: name,
    title: panel.title,
    // Tab changes and temporary narrow layouts must retain editor drafts as well as the circuit. A
    // floating window is never folded into a tab, and dockview repositions an always-rendered
    // overlay only on a later resize: with no glide to cause one under reduced motion, the Bloch
    // window stayed at the sliver it was first laid out at, and blank.
    renderer: panel.floating === undefined ? "always" : "onlyWhenVisible",
    ...(panel.floating === undefined
      ? besideTheCircuit(api)
      : { floating: floatingSizeWithin(panel.floating) }),
    ...options,
  });
}

/**
 * Closes a panel by name, if it is open and not one the app needs.
 *
 * @param {!string} name
 * @returns {void}
 */
function closePanel(name) {
  const api = appStore.getState().dock;
  const existing = api === undefined ? undefined : api.getPanel(name);
  if (existing !== undefined && PANELS[name]?.permanent !== true) {
    existing.api.close();
  }
}

/**
 * The dock: the one thing that decides where panels live. Panels are registered by name in
 * src/components/panels/panels.jsx and placed by openPanel, and the arrangement the user drags
 * them into is remembered.
 */
function Dock() {
  useColourScheme();
  const cleanupRef = useRef(() => {});
  useEffect(() => () => cleanupRef.current(), []);
  const hostRef = useRef(/** @type {HTMLElement | null} */ (null));
  const onReady = (event) => {
    const { api } = event;
    appStore.setState({ dock: api });
    // Sized before anything is placed. Dockview learns its size from a resize observer a frame
    // later, and a panel added at a width to a grid of no size - the gate palette at 240px - is
    // scaled with the grid afterwards instead of keeping its width.
    const host = hostRef.current;
    if (host !== null) {
      api.layout(
        host.clientWidth <= NARROW_WIDTH ? 1200 : host.clientWidth,
        host.clientHeight,
      );
    }

    const saved = readLayout();
    if (saved !== undefined) {
      try {
        api.fromJSON(saved);
      } catch (ex) {
        // A layout from a version whose panels no longer exist. Start over rather than strand
        // the user in a dock that cannot render itself - but say so, because silently losing an
        // arrangement the user built is worse than the arrangement being wrong.
        console.warn(
          "Could not restore the dock layout; starting from the default.",
          ex,
        );
        api.clear();
      }
    }
    addMissingPermanentPanels(api);
    // A saved layout remembers each tab's title; the registry's is the one to show, so a panel
    // renamed since the layout was saved shows its new name.
    for (const panel of api.panels) {
      panel.api.setRenderer("always");
      const title = PANELS[panel.id]?.title;
      if (title !== undefined && panel.title !== title) {
        panel.api.setTitle(title);
      }
    }
    // Subscribed after the restore, so the half-built states dockview reports while it rebuilds
    // are never written back.
    const adaptive = new AdaptiveDock(api, withoutFloatingPanels(api.toJSON()));
    adaptiveDocks.set(api, adaptive);
    const resize = () => {
      if (!host) return;
      const narrow = host.clientWidth <= NARROW_WIDTH;
      // Capture before shrinking; expanding needs the new dimensions before restoring splits.
      if (narrow) adaptive.setNarrow(true);
      api.layout(host.clientWidth, host.clientHeight);
      if (!narrow) adaptive.setNarrow(false);
      for (const group of api.groups) {
        if (group.api.location.type !== "floating") continue;
        group.api.setSize({
          width: Math.min(group.api.width, Math.max(1, host.clientWidth - 16)),
          height: Math.min(
            group.api.height,
            Math.max(1, host.clientHeight - 16),
          ),
        });
      }
    };
    resize();
    const layoutSubscription = api.onDidLayoutChange(() => {
      if (adaptive.changing || (!adaptive.narrow && api.width <= NARROW_WIDTH))
        return;
      if (adaptive.narrow) {
        adaptive.reconcile();
        if (
          api.groups.filter((group) => group.api.location.type === "grid")
            .length > 1
        )
          adaptive.gather();
      }
      saveLayout(api, adaptive);
    });
    const releasePaletteWidth = keepPaletteWidth(api, adaptive);
    const observer = new ResizeObserver(resize);
    if (host) observer.observe(host);
    cleanupRef.current = () => {
      observer.disconnect();
      layoutSubscription.dispose();
      releasePaletteWidth();
      adaptiveDocks.delete(api);
    };
  };

  // Wrapped, because dockview's className lands on an inner element: the flex child the work area
  // sizes has to be one this file owns.
  return (
    <main
      className="app-dock"
      aria-label="Quantum circuit workspace"
      ref={hostRef}
    >
      <DockviewReact
        theme={Theme.dock}
        floatingGroupBounds="boundedWithinViewport"
        components={PANEL_COMPONENTS}
        defaultTabComponent={DockTab}
        rightHeaderActionsComponent={DockGroupActions}
        onReady={onReady}
      />
    </main>
  );
}

export { Dock, openPanel, closePanel };
