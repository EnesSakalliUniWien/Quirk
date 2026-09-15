import {Colours} from './colours.js';
import {Typography} from './typography.js';
import {Spacing} from './spacing.js';
import {Borders} from './borders.js';

/** Plain appearance data: safe in a worker or any renderer, with no DOM, CSS or Pixi dependency. */
export const Appearance = Object.freeze({colours: Colours, typography: Typography, spacing: Spacing, borders: Borders,
    opacity: Object.freeze({forgeRange: 0.08, ghostHover: 0.5, focus: 0.5, matrixActive: 0.22, operatorControl: 0.05}),
    phase: Object.freeze({lightness: 0.75, chroma: 0.12}), colorScheme: 'dark'});
