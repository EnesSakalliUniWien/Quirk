import { Suite, assertThat } from "../TestUtil.js";
import {
  CanvasTheme as theme,
  phaseColor,
  phaseRgb,
  gateStyle,
} from "../../src/config/CanvasTheme.js";
import { Appearance } from "../../src/appearance/Appearance.js";

const suite = new Suite("CanvasTheme");

suite.test(
  "phase RGB agrees with the browser's independent OKLCH conversion",
  () => {
    assertThat(CSS.supports("color", "oklch(0.75 0.12 0)")).isEqualTo(true);
    const { lightness, chroma } = Appearance.phase;
    for (const angle of [
      -405, -180, -45, 0, 45, 90, 135, 180, 225, 270, 315, 360, 765,
    ]) {
      // A phase of 0° is OKLCH hue 245, so a positive amplitude is blue and a negative one orange.
      const expected = rgb(`oklch(${lightness} ${chroma} ${angle + 245})`);
      const actual = phaseRgb(angle);
      // Allow one byte of rounding difference between the browser and the explicit matrices.
      assertThat(
        actual.every((channel, i) => Math.abs(channel - expected[i]) <= 1),
      )
        .withInfo({ angle, actual, expected })
        .isEqualTo(true);
    }
  },
);

suite.test(
  "IQP-dark assigns operations by axis, Quirk's axis formulas included",
  () => {
    for (const [ids, fill] of [
      [["H"], "#FA4D56"],
      [
        [
          "X",
          "Swap",
          "X^½",
          "X^-¼",
          "Rx",
          "Rxft",
          "X^ft",
          "X^t",
          "e^-iXt",
          "X^(A/2^n)",
        ],
        "#4589FF",
      ],
      [["Y", "Ry", "Y^½", "Y^-½", "Ryft", "Y^ft", "Y^-t", "e^-iYt"], "#FF7EB6"],
      [["Z", "Z^½", "Z^-¼", "Rz", "Rzft", "Z^ft", "e^iZt"], "#BAE6FF"],
      [["Measure"], "#8D8D8D"],
    ]) {
      for (const serializedId of ids) {
        const style = gateStyle({
          serializedId,
          symbol: "different display label",
        });
        assertThat(style).isEqualTo({ fill, text: "#000000" });
        check(style.text, style.fill, 4.5);
      }
    }
    assertThat(theme.surface.background).isEqualTo("#202630");
    assertThat(
      gateStyle({ serializedId: "~custom", symbol: "H" }).fill,
    ).isEqualTo(theme.surface.gate);
    // The clock pulses sit on the time tile, so their labels take the canvas's ink, not a bright fill's.
    for (const serializedId of ["X^⌈t⌉", "X^⌈t-¼⌉"]) {
      const style = gateStyle({
        serializedId,
        symbol: "different display label",
      });
      assertThat(style.text).isEqualTo(theme.text.primary);
      check(style.text, theme.gate.time, 4.5);
    }
  },
);

