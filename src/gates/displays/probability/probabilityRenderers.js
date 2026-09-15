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

import { makeDisplayRenderer } from "../../../draw/gate/GateRenderers.js";
import { paintProbabilityBox, paintMultiProbabilityDisplay } from "../../../draw/displays/probability/ProbabilityView.js";

const SINGLE_PROBABILITY_RENDERER = makeDisplayRenderer((args) => {
        const { row, col } = args.positionInCircuit;
        paintProbabilityBox(
          args.painter,
          args.stats.controlledWireProbabilityJustAfter(row, col),
          args.rect,
          args.focusPoints,
        );
      });

const MULTI_PROBABILITY_RENDERER = makeDisplayRenderer(paintMultiProbabilityDisplay);

export { SINGLE_PROBABILITY_RENDERER, MULTI_PROBABILITY_RENDERER };
