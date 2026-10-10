import { createStore } from "zustand/vanilla";

import { Animation } from "../config/Animation.js";
import { Recording } from "../config/Recording.js";

/** Where the user's choices are remembered between visits. */
const MOTION_SETTINGS_STORAGE_KEY = "shadow-quant.motion-settings";

/**
 * What the user may set about how things move and how a recording samples and measures: each
 * setting's default, from Animation.js and Recording.js, and the range it is held to. The paces of
 * Play and of t's cycle are the Steps and Time lanes' own speeds.
 */
const MOTION_SETTINGS = Object.freeze({
  glideMs: Object.freeze({
    initial: Animation.GLIDE_DURATION_MS,
    min: 0,
    max: 2000,
  }),
  panelSampleMs: Object.freeze({
    initial: Animation.PANEL_SAMPLE_COOLDOWN_MS,
    min: 16,
    max: 2000,
  }),
  sampleRateHz: Object.freeze({
    initial: Recording.SAMPLE_RATE_HZ,
    min: 0.1,
    max: 20,
  }),
  // Held low enough that a take measures in a few milliseconds and stays a few hundred KiB at most,
  // since a ghost measures on every edit.
  shots: Object.freeze({
    initial: Recording.MEASUREMENT_SHOTS,
    min: 1,
    max: 10000,
    integer: true,
  }),
});

/**
 * @param {!string} key One of MOTION_SETTINGS.
 * @param {*} value
 * @returns {!number} The value held to the setting's range, or its default when it is no number.
 */
function clampMotionSetting(key, value) {
  const { initial, min, max, integer } = MOTION_SETTINGS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return initial;
  const clamped = Math.min(max, Math.max(min, number));
  return integer ? Math.round(clamped) : clamped;
}

const defaults = () =>
  Object.fromEntries(
    Object.entries(MOTION_SETTINGS).map(([key, { initial }]) => [key, initial]),
  );

/**
 * @param {undefined|!{getItem: !function(!string): (null|!string), setItem: !function(!string, !string): void}} storage
 * @returns {!Object} The remembered values, each clamped; anything unreadable is left at its default.
 */
function readStored(storage) {
  const values = defaults();
  try {
    const stored = JSON.parse(
      storage?.getItem(MOTION_SETTINGS_STORAGE_KEY) ?? "{}",
    );
    for (const key of Object.keys(MOTION_SETTINGS)) {
      if (
        stored !== null &&
        typeof stored === "object" &&
        Object.hasOwn(stored, key)
      ) {
        values[key] = clampMotionSetting(key, stored[key]);
      }
    }
  } catch {
    // A browser that refuses site data, or a value this version cannot read, starts from the defaults.
  }
  return values;
}

/**
 * The user's motion and recording settings, in a zustand store: the values, `set(key, value)`,
 * which clamps, and `reset()`. Every change is remembered in the storage given.
 *
 * @param {undefined|!{getItem: !function(!string): (null|!string), setItem: !function(!string, !string): void}} storage
 */
function createMotionSettings(storage) {
  const remember = (state) => {
    try {
      storage?.setItem(
        MOTION_SETTINGS_STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.keys(MOTION_SETTINGS).map((key) => [key, state[key]]),
          ),
        ),
      );
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  };
  const store = createStore((set, get) => ({
    ...readStored(storage),
    set: (key, value) => {
      set({ [key]: clampMotionSetting(key, value) });
      remember(get());
    },
    reset: () => {
      set(defaults());
      remember(get());
    },
  }));
  return store;
}

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/**
 * Takes up the choices another tab of the app remembers, as it remembers them, so two open tabs
 * never disagree.
 * @param {import("zustand/vanilla").StoreApi} store
 * @param {undefined|!Object} storage The storage the store remembers its choices in.
 * @param {!{addEventListener: !function(!string, !function(!StorageEvent): void): void}} target
 */
function followOtherTabs(store, storage, target) {
  target.addEventListener("storage", (event) => {
    if (
      event.key === MOTION_SETTINGS_STORAGE_KEY &&
      event.storageArea === storage
    ) {
      store.setState(readStored(storage));
    }
  });
}

/** The app's settings, shared by everything that moves and by the recorder. */
const motionSettings = createMotionSettings(browserStorage());
if (typeof window !== "undefined")
  followOtherTabs(motionSettings, browserStorage(), window);

export {
  MOTION_SETTINGS,
  createMotionSettings,
  followOtherTabs,
  motionSettings,
};
