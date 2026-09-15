/** Compatibility entry point for browser consumers. Shared data lives in appearance/Appearance.js. */
import {Appearance} from '../appearance/Appearance.js';
import {colourString} from '../appearance/formats/colour.js';
import {CanvasTheme} from '../draw/theme/CanvasTheme.js';
import {Typography} from '../appearance/formats/typography.js';
import {dom} from '../browser/theme/dom.js';
import {dockProperties} from '../browser/theme/dock.js';

const {colorScheme} = Appearance;
export const Theme = Object.freeze({colorScheme, canvas: CanvasTheme, typography: Typography, dom, dockProperties,
    dock: Object.freeze({name: 'shadow-quant', className: 'dockview-theme-shadow-quant', colorScheme}),
    tape: Object.freeze(Appearance.colours.tape.map(colourString)),
});
export {CanvasTheme};
export {phaseColor} from '../appearance/formats/phase.js';
export {gateStyle} from '../draw/theme/gateStyle.js';
