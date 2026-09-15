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

import {Appearance} from '../Appearance.js';
const {lightness: PHASE_LIGHTNESS, chroma: PHASE_CHROMA} = Appearance.phase;

function phaseRgb(phaseDegrees) {
  const hue = ((((phaseDegrees % 360) + 360) % 360) * Math.PI) / 180;
  const a = PHASE_CHROMA * Math.cos(hue);
  const b = PHASE_CHROMA * Math.sin(hue);
  // OKLab to linear sRGB (Ottosson), then the sRGB transfer curve.
  const l = (PHASE_LIGHTNESS + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (PHASE_LIGHTNESS - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (PHASE_LIGHTNESS - 0.0894841775 * a - 1.291485548 * b) ** 3;
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
function phaseColor(phaseDegrees, alpha = 1) {
  const [r, g, b] = phaseRgb(phaseDegrees);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export {phaseRgb, phaseColor};
