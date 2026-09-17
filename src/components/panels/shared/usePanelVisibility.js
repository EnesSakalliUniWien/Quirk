import { createContext, useContext } from "react";

/**
 * Whether the dock panel around a component is on screen. The dock's panel wrapper provides it
 * (src/components/panels/shared/panel-wrapper.jsx): a panel behind another tab of its group stays
 * mounted, and this is how its hooks know to stop working for nobody. Outside the dock, a panel
 * counts as visible.
 */
const PanelVisibility = createContext(true);

/**
 * @returns {!boolean} Whether the enclosing dock panel is showing.
 */
function usePanelVisibility() {
  return useContext(PanelVisibility);
}

export { PanelVisibility, usePanelVisibility };
