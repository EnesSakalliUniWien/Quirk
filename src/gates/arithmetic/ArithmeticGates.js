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

import { Gate } from "../../circuit/model/Gate.js";
import {
  ketArgs,
  ketShaderPermute,
  ketInputGateShaderCode,
} from "../../engine/simulation/gpu/KetShaderUtil.js";
import { WglArg } from "../../engine/webgl/shader/WglArg.js";

const ArithmeticGates = {};

const ADDITION_SHADER = ketShaderPermute(
  `
        uniform float factor;
        ${ketInputGateShaderCode("A")}
    `,
  `
        float d = read_input_A();
        d *= factor;
        d = mod(d, span);
        return mod(out_id + span - d, span);`,
);

ArithmeticGates.PlusAFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setSerializedId("+=A" + span)
    .setSymbol("+A")
    .setTitle("Addition Gate [input A]")
    .setBlurb("Adds input A into the qubits covered by this gate.")
    .setRequiredContextKeys("Input Range A")
    .setActualEffectToShaderProvider((ctx) =>
      ADDITION_SHADER.withArgs(
        ...ketArgs(ctx, span, ["A"]),
        WglArg.float("factor", +1),
      ),
    )
    .setKnownEffectToParametrizedPermutation(
      (v, a) => (v + a) & ((1 << span) - 1),
    ),
);

ArithmeticGates.MinusAFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setAlternateFromFamily(ArithmeticGates.PlusAFamily)
    .setSerializedId("-=A" + span)
    .setSymbol("−A")
    .setTitle("Subtraction Gate [input A]")
    .setBlurb("Subtracts input A out of the qubits covered by this gate.")
    .setRequiredContextKeys("Input Range A")
    .setActualEffectToShaderProvider((ctx) =>
      ADDITION_SHADER.withArgs(
        ...ketArgs(ctx, span, ["A"]),
        WglArg.float("factor", -1),
      ),
    )
    .setKnownEffectToParametrizedPermutation(
      (v, a) => (v - a) & ((1 << span) - 1),
    ),
);

ArithmeticGates.all = [
  ...ArithmeticGates.PlusAFamily.all,
  ...ArithmeticGates.MinusAFamily.all,
];

export { ArithmeticGates };
