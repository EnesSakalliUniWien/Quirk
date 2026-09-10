import { useStore } from "zustand";

import { appStore } from "../../state/appStore.js";
import { GateToolbox } from "../toolbox/gate-toolbox.jsx";

/**
 * The gate palette, as a dock panel like any other: it starts beside the circuit, and it can be
 * resized, moved, tabbed or floated like the rest. It is permanent, so it is always somewhere.
 *
 * A gate is taken by dragging it onto the circuit, so the circuit has to be in view once the drag
 * starts. When the palette shares a group with the circuit - as it does, as a tab, on a narrow
 * screen - taking a gate brings the circuit to the front. The drag tracker listens on the
 * document, so it follows the pointer through the switch.
 */
function GatesPanel() {
  // Published by startQuirk; the shell stays hidden until then.
  const gateToolbox = useStore(appStore, (s) => s.gateToolbox);
  if (gateToolbox === undefined) {
    return null;
  }
  const grabShowingCircuit = (gate, pointer) => {
    // Asked of the group, not the panel: the circuit renders "always", so it stays laid out - and
    // can report itself visible - while another tab of its group covers it.
    const circuit = appStore.getState().dock?.getPanel("circuit");
    if (circuit !== undefined && circuit.group.activePanel !== circuit) {
      circuit.api.setActive();
    }
    gateToolbox.onGrab(gate, pointer);
  };
  return <GateToolbox {...gateToolbox} onGrab={grabShowingCircuit} />;
}

export { GatesPanel };
