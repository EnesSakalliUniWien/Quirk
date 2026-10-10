import styles from "./ready-controls.module.css";
import { Menu } from "@base-ui/react/menu";
import { CircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { openPanel } from "../../dock.jsx";

/**
 * What a screen reader is told about a recording: that it started, at which rate, and that it
 * stopped, with how many snapshots. The running count on screen changes with every sample and is
 * not announced, so the announcements never crowd out anything else.
 */
function recordingAnnouncement(recording, busy, rate, samples) {
  if (recording) return `Recording started, a snapshot ${rate}.`;
  if (busy) return "Recording every step.";
  return samples > 0
    ? `Recording stopped, ${samples} ${samples === 1 ? "snapshot" : "snapshots"} saved.`
    : "";
}

/**
 * Recording, as one quiet menu at the end of the Steps lane: a snapshot of the state at the
 * playhead, a snapshot of every step from the start to the end, or a snapshot at the sampling rate
 * until the user stops. Neither hides behind a press-and-hold, and none outweighs Play. Nothing
 * records until one is chosen. While a whole run records the menu gives way to its Cancel, and
 * while a recording runs to its Stop, with the indicator beside it; the focus goes to that button
 * and comes back to the menu after.
 *
 * @param {!{recorder: !Recorder}} props
 */
function ReadyControls({ recorder }) {
  const busy = useStore(recorder.busy, (state) => state.value);
  const recording = useStore(recorder.recording, (state) => state.value);
  const samples = useStore(recorder.samples, (state) => state.value);
  const recordingError = useStore(
    recorder.recordingError,
    (state) => state.value,
  );
  const sampleRateHz = useStore(
    recorder.settings,
    (state) => state.sampleRateHz,
  );
  const [error, setError] = useState("");
  const trigger = useRef(null);
  const ender = useRef(null);
  const underWay = busy || recording;
  useEffect(() => {
    // The menu that was focused, or the item that closed it, is gone: the focus would be lost.
    const lost = () =>
      document.activeElement === null ||
      document.activeElement === document.body;
    if (underWay) {
      if (lost()) ender.current?.focus();
    } else if (lost() || document.activeElement === ender.current) {
      trigger.current?.focus();
    }
  }, [underWay]);
  const run = async (whole) => {
    openPanel("tape");
    setError("");
    try {
      await (whole ? recorder.recordRun() : recorder.record());
    } catch (e) {
      setError(e.message);
    }
  };
  const start = () => {
    openPanel("tape");
    setError("");
    recorder.start();
  };
  const perSecond = Number(sampleRateHz.toPrecision(3));
  const rate = `${perSecond} per second`;
  return (
    <span className="record-controls" role="group" aria-label="Recording">
      {busy ? (
        <Button type="button" ref={ender} onClick={() => recorder.cancel()}>
          Cancel recording
        </Button>
      ) : recording ? (
        <Button
          id="record-stop"
          type="button"
          ref={ender}
          onClick={() => recorder.stop()}
        >
          Stop recording
        </Button>
      ) : (
        <Menu.Root>
          <Menu.Trigger
            render={
              <Button
                id="record-button"
                ref={trigger}
                className={styles.trigger}
              />
            }
          >
            <CircleIcon
              className={styles.dot}
              data-icon="inline-start"
              fill="currentColor"
              aria-hidden="true"
            />
            <span>Record</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              className="app-menu-positioner"
              side="bottom"
              align="end"
              sideOffset={4}
            >
              <Menu.Popup className="app-menu" aria-label="Record">
                <Menu.Group>
                  <Menu.GroupLabel className="app-menu-label">
                    Save to Recordings
                  </Menu.GroupLabel>
                  <Menu.Item
                    id="record-take"
                    className="app-menu-item"
                    onClick={() => run(false)}
                  >
                    <span className={styles.item}>
                      This step
                      <span className={styles.detail}>
                        one snapshot, at the playhead
                      </span>
                    </span>
                  </Menu.Item>
                  <Menu.Item
                    id="record-run"
                    className="app-menu-item"
                    onClick={() => run(true)}
                  >
                    <span className={styles.item}>
                      Every step
                      <span className={styles.detail}>
                        a snapshot per step, start to end
                      </span>
                    </span>
                  </Menu.Item>
                  <Menu.Item
                    id="record-start"
                    className="app-menu-item"
                    onClick={start}
                  >
                    <span className={styles.item}>
                      Over time
                      <span className={styles.detail}>
                        a snapshot {rate}, until you stop
                      </span>
                    </span>
                  </Menu.Item>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
      <span
        id="recording-indicator"
        className="recording-indicator"
        aria-hidden="true"
        hidden={!underWay}
      >
        <span className="recording-dot" />
        {recording
          ? `Recording · ${perSecond}/s · ${samples} ${samples === 1 ? "snapshot" : "snapshots"}`
          : busy
            ? "Recording every step"
            : ""}
      </span>
      <span id="recording-status" className="visually-hidden" role="status">
        {recordingAnnouncement(recording, busy, rate, samples)}
      </span>
      {(error || recordingError) && (
        <span role="alert">{error || recordingError}</span>
      )}
    </span>
  );
}

export { ReadyControls };
