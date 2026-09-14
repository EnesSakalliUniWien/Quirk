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

import {Simulation} from '../../../config/Simulation.js';

/** Computes the definition and temporary-wire marker for a nonnegative extra wire count. */
function withJustEnoughWires(context, extraWireCount) {
    const desiredWireCount = context.definition.minimumRequiredWireCount();
    const clampedWireCount = Math.min(Simulation.MAX_WIRE_COUNT,
        Math.max(Simulation.MIN_WIRE_COUNT, desiredWireCount) + extraWireCount);
    return {
        definition: context.definition.withWireCount(clampedWireCount),
        extraWireStartIndex: extraWireCount === 0 ? undefined : context.definition.numWires
    };
}

export {withJustEnoughWires};
