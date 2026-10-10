import { Menu } from "@base-ui/react/menu";
import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { menuAnchorStyle } from "./menuAnchorStyle.js";
import {
  copySelection,
  cutSelection,
  deleteSelection,
  describeRange,
  makeGateFromSelection,
  toggleSelectionActive,
} from "./selectionCommands.js";

const writeClipboard = (text) => navigator.clipboard.writeText(text);

/**
 * The menu a right click, a touch and hold, or the menu key opens inside the selection, drawn inside
 * the circuit's scroll content so it sits where it was asked for (src/app/canvas/canvasPointer.js and
 * useCircuitKeyboard.js write the store). Its items act on the selection as it is when one is chosen,
 * like the selection's bar and keys, which offer every one of them too. The keys are named in the
 * bar's tooltips, not here: a context menu lists commands, not shortcuts.
 *
 * @param {!{host: !{current: (null|!HTMLElement)}}} props host is the scroll container the menu is
 *     positioned in.
 */
function SelectionMenu({ host }) {
  const menu = useStore(appStore, (s) => s.selectionMenu);
  const actions = useStore(appStore, (s) => s.selectionActions);
  if (menu === undefined || actions === undefined) {
    return null;
  }
  const close = () => appStore.setState({ selectionMenu: undefined });
  const anchor = menuAnchorStyle(host.current, menu);
  const range = actions.range();

  return (
    <Menu.Root open onOpenChange={(open) => !open && close()}>
      <Menu.Trigger
        nativeButton={false}
        render={
          <span
            className="gutter-menu-anchor"
            style={anchor}
            aria-hidden="true"
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner
          className="app-menu-positioner"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          {/* Opened from the keyboard, closing hands the focus back to the circuit, where the keys
              that opened it were pressed. */}
          <Menu.Popup
            className="app-menu selection-menu"
            finalFocus={menu.viaKeyboard ? host : false}
            aria-label="Selection"
          >
            <Menu.Group>
              <Menu.GroupLabel className="app-menu-label">
                {range === undefined ? "Selection" : describeRange(range)}
              </Menu.GroupLabel>
              <Menu.Item
                className="app-menu-item"
                data-action="copy"
                onClick={() => copySelection(actions, writeClipboard)}
              >
                Copy
              </Menu.Item>
              <Menu.Item
                className="app-menu-item"
                data-action="cut"
                onClick={() => cutSelection(actions, writeClipboard)}
              >
                Cut
              </Menu.Item>
              <Menu.Item
                className="app-menu-item"
                data-action="make-gate"
                onClick={() => makeGateFromSelection(actions)}
              >
                Create Gate…
              </Menu.Item>
              <Menu.Item
                className="app-menu-item"
                data-action={
                  actions.allDeactivated() ? "activate" : "deactivate"
                }
                onClick={() => toggleSelectionActive(actions)}
              >
                {actions.allDeactivated() ? "Activate" : "Deactivate"}
              </Menu.Item>
            </Menu.Group>
            <Menu.Separator className="app-menu-separator" />
            <Menu.Item
              className="app-menu-item"
              data-action="delete"
              onClick={() => deleteSelection(actions)}
            >
              Delete
            </Menu.Item>
            <Menu.Item
              className="app-menu-item"
              data-action="clear"
              onClick={() => actions.clear()}
            >
              Clear Selection
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { SelectionMenu };
