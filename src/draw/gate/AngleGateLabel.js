import {fitLine} from '../text/TextLayout.js';
import {gateStyle} from '../../config/CanvasTheme.js';
import {Rect} from '../../geometry/Rect.js';

/** Display notation only: never rewrite the stored parameter or the gate footprint. */
export function angleLabelParts(gate) {
    return {symbol:gate.symbol, parameter:String(gate.param).replace(/(?<![a-z_])pi(?![a-z_])/gi, 'π')};
}
export function paintAngleGateLabel(args) {
    const {symbol,parameter} = angleLabelParts(args.gate);
    const {rect,painter} = args;
    const fill = gateStyle(args.gate).text;
    fitLine(painter,symbol,new Rect(rect.x+3,rect.y+2,rect.w-6,rect.h*.45),{horizontal:.5,vertical:.5,fill,maxFontSize:17});
    fitLine(painter,parameter.length > 28 ? parameter.slice(0,25)+'…' : parameter,
        new Rect(rect.x+4,rect.y+rect.h*.48,rect.w-8,rect.h*.35),{horizontal:.5,vertical:.5,fill,maxFontSize:12});
}
