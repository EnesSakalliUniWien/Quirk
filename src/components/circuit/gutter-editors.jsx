import { Menu } from "@base-ui/react/menu";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { INPUT_LETTERS } from "../../circuit/model/InputLetters.js";
import { Layout } from "../../config/Layout.js";
import { appStore } from "../../state/appStore.js";
import { openPanel } from "../dock.jsx";

/**
 * The editors that sit over the circuit's gutter: renaming a register where its name is drawn, and
 * the menu a right click on a wire label opens. The canvas says where (src/app/canvas/
 * canvasPointer.js writes the store); this file draws them there, inside the scroll content, so
 * they move with the drawing.
 *
 * @param {!{host: !{current: (null|!HTMLElement)}}} props host is the scroll container the
 *     editors are positioned in.
 */
function GutterEditors({ host }) {
  const rename = useStore(appStore, (s) => s.registerRename);
  const menu = useStore(appStore, (s) => s.gutterMenu);
  const zoom = useStore(appStore, (s) => s.zoom);
  const actions = useStore(appStore, (s) => s.registerActions);
  if (actions === undefined) {
    return null;
  }
  return (
    <>
      {rename !== undefined && <RenameBox key={rename.name} rename={rename} zoom={zoom} actions={actions} />}
      {menu !== undefined && <GutterMenu menu={menu} host={host} actions={actions} />}
    </>
  );
}

/**
 * A text box over the register's name. Enter or leaving applies; Escape lets it be. A name the
 * registers refuse - taken, or not a name - is said under the box and the box stays.
 */
function RenameBox({ rename, zoom, actions }) {
  const inputRef = useRef(null);
  // Set once the box is closing, so a blur fired by its removal cannot apply what Escape gave up.
  const closing = useRef(false);
  const [error, setError] = useState(undefined);
  const { rect } = rename;
  const done = () => {
    closing.current = true;
    appStore.setState({ registerRename: undefined });
  };
  const apply = () => {
    const input = inputRef.current;
    if (input === null || closing.current) {
      return;
    }
    const refused = actions.rename(rename.name, input.value.trim());
    if (refused === undefined) {
      done();
    } else {
      setError(refused);
      input.focus();
    }
  };
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const style = {
    left: `${rect.x * zoom}px`,
    top: `${rect.y * zoom}px`,
    width: `${Math.max(rect.w, Layout.REGISTER_NAME_WIDTH * 2) * zoom}px`,
    height: `${Layout.REGISTER_HEIGHT * zoom}px`,
    fontSize: `${Layout.REGISTER_FONT_SIZE * zoom}px`,
  };
  return (
    <>
      <input
        ref={inputRef}
        className="gutter-rename"
        style={style}
        defaultValue={rename.name}
        aria-label={`Rename register ${rename.name}`}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck="false"
        onChange={() => setError(undefined)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            apply();
            event.preventDefault();
          } else if (event.key === "Escape") {
            done();
            event.preventDefault();
          }
          event.stopPropagation();
        }}
        onBlur={apply}
      />
      {error !== undefined && (
        <p className="gutter-rename-error" role="alert" style={{ left: style.left, top: `${(rect.y + Layout.REGISTER_HEIGHT) * zoom}px` }}>
          {error}
        </p>
      )}
    </>
  );
}

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
        <Menu.Positioner className="gutter-menu-positioner" side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className="gutter-menu" aria-label={register === undefined ? `Wire q${menu.wire}` : `Register ${register.name}`}>
            {register === undefined ? (
              <Menu.Item
                className="gutter-menu-item"
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
                  className="gutter-menu-item"
                  onClick={() => (menu.rect === undefined ? undefined : renameHere(register.name, menu.rect))}
                >
                  {`Rename ${register.name}…`}
                  <kbd>double-click</kbd>
                </Menu.Item>
                <Menu.Group>
                  <Menu.GroupLabel className="gutter-menu-label">Feeds input</Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={register.input ?? ""}
                    onValueChange={(value) => actions.feed(register.name, value === "" ? undefined : value)}
                  >
                    <Menu.RadioItem className="gutter-menu-item" value="">
                      None
                    </Menu.RadioItem>
                    {INPUT_LETTERS.map((letter) => (
                      <Menu.RadioItem key={letter} className="gutter-menu-item" value={letter}>
                        {`Input ${letter}`}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Group>
                <Menu.Separator className="gutter-menu-separator" />
                <Menu.Item className="gutter-menu-item" onClick={() => actions.remove(register.name)}>
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

export { GutterEditors };
