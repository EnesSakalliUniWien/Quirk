import { useStore } from "zustand";

import { appStore } from "../state/appStore.js";
import { Dock } from "./dock.jsx";
import { AppToolbar } from "./toolbar/app-toolbar.jsx";
import { TransportBar } from "./toolbar/transport-bar.jsx";
import { ResponsiveGateToolbox } from "./toolbox/gate-toolbox.jsx";

/**
 * The whole shell, under the app's one React root: the toolbar strip, the work area, and the
 * transport strip. Nothing outside this tree creates DOM.
 *
 * The work area is the gate palette beside the dock, and the dock is where every panel lives -
 * the circuit included. Adding a view to the app is a panel registration, not a change here.
 */
function App() {
  // Both are published by the circuit panel once startQuirk has run: the palette needs the drag
  // and place pipelines, and the shell stays hidden until the first frame is about to be painted.
  const gateToolbox = useStore(appStore, (s) => s.gateToolbox);
  const circuitArea = useStore(appStore, (s) => s.circuitArea);
  const booted = useStore(appStore, (s) => s.booted);

  return (
    // An inline style, because #inspectorDiv's own display rule outranks the [hidden] attribute.
    <div id="inspectorDiv" style={{ display: booted ? undefined : "none" }}>
      <AppToolbar />
      <div className="app-body">
        {gateToolbox !== undefined && (
          <ResponsiveGateToolbox
            {...gateToolbox}
            circuitArea={circuitArea}
          />
        )}
        <Dock />
      </div>
      <TransportBar />
    </div>
  );
}

export { App };
