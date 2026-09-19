/** Compatibility entry point for browser consumers. Shared data lives in appearance/Appearance.js. */
import { appearanceFor, colourScheme } from '../appearance/Appearance.js';
import { colourString } from '../appearance/formats/colour.js';
import { canvasThemeFor } from '../draw/theme/CanvasTheme.js';
import { Typography } from '../appearance/formats/typography.js';
import { domFor } from '../browser/theme/dom.js';
import { dockPropertiesFor } from '../browser/theme/dock.js';

const scheme = colourScheme();
const appearance = appearanceFor(scheme);
const canvas = canvasThemeFor(scheme);
const dom = domFor(scheme);
const dockProperties = dockPropertiesFor(scheme);
const colorScheme = appearance.colorScheme;

export const Theme = Object.freeze({ colorScheme, canvas, typography: Typography, dom, dockProperties,
    dock: Object.freeze({ name: 'shadow-quant', className: 'dockview-theme-shadow-quant', colorScheme }),
    tape: Object.freeze(appearance.colours.tape.map(colourString)),
});
export { canvas as CanvasTheme };
export { phaseColor } from '../appearance/formats/phase.js';
export { gateStyle } from '../draw/theme/gateStyle.js';
