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

export function traceAmplitudeProbabilitySquare(trace, real, imag, x, y, d) {
  const p = real * real + imag * imag;
  if (p > 0.001) {
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

export function traceAmplitudeLogarithmCircle(trace, real, imag, x, y, d) {
  const g = 1 + Math.log(real * real + imag * imag) / 15;
  if (g > 0) {
    trace.circle(x + d / 2, y + d / 2, (g * d) / 2);
  }
}

export function traceAmplitudePhaseDirection(trace, real, imag, x, y, d) {
  const mag = Math.sqrt(real * real + imag * imag);
  if (mag === 0) return;
  const g = 1 + Math.log(mag) / 10;
  const r = Math.max(1, g / mag) * Math.max(d / 2, 5);
  if (r < 0.1) {
    return;
  }
  const cx = x + d / 2;
  const cy = y + d / 2;
  PathGeometry.line(trace, cx, cy, cx + real * r, cy - imag * r);
}
