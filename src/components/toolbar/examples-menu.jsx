import { Menu } from "@base-ui/react/menu";
import { BookOpenIcon } from "lucide-react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { EXAMPLE_CIRCUITS } from "../../config/exampleCircuits.js";
import { appStore } from "../../state/appStore.js";
import styles from "./examples-menu.module.css";

const exampleGroups = [
  {
    label: "Start here",
    examples: EXAMPLE_CIRCUITS.filter(
      (example) => example.category === "starter",
    ),
  },
  {
    label: "Explore further",
    examples: EXAMPLE_CIRCUITS.filter(
      (example) => example.category !== "starter",
    ),
  },
];

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
            <Button
              id="examples-button"
              size="icon"
              aria-label="Examples"
              title="Examples"
            />
          }
        >
          <BookOpenIcon aria-hidden="true" />
        </Menu.Trigger>
      )}
      <Menu.Portal>
        <Menu.Positioner
          className="app-menu-positioner"
          side="bottom"
          align={worded ? "center" : "start"}
          sideOffset={4}
        >
          <Menu.Popup
            className={`app-menu ${styles.examples}`}
            aria-label="Example circuits"
          >
            {exampleGroups.map(({ label, examples }) => (
              <Menu.Group key={label}>
                <Menu.GroupLabel className="app-menu-label">
                  {label}
                </Menu.GroupLabel>
                {examples.map(({ name, circuit, category, goal }) => (
                  <Menu.Item
                    key={name}
                    className={`app-menu-item ${styles.example}`}
                    aria-label={name}
                    aria-description={goal}
                    onClick={() => {
                      deps?.revision.commit(JSON.stringify(circuit));
                      appStore.getState().playhead?.rest();
                      if (category === "starter") {
                        requestAnimationFrame(() => {
                          const viewport = document.getElementById("canvasDiv");
                          const width = deps?.displayed
                            .getState()
                            .value.displayedCircuit.unshiftedDesiredWidth();
                          if (viewport && width > 0) {
                            appStore
                              .getState()
                              .setZoom(
                                Math.max(
                                  0.4,
                                  Math.min(1, viewport.clientWidth / width),
                                ),
                              );
                            viewport.scrollTo(0, 0);
                          }
                        });
                      }
                    }}
                  >
                    <span className="example-menu-name">{name}</span>
                    {goal && (
                      <span className={`example-menu-goal ${styles.goal}`}>
                        {goal}
                      </span>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Group>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { ExamplesMenu };
