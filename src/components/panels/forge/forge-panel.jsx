import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { ForgePanelBody } from "./forge-panel-body.jsx";

/**
 * The gate forge: define a custom gate from a rotation, from a matrix, or from part of the circuit
 * already on screen.
 */
function ForgePanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  return deps === undefined ? (
    null
  ) : (
    <ForgePanelBody deps={deps} />
  );
}

export { ForgePanel };
