import styles from "./ready-controls.module.css";
import { Menu } from "@base-ui/react/menu";
import { CircleIcon } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { openPanel } from "../../dock.jsx";

/**
 * Recording, as one quiet menu at the end of the Steps lane: a take of the state at the playhead,
 * or a take of every step from the start to the end. Neither hides behind a press-and-hold, and
 * neither outweighs Play. While a whole run records, the menu gives way to its Cancel.
 *
 * @param {!{recorder: !Recorder}} props
 */
function ReadyControls({ recorder }) {
  const busy = useStore(recorder.busy, (state) => state.value);
  const [error, setError] = useState("");
  const run = async (whole) => {
    openPanel("tape");
    setError("");
    try {
      await (whole ? recorder.recordRun() : recorder.record());
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      {busy ? (
        <Button type="button" onClick={() => recorder.cancel()}>
          Cancel recording
        </Button>
      ) : (
        <Menu.Root>
          <Menu.Trigger render={<Button id="record-button" className={styles.trigger} />}>
            <CircleIcon className={styles.dot} data-icon="inline-start" fill="currentColor" aria-hidden="true" />
            <span className={styles.word}>Record</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className="app-menu-positioner" side="bottom" align="end" sideOffset={4}>
              <Menu.Popup className="app-menu" aria-label="Record">
                <Menu.Group>
                  <Menu.GroupLabel className="app-menu-label">Record to the Tape</Menu.GroupLabel>
                  <Menu.Item id="record-take" className="app-menu-item" onClick={() => run(false)}>
                    <span className={styles.item}>
                      This step
                      <span className={styles.detail}>one take, at the playhead</span>
                    </span>
                  </Menu.Item>
                  <Menu.Item id="record-run" className="app-menu-item" onClick={() => run(true)}>
                    <span className={styles.item}>
                      Every step
                      <span className={styles.detail}>a take per step, start to end</span>
                    </span>
                  </Menu.Item>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
      {error && <span role="alert">{error}</span>}
    </>
  );
}

export { ReadyControls };