function rgb(color) {
  const ctx = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

function contrast(a, b) {
  const luminance = (c) =>
    c
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function check(foreground, background, target) {
  const ratio = contrast(rgb(foreground), rgb(background));
  if (ratio < target)
    throw new Error(
      `${foreground} on ${background}: ${ratio.toFixed(2)} < ${target}`,
    );
}

// Machado, Oliveira & Fernandes (2009) red-green deficiencies at full severity, on linear RGB.
const DEFICIENCIES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

/** OKLab coordinates of a colour, seen with full colour vision or with the given deficiency. */
function oklab(color, deficiency = undefined) {
  const linear = rgb(color)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const [r, g, b] =
    deficiency === undefined
      ? linear
      : DEFICIENCIES[deficiency].map((row) =>
          Math.min(
            1,
            Math.max(
              0,
              row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2],
            ),
          ),
        );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Colour difference as OKLab distance ×100. At 15 two colours are told apart at a glance. */
function difference(a, b, deficiency = undefined) {
  const [x, y] = [oklab(a, deficiency), oklab(b, deficiency)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

suite.test("colour definitions are immutable", () => {
  assertThat(Object.isFrozen(theme)).isEqualTo(true);
  for (const value of Object.values(theme)) {
    if (typeof value === "object")
      assertThat(Object.isFrozen(value)).isEqualTo(true);
  }
});

suite.test("each colour that carries a meaning carries only one", () => {
  // The X and Z axes are their gates' colours, so they are counted with them.
  const meanings = {
    hadamard: theme.iqp.hadamard,
    not: theme.iqp.not,
    rotation: theme.iqp.rotation,
    phase: theme.iqp.phase,
    measure: theme.iqp.measure,
    stateReadout: theme.probability.fill,
    operator: theme.operation.fill,
    highlight: theme.interaction.outline,
    error: theme.error.text,
    blochY: theme.bloch.axisY,
  };
  const owners = new Map();
  for (const [meaning, color] of Object.entries(meanings)) {
    assertThat(owners.get(color.toUpperCase()))
      .withInfo({ meaning, color })
      .isEqualTo(undefined);
    owners.set(color.toUpperCase(), meaning);
  }
  // Shared on purpose: one meaning, drawn in two places.
  assertThat(theme.bloch.vector).isEqualTo(theme.probability.fill);
  assertThat(theme.bloch.background).isEqualTo(theme.probability.background);
  assertThat(theme.interaction.playhead).isEqualTo(theme.interaction.outline);
  assertThat(theme.operation.background).isEqualTo(theme.surface.gate);
  // One hue per axis: X's gates and the Bloch sphere's X axis are one colour.
  assertThat(theme.bloch.axisX).isEqualTo(theme.iqp.not);
});

suite.test(
  "the playhead's band is neutral, so the next column never reads as a hovered gate",
  () => {
    // The band is a neutral slate, its channels within a slate's spread of each other, and the hover
    // fill is warm: told apart by hue, as dark colours this close in lightness are.
    const spread = (color) => {
      const c = rgb(color);
      return Math.max(...c) - Math.min(...c);
    };
    assertThat(spread(theme.interaction.playheadBand) <= 24).isEqualTo(true);
    assertThat(spread(theme.gate.hover) >= 30).isEqualTo(true);
  },
);

suite.test(
  "a grid's phases read by hue, and a sign also with red-green colour blindness",
  () => {
    // In every grid of complex numbers colour means phase alone: +1 blue, -1 orange, +i magenta, -i green.
    const cardinal = {
      one: phaseColor(0),
      minusOne: phaseColor(180),
      i: phaseColor(90),
      minusI: phaseColor(-90),
    };
    const names = Object.keys(cardinal);
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        const d = difference(cardinal[names[a]], cardinal[names[b]]);
        assertThat(d >= 15)
          .withInfo({ pair: `${names[a]}~${names[b]}`, d })
          .isEqualTo(true);
      }
    }
    // A sign, the difference read most often, survives red-green deficiency. A quarter turn may not,
    // so the hand on every disc says the exact phase.
    for (const deficiency of Object.keys(DEFICIENCIES)) {
      const d = difference(cardinal.one, cardinal.minusOne, deficiency);
      assertThat(d >= 15)
        .withInfo({ deficiency, d })
        .isEqualTo(true);
    }
  },
);

suite.test(
  "an amplitude's disc stays apart from the chance gauge beside it, whatever its phase",
  () => {
    // Both size one cell's value, so they must not read as a single mark; and the hand crosses the disc.
    for (let angle = -180; angle < 180; angle += 5) {
      const disc = phaseColor(angle);
      assertThat(difference(disc, theme.amplitude.chance) >= 15)
        .withInfo({ angle })
        .isEqualTo(true);
      for (const deficiency of Object.keys(DEFICIENCIES)) {
        const d = difference(disc, theme.amplitude.chance, deficiency);
        assertThat(d >= 8)
          .withInfo({ angle, deficiency, d })
          .isEqualTo(true);
      }
      check(disc, theme.amplitude.background, 3);
      check(theme.amplitude.hand, disc, 3);
    }
    // The neutral inks: the chance a reader reads, the disc without a phase, and the log ring.
    check(theme.amplitude.chance, theme.amplitude.background, 4.5);
    check(theme.amplitude.unknown, theme.amplitude.background, 3);
    check(theme.amplitude.hand, theme.amplitude.unknown, 3);
    check(theme.stroke.logRing, theme.amplitude.background, 3);
  },
);

suite.test(
  "the Bloch axes stay apart from each other and the vector, also with red-green colour blindness",
  () => {
    // The triangles and the vector share one picture, so colour is what says which axis is which.
    const kinds = {
      x: theme.bloch.axisX,
      y: theme.bloch.axisY,
      z: theme.bloch.axisZ,
      vector: theme.bloch.vector,
    };
    const names = Object.keys(kinds);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [kinds[names[i]], kinds[names[j]]];
        const pair = `${names[i]}~${names[j]}`;
        assertThat(difference(a, b) >= 15)
          .withInfo({ pair, normal: difference(a, b) })
          .isEqualTo(true);
        for (const deficiency of Object.keys(DEFICIENCIES)) {
          const d = difference(a, b, deficiency);
          assertThat(d >= 8)
            .withInfo({ pair, deficiency, d })
            .isEqualTo(true);
        }
      }
    }
    for (const axis of [
      theme.bloch.axisX,
      theme.bloch.axisY,
      theme.bloch.axisZ,
    ]) {
      const d = difference(axis, theme.error.text);
      assertThat(d >= 15)
        .withInfo({ axis, d })
        .isEqualTo(true);
      // A leg is drawn over the sphere's own meridians and axis lines.
      for (const guide of [theme.stroke.guide, theme.stroke.faint]) {
        assertThat(difference(axis, guide) >= 15)
          .withInfo({ axis, guide, normal: difference(axis, guide) })
          .isEqualTo(true);
        for (const deficiency of Object.keys(DEFICIENCIES)) {
          const seen = difference(axis, guide, deficiency);
          assertThat(seen >= 8)
            .withInfo({ axis, guide, deficiency, seen })
            .isEqualTo(true);
        }
      }
      // Triangle legs on the sphere; letters beside it and readout names on the panel.
      check(axis, theme.bloch.background, 3);
      check(axis, theme.surface.background, 4.5);
      check(axis, theme.surface.quiet, 4.5);
    }
  },
);

