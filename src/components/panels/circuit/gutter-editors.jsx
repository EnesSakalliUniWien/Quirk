import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { RenameBox } from "./rename-box.jsx";
import { GutterMenu } from "./gutter-menu.jsx";

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

export { GutterEditors };
