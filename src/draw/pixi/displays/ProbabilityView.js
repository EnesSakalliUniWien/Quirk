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

import {DATA_RENDERERS} from '../../renderers/dataRenderers.js';

/**
 * The multi-qubit probability display: the shared probabilities renderer, fed from the gate's
 * stats. The drawing itself lives in src/draw/renderers/dataRenderers.js, where the panels use it
 * too.
 *
 * @param {!GateRenderParams} args
 */
function paintMultiProbabilityDisplay(args) {
    DATA_RENDERERS.probabilities(args.painter, args.customStats, args.rect, {
        wireCount: args.gate.height,
        focusPoints: args.focusPoints,
    });
}

export {paintMultiProbabilityDisplay};
