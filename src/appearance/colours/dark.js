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
  logRing: colour(125, 133, 153, 0.55),
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

// The disc reads lighter than the probability bar beneath it, so the two encodings stay apart.
const amplitude = Object.freeze({
  background: colour(14, 27, 30),
  circle: colour(56, 169, 196),
  fill: colour(22, 117, 138),
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
  axisX: colour(252, 169, 187),
  axisY: colour(80, 252, 234),
  axisZ: colour(41, 201, 250),
});

const highlight = colour(245, 158, 11);
const interaction = Object.freeze({
  outline: highlight,
  button: highlight,
  buttonText: text.onBright,
  buttonFocus: colour(252, 211, 77),
  buttonFocusText: text.onBright,
  playhead: highlight,
  playheadBand: colour(245, 158, 11, 0.14),
  // A debugger's breakpoint dot.
  breakpoint: colour(248, 113, 113),
  drop: colour(255, 196, 112, 0.16),
});

const error = Object.freeze({
  text: colour(232, 121, 249),
  background: colour(53, 28, 57),
});

const ui = Object.freeze({
  tableDivider: colour(223, 211, 214, 0.0635),
  transportSurface: colour(41, 30, 33),
  searchSurface: colour(41, 31, 34),
  focusShadow: colour(139, 147, 166, 0.28),
  tileHover: colour(53, 57, 69),
  controlBorder: colour(237, 227, 229, 0.6135),
  controlSurface: colour(65, 73, 91),
  controlHover: colour(80, 91, 112),
  brandInk: colour(241, 233, 235),
  brandSurface: colour(238, 229, 231, 0.2),
  brandBorder: colour(238, 229, 231, 0.52),
  brandGlow: colour(238, 229, 231, 0.24),
  panelGlow: colour(139, 147, 166, 0.6),
  panelPrimaryHover: colour(239, 230, 232),
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
// face, a ring, a dark core, and an index mark toned by the gate's axis.
const dial = Object.freeze({
  face: colour(242, 239, 231), // #F2EFE7
  ring: colour(40, 40, 40), // #282828
  core: colour(20, 20, 20), // #141414
  x: colour(75, 141, 248), // #4B8DF8
  y: colour(88, 194, 122), // #58C27A
  z: colour(242, 140, 51), // #F28C33
  plain: colour(160, 160, 160), // #A0A0A0
  // The rest of the arc the index has not reached.
  track: colour(80, 82, 88), // #505258
});

const Colours = Object.freeze({
  surface, text, iqp, iqpText, stroke, gate, probability, amplitude,
  operation, bloch, interaction, error, ui, tape, dial,
  transparent: colour(0, 0, 0, 0),
});

export const dark = Object.freeze({
  colours: Colours,
  phase: Object.freeze({ lightness: 0.75, chroma: 0.12 }),
  scheme: "dark",
});