suite.test(
  "the highlight stands apart from every colour that means something",
  () => {
    // The phase wheel takes every hue, so a hovered cell is told from its disc by form: an outline
    // round the cell, not a fill inside it.
    for (const color of [
      theme.iqp.hadamard,
      theme.iqp.not,
      theme.iqp.rotation,
      theme.iqp.phase,
      theme.iqp.measure,
      theme.probability.fill,
      theme.amplitude.chance,
      theme.operation.fill,
      theme.error.text,
      theme.bloch.axisX,
      theme.bloch.axisY,
      theme.bloch.axisZ,
    ]) {
      const d = difference(theme.interaction.outline, color);
      assertThat(d >= 15)
        .withInfo({ color, d })
        .isEqualTo(true);
    }
  },
);

suite.test(
  "text contrasts on normal hover error and data-label surfaces",
  () => {
    for (const background of [
      theme.surface.background,
      theme.surface.gate,
      theme.surface.quiet,
      theme.gate.hover,
      theme.gate.time,
      theme.probability.background,
      theme.amplitude.background,
      theme.operation.background,
      theme.bloch.background,
    ]) {
      for (const foreground of [
        theme.text.primary,
        theme.text.default,
        theme.text.muted,
      ]) {
        check(foreground, background, 4.5);
      }
      check(theme.error.text, background, 4.5);
    }
    check(theme.error.text, theme.error.background, 4.5);
    // Chance labels sit over their bars and beside them, in the same white.
    check(theme.text.primary, theme.probability.bar, 4.5);
    check(theme.text.onBright, theme.operation.fill, 4.5);
    check(theme.probability.fillText, theme.probability.fill, 4.5);
    check(theme.interaction.buttonText, theme.interaction.button, 4.5);
    check(
      theme.interaction.buttonFocusText,
      theme.interaction.buttonFocus,
      4.5,
    );
  },
);

