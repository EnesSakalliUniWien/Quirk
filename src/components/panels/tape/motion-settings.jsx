import { useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { MOTION_SETTINGS } from "../../../state/motionSettings.js";
import {
  onReducedMotionChange,
  prefersReducedMotion,
} from "../../../browser/reducedMotion.js";

/**
 * A slider for one setting, with its value beside it. `scale` converts the stored value to the
 * shown unit, for a setting kept in one unit and shown in another.
 */
function SliderSetting({
  settings,
  id,
  label,
  setting,
  step,
  scale = 1,
  unit,
}) {
  const value = useStore(settings, (state) => state[setting]);
  const { min, max } = MOTION_SETTINGS[setting];
  const shown = Number((value / scale).toPrecision(4));
  return (
    <div className="motion-setting">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min / scale}
        max={max / scale}
        step={step}
        value={shown}
        aria-valuetext={`${shown} ${unit}`}
        onChange={(e) =>
          settings.getState().set(setting, Number(e.target.value) * scale)
        }
      />
      <output htmlFor={id}>
        {shown} {unit}
      </output>
    </div>
  );
}

/**
 * The shots, typed: the field keeps what is being typed, and the setting takes it once it is a
 * number in range - or, on leaving the field, the nearest one that is.
 */
function ShotsSetting({ settings }) {
  const shots = useStore(settings, (state) => state.shots);
  const [draft, setDraft] = useState(String(shots));
  useEffect(() => setDraft(String(shots)), [shots]);
  const { min, max } = MOTION_SETTINGS.shots;
  const inRange = (text) =>
    /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max;
  return (
    <div className="motion-setting">
      <label htmlFor="setting-shots">Shots per snapshot</label>
      <input
        id="setting-shots"
        type="number"
        min={min}
        max={max}
        step={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (inRange(e.target.value))
            settings.getState().set("shots", e.target.value);
        }}
        onBlur={() => {
          settings.getState().set("shots", draft);
          setDraft(String(settings.getState().shots));
        }}
      />
    </div>
  );
}

/**
 * How things move and how a recording samples and measures, for the user to set. The paces of Play
 * and of t are the Steps and Time lanes' own speeds; these are the rest.
 */
function MotionSettings({ settings }) {
  // Follows the system setting while the panel is open.
  const reducedMotion = useSyncExternalStore(
    onReducedMotionChange,
    prefersReducedMotion,
  );
  const { reset } = settings.getState();
  return (
    <details className="motion-settings">
      <summary>Animation, sampling and measurement</summary>
      {reducedMotion && (
        <p>
          Reduce Motion is on: t starts paused, and the Time lane plays, scrubs
          and nudges it.
        </p>
      )}
      <SliderSetting
        settings={settings}
        id="setting-glide"
        label="Bloch glide"
        setting="glideMs"
        step={50}
        unit="ms"
      />
      <SliderSetting
        settings={settings}
        id="setting-panel-refresh"
        label="Panels refresh every"
        setting="panelSampleMs"
        step={2}
        unit="ms"
      />
      <SliderSetting
        settings={settings}
        id="setting-sample-rate"
        label="Sampling rate"
        setting="sampleRateHz"
        step={0.1}
        unit="snapshots/s"
      />
      <ShotsSetting settings={settings} />
      <button type="button" onClick={() => reset()}>
        Reset to defaults
      </button>
    </details>
  );
}

export { MotionSettings };
