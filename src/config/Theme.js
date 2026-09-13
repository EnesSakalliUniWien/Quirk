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
 * The application's theme values. Panels, controls, canvas gates, Dockview and Tape read this
 * definition. CSS consumes the DOM properties applied by browser/applyTheme.js; it defines no
 * theme values. Edit assignments here to change the theme, then reload the app.
 */

/** The state readout: Chance, Bloch, density matrices and samples. */
const STATE_READOUT = "#22C55E";
const STATE_READOUT_BACKGROUND = "#0F1F14";
const GATE_SURFACE = "#343B49";
const GRID = "#7D8599";
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
    grid: GRID,
    guide: "#8B93A6",
    faint: GRID,
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
  // Circle area and level show probability, the level a quiet tint behind the disc. The hand is
  // white over the halo, so phase reads by angle, and by number in the tooltip; the reference ink
  // outlines the cell whose phase was taken as zero.
  amplitude: Object.freeze({
    background: "#0E1B1E",
    circle: "#0E7490",
    fill: "#16758A",
    phaseHalo: "#14161D",
    reference: "#FAFAFA",
  }),
  // Operator matrices, cycle and counting gates, and rotations, also identified by gate labels and
  // arrow direction. Violet keeps an operator matrix apart from the amplitude grid and the density
  // matrix, which are drawn the same way, including under red-green colour blindness; this violet
  // is dark enough for the white hand on it to clear 3:1. The DOM operator colour below reads this same value.
  operation: Object.freeze({ background: GATE_SURFACE, fill: "#9878F4" }),
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

/**
 * The phase wheel: constant OKLCH lightness and chroma, so every hue weighs the same against the
 * dark surfaces (about 7:1), where an HSL wheel ran from 3:1 at blue to 14:1 at yellow. The chroma
 * is the most the sRGB gamut allows at this lightness for every hue. One wheel serves the state
 * panel's swatches, the operator rasters and the CSS legend, which lists its stops.
 */
const PHASE_LIGHTNESS = 0.75;
const PHASE_CHROMA = 0.12;

/**
 * @param {!number} phaseDegrees
 * @returns {!Array.<!int>} The phase's colour as 0-255 sRGB.
 */
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
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  });
}

