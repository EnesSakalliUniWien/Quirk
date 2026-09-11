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
 */
const CanvasTheme = Object.freeze({
  // IQP-dark canvas and wire colour. Quirk-only displays keep their explicit data roles below.
  surface: Object.freeze({
    background: "#262626",
    gate: "#191C24",
    quiet: "#232630",
  }),
  text: Object.freeze({
    primary: "#FFFFFF",
    default: "#FAFAFA",
    muted: "#B0B7C9",
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
  // Wires, grid boundaries and depth guides remain visible on the dark display surfaces.
  stroke: Object.freeze({
    grid: "#7D8599",
    guide: "#8B93A6",
    faint: "#747D91",
    bright: "#D3D6E0",
  }),
  gate: Object.freeze({ hover: "#493824", time: "#302C43" }),
  // Probability is also encoded by bar extent and numbers; labels use an opaque neutral plate.
  probability: Object.freeze({
    background: "#0F1F14",
    fill: "#22C55E",
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
  // Operator matrices and rotation arrows, also identified by gate labels and arrow direction.
  operation: Object.freeze({ background: "#2E2A12", fill: "#EAB308" }),
  // Bloch vector length/direction and the numeric |r| readout carry the state information.
  bloch: Object.freeze({
    background: "#0F1F14",
    vector: "#22C55E",
    mixed: "#EAB308",
  }),
  // Hover/focus have outlines; the playhead has a band and edge; drop targets have an outline.
  interaction: Object.freeze({
    outline: "#F59E0B",
    button: "#F59E0B",
    buttonFocus: "#FCD34D",
    playhead: "#A78BFA",
    playheadBand: "rgba(167, 139, 250, 0.14)",
    drop: "rgba(255, 196, 112, 0.16)",
  }),
  // Errors retain their message and a crossed-out gate. Error colour never means hover.
  error: Object.freeze({ text: "#E879F9", background: "#351C39" }),
  tooltip: Object.freeze({ title: "#60A5FA", background: "#101812" }),
  // Registers take these in wire order, for their names and the bar down their wire labels.
  register: Object.freeze({
    colors: Object.freeze(["#22D3EE", "#EAB308", "#A78BFA", "#F472B6", "#34D399", "#FB923C"]),
  }),
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

/**
 * @param {!int} index A register's place in wire order.
 * @returns {!string} Its colour, on the canvas and in the panels alike.
 */
function registerColor(index) {
  const { colors } = CanvasTheme.register;
  return colors[index % colors.length];
}

export { CanvasTheme, phaseColor, gateStyle, registerColor };
