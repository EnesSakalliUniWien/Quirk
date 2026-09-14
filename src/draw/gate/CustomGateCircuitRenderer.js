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

import {DEFAULT_RENDERER} from './GateRenderers.js';

/**
 * The one renderer the serializer cannot import: a circuit-defined custom gate is drawn as its
 * little circuit, and that renderer lives up in the editor layer, whose modules import the
 * serializer right back. App and test entry points register the renderer explicitly,
 * and gates deserialized from a circuit resolve it lazily at paint time.
 *
 * Until it is registered - as in tests that serialize circuits without ever drawing them - the
 * fallback draws the gate like any other boxed gate.
 *
 * @type {undefined|!function(!GateRenderParams)}
 */
let _circuitRenderer = undefined;

/**
 * @param {!function(!GateRenderParams)} renderer
 * @returns {void}
 */
function setCustomGateCircuitRenderer(renderer) {
  _circuitRenderer = renderer;
}

/**
 * @param {!GateRenderParams} args
 * @returns {void}
 */
function renderCustomGateCircuit(args) {
  (_circuitRenderer || DEFAULT_RENDERER)(args);
}

export { setCustomGateCircuitRenderer, renderCustomGateCircuit };
