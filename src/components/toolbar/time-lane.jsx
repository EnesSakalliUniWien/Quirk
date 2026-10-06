import styles from "./transport-bar.module.css";
import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { observeStore } from "../../base/valueStore.js";
import { prefersReducedMotion } from "../../browser/reducedMotion.js";
import { Animation } from "../../config/Animation.js";
import { appStore } from "../../state/appStore.js";
import { DIAL_RADIUS, sectorPath } from "./cycleDial.js";
import { SpeedMenu } from "./speed-menu.jsx";

const NUDGE = `1/${Math.round(1 / Animation.T_NUDGE)}`;

/** The word beside t for what holds it, when something does. */
const HOLD_WORDS = Object.freeze({
  paused: "paused",
  recording: "recording",
  take: "snapshot",
});

/**
 * @param {undefined|!string} hold
 * @param {!number} speed
 * @returns {!string} What the lane is doing, for the play button's tooltip.
 */
function holdTitle(hold, speed) {
  switch (hold) {
    case undefined: {
      const seconds = Number(
        (Animation.CYCLE_DURATION_MS / 1000 / speed).toFixed(2),
      );
      return `t runs from 0 to 1 every ${seconds} s; formula gates read twice it, from 0 to 2. Pause it to read one phase.`;
    }
    case "paused":
      return prefersReducedMotion()
        ? "Paused because Reduce Motion is on. Play t, scrub it, or nudge it."
        : "Paused. Play t, scrub it, or nudge it.";
    case "recording":
      return "Held while the whole run records.";
    default:
      return "Held at the restored snapshot's phase.";
  }
}

/**
 * The transport's Time lane: t, the phase every time-dependent gate takes, with its own play,
 * scrubber, nudges and speed. Moving the playhead in the Steps lane above never moves t, and t
 * never moves the playhead.
 *
 * The readout and the scrubber follow the phase each frame was drawn at, written straight into
 * the DOM so a running cycle costs no React render per frame. Without a gate that uses t, the lane
 * keeps its place and says so, so the canvas below never jumps.
 */
function TimeLane() {
  const animates = useStore(appStore, (s) => s.cycleAnimates);
  const hold = useStore(appStore, (s) => s.cycleHold);
  const controls = useStore(appStore, (s) => s.cycleControls);
  const deps = useStore(appStore, (s) => s.panelDeps);
  const speed = useStore(appStore, (s) => s.timeSpeed);
  const setTimeSpeed = useStore(appStore, (s) => s.setTimeSpeed);
  const valueRef = useRef(null);
  const sectorRef = useRef(null);
  const scrubRef = useRef(null);
  const dragging = useRef(/** @type {number | undefined} */ (undefined));

  const live = animates && controls !== undefined && deps !== undefined;
  useEffect(() => {
    const release = (event) => {
      if (event.type === "blur" || event.pointerId === dragging.current)
        dragging.current = undefined;
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      dragging.current = undefined;
    };
  }, [live]);
  useEffect(() => {
    if (!live) {
      return undefined;
    }
    let lastValue;
    let lastSector;
    return observeStore(deps.mostRecentStats).subscribe((stats) => {
      const value = stats.time.toFixed(2);
      // A 512th of a turn is finer than the dial's pixels; finer writes would change nothing.
      const sector = Math.round(stats.time * 512) / 512;
      if (value !== lastValue && valueRef.current !== null) {
        valueRef.current.textContent = value;
        scrubRef.current?.setAttribute("aria-valuetext", `t ${value}`);
        lastValue = value;
      }
      if (sector !== lastSector && sectorRef.current !== null) {
        sectorRef.current.setAttribute("d", sectorPath(sector));
        if (dragging.current === undefined && scrubRef.current !== null) {
          scrubRef.current.value = String(sector);
        }
        lastSector = sector;
      }
    });
  }, [live, deps]);

  const running = hold === undefined;
  const usersToMove = running || hold === "paused";
  return (
    <div className={styles.lane} role="group" aria-label="Time">
      <span
        className={`${styles.laneLabel} ${styles.timeLabel}`}
        aria-hidden="true"
      >
        Time
      </span>
      {live ? (
        <>
          <Button
            id="time-back-button"
            className={styles.back}
            size="icon"
            disabled={!usersToMove}
            aria-label={`Move t back ${NUDGE}`}
            title={`Move t back ${NUDGE}`}
            onClick={() => controls.nudge(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            id="time-play-button"
            className={styles.play}
            disabled={!usersToMove}
            aria-describedby={running ? undefined : "time-hold"}
            title={holdTitle(hold, speed)}
            onClick={() => controls.toggle()}
          >
            {running ? (
              <PauseIcon data-icon="inline-start" fill="currentColor" />
            ) : (
              <PlayIcon data-icon="inline-start" fill="currentColor" />
            )}
            <span className={styles.word}>
              {running ? "Pause t" : "Play t"}
            </span>
          </Button>
          <Button
            id="time-forward-button"
            className={styles.forward}
            size="icon"
            disabled={!usersToMove}
            aria-label={`Move t forward ${NUDGE}`}
            title={`Move t forward ${NUDGE}`}
            onClick={() => controls.nudge(1)}
          >
            <ChevronRightIcon />
          </Button>
          <input
            id="time-scrub"
            ref={scrubRef}
            className={styles.scrub}
            type="range"
            min="0"
            max="1"
            step={1 / 128}
            defaultValue="0"
            disabled={!usersToMove}
            aria-label="Scrub t"
            onPointerDown={(event) => {
              if (dragging.current === undefined)
                dragging.current = event.pointerId;
            }}
            onLostPointerCapture={(event) => {
              if (dragging.current === event.pointerId)
                dragging.current = undefined;
            }}
            onInput={(event) =>
              controls.scrub(Number(event.currentTarget.value))
            }
          />
          <span className={styles.readout}>
            <svg
              className={styles.dial}
              viewBox="-8 -8 16 16"
              aria-hidden="true"
            >
              <circle className={styles.face} r={DIAL_RADIUS} />
              <path className={styles.sector} ref={sectorRef} />
              {/* Zero, where every dial on the canvas starts. */}
              <line
                className={styles.zero}
                x1="0"
                y1={-DIAL_RADIUS}
                x2="0"
                y2={-DIAL_RADIUS + 2.5}
              />
            </svg>
            <span className={styles.value}>
              t <span ref={valueRef} />
            </span>
            <span id="time-hold" className={styles.hold}>
              {running ? "" : HOLD_WORDS[hold]}
            </span>
          </span>
          <span className={styles.pace}>
            <SpeedMenu lane="time" value={speed} onChange={setTimeSpeed} />
          </span>
        </>
      ) : (
        // Nothing here moves, so the lane offers nothing to press: it only says why.
        <span className={styles.idle}>No gate in this circuit uses t.</span>
      )}
    </div>
  );
}

export { TimeLane };
