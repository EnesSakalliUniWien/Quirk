import styles from "./transport-bar.module.css";
import { RecordControls } from "../panels/tape/record-controls.jsx";
import { SpeedMenu } from "./speed-menu.jsx";
import { TimeLane } from "./time-lane.jsx";
import { useEffect, useRef } from "react";
import { useStore } from "zustand";

import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDotIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { appStore } from "../../state/appStore.js";

/**
 * The transport follows the OP-1's keys: the arrows that move the playhead are drawn as outlines,
 * and play and pause, the keys that run it, are filled. The stroke is the app's, from IconProvider.
 */
function TransportButton({ id, icon: Icon, disabled, onClick, children }) {
  return (
    <Button id={id} size="default" disabled={disabled} onClick={onClick}>
      <Icon data-icon="inline-start" />
      <span className={styles.word}>{children}</span>
    </Button>
  );
}

/**
 * Space pauses whatever is moving and brings back what it paused, the way a media player's does:
 * the steps if they are playing, t if it is running, both if both are. When nothing moves and
 * Space paused nothing, it plays the steps. It only acts where nothing else claims the key: on the
 * page body or the circuit area. A focused button or text field keeps Space for itself.
 */
function useSpaceTogglesPlayback() {
  useEffect(() => {
    // What the last Space paused, so the next one brings it back.
    let paused = { steps: false, time: false };
    const onKeyDown = (ev) => {
      if (ev.key !== " " || ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      if (ev.target !== document.body && ev.target.id !== "canvasDiv") {
        return;
      }
      const {
        playhead,
        playheadState,
        cycleAnimates,
        cycleHold,
        cycleControls,
      } = appStore.getState();
      if (playhead === undefined) {
        return;
      }
      ev.preventDefault();
      const stepsMoving = playheadState.playing;
      const timeMoving = cycleAnimates && cycleHold === undefined;
      if (stepsMoving || timeMoving) {
        if (stepsMoving) playhead.togglePlay();
        if (timeMoving) cycleControls?.toggle();
        paused = { steps: stepsMoving, time: timeMoving };
        return;
      }
      if (paused.time && cycleAnimates && cycleHold === "paused")
        cycleControls?.toggle();
      if (paused.steps || !paused.time) playhead.togglePlay();
      paused = { steps: false, time: false };
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * The scrub slider is driven imperatively rather than as a controlled input: its value follows
 * the playhead through the DOM, and its native input event seeks. A controlled range input would
 * drop value writes made on the element itself, which is how tests and assistive tools drive it.
 * @param {!{operationIndex: !int, operationCount: !int, canPlay: !boolean}} state
 * @returns {!{current: null|!HTMLInputElement}}
 */
function useScrub(state) {
  const scrubRef = useRef(null);
  useEffect(() => {
    const scrub = scrubRef.current;
    scrub.max = String(state.operationCount);
    scrub.value = String(state.operationIndex);
    scrub.disabled = !state.canPlay;
  }, [state]);
  useEffect(() => {
    const scrub = scrubRef.current;
    const onInput = () => {
      const { playhead } = appStore.getState();
      if (playhead !== undefined) {
        playhead.seekOperation(parseInt(scrub.value, 10));
      }
    };
    scrub.addEventListener("input", onInput);
    return () => scrub.removeEventListener("input", onInput);
  }, []);
  return scrubRef;
}

/**
 * The Steps lane: steps between operation columns, skipping display-only and empty columns, with
 * its own Play and speed. It moves only the playhead; t is the Time lane's.
 *
 * This is a group rather than a toolbar: the toolbar pattern puts the whole strip on one tab stop
 * and moves between its controls with the arrow keys, which are the keys the scrub slider needs for
 * its own value. Each control is its own tab stop instead, the way media controls usually are.
 *
 * The labels and the readout follow ket's GUI debugger (github.com/brenocq/ket), except that its
 * ASCII arrows in "< Prev" and "Next >" are drawn glyphs here, like every other arrow in the app.
 */
function StepsLane() {
  const state = useStore(appStore, (s) => s.playheadState);
  const playhead = useStore(appStore, (s) => s.playhead);
  const speed = useStore(appStore, (s) => s.stepSpeed);
  const setStepSpeed = useStore(appStore, (s) => s.setStepSpeed);
  const scrubRef = useScrub(state);

  return (
    <div className={styles.lane} role="group" aria-label="Steps">
      <span
        className={`${styles.laneLabel} ${styles.stepsLabel}`}
        aria-hidden="true"
      >
        Steps
      </span>
      {/* Back, Play, forward and the extra command each take their own column, so the Time lane's
          nudges and Play stand under Prev, Play and Next. */}
      <ButtonGroup aria-label="Back" className={styles.back}>
        <TransportButton
          id="playhead-reset-button"
          icon={ChevronFirstIcon}
          disabled={!state.canStepBack}
          onClick={() => playhead.reset()}
        >
          Reset
        </TransportButton>
        <TransportButton
          id="playhead-prev-button"
          icon={ChevronLeftIcon}
          disabled={!state.canStepBack}
          onClick={() => playhead.previous()}
        >
          Prev
        </TransportButton>
      </ButtonGroup>
      {/* The lane's one filled button: stepping through the circuit is what the transport is for. */}
      <Button
        id="playhead-play-button"
        className={`${styles.play} ${styles.prominent}`}
        size="default"
        disabled={!state.canPlay}
        aria-pressed={state.playing}
        onClick={() => playhead.togglePlay()}
      >
        {state.playing ? (
          <PauseIcon
            id="playhead-pause-icon"
            data-icon="inline-start"
            fill="currentColor"
          />
        ) : (
          <PlayIcon
            id="playhead-play-icon"
            data-icon="inline-start"
            fill="currentColor"
          />
        )}
        {/* Named for its lane, since the Time lane has a Play of its own. */}
        <span id="playhead-play-label" className={styles.word}>
          {state.playing ? "Pause steps" : "Play steps"}
        </span>
      </Button>
      <ButtonGroup aria-label="Forward" className={styles.forward}>
        <TransportButton
          id="playhead-next-button"
          icon={ChevronRightIcon}
          disabled={!state.canStepForward}
          onClick={() => playhead.next()}
        >
          Next
        </TransportButton>
        <TransportButton
          id="playhead-end-button"
          icon={ChevronLastIcon}
          disabled={!state.canStepForward}
          onClick={() => playhead.end()}
        >
          End
        </TransportButton>
      </ButtonGroup>
      {/* A breakpoint goes on the operation the playhead stands before - the banded column - the
          way a debugger's toggle goes on the current line. Play and End halt before it. */}
      <Button
        id="breakpoint-toggle-button"
        className={styles.more}
        size="default"
        disabled={state.nextColumn === undefined}
        aria-pressed={state.breakpoints.includes(state.nextColumn)}
        onClick={() => playhead.toggleBreakpoint(state.nextColumn)}
      >
        <CircleDotIcon data-icon="inline-start" />
        <span className={styles.word}>Breakpoint</span>
      </Button>
      <input
        id="playhead-scrub"
        className={styles.scrub}
        type="range"
        min="0"
        max="0"
        step="1"
        defaultValue="0"
        ref={scrubRef}
        aria-label="Scrub to an operation"
        aria-describedby="playhead-position"
        aria-valuetext={`operation ${state.operationIndex} of ${state.operationCount}`}
      />
      {/* Polite, so a step taken by key or button is announced without stealing focus. */}
      <span
        id="playhead-position"
        className={`${styles.readout} ${styles.position}`}
        aria-live="polite"
      >
        operation {state.operationIndex} / {state.operationCount}
      </span>
      <span className={styles.pace}>
        <SpeedMenu lane="steps" value={speed} onChange={setStepSpeed} />
      </span>
      {/* A take records the state at the playhead, or every step of the run, from one menu. */}
      <span className={styles.extra}>
        <RecordControls />
      </span>
    </div>
  );
}

/**
 * The transport under the toolbar, as two lanes on one grid, like two tracks of a sequencer: Steps
 * walks the playhead through the columns and Time runs t, each with its own Play, scrubber, readout
 * and speed, each in the same column as the other's. Neither moves the other.
 */
function TransportBar() {
  useSpaceTogglesPlayback();
  return (
    <div
      className={`transport-bar ${styles.bar}`}
      role="group"
      aria-label="Playback controls"
    >
      <StepsLane />
      <TimeLane />
    </div>
  );
}

export { TransportBar };
