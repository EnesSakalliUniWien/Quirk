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

import {GatePainting} from "./GatePainting.js"

/**
 * The one drawer the serializer cannot import: a circuit-defined custom gate is drawn as its
 * little circuit, and that renderer lives up in the ui layer, whose modules import the serializer
 * right back. The ui layer deposits the renderer here at load time, and gates deserialized from a
 * circuit resolve it lazily at paint time.
 *
 * Until it is deposited - as in tests that serialize circuits without ever drawing them - the
 * fallback draws the gate like any other boxed gate.
 *
 * @type {undefined|!function(!GateDrawParams)}
 */
let _circuitDrawer = undefined;

/**
 * @param {!function(!GateDrawParams)} drawer
 * @returns {void}
 */
function setCustomGateCircuitDrawer(drawer) {
    _circuitDrawer = drawer;
}

/**
 * @param {!GateDrawParams} args
 * @returns {void}
 */
function drawCustomGateCircuit(args) {
    (_circuitDrawer || GatePainting.DEFAULT_DRAWER)(args);
}

export {setCustomGateCircuitDrawer, drawCustomGateCircuit}
