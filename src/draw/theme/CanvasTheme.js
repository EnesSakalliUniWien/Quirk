import {Appearance} from '../../appearance/Appearance.js';
import {colourString} from '../../appearance/formats/colour.js';

/** String-valued colours accepted by the existing drawing API; no Pixi objects are shared. */
export const CanvasTheme = Object.freeze({
    surface: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.surface).map(([name, value]) => [name, colourString(value)]))),
    text: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.text).map(([name, value]) => [name, colourString(value)]))),
    iqp: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.iqp).map(([name, value]) => [name, colourString(value)]))),
    stroke: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.stroke).map(([name, value]) => [name, colourString(value)]))),
    gate: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.gate).map(([name, value]) => [name, colourString(value)]))),
    probability: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.probability).map(([name, value]) => [name, colourString(value)]))),
    amplitude: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.amplitude).map(([name, value]) => [name, colourString(value)]))),
    operation: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.operation).map(([name, value]) => [name, colourString(value)]))),
    bloch: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.bloch).map(([name, value]) => [name, colourString(value)]))),
    interaction: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.interaction).map(([name, value]) => [name, colourString(value)]))),
    error: Object.freeze(Object.fromEntries(Object.entries(Appearance.colours.error).map(([name, value]) => [name, colourString(value)]))),
    transparent: colourString(Appearance.colours.transparent),
});