suite.test(
  "essential boundaries and Bloch guides contrast with dark surfaces",
  () => {
    for (const background of [
      theme.surface.background,
      theme.surface.gate,
      theme.surface.quiet,
      theme.probability.background,
      theme.amplitude.background,
      theme.operation.background,
    ]) {
      for (const foreground of [
        theme.stroke.grid,
        theme.stroke.guide,
        theme.stroke.faint,
        theme.interaction.outline,
        theme.interaction.playhead,
      ])
        check(foreground, background, 3);
    }
    check(theme.bloch.vector, theme.bloch.background, 3);
    check(theme.probability.fill, theme.probability.background, 3);
    check(theme.probability.bar, theme.probability.background, 3);
    check(theme.probability.fill, theme.amplitude.background, 3);
    check(theme.stroke.grid, theme.amplitude.phaseHalo, 3);
  },
);

suite.test("frames read clearly on every surface an element can have", () => {
  // Dark fills are within 1.2:1 of the canvas, so the frame is their edge: it clears 4.5:1, not
  // just the 3:1 minimum, and the highlight ring around it clears 3:1.
  for (const background of [
    theme.surface.background,
    theme.surface.gate,
    theme.surface.quiet,
    theme.gate.hover,
    theme.gate.time,
    theme.probability.background,
    theme.amplitude.background,
    theme.bloch.background,
    theme.error.background,
  ]) {
    check(theme.stroke.frame, background, 4.5);
    check(theme.interaction.outline, background, 3);
  }
});

suite.test(
  "phase wraps consistently and remains visible against its halo",
  () => {
    assertThat(phaseColor(-180)).isEqualTo(phaseColor(180));
    assertThat(phaseColor(0)).isEqualTo(phaseColor(360));
    for (let angle = -180; angle <= 180; angle++)
      check(phaseColor(angle), theme.amplitude.phaseHalo, 3);
  },
);

function composited(overlay) {
  const ctx = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = theme.surface.background;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

suite.test(
  "playhead, drop and selection overlays preserve text contrast after compositing",
  () => {
    for (const overlay of [
      theme.interaction.playheadBand,
      theme.interaction.drop,
      theme.interaction.selection,
    ]) {
      const background = composited(overlay);
      assertThat(
        contrast(rgb(theme.text.primary), background) >= 4.5,
      ).isEqualTo(true);
      assertThat(contrast(rgb(theme.text.muted), background) >= 4.5).isEqualTo(
        true,
      );
    }
    // A disabled gate's reason can sit in the playhead's column.
    assertThat(
      contrast(
        rgb(theme.error.text),
        composited(theme.interaction.playheadBand),
      ) >= 4.5,
    ).isEqualTo(true);
  },
);

suite.test(
  "the selection's edge reads on every surface and takes no hue that means something",
  () => {
    for (const background of [
      theme.surface.background,
      theme.surface.gate,
      theme.surface.quiet,
    ]) {
      check(theme.interaction.selectionEdge, background, 3);
    }
    for (const color of [
      theme.interaction.outline,
      theme.iqp.hadamard,
      theme.iqp.not,
      theme.iqp.rotation,
      theme.probability.fill,
      theme.operation.fill,
      theme.error.text,
    ]) {
      const d = difference(theme.interaction.selectionEdge, color);
      assertThat(d >= 15)
        .withInfo({ color, d })
        .isEqualTo(true);
    }
  },
);
