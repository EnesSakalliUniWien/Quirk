/** Renderer-independent sRGB channels (0–255) and alpha (0–1). */
const colour = (r, g, b, alpha = 1) => Object.freeze({ r, g, b, alpha });

const surface = Object.freeze({
  background: colour(32, 38, 48),
  gate: colour(52, 59, 73),
  quiet: colour(35, 38, 48),
  // A readout's tile: quieter than a gate, so a value is told from an operation at a glance.
  readout: colour(38, 43, 54),
});

const text = Object.freeze({
  primary: colour(255, 255, 255),
  default: colour(250, 250, 250),
  muted: colour(176, 183, 201),
  onBright: colour(0, 0, 0),
});

// Qiskit's IQP-dark gate assignments; these describe gate families, not physical quantities.
// https://github.com/Qiskit/qiskit/blob/main/qiskit/visualization/circuit/styles/iqp-dark.json
const iqp = Object.freeze({
  hadamard: colour(250, 77, 86),
  not: colour(69, 137, 255),
  rotation: colour(255, 126, 182),
  phase: colour(186, 230, 255),
  measure: colour(141, 141, 141),
  classicalWire: colour(119, 136, 153),
});

// One hue per axis, on gates, dials and the Bloch sphere alike: X is NOT's blue, Y the rotations'
// pink, Z the phases' pale blue. A line takes the lightness its ground needs, never another hue: Y's
// pink is lifted clear of the error magenta and of the grey guides it crosses on the sphere.
const axis = Object.freeze({
  x: iqp.not,
  y: colour(255, 156, 180),
  z: iqp.phase,
});

// Every gate label sits on a bright fill in dark mode, so all labels are dark.
const iqpText = Object.freeze({
  hadamard: text.onBright,
  not: text.onBright,
  rotation: text.onBright,
  phase: text.onBright,
  measure: text.onBright,
});

const stroke = Object.freeze({
  grid: colour(125, 133, 153),
  guide: colour(139, 147, 166),
  faint: colour(125, 133, 153),
  // The logarithmic scale a phase hand's tip ends on: quieter than the marks it measures.
  // Opaque, so it holds 3:1 on an amplitude cell, as a mark a value is read from must.
  logRing: colour(102, 109, 126),
  bright: colour(211, 214, 224),
  frame: text.muted,
  displayFrame: colour(196, 203, 216),
  // The wire: a line, not text, so it sits back from the gates it carries.
  wire: colour(150, 158, 175),
});

const gate = Object.freeze({
  hover: colour(73, 56, 36),
  time: colour(48, 44, 67),
});

const probability = Object.freeze({
  background: colour(15, 31, 20),
  fill: colour(34, 197, 94),
  fillText: text.onBright,
  outline: colour(112, 224, 154),
  // The fill's hue, dark enough that white chance labels read over a bar as well as beside it.
  bar: colour(19, 133, 61),
  // The track a thin bar runs along, on the readout tile.
  track: colour(66, 73, 90),
});

// In a grid of complex numbers colour means phase and nothing else: each disc wears its phase's
// hue from the wheel, and every other mark is a neutral ink, so no colour competes with it.
const amplitude = Object.freeze({
  background: colour(22, 26, 33),
  // The hand on a disc: dark, so it reads on every hue of the wheel.
  hand: colour(14, 16, 21),
  // A chance's bar and number.
  chance: colour(214, 218, 228),
  // A disc whose phase is not defined - its qubit entangled with others - has no hue to wear.
  unknown: colour(116, 122, 138),
  phaseHalo: colour(20, 22, 29),
  reference: text.default,
});

const operation = Object.freeze({
  background: surface.gate,
  fill: colour(152, 120, 244),
});

const bloch = Object.freeze({
  background: probability.background,
  vector: probability.fill,
  mixed: text.muted,
  axisX: axis.x,
  axisY: axis.y,
  axisZ: axis.z,
  // The axes' names as text in the analyzer's panels, a step lighter where the hue alone falls
  // under 4.5:1 on a panel's surface; the canvas keeps the hue itself.
  axisTextX: colour(110, 160, 255), // #6EA0FF
  axisTextY: axis.y,
  axisTextZ: axis.z,
});

