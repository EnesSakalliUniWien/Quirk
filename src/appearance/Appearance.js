import { dark, light } from "./colours.js";
import { Typography } from "./typography.js";
import { Spacing } from "./spacing.js";
import { Borders } from "./borders.js";
import {
  setColourScheme,
  colourScheme,
  onColourSchemeChange,
} from "./colourScheme.js";

const palettes = { dark, light };

const opacity = Object.freeze({
  forgeRange: 0.08,
  ghostHover: 0.5,
  focus: 0.5,
  matrixActive: 0.22,
  operatorControl: 0.05,
});

/**
 * Plain appearance data for one colour scheme: safe in a worker or any renderer, with no DOM, CSS
 * or Pixi dependency.
 * @param {'dark'|'light'} scheme
 * @returns {!Object}
 */
export function appearanceFor(scheme) {
  if (!Object.hasOwn(palettes, scheme)) {
    throw new RangeError(`Unknown colour scheme: ${scheme}`);
  }
  const palette = palettes[scheme];
  return Object.freeze({
    colours: palette.colours,
    typography: Typography,
    spacing: Spacing,
    borders: Borders,
    opacity,
    phase: palette.phase,
    colorScheme: palette.scheme,
  });
}

/** Immutable snapshot of the active scheme, replaced when the system appearance changes. */
export let Appearance = appearanceFor(colourScheme());
onColourSchemeChange(() => {
  Appearance = appearanceFor(colourScheme());
});

export { setColourScheme, colourScheme };
