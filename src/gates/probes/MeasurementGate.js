/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {PathGeometry} from '../../draw/pixi/PathGeometry.js';
import {drawPath} from '../../draw/pixi/ShapeView.js';
import {gateStyle} from '../../config/CanvasTheme.js';

import {GateBuilder} from '../../circuit/model/Gate.js';
import {GatePainting} from '../../draw/gate/GatePainting.js';

/**
 * @param {!GateDrawParams} args
 */
function drawMeasurementGate(args) {
    const style = gateStyle(args.gate);
    GatePainting.paintBackground(args);
    GatePainting.paintOutline(args);

    const τ = Math.PI * 2;
    let r = args.rect.w*0.4;
    let {x, y} = args.rect.center();
    y += r*0.6;
    let a = -τ/6;
    let [c, s] = [Math.cos(a)*r*1.5, Math.sin(a)*r*1.5];
    let [p, q] = [x + c, y + s];

    // Draw the dial and shaft.
    drawPath(args.painter, trace => {
        trace.arc(x, y, r, τ/2, τ);
        PathGeometry.line(trace, x, y, p, q);
    }, [{stroke: {color: style.text, width: 1}}]);
    // Draw the indicator head.
    drawPath(args.painter, trace => PathGeometry.arrowHead(trace, p, q, r*0.3, a, τ/4), [{fill: style.text}]);
}

let MeasurementGate = new GateBuilder().
    setSerializedIdAndSymbol("Measure").
    setTitle("Measurement Gate").
    setBlurb("Measures whether a qubit is ON or OFF, without conditioning on the result.").
    promiseHasNoNetEffectOnStateVector().  // Because in the simulation we defer measurement by preventing operations.
    setDrawer(drawMeasurementGate).
    setExtraDisableReasonFinder(args => {
        if (args.isNested) {
            return "can't\nnest\nmeasure\n(sorry)";
        }
        let isMeasured = (args.measuredMask & (1<<args.outerRow)) !== 0;
        if (args.innerColumn.hasControl() && !isMeasured) {
            return "can't\ncontrol\n(sorry)";
        }
        return undefined;
    }).
    gate;

export {MeasurementGate}
