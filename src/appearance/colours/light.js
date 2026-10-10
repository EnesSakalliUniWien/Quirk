/** Renderer-independent sRGB channels (0–255) and alpha (0–1). */
const colour = (r, g, b, alpha = 1) => Object.freeze({ r, g, b, alpha });

// ── Surfaces ────────────────────────────────────────────────────────────────
const surface = Object.freeze({
  background: colour(255, 255, 255), // #FFFFFF
  gate: colour(227, 230, 236), // #E3E6EC
  quiet: colour(255, 255, 255), // #FFFFFF
  // A readout's tile: quieter than a gate, so a value is told from an operation at a glance.
  readout: colour(250, 250, 247), // #FAFAF7
});

// ── Text ────────────────────────────────────────────────────────────────────
const text = Object.freeze({
  primary: colour(11, 15, 25), // #0B0F19  AAA on white: 19.15:1
  default: colour(26, 31, 43), // #1A1F2B  AAA on white: 15.77:1
  muted: colour(74, 82, 99), // #4A5263  AAA on white: 7.84:1
  onBright: colour(0, 0, 0), // #000000  for bright gate fills
});

// ── IQP gate colours (Qiskit light iqp.json pairs) ──────────────────────────
// Rotation leaves Qiskit's maroon, which is all but the error colour here, for a rose that is the
// Y axis's on the Bloch sphere too.
const iqp = Object.freeze({
  hadamard: colour(250, 77, 86), // #FA4D56
  not: colour(0, 45, 156), // #002D9C
  rotation: colour(184, 43, 171), // #B82BAB
  phase: colour(51, 177, 255), // #33B1FF
  measure: colour(168, 168, 168), // #A8A8A8
  classicalWire: colour(119, 136, 153), // #778899
});

// One hue per axis, on gates, dials and the Bloch sphere alike. Z's sky blue darkens for lines,
// which need 4.5:1 on white where the gate fill needs only its dark label.
const axis = Object.freeze({
  x: iqp.not,
  y: iqp.rotation,
  z: colour(21, 119, 216), // #1577D8
});
// Per-gate label colours: dark on bright fills, white on dark fills.
const iqpText = Object.freeze({
  hadamard: colour(0, 0, 0), // 6.26:1 on #FA4D56
  not: colour(255, 255, 255), // 11.32:1 on #002D9C
  rotation: colour(255, 255, 255), // 5.33:1 on #B82BAB
  phase: colour(0, 0, 0), // 8.87:1 on #33B1FF
  measure: colour(0, 0, 0), // 8.83:1 on #A8A8A8
});

// ── Lines and marks (≥3:1 non-text contrast on white) ───────────────────────
const stroke = Object.freeze({
  grid: colour(124, 132, 148), // #7C8494  3.76:1 on white
  guide: colour(94, 102, 117), // #5E6675  5.78:1 on white
  faint: colour(124, 132, 148), // #7C8494
  // Opaque, so it holds 3:1 on an amplitude cell, as a mark a value is read from must.
  logRing: colour(132, 139, 154),
  bright: colour(46, 52, 64), // #2E3440  12.49:1 on white
  frame: text.muted,
  displayFrame: colour(46, 52, 64),
  // The wire: a line, not text, so it sits back from the gates it carries.
  wire: colour(110, 118, 134), // #6E7686
});

// ── Gate chrome ─────────────────────────────────────────────────────────────
const gate = Object.freeze({
  hover: colour(253, 230, 138), // warm highlight on light
  time: colour(221, 214, 254), // violet tint
});

// ── Probability display ─────────────────────────────────────────────────────
const probability = Object.freeze({
  background: colour(240, 253, 244), // very light green
  fill: colour(21, 128, 61), // #15803D
  // A sampled 1 sits on the fill: white reads at 5.02:1 where black reaches only 4.19:1.
  fillText: colour(255, 255, 255),
  outline: colour(22, 101, 52), // #166534
  // Chance labels in text.primary straddle the bar and the ground: 5.34:1 on the bar, and the bar
  // keeps 3.42:1 against the ground.
  bar: colour(47, 154, 80), // #2F9A50
  // The track a thin bar runs along, on the readout tile.
  track: colour(222, 226, 233), // #DEE2E9
});

// ── Amplitude display ───────────────────────────────────────────────────────
// In a grid of complex numbers colour means phase and nothing else: each disc wears its phase's
// hue from the wheel, and every other mark is a neutral ink, so no colour competes with it.
const amplitude = Object.freeze({
  background: colour(246, 247, 249),
  // The hand on a disc: dark, so it reads on every hue of the wheel.
  hand: colour(20, 23, 31),
  // A chance's bar and number.
  chance: colour(64, 70, 84),
  // A disc whose phase is not defined - its qubit entangled with others - has no hue to wear. It
  // holds 3:1 on the cell, as a disc whose size is read must.
  unknown: colour(126, 132, 144), // #7E8490
  phaseHalo: colour(224, 242, 254),
  reference: text.default,
});

