import { useStore } from "zustand";
import { AtomIcon } from "lucide-react";

import { appStore } from "../state/appStore.js";
import { Dock } from "./dock.jsx";
import { AppToolbar } from "./toolbar/app-toolbar.jsx";
import { TransportBar } from "./toolbar/transport-bar.jsx";
import { IconProvider } from "./ui/icon.jsx";
import { Toasts } from "./ui/toasts.jsx";

/**
 * The whole shell, under the app's one React root: the toolbar strip, the transport strip, and the
 * work area. Nothing outside this tree creates DOM.
 *
 * Both strips are at the top of the window: a window moved partly off the screen, or a browser bar
 * over its lower edge, never hides the controls that run the circuit.
 *
 * The work area is the dock, and the dock is where every panel lives - the circuit and the gate
 * palette included. Adding a view to the app is a panel registration, not a change here.
 */
function App() {
  // Published by the circuit panel once startQuirk has run: the shell stays hidden until the first
  // frame is about to be painted.
  const booted = useStore(appStore, (s) => s.booted);

  return (
    // Hidden rather than taken out of the layout: the dock measures itself while the circuit boots,
    // so a panel placed at a size - the gate palette beside the circuit - keeps that size.
    // Every icon under here is drawn at the one stroke the provider sets.
    <IconProvider>
      <div
        id="inspectorDiv"
        style={{ visibility: booted ? undefined : "hidden" }}
      >
        <header>
          <div className="app-header">
            <h1 className="app-brand" style={{ margin: 0 }}>
              <span className="app-brand-mark" aria-hidden="true">
                <AtomIcon />
              </span>
              <strong>Quirk-Bench</strong>
            </h1>
            <AppToolbar />
          </div>
          <TransportBar />
        </header>
        <Dock />
      </div>
      <Toasts />
    </IconProvider>
  );
}

export { App };
