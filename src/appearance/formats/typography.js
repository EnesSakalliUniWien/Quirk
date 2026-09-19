import {Appearance} from '../Appearance.js';
const {family, size, weight} = Appearance.typography;
const familyString = names => names.map(name => /[ -]/.test(name) && !['sans-serif', 'ui-monospace'].includes(name) ? `'${name}'` : name).join(', ');
/** Text API formatting belongs here; shared font data remains arrays and numbers. */
export const Typography = Object.freeze({
    DEFAULT_FONT_SIZE: size.default, DEFAULT_FONT_FAMILY: familyString(family.sans),
    MONO_FONT_FAMILY: familyString(family.mono), GATE_SYMBOL_FONT_SIZE: size.gate,
    GATE_SYMBOL_FONT_WEIGHT: weight.gate, GATE_SYMBOL_MIN_FONT_SIZE: size.gateMinimum,
    READOUT_FONT_SIZE: size.readout, LABEL_FONT_SIZE: size.label,
});
