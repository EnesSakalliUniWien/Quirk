/** Renderer-independent sRGB channels (0–255) and alpha (0–1). */
const colour = (r, g, b, alpha = 1) => Object.freeze({r, g, b, alpha});

const surface = Object.freeze({
    background: colour(32, 38, 48),
    gate: colour(52, 59, 73),
    quiet: colour(35, 38, 48),
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

const stroke = Object.freeze({
    grid: colour(125, 133, 153),
    guide: colour(139, 147, 166),
    faint: colour(125, 133, 153),
    bright: colour(211, 214, 224),
    frame: text.muted,
    displayFrame: colour(196, 203, 216),
});

const gate = Object.freeze({
    hover: colour(73, 56, 36),
    time: colour(48, 44, 67),
});

const probability = Object.freeze({
    background: colour(15, 31, 20),
    fill: colour(34, 197, 94),
    outline: colour(112, 224, 154),
});

const amplitude = Object.freeze({
    background: colour(14, 27, 30),
    circle: colour(14, 116, 144),
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
    buttonFocus: colour(252, 211, 77),
    playhead: highlight,
    playheadBand: colour(245, 158, 11, 0.14),
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

export const Colours = Object.freeze({surface, text, iqp, stroke, gate, probability, amplitude, operation, bloch, interaction, error, ui, tape, transparent: colour(0, 0, 0, 0)});
