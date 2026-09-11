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
 * Explicit colours for canvas drawing and gate chips. Gate renderers consume these values directly.
 * DOM colours are defined separately in styles/tokens.css.
 * Each section states the meaning and visible cue that accompanies its colours.
 *
 * A colour that means something means one thing: gate families, three kinds of data, the
 * highlight and errors each have their own hue, and everything else is neutral. Where two roles
 * share a value on purpose, the value is named once below rather than copied.
 */

/** The state readout: Chance, Bloch, density matrices and samples. */
const STATE_READOUT = "#22C55E";
const STATE_READOUT_BACKGROUND = "#0F1F14";
const GATE_SURFACE = "#191C24";
/** Muted text, and the frame ink containers wear one step behind the circuit's white lines. */
const MUTED = "#B0B7C9";
/** Where you are and what you touch: hover, drop targets, the gate button, the playhead. */
const HIGHLIGHT = "#F59E0B";

const CanvasTheme = Object.freeze({
  // IQP-dark canvas and wire colour. Quirk-only displays keep their explicit data roles below.
  surface: Object.freeze({
    background: "#262626",
    gate: GATE_SURFACE,
    quiet: "#232630",
  }),
  text: Object.freeze({
    primary: "#FFFFFF",
    default: "#FAFAFA",
    muted: MUTED,
    onBright: "#000000",
  }),
  // Qiskit visualization/circuit/styles/iqp-dark.json. Names describe assignments, not physics.
  iqp: Object.freeze({
    hadamard: "#FA4D56",
    not: "#4589FF",
    rotation: "#FF7EB6",
    phase: "#BAE6FF",
    measure: "#8D8D8D",
    classicalWire: "#778899",
  }),
  // Wires, grid boundaries and depth guides remain visible on the dark display surfaces. The
  // circuit's own lines are text.primary; frame is the quieter ink every container wears -
  // displays, kets, output boxes, register braces - so the circuit leads and its readouts follow.
  stroke: Object.freeze({
    grid: "#7D8599",
    guide: "#8B93A6",
    faint: "#747D91",
    bright: "#D3D6E0",
    frame: MUTED,
  }),
  gate: Object.freeze({ hover: "#493824", time: "#302C43" }),
  // Probability is also encoded by bar extent and numbers; labels use an opaque neutral plate.
  probability: Object.freeze({
    background: STATE_READOUT_BACKGROUND,
    fill: STATE_READOUT,
    outline: "#70E09A",
  }),
  // Circle area/level show probability; line angle and tooltips show phase independently of hue.
  amplitude: Object.freeze({
    background: "#0E1B1E",
    circle: "#0E7490",
    fill: "#22D3EE",
    phaseHalo: "#14161D",
    reference: "#FAFAFA",
  }),
  // Operator matrices, cycle and counting gates, and rotations, also identified by gate labels and
  // arrow direction. Violet keeps an operator matrix apart from the amplitude grid and the density
  // matrix, which are drawn the same way, including under red-green colour blindness.
  operation: Object.freeze({ background: GATE_SURFACE, fill: "#A78BFA" }),
  // Bloch vector length/direction and the numeric |r| readout carry the state information; a
  // mixed state greys out rather than changing hue.
  bloch: Object.freeze({
    background: STATE_READOUT_BACKGROUND,
    vector: STATE_READOUT,
    mixed: MUTED,
  }),
  // Hover/focus have outlines; the playhead has a band and edge; drop targets have an outline.
  interaction: Object.freeze({
    outline: HIGHLIGHT,
    button: HIGHLIGHT,
    buttonFocus: "#FCD34D",
    playhead: HIGHLIGHT,
    playheadBand: "rgba(245, 158, 11, 0.14)",
    drop: "rgba(255, 196, 112, 0.16)",
  }),
  // Errors retain their message and a crossed-out gate. Error colour never means hover.
  error: Object.freeze({ text: "#E879F9", background: "#351C39" }),
  transparent: "transparent",
});

/**
 * One assignment for canvas gates, previews and toolbox chips, using stable serialized IDs.
 * Source: https://github.com/Qiskit/qiskit/blob/main/qiskit/visualization/circuit/styles/iqp-dark.json
 * Quirk's powers/formulas extend the corresponding axis assignment. Quirk-only operations and
 * scientific displays have no IQP equivalent and retain the explicit neutral/data roles.
 */
function gateStyle(gate) {
  const id = gate.serializedId || "";
  const p = CanvasTheme.iqp;
  let fill;
  if (id === "H") fill = p.hadamard;
  else if (id === "X" || id === "Swap") fill = p.not;
  else if (id === "Measure") fill = p.measure;
  else if (/^(Z($|\^)|Rz($|ft$)|e\^[-+]?iZt$)/.test(id)) fill = p.phase;
  else if (/^(Y$|[XY]\^|R[xy]($|ft$)|e\^[-+]?i[XY]t$)/.test(id))
    fill = p.rotation;
  return {
    fill: fill || CanvasTheme.surface.gate,
    text: fill ? CanvasTheme.text.onBright : CanvasTheme.text.primary,
  };
}

/** Cyclic phase scale in degrees; the numeric phase and direction remain the primary cues. */
function phaseColor(phaseDegrees, alpha = 1) {
  return `hsl(${((phaseDegrees % 360) + 360) % 360} 85% 62% / ${alpha})`;
}

export { CanvasTheme, phaseColor, gateStyle };
