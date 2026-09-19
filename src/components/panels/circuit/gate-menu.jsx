import { Menu } from "@base-ui/react/menu";
import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { openPanel } from "../../dock.jsx";

/**
 * The menu a right click on a gate opens, drawn inside the circuit's scroll content so it sits
 * where the click was (src/app/canvas/canvasPointer.js writes the store). Switch the gate off or
 * on, edit its parameter when it has one, or delete it. The gate is read from its slot when an item
 * is chosen, so a menu left open over a circuit that changed acts on what is there now, or on
 * nothing.
 *
 * @param {!{host: !{current: (null|!HTMLElement)}}} props host is the scroll container the menu is
 *     positioned in.
 */
function GateMenu({ host }) {
  const menu = useStore(appStore, (s) => s.gateMenu);
  const actions = useStore(appStore, (s) => s.gateActions);
  if (menu === undefined || actions === undefined) {
    return null;
  }
  const close = () => appStore.setState({ gateMenu: undefined });
  const element = host.current;
  const box = element === null ? { left: 0, top: 0 } : element.getBoundingClientRect();
  const anchor = {
    left: `${menu.x - box.left + (element?.scrollLeft ?? 0)}px`,
    top: `${menu.y - box.top + (element?.scrollTop ?? 0)}px`,
  };
  const gate = actions.gateAt(menu.col, menu.row) ?? menu.gate;
  const editParameter = () => {
    const current = actions.gateAt(menu.col, menu.row);
    if (current?.paramDialog === undefined) {
      return;
    }
    appStore.setState({ gateParamTarget: { col: menu.col, row: menu.row, gate: current } });
    openPanel("gate-param");
  };

  return (
    <Menu.Root open onOpenChange={(open) => !open && close()}>
      <Menu.Trigger nativeButton={false} render={<span className="gutter-menu-anchor" style={anchor} aria-hidden="true" />} />
      <Menu.Portal>
        <Menu.Positioner className="app-menu-positioner" side="bottom" align="start" sideOffset={4}>
          {/* The anchor is not a control, so closing hands focus nowhere: the parameter panel an
              item opens keeps the focus it took. */}
          <Menu.Popup className="app-menu gate-menu" finalFocus={false}
            aria-label={`${gate.name} at wire ${menu.row + 1}, column ${menu.col + 1}`}>
            <Menu.Group>
              <Menu.GroupLabel className="app-menu-label">{gate.name}</Menu.GroupLabel>
              <Menu.Item
                className="app-menu-item"
                data-action={gate.deactivated ? "activate" : "deactivate"}
                onClick={() => actions.setDeactivated(menu.col, menu.row, !gate.deactivated)}
              >
                {gate.deactivated ? "Activate" : "Deactivate"}
              </Menu.Item>
              {gate.paramDialog !== undefined && (
                <Menu.Item className="app-menu-item" data-action="edit" onClick={editParameter}>
                  Edit parameter…
                </Menu.Item>
              )}
            </Menu.Group>
            <Menu.Separator className="app-menu-separator" />
            <Menu.Item className="app-menu-item" data-action="delete" onClick={() => actions.remove(menu.col, menu.row)}>
              Delete
              <kbd>middle-click</kbd>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { GateMenu };
