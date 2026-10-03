import { Menu } from "@base-ui/react/menu";
import { BookOpenIcon } from "lucide-react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { EXAMPLE_CIRCUITS } from "../../config/exampleCircuits.js";
import { appStore } from "../../state/appStore.js";

/**
 * The example circuits, as a menu on the toolbar. Choosing one commits it the way any edit is
 * committed, so undo puts the circuit that was there back. An example is a new program, so the
 * playhead starts at its beginning.
 */
function ExamplesMenu({ worded = false }) {
  const deps = useStore(appStore, (s) => s.panelDeps);
  return (
    <Menu.Root>
      {worded ? (
        // The same menu, worded, for the empty circuit, where a first-timer is looking.
        <Menu.Trigger render={<Button id="examples-worded-button" />}>
          <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
          Open an example
        </Menu.Trigger>
      ) : (
        <Menu.Trigger
          render={
            <Button id="examples-button" size="icon" aria-label="Examples" title="Examples" />
          }
        >
          <BookOpenIcon aria-hidden="true" />
        </Menu.Trigger>
      )}
      <Menu.Portal>
        <Menu.Positioner className="app-menu-positioner" side="bottom" align={worded ? "center" : "start"} sideOffset={4}>
          <Menu.Popup className="app-menu" aria-label="Example circuits">
            {EXAMPLE_CIRCUITS.map(({ name, circuit }) => (
              <Menu.Item
                key={name}
                className="app-menu-item"
                onClick={() => {
                  deps?.revision.commit(JSON.stringify(circuit));
                  appStore.getState().playhead?.rest();
                }}
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
