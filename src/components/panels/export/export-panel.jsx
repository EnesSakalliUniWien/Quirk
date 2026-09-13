import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { ExportPanelBody } from "./export-panel-body.jsx";

/**
 * The export panel: the circuit as a shareable link, as JSON, and the simulation's output data.
 */
function ExportPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  // The body is split out because it observes the revision, and a hook cannot be skipped while
  // the circuit is still starting up.
  return deps === undefined ? (
    null
  ) : (
    <ExportPanelBody deps={deps} />
  );
}

export { ExportPanel };