// ── Operation display ───────────────────────────────────────────────────────
const operation = Object.freeze({
  background: surface.gate,
  fill: colour(109, 40, 217), // #6D28D9
});

// ── Bloch sphere ────────────────────────────────────────────────────────────
const bloch = Object.freeze({
  background: probability.background,
  vector: probability.fill,
  mixed: text.muted,
  axisX: axis.x,
  axisY: axis.y,
  axisZ: axis.z,
  // The axes' names as text in the analyzer's panels, a step darker where the hue alone falls
  // under 4.5:1 on a panel's surface; the canvas keeps the hue itself.
  axisTextX: axis.x,
  axisTextY: axis.y,
  axisTextZ: colour(16, 98, 184), // #1062B8
});

// ── Interaction / highlight ─────────────────────────────────────────────────
const highlight = colour(180, 83, 9); // #B45309
const interaction = Object.freeze({
  outline: highlight,
  button: highlight,
  buttonText: colour(255, 255, 255), // 5.02:1 on the button
  buttonFocus: colour(253, 230, 138),
  buttonFocusText: colour(0, 0, 0), // 16.86:1 on the focused button
  // The run's cursor: an amber bracket over a neutral band, apart from the amber hover.
  playhead: highlight,
  playheadBand: colour(46, 52, 64, 0.05),
  // A debugger's breakpoint dot.
  breakpoint: colour(185, 28, 28),
  drop: colour(180, 83, 9, 0.16),
  // A selected part of the circuit: neutral ink, so it takes no hue that already means something.
  selection: colour(46, 52, 64, 0.08),
  selectionEdge: colour(46, 52, 64), // #2E3440  12.49:1 on white
});

// ── Error ───────────────────────────────────────────────────────────────────
const error = Object.freeze({
  text: colour(157, 23, 77), // #9D174D
  background: colour(253, 242, 248),
});

// ── UI chrome ───────────────────────────────────────────────────────────────
const ui = Object.freeze({
  tableDivider: colour(0, 0, 0, 0.08),
  transportSurface: colour(243, 244, 246),
  searchSurface: colour(243, 244, 246),
  focusShadow: colour(0, 0, 0, 0.15),
  tileHover: colour(229, 231, 235),
  // Control and input edges: at least 3.16:1 against white and #F4F5F7, over white or #F3F4F6 fills.
  controlBorder: colour(0, 0, 0, 0.46),
  controlSurface: colour(255, 255, 255),
  controlHover: colour(243, 244, 246),
  brandInk: colour(11, 15, 25),
  panelGlow: colour(0, 0, 0, 0.08),
  panelPrimaryHover: colour(11, 15, 25),
  panelOptionSurface: colour(243, 244, 246, 0.62),
  panelOptionBorder: colour(0, 0, 0, 0.12),
  errorBorder: colour(157, 23, 77, 0.5),
  sidebarScrollbar: colour(0, 0, 0, 0.15),
  shadowPopup: colour(0, 0, 0, 0.12),
  shadowBanner: colour(0, 0, 0, 0.1),
  shadowControl: colour(0, 0, 0, 0.08),
  background: colour(244, 245, 247), // #F4F5F7
  foreground: colour(11, 15, 25),
  primary: colour(26, 31, 43),
  secondary: colour(243, 244, 246),
  border: colour(0, 0, 0, 0.1),
  input: colour(0, 0, 0, 0.46),
});

// ── Tape colours (order preserved, ≥4.8:1 on white) ─────────────────────────
const tape = Object.freeze([
  colour(0, 124, 153), // #007C99
  colour(179, 89, 0), // #B35900
  colour(63, 127, 26), // #3F7F1A
  colour(142, 68, 173), // #8E44AD
  colour(192, 57, 43), // #C0392B
  colour(0, 121, 107), // #00796B
  colour(138, 109, 0), // #8A6D00
  colour(79, 95, 214), // #4F5FD6
]);

// ── Dial ────────────────────────────────────────────────────────────────────
// The encoder beside a rotation gate, seen from above after a pocket synthesizer's knobs: a pale
// face, a ring, a dark core, and an index mark toned by the gate's axis.
const dial = Object.freeze({
  face: colour(242, 239, 231), // #F2EFE7
  ring: colour(40, 40, 40), // #282828
  core: colour(20, 20, 20), // #141414
  x: axis.x,
  y: axis.y,
  z: axis.z,
  plain: colour(96, 96, 96), // #606060
  // The rest of the arc the index has not reached, dark enough to read as a track on the face.
  track: colour(192, 189, 179), // #C0BDB3
});

const Colours = Object.freeze({
  surface,
  text,
  axis,
  iqp,
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

export const light = Object.freeze({
  colours: Colours,
  phase: Object.freeze({ lightness: 0.6, chroma: 0.135 }),
  scheme: "light",
});
