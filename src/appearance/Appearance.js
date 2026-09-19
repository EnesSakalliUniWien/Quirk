import { dark, light } from "./colours.js";
import { Typography } from "./typography.js";
import { Spacing } from "./spacing.js";
import { Borders } from "./borders.js";
import { setColourScheme, colourScheme } from "./colourScheme.js";

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

/** The appearance of the scheme chosen at startup: dark unless the browser selected light first. */
export const Appearance = appearanceFor(colourScheme());

export { setColourScheme, colourScheme };
