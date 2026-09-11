import { Menu } from "@base-ui/react/menu";
import { BookOpenIcon } from "lucide-react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { EXAMPLE_CIRCUITS } from "../../config/exampleCircuits.js";
import { appStore } from "../../state/appStore.js";

/**
 * The example circuits, as a menu on the toolbar. Choosing one commits it the way any edit is
 * committed, so undo puts the circuit that was there back.
 */
function ExamplesMenu() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button id="examples-button" size="icon" aria-label="Examples" title="Examples" />
        }
      >
        <BookOpenIcon aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="app-menu-positioner" side="bottom" align="start" sideOffset={4}>
          <Menu.Popup className="app-menu" aria-label="Example circuits">
            {EXAMPLE_CIRCUITS.map(({ name, circuit }) => (
              <Menu.Item
                key={name}
                className="app-menu-item"
                onClick={() => deps?.revision.commit(JSON.stringify(circuit))}
              >
                {name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { ExamplesMenu };
