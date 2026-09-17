import { useEffect, useState } from "react";

import { PanelVisibility } from "./usePanelVisibility.js";

/**
 * Whether a dock panel is on screen, from its dockview api: it changes when another tab of its
 * group comes to the front or the group is hidden. Without an api - a panel mounted outside the
 * dock - it is showing.
 *
 * @param {undefined|!Object} api Dockview's panel api: isVisible, and onDidVisibilityChange for when it changes.
 * @returns {!boolean}
 */
function useDockVisibility(api) {
  const [visible, setVisible] = useState(() => api?.isVisible ?? true);
  useEffect(() => {
    if (api === undefined) {
      return undefined;
    }
    setVisible(api.isVisible);
    const subscription = api.onDidVisibilityChange((event) => setVisible(event.isVisible));
    return () => subscription.dispose();
  }, [api]);
  return visible;
}

/** Create each dock wrapper once, so panel state survives registry consumers re-rendering. */
function createPanelComponent(name, Component) {
  const Wrapped = (props) => {
    const visible = useDockVisibility(props.api);
    return (
      <PanelVisibility.Provider value={visible}>
        <div className="panel-scroll" data-panel-id={name}>
          <Component {...props} />
        </div>
      </PanelVisibility.Provider>
    );
  };
  Wrapped.displayName = `Panel(${name})`;
  return Wrapped;
}

export { createPanelComponent };
