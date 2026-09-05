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

import {Complex, PARSE_COMPLEX_TOKEN_MAP_RAD} from "../../math/Complex.js"
import {parseFormula} from "../../math/FormulaParser.js"

/**
 * @param {!string} formula
 * @param {undefined|!number} time
 * @param {!boolean} warn
 * @returns {undefined|!number}
 */
function parseTimeFormula(formula, time, warn) {
    let tokenMap = new Map([...PARSE_COMPLEX_TOKEN_MAP_RAD.entries()]);
    if (time !== undefined) {
        tokenMap.set('t', time);
    }
    try {
        let angle = Complex.from(parseFormula(formula, tokenMap));
        if (Math.abs(angle.imag) > 0.0001) {
            throw new Error(`Non-real angle: ${formula} = ${angle}`);
        }
        return angle.real;
    } catch (ex) {
        if (warn) {
            console.warn(ex);
        }
        return undefined;
    }
}

/** Sample values spanning the time variable's range, for probing whether a formula uses t. */
const TIME_PROBE_VALUES = [0.02, 1.26, 1.96];

/**
 * Makes a `Gate.withParam` recompute function that resizes the gate to fit its formula and pairs it
 * with a negated-formula alternate.
 * @param {!int} symbolOverheadChars Characters the gate symbol adds around the formula text.
 * @param {!boolean} allowTimeDependence Whether a t-dependent formula makes the gate animate.
 *     Gates whose parameter must be constant stay stable so an invalid t never forces repaints.
 * @returns {!function(gate: !Gate)}
 */
function makeUpdateFormulaFunc(symbolOverheadChars=1, allowTimeDependence=true) {
    return gate => {
        // A formula is only time-dependent when it fails to parse on its own but succeeds once a
        // value is substituted for t. A formula that never parses is broken, not time-dependent;
        // treating it as stable avoids endlessly recomputing a gate that is disabled anyway.
        let constant = parseTimeFormula(gate.param, undefined, false) !== undefined;
        let dynamic = allowTimeDependence && !constant &&
            TIME_PROBE_VALUES.some(t => parseTimeFormula(gate.param, t, false) !== undefined);
        gate._stableDuration = dynamic ? 0 : Infinity;

        if (typeof gate.param === 'string') {
            gate.width = Math.ceil((gate.param.length + symbolOverheadChars) / 5);
            gate.alternate = gate._copy();
            gate.alternate.alternate = gate;
            if (gate.param.startsWith('-(') && gate.param.endsWith(')')) {
                gate.alternate.param = gate.param.substring(2, gate.param.length - 1);
            } else {
                gate.alternate.param = '-(' + gate.param + ')';
            }
        } else {
            gate.width = 1;
            gate.alternate = gate;
        }
    };
}

export {parseTimeFormula, makeUpdateFormulaFunc, TIME_PROBE_VALUES}
