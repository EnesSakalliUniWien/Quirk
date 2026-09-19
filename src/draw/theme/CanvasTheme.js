import { appearanceFor } from '../../appearance/Appearance.js';
import { colourScheme } from '../../appearance/colourScheme.js';
import { colourString } from '../../appearance/formats/colour.js';

/** String-valued colours accepted by the existing drawing API; no Pixi objects are shared. */
export function canvasThemeFor(scheme) {
    const { colours } = appearanceFor(scheme);
    return Object.freeze({
        surface: Object.freeze(Object.fromEntries(Object.entries(colours.surface).map(([name, value]) => [name, colourString(value)]))),
        text: Object.freeze(Object.fromEntries(Object.entries(colours.text).map(([name, value]) => [name, colourString(value)]))),
        iqp: Object.freeze(Object.fromEntries(Object.entries(colours.iqp).map(([name, value]) => [name, colourString(value)]))),
        iqpText: Object.freeze(Object.fromEntries(Object.entries(colours.iqpText).map(([name, value]) => [name, colourString(value)]))),
        stroke: Object.freeze(Object.fromEntries(Object.entries(colours.stroke).map(([name, value]) => [name, colourString(value)]))),
        gate: Object.freeze(Object.fromEntries(Object.entries(colours.gate).map(([name, value]) => [name, colourString(value)]))),
        probability: Object.freeze(Object.fromEntries(Object.entries(colours.probability).map(([name, value]) => [name, colourString(value)]))),
        amplitude: Object.freeze(Object.fromEntries(Object.entries(colours.amplitude).map(([name, value]) => [name, colourString(value)]))),
        operation: Object.freeze(Object.fromEntries(Object.entries(colours.operation).map(([name, value]) => [name, colourString(value)]))),
        bloch: Object.freeze(Object.fromEntries(Object.entries(colours.bloch).map(([name, value]) => [name, colourString(value)]))),
        interaction: Object.freeze(Object.fromEntries(Object.entries(colours.interaction).map(([name, value]) => [name, colourString(value)]))),
        error: Object.freeze(Object.fromEntries(Object.entries(colours.error).map(([name, value]) => [name, colourString(value)]))),
        transparent: colourString(colours.transparent),
    });
}

export const CanvasTheme = canvasThemeFor(colourScheme());
