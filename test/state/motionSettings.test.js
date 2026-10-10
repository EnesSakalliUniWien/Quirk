import { Suite, assertThat } from "../TestUtil.js";
import { Animation } from "../../src/config/Animation.js";
import { Recording } from "../../src/config/Recording.js";
import {
  MOTION_SETTINGS,
  createMotionSettings,
  followOtherTabs,
} from "../../src/state/motionSettings.js";

const suite = new Suite("motionSettings");

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    items,
  };
}

suite.test("starts from the configured defaults", () => {
  const state = createMotionSettings(undefined).getState();
  assertThat(state.glideMs).isEqualTo(Animation.GLIDE_DURATION_MS);
  assertThat(state.panelSampleMs).isEqualTo(Animation.PANEL_SAMPLE_COOLDOWN_MS);
  assertThat(state.sampleRateHz).isEqualTo(Recording.SAMPLE_RATE_HZ);
  assertThat(state.shots).isEqualTo(Recording.MEASUREMENT_SHOTS);
});

suite.test(
  "holds each setting to its range, and the shots to whole numbers",
  () => {
    const store = createMotionSettings(undefined);
    store.getState().set("panelSampleMs", 1);
    assertThat(store.getState().panelSampleMs).isEqualTo(
      MOTION_SETTINGS.panelSampleMs.min,
    );
    store.getState().set("sampleRateHz", 1e9);
    assertThat(store.getState().sampleRateHz).isEqualTo(
      MOTION_SETTINGS.sampleRateHz.max,
    );
    store.getState().set("shots", "12.6");
    assertThat(store.getState().shots).isEqualTo(13);
    store.getState().set("glideMs", "not a number");
    assertThat(store.getState().glideMs).isEqualTo(Animation.GLIDE_DURATION_MS);
  },
);

suite.test(
  "remembers the choices, reads them back clamped, and resets to the defaults",
  () => {
    const storage = memoryStorage();
    createMotionSettings(storage).getState().set("glideMs", 900);
    assertThat(createMotionSettings(storage).getState().glideMs).isEqualTo(900);
    const tampered = memoryStorage({
      "shadow-quant.motion-settings": JSON.stringify({
        shots: -5,
        sampleRateHz: "x",
        unknown: 1,
      }),
    });
    const read = createMotionSettings(tampered).getState();
    assertThat(read.shots).isEqualTo(MOTION_SETTINGS.shots.min);
    assertThat(read.sampleRateHz).isEqualTo(Recording.SAMPLE_RATE_HZ);
    const unreadable = createMotionSettings(
      memoryStorage({ "shadow-quant.motion-settings": "{" }),
    ).getState();
    assertThat(unreadable.glideMs).isEqualTo(Animation.GLIDE_DURATION_MS);
    const store = createMotionSettings(storage);
    store.getState().reset();
    assertThat(createMotionSettings(storage).getState().glideMs).isEqualTo(
      Animation.GLIDE_DURATION_MS,
    );
  },
);

suite.test(
  "a storage that refuses writes keeps the choice for the visit",
  () => {
    const store = createMotionSettings({
      getItem: () => null,
      setItem: () => {
        throw new Error("refused");
      },
    });
    store.getState().set("shots", 50);
    assertThat(store.getState().shots).isEqualTo(50);
  },
);

suite.test("takes up what another tab remembers, and nothing else", () => {
  const storage = memoryStorage();
  const store = createMotionSettings(storage);
  const listeners = [];
  followOtherTabs(store, storage, {
    addEventListener: (type, listener) => listeners.push([type, listener]),
  });
  assertThat(listeners.map(([type]) => type)).isEqualTo(["storage"]);
  // The other tab writes its choice; this one hears of it.
  createMotionSettings(storage).getState().set("shots", 77);
  listeners[0][1]({
    key: "shadow-quant.motion-settings",
    storageArea: storage,
  });
  assertThat(store.getState().shots).isEqualTo(77);
  createMotionSettings(storage).getState().set("shots", 88);
  listeners[0][1]({ key: "another-key", storageArea: storage });
  listeners[0][1]({
    key: "shadow-quant.motion-settings",
    storageArea: memoryStorage(),
  });
  assertThat(store.getState().shots).isEqualTo(77);
});

suite.test(
  "the shots stop at a count a snapshot measures in a few milliseconds",
  () => {
    const store = createMotionSettings(undefined);
    store.getState().set("shots", 100000);
    assertThat(store.getState().shots).isEqualTo(10000);
  },
);
