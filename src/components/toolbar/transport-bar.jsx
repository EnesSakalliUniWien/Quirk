import { useEffect, useRef } from "react";
import { useStore } from "zustand";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { appStore } from "../../state/appStore.js";

/** Matches the app toolbar, so the two strips read as one set of controls. */
const ICON_STROKE_WIDTH = 1.5;

function TransportButton({ id, icon: Icon, disabled, onClick, children }) {
  return (
    <Button id={id} size="default" disabled={disabled} onClick={onClick}>
      <Icon data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
      {children}
    </Button>
  );
}

/**
 * Space plays and pauses, but only when nothing else claims the key: on the page body or the
 * circuit area. A focused button or text field keeps Space for itself.
 */
function useSpaceTogglesPlayback() {
  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key !== " " || ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      if (ev.target !== document.body && ev.target.id !== "canvasDiv") {
        return;
      }
      const { playhead } = appStore.getState();
      if (playhead === undefined) {
        return;
      }
      playhead.togglePlay();
      ev.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * The scrub slider is driven imperatively rather than as a controlled input: its value follows
 * the playhead through the DOM, and its native input event seeks. A controlled range input would
 * drop value writes made on the element itself, which is how tests and assistive tools drive it.
 * @param {!{step: !int, columnCount: !int, canPlay: !boolean}} state
 * @returns {!{current: null|!HTMLInputElement}}
 */
function useScrub(state) {
  const scrubRef = useRef(null);
  useEffect(() => {
    const scrub = scrubRef.current;
    scrub.max = String(state.columnCount);
    scrub.value = String(state.step);
    scrub.disabled = !state.canPlay;
  }, [state]);
  useEffect(() => {
    const scrub = scrubRef.current;
    const onInput = () => {
      const { playhead } = appStore.getState();
      if (playhead !== undefined) {
        playhead.seek(parseInt(scrub.value, 10));
      }
    };
    scrub.addEventListener("input", onInput);
    return () => scrub.removeEventListener("input", onInput);
  }, []);
  return scrubRef;
}

/**
 * Steps the circuit a column at a time.
 *
 * This is a group rather than a toolbar: the toolbar pattern puts the whole strip on one tab stop
 * and moves between its controls with the arrow keys, which are the keys the scrub slider needs for
 * its own value. Each control is its own tab stop instead, the way media controls usually are.
 *
 * The labels and the readout follow ket's GUI debugger (github.com/brenocq/ket), except that its
 * ASCII arrows in "< Prev" and "Next >" are drawn glyphs here, like every other arrow in the app.
 */
function TransportBar() {
  useSpaceTogglesPlayback();
  const state = useStore(appStore, (s) => s.playheadState);
  const playhead = useStore(appStore, (s) => s.playhead);
  const scrubRef = useScrub(state);

  return (
    <div className="transport-bar" role="group" aria-label="Playback controls">
      <ButtonGroup aria-label="Playhead">
        <TransportButton
          id="playhead-reset-button"
          icon={SkipBackIcon}
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
        <Button
          id="playhead-play-button"
          size="default"
          disabled={!state.canPlay}
          aria-pressed={state.playing}
          onClick={() => playhead.togglePlay()}
        >
          {state.playing ? (
            <PauseIcon id="playhead-pause-icon" data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
          ) : (
            <PlayIcon id="playhead-play-icon" data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
          )}
          <span id="playhead-play-label">{state.playing ? "Pause" : "Play"}</span>
        </Button>
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
          icon={SkipForwardIcon}
          disabled={!state.canStepForward}
          onClick={() => playhead.end()}
        >
          End
        </TransportButton>
      </ButtonGroup>
      <input
        id="playhead-scrub"
        className="transport-scrub"
        type="range"
        min="0"
        max="0"
        step="1"
        defaultValue="0"
        ref={scrubRef}
        aria-label="Scrub to a gate"
        aria-describedby="playhead-position"
      />
      {/* A column is what executes at once, and in practice holds a single gate, so ket's gate
          counter reads the same here. */}
      <span id="playhead-position" className="transport-position">
        gate {state.step} / {state.columnCount}
      </span>
    </div>
  );
}

export { TransportBar };
