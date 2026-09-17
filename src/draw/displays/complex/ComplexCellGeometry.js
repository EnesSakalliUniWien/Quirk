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

import { PathGeometry } from "../../shapes/PathGeometry.js";

export const PHASE_HAND_WIDTH = 2;
export const LOG_RING_WIDTH = 1;
/** How far an amplitude's probability bar stays in from each side of its cell. */
const BAR_INSET = 0.15;

export function traceAmplitudeProbabilitySquare(trace, real, imag, x, y, d) {
  const p = real * real + imag * imag;
  if (p > 0.001) {
    // Inset bars stay one per cell instead of joining into a line across the row.
    const left = x + d * BAR_INSET;
    const right = x + d * (1 - BAR_INSET);
    trace.poly([
      left,
      y + d * (1 - p),
      right,
      y + d * (1 - p),
      right,
      y + d,
      left,
      y + d,
    ]);
  }
}

export function traceProbabilitySquare(trace, real, imag, x, y, d) {
  const p = real;
  if (d * p > 0.1) {
    trace.poly([
      x,
      y + d * (1 - p),
      x + d,
      y + d * (1 - p),
      x + d,
      y + d,
      x,
      y + d,
    ]);
  }
}

export function traceAmplitudeProbabilityCircle(trace, real, imag, x, y, d) {
  const mag = Math.sqrt(real * real + imag * imag);
  if (d * mag > 0.5) {
    trace.circle(x + d / 2, y + d / 2, (mag * d) / 2);
  }
}

/** A squared magnitude on the logarithmic scale the ring and the hand share, in half-cells. */
function logarithmicRadius(squaredMagnitude) {
  return 1 + Math.log(squaredMagnitude) / 15;
}

export function traceAmplitudeLogarithmCircle(trace, real, imag, x, y, d) {
  const g = logarithmicRadius(real * real + imag * imag);
  if (g > 0) {
    trace.circle(x + d / 2, y + d / 2, (g * d) / 2);
  }
}

export function traceAmplitudePhaseDirection(trace, real, imag, x, y, d) {
  const mag = Math.sqrt(real * real + imag * imag);
  if (mag === 0) return;
  // The hand ends on the logarithmic ring, so its tip and the ring read as one scale.
  const g = logarithmicRadius(mag * mag);
  const r = Math.max(1, g / mag) * Math.max(d / 2, 5);
  if (r < 0.1) {
    return;
  }
  const cx = x + d / 2;
  const cy = y + d / 2;
  PathGeometry.line(trace, cx, cy, cx + real * r, cy - imag * r);
}
