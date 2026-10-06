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

/**
 * Where each mark of one complex-valued cell goes, as plain numbers: the cell is `d` units a side
 * with its top-left corner at (x, y), and its entry is real + i·imag. Nothing here draws; the
 * matrix's marks are laid out from these, so they can be read and tested on their own.
 */

/** How wide a phase hand is drawn. */
export const PHASE_HAND_WIDTH = 2;
/** The shortest a hand is drawn, so a small amplitude's phase still shows a direction. */
const MIN_HAND_LENGTH = 4;
/** An amplitude's chance gauge: how wide it is, and how far in from its cell's left edge. */
const GAUGE_WIDTH = 0.12;
const GAUGE_INSET = 0.06;
/** How far the gauge stays in from the cell's top and bottom, clear of the grid's lines. */
const GAUGE_MARGIN = 2.5;
/** The least a possible outcome's gauge stands, so it never looks like an impossible one. */
const GAUGE_MIN_HEIGHT = 2;
/** A chance this small is a rounding error, not an outcome; it gets no gauge at all. */
const GAUGE_ZERO = 1e-9;

/** @returns {!number} The disc's radius: its entry's magnitude, as a share of the half-cell. */
export function discRadius(real, imag, d) {
  return (Math.sqrt(real * real + imag * imag) * d) / 2;
}

/**
 * @returns {!number} The ring's radius: the chance on a logarithmic scale, the half-cell at 100% and
 *     shrinking by a fifteenth of it per factor of e, so an amplitude far too small for its disc to
 *     show still has a ring; 0 where it is smaller even than that.
 */
export function logRingRadius(real, imag, d) {
  const chance = real * real + imag * imag;
  const g = chance > 0 ? 1 + Math.log(chance) / 15 : 0;
  return g > 0 ? (g * d) / 2 : 0;
}

/**
 * @returns {!number} The hand's length from the cell's centre: as long as the amplitude, so it ends
 *     on its disc's edge and the two say one magnitude; at least MIN_HAND_LENGTH (or a quarter of a
 *     small cell), so a small amplitude's phase still points somewhere. 0 for no amplitude.
 */
export function handLength(real, imag, d) {
  const mag = Math.sqrt(real * real + imag * imag);
  return mag === 0
    ? 0
    : Math.max((mag * d) / 2, Math.min(MIN_HAND_LENGTH, d / 4));
}

/**
 * An amplitude's chance, as a gauge up its cell's left edge on a rail as tall as it could reach:
 * its height is the chance, the way a Chance bar's length is. It stands clear of the disc's middle,
 * so the disc never hides the level it reaches, and inside the grid's lines. A possible outcome
 * keeps at least GAUGE_MIN_HEIGHT of it, as a Chance bar keeps a sliver.
 *
 * @returns {undefined|!{left: !number, bottom: !number, width: !number, rail: !number, level: !number}}
 *     Undefined for an impossible outcome; otherwise the gauge's left edge and foot, its width, the
 *     rail's height and the level the chance reaches.
 */
export function chanceGauge(real, imag, x, y, d) {
  const chance = real * real + imag * imag;
  if (!(chance > GAUGE_ZERO)) return undefined;
  const rail = Math.max(0, d - 2 * GAUGE_MARGIN);
  return {
    left: x + d * GAUGE_INSET,
    bottom: y + d - GAUGE_MARGIN,
    width: Math.max(2, d * GAUGE_WIDTH),
    rail,
    level: Math.min(rail, Math.max(GAUGE_MIN_HEIGHT, rail * chance)),
  };
}

/**
 * @returns {!number} How high a density matrix's diagonal cell fills from its foot: its chance, the
 *     real entry there; 0 where that is too small to see.
 */
export function densityChanceHeight(real, d) {
  return d * real > 0.1 ? d * Math.min(1, real) : 0;
}