/** Cyclic phase scale in degrees, as a CSS colour; the number beside a swatch is the cue. */
function phaseColor(phaseDegrees, alpha = 1) {
  const [r, g, b] = phaseRgb(phaseDegrees);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/** Shared font assignments for both DOM and canvas text. */
const typography = Object.freeze({
  DEFAULT_FONT_SIZE: 12,
  DEFAULT_FONT_FAMILY: "'Geist Variable', sans-serif",
  MONO_FONT_FAMILY: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
  GATE_SYMBOL_FONT_SIZE: 16,
  GATE_SYMBOL_FONT_WEIGHT: 500,
  GATE_SYMBOL_MIN_FONT_SIZE: 11,
});

const background = "#1A1D25";
const foreground = "#FAFAFC";
const secondary = "#2B2F3B";
const controlSurface = "#41495B";
const brandInk = "#F1E9EB";
const border = "rgba(211, 214, 224, 0.14)";
const primary = "#E5E7EF";

const dom = Object.freeze({
  "--spacing": "0.25rem",
  "--text-caption": "0.6875rem",
  "--text-small": "0.8125rem",
  "--text-body": "0.9375rem",
  "--text-heading": "1.125rem",
  "--text-title": "1.75rem",
  "--font-sans": typography.DEFAULT_FONT_FAMILY,
  "--font-mono": typography.MONO_FONT_FAMILY,
  "--table-divider": "rgba(223, 211, 214, 0.0635)",
  "--transport-surface": "#291E21",
  "--search-muted": CanvasTheme.text.muted,
  "--search-surface": "#291F22",
  "--focus-shadow": "rgba(139, 147, 166, 0.28)",
  "--tile-hover": "#353945",
  "--tile-outline": CanvasTheme.stroke.guide,
  "--focus-outline": CanvasTheme.stroke.guide,
  "--inset-surface": secondary,
  "--sidebar-muted": CanvasTheme.text.muted,
  "--control-border": "rgba(237, 227, 229, 0.6135)",
  "--control-surface": controlSurface,
  "--control-hover": "#505B70",
  "--input-surface": controlSurface,
  "--brand-ink": brandInk,
  "--brand-surface": "rgba(238, 229, 231, 0.2)",
  "--brand-border": "rgba(238, 229, 231, 0.52)",
  "--brand-glow": "rgba(238, 229, 231, 0.24)",
  "--panel-heading": brandInk,
  "--panel-glow": "rgba(139, 147, 166, 0.6)",
  "--panel-primary-hover": "#EFE6E8",
  "--panel-option-surface": "rgba(43, 47, 59, 0.62)",
  "--panel-option-border": "rgba(146, 154, 172, 0.6135)",
  "--panel-link": CanvasTheme.text.muted,
  "--panel-link-hover": CanvasTheme.text.primary,
  "--error-border": "rgba(232, 121, 249, 0.5)",
  "--sidebar-scrollbar": "rgba(252, 250, 250, 0.22)",
  "--shadow-popup": "rgba(0, 0, 0, 0.45)",
  "--shadow-banner": "rgba(0, 0, 0, 0.4)",
  "--shadow-control": "rgba(0, 0, 0, 0.35)",
  "--state-probability-fill": CanvasTheme.probability.fill,
  "--state-probability-back": CanvasTheme.probability.background,
  "--operator": CanvasTheme.operation.fill,
  "--phase-legend": `linear-gradient(to right, ${Array.from({length: 9}, (_, i) => phaseColor(-180 + i * 45)).join(", ")})`,
  "--app-font-sans": typography.DEFAULT_FONT_FAMILY,
  "--app-font-mono": typography.MONO_FONT_FAMILY,
  "--background": background,
  "--foreground": foreground,
  "--card": CanvasTheme.surface.quiet,
  "--card-foreground": foreground,
  "--popover": CanvasTheme.surface.quiet,
  "--popover-foreground": foreground,
  "--primary": primary,
  "--primary-foreground": CanvasTheme.surface.quiet,
  "--secondary": secondary,
  "--secondary-foreground": foreground,
  "--muted": secondary,
  "--muted-foreground": CanvasTheme.text.muted,
  "--accent": secondary,
  "--accent-foreground": foreground,
  "--destructive": CanvasTheme.error.text,
  "--border": border,
  "--input": "rgba(211, 214, 224, 0.3)",
  "--ring": CanvasTheme.stroke.guide,
  "--radius": "0.625rem",
  "--sidebar": background,
  "--sidebar-foreground": foreground,
  "--sidebar-primary": primary,
  "--sidebar-primary-foreground": CanvasTheme.surface.quiet,
  "--sidebar-accent": secondary,
  "--sidebar-accent-foreground": foreground,
  "--sidebar-border": border,
  "--sidebar-ring": CanvasTheme.stroke.guide,
  "--button-ghost-hover": `color-mix(in oklab, ${secondary} 50%, transparent)`,
  "--button-focus-shadow": `color-mix(in oklab, ${CanvasTheme.stroke.guide} 50%, transparent)`,
  "--matrix-active-surface": `color-mix(in oklab, ${CanvasTheme.stroke.guide} 22%, transparent)`,
  "--operator-control-surface": `color-mix(in oklab, ${foreground} 5%, transparent)`,
});

/** Dockview receives the same values through its documented custom-theme properties. */
const dockProperties = Object.freeze({
  "--dv-paneview-active-outline-color": dom["--ring"],
  "--dv-tabs-and-actions-container-font-size": "13px",
  "--dv-tabs-and-actions-container-height": "35px",
  "--dv-drag-over-background-color": dom["--focus-shadow"],
  "--dv-drag-over-border-color": dom["--ring"],
  "--dv-edge-dock-indicator-color": dom["--ring"],
  "--dv-tabs-container-scrollbar-color": dom["--sidebar-scrollbar"],
  "--dv-icon-hover-background-color": dom["--accent"],
  "--dv-floating-box-shadow": `0 8px 32px ${dom["--shadow-popup"]}`,
  "--dv-floating-border": `1px solid ${dom["--control-border"]}`,
  "--dv-overlay-z-index": "999",
  "--dv-tab-font-size": "inherit",
  "--dv-border-radius": "0px",
  "--dv-tab-margin": "0",
  "--dv-active-sash-transition-duration": "0.1s",
  "--dv-active-sash-transition-delay": "0.5s",
  "--dv-spacing-padding": "0px",
  "--dv-tab-border-radius": "0px",
  "--dv-sash-border-radius": "0px",
  "--dv-dropdown-border-radius": "0px",
  "--dv-tab-close-icon-size": "inherit",
  "--dv-floating-group-border": "none",
  "--dv-drag-over-border": "none",
  "--dv-floating-group-dragging-opacity": "0.5",
  "--dv-floating-titlebar-height": "22px",
  "--dv-floating-titlebar-background-color": dom["--card"],
  "--dv-floating-titlebar-border-bottom": `1px solid ${dom["--control-border"]}`,
  "--dv-group-view-background-color": dom["--card"],
  "--dv-tabs-and-actions-container-background-color": dom["--background"],
  "--dv-activegroup-visiblepanel-tab-background-color": dom["--card"],
  "--dv-activegroup-hiddenpanel-tab-background-color": dom["--background"],
  "--dv-inactivegroup-visiblepanel-tab-background-color": dom["--card"],
  "--dv-inactivegroup-hiddenpanel-tab-background-color": dom["--background"],
  "--dv-activegroup-visiblepanel-tab-color": dom["--foreground"],
  "--dv-activegroup-hiddenpanel-tab-color": dom["--muted-foreground"],
  "--dv-inactivegroup-visiblepanel-tab-color": dom["--muted-foreground"],
  "--dv-inactivegroup-hiddenpanel-tab-color": dom["--muted-foreground"],
  "--dv-tab-divider-color": dom["--border"],
  "--dock-tab-icon-size": "14px",
  "--dv-separator-border": dom["--border"],
  "--dv-paneview-header-border-color": dom["--border"],
  "--dv-context-menu-background-color": dom["--card"],
  "--dv-sash-color": dom["--border"],
  "--dv-active-sash-color": dom["--ring"],
});

const colorScheme = "dark";
const Theme = Object.freeze({
  colorScheme,
  canvas: CanvasTheme,
  typography,
  dom,
  dockProperties,
  dock: Object.freeze({name: "shadow-quant", className: "dockview-theme-shadow-quant", colorScheme}),
  tape: Object.freeze(["#66d9ef", "#ffb454", "#b8e986", "#ce93d8", "#ff8a80", "#80cbc4", "#fff176", "#aabfff"]),
});

export { Theme, CanvasTheme, phaseColor, phaseRgb, gateStyle };
