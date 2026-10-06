/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Appearance } from "../Appearance.js";

/**
 * Where a phase of 0° sits on the wheel, in OKLCH hue degrees. A positive real amplitude is blue, so
 * a negative one, half a turn round, is orange, the colours a sign reads by; +i is magenta and −i
 * green. The hue turns the way the phase does, counter-clockwise.
 */
const HUE_AT_ZERO_PHASE = 245;

/** The phase wheel for one scheme's `phase` settings; the active scheme's by default. */
function phaseRgb(phaseDegrees, { lightness, chroma } = Appearance.phase) {
  const hue =
    (((((phaseDegrees + HUE_AT_ZERO_PHASE) % 360) + 360) % 360) * Math.PI) /
    180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  // OKLab to linear sRGB (Ottosson), then the sRGB transfer curve.
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round(
      (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255,
    );
  });
}

/** Cyclic phase scale in degrees, as a CSS colour; the number beside a swatch is the cue. */
function phaseColor(phaseDegrees, alpha = 1, phase = Appearance.phase) {
  const [r, g, b] = phaseRgb(phaseDegrees, phase);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The wheel as tints, one per whole degree, for each scheme's settings. @type {!Map<!string, !Uint32Array>} */
const tintTables = new Map();
/** The settings last asked for and their table, so a raster's lookup per entry builds no key. */
let lastSettings = undefined;
let lastTable = undefined;

/**
 * A phase's colour as a 0xRRGGBB tint, to the nearest degree, from a table built once per scheme:
 * for marks that take a colour each frame, where a CSS string would be built and parsed again.
 * @param {!number} phaseDegrees
 * @param {!{lightness: !number, chroma: !number}=} phase
 * @returns {!number}
 */
function phaseTint(phaseDegrees, phase = Appearance.phase) {
  if (phase !== lastSettings) {
    lastTable = tintTable(phase);
    lastSettings = phase;
  }
  return lastTable[((Math.round(phaseDegrees) % 360) + 360) % 360];
}

/** @param {!{lightness: !number, chroma: !number}} phase @returns {!Uint32Array} */
function tintTable(phase) {
  const key = `${phase.lightness}|${phase.chroma}`;
  let table = tintTables.get(key);
  if (table === undefined) {
    table = new Uint32Array(360);
    for (let degree = 0; degree < 360; degree++) {
      const [r, g, b] = phaseRgb(degree, phase);
      table[degree] = (r << 16) | (g << 8) | b;
    }
    tintTables.set(key, table);
  }
  return table;
}

export { phaseRgb, phaseColor, phaseTint };