const highlight = colour(245, 158, 11);
const interaction = Object.freeze({
  outline: highlight,
  button: highlight,
  buttonText: text.onBright,
  buttonFocus: colour(252, 211, 77),
  buttonFocusText: text.onBright,
  // The playhead is the run's cursor: an amber bracket at the column's edge over a neutral band, so
  // the next column never reads as a hovered one, whose fill is the amber-brown gate.hover.
  playhead: highlight,
  playheadBand: colour(211, 214, 224, 0.06),
  // A debugger's breakpoint dot.
  breakpoint: colour(248, 113, 113),
  drop: colour(255, 196, 112, 0.16),
  // A selected part of the circuit: neutral ink, so it takes no hue that already means something.
  selection: colour(211, 214, 224, 0.1),
  selectionEdge: colour(211, 214, 224),
});

const error = Object.freeze({
  text: colour(232, 121, 249),
  background: colour(53, 28, 57),
});

// The chrome's neutrals share the canvas's indigo cast (OKLCH hue about 268°), so no strip or
// border reads warmer than the surfaces around it.
const ui = Object.freeze({
  tableDivider: colour(211, 214, 224, 0.0635),
  transportSurface: colour(30, 33, 42),
  searchSurface: colour(31, 34, 42),
  focusShadow: colour(139, 147, 166, 0.28),
  tileHover: colour(53, 57, 69),
  controlBorder: colour(227, 230, 238, 0.6135),
  controlSurface: colour(65, 73, 91),
  controlHover: colour(80, 91, 112),
  brandInk: colour(233, 235, 242),
  brandSurface: colour(229, 232, 239, 0.2),
  brandBorder: colour(229, 232, 239, 0.52),
  brandGlow: colour(229, 232, 239, 0.24),
  panelGlow: colour(139, 147, 166, 0.6),
  // A filled primary button lifts to white under the pointer, as a light one deepens on light.
  panelPrimaryHover: colour(255, 255, 255),
  panelOptionSurface: colour(43, 47, 59, 0.62),
  panelOptionBorder: colour(146, 154, 172, 0.6135),
  errorBorder: colour(232, 121, 249, 0.5),
  sidebarScrollbar: colour(252, 250, 250, 0.22),
  shadowPopup: colour(0, 0, 0, 0.45),
  shadowBanner: colour(0, 0, 0, 0.4),
  shadowControl: colour(0, 0, 0, 0.35),
  background: colour(26, 29, 37),
  foreground: colour(250, 250, 252),
  primary: colour(229, 231, 239),
  secondary: colour(43, 47, 59),
  border: colour(211, 214, 224, 0.14),
  input: colour(211, 214, 224, 0.3),
});

const tape = Object.freeze([
  colour(102, 217, 239),
  colour(255, 180, 84),
  colour(184, 233, 134),
  colour(206, 147, 216),
  colour(255, 138, 128),
  colour(128, 203, 196),
  colour(255, 241, 118),
  colour(170, 191, 255),
]);

// ── Dial ────────────────────────────────────────────────────────────────────
// The encoder beside a rotation gate, seen from above after a pocket synthesizer's knobs: a pale
// face, a ring, a dark core, and an index mark in the gate's axis hue. X's blue is lifted to clear
// 3:1 against the dark ring.
const dial = Object.freeze({
  face: colour(242, 239, 231), // #F2EFE7
  ring: colour(40, 40, 40), // #282828
  core: colour(20, 20, 20), // #141414
  x: colour(110, 160, 255), // #6EA0FF
  y: axis.y,
  z: axis.z,
  plain: colour(160, 160, 160), // #A0A0A0
  // The rest of the arc the index has not reached.
  track: colour(80, 82, 88), // #505258
});

const Colours = Object.freeze({
  surface,
  text,
  iqp,
  axis,
  iqpText,
  stroke,
  gate,
  probability,
  amplitude,
  operation,
  bloch,
  interaction,
  error,
  ui,
  tape,
  dial,
  transparent: colour(0, 0, 0, 0),
});

export const dark = Object.freeze({
  colours: Colours,
  phase: Object.freeze({ lightness: 0.74, chroma: 0.13 }),
  scheme: "dark",
});
