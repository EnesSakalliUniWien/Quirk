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

import { GateBuilder } from "../../../circuit/model/Gate.js";
import { BLOCH_SPHERE_RENDERER } from "./blochSphereRenderer.js";

const BlochSphereDisplay = new GateBuilder().
    setSerializedIdAndSymbol("Bloch").
    setTitle("Bloch Sphere Display").
    setBlurb("Shows a wire's local state as a point on the Bloch Sphere.\nUse controls to see conditional states.").
    markAsRendererNeedsSingleQubitDensityStats().
    setRenderer(BLOCH_SPHERE_RENDERER).
    promiseHasNoNetEffectOnStateVector().
    setExtraDisableReasonFinder(args => args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined).
    gate;

export { BlochSphereDisplay };
