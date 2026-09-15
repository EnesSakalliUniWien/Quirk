import {paintGateLabel} from './GateLabel.js';
import {GATE_SYMBOL_FONT} from './GateSymbol.js';
import {gateStyle} from '../../config/CanvasTheme.js';

/** Display notation only: never rewrite the stored parameter or the gate footprint. */
export function angleLabelParts(gate) {
    return {symbol:gate.symbol, parameter:String(gate.param).replace(/(?<![a-z_])pi(?![a-z_])/gi, 'π')};
}
export function paintAngleGateLabel(args) {
    const {symbol,parameter} = angleLabelParts(args.gate);
    const {rect,painter} = args;
    const fill = gateStyle(args.gate).text;
    paintGateLabel(painter, rect.paddedBy(-3), [
        [{text: symbol, font: {...GATE_SYMBOL_FONT, fontSize: 17}}],
        [{text: parameter.length > 28 ? parameter.slice(0,25)+'…' : parameter,
            font: {...GATE_SYMBOL_FONT, fontSize: 12}}]
    ], fill);
}
