import { Menu } from "@base-ui/react/menu";
import { INPUT_LETTERS } from "../../../circuit/model/InputLetters.js";
import { appStore } from "../../../state/appStore.js";
import { openPanel } from "../../dock.jsx";

/**
 * The wire label's menu. On a wire outside every register: group it. On a register's wire: rename
 * the register, choose the input it feeds, or ungroup it.
 */
function GutterMenu({ menu, host, actions }) {
  const close = () => appStore.setState({ gutterMenu: undefined });
  const element = host.current;
  const box = element === null ? { left: 0, top: 0 } : element.getBoundingClientRect();
  const anchor = {
    left: `${menu.x - box.left + (element?.scrollLeft ?? 0)}px`,
    top: `${menu.y - box.top + (element?.scrollTop ?? 0)}px`,
  };
  const register = menu.register === undefined ? undefined : actions.current().named(menu.register);
  const renameHere = (name, rect) => appStore.setState({ registerRename: { name, rect } });

  return (
    <Menu.Root open onOpenChange={(open) => !open && close()}>
      <Menu.Trigger nativeButton={false} render={<span className="gutter-menu-anchor" style={anchor} aria-hidden="true" />} />
      <Menu.Portal>
        <Menu.Positioner className="app-menu-positioner" side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className="app-menu" aria-label={register === undefined ? `Wire q${menu.wire}` : `Register ${register.name}`}>
            {register === undefined ? (
              <Menu.Item
                className="app-menu-item"
                onClick={() => {
                  const name = actions.addAt(menu.wire);
                  if (name !== undefined) {
                    // The new register's name sits where the wire's label was; offer it at once.
                    const created = actions.current().named(name);
                    if (created !== undefined) {
                      openPanel("registers");
                      appStore.setState({ registerTarget: name });
                    }
                  }
                }}
              >
                {`Group q${menu.wire} into a register`}
              </Menu.Item>
            ) : (
              <>
                <Menu.Item
                  className="app-menu-item"
                  onClick={() => (menu.rect === undefined ? undefined : renameHere(register.name, menu.rect))}
                >
                  {`Rename ${register.name}…`}
                  <kbd>double-click</kbd>
                </Menu.Item>
                <Menu.Group>
                  <Menu.GroupLabel className="app-menu-label">Feeds input</Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={register.input ?? ""}
                    onValueChange={(value) => actions.feed(register.name, value === "" ? undefined : value)}
                  >
                    <Menu.RadioItem className="app-menu-item" value="">
                      None
                    </Menu.RadioItem>
                    {INPUT_LETTERS.map((letter) => (
                      <Menu.RadioItem key={letter} className="app-menu-item" value={letter}>
                        {`Input ${letter}`}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Group>
                <Menu.Separator className="app-menu-separator" />
                <Menu.Item className="app-menu-item" onClick={() => actions.remove(register.name)}>
                  {`Ungroup ${register.name}`}
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { GutterMenu };
