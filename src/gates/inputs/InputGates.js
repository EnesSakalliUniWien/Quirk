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

import { fitText } from "../../draw/text/TextLayout.js";
import { rectangle } from "../../draw/shapes/ShapeView.js";

import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Typography } from "../../config/Typography.js";
import { Gate, GateBuilder } from "../../circuit/model/Gate.js";
import {
  paintBackground,
  paintResizeTab,
  paintLocationIndependentFrame,
  paintGateButton,
} from "../../draw/gate/GateFrame.js";
import { paintGateSymbol } from "../../draw/gate/GateSymbol.js";
import { reverseShaderForSize } from "../ordering/ReverseBitsGate.js";

const InputGates = {};

/**
 * @param {!GateRenderParams} args
 * @param {!string} key
 * @param {!boolean} reverse
 */
function drawInputGate(args, key, reverse) {
  paintBackground(args, CanvasTheme.surface.quiet);
  rectangle(args.painter, args.rect, {
    stroke: { color: CanvasTheme.stroke.guide, width: 1 },
  });
  paintResizeTab(args);

  const { x, y } = args.rect.center();
  fitText(args.painter, "input", {
    x,
    y: y - 2,
    align: "center",
    baseline: "bottom",
    fill: CanvasTheme.text.primary,
    font: { fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: args.rect.w - 2,
    height: args.rect.h / 2,
  });
  fitText(args.painter, key + (reverse ? "[::-1]" : ""), {
    x,
    y: y + 2,
    align: "center",
    baseline: "top",
    fill: CanvasTheme.text.primary,
    font: { fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: args.rect.w - 2,
    height: args.rect.h / 2,
  });
}

const makeInputGate = (key, reverse) =>
  Gate.buildFamily(1, 16, (span, builder) =>
    builder
      .setSerializedId((reverse ? "rev" : "") + `input${key}${span}`)
      .setSymbol((reverse ? "rev " : "") + `input ${key}`)
      .setTitle(`Input Gate [${key}]` + (reverse ? " [reversed]" : ""))
      .setBlurb(
        `Temporarily uses some qubits as input ${key}${reverse ? ", in big-endian order" : ""}.`,
      )
      .setRenderer((args) => drawInputGate(args, key, reverse))
      .promiseHasNoNetEffectOnStateVector()
      .markAsNotInterestedInControls()
      .setSetupCleanupEffectsToShaderProviders(
        reverse && span > 1 ? reverseShaderForSize(span) : undefined,
        reverse && span > 1 ? reverseShaderForSize(span) : undefined,
      )
      .setContextProvider((qubitIndex) => [
        {
          key: `Input Range ${key}`,
          val: {
            offset: qubitIndex,
            length: span,
          },
        },
      ]),
  );

const makeSetInputGate = (key) =>
  new GateBuilder()
    .setSerializedIdAndSymbol(`set${key}`)
    .setTitle(`Set Default ${key}`)
    .setBlurb(
      `Sets a default value for input ${key}, for when an inline input isn't given.`,
    )
    .setWidth(2)
    .setHeight(2)
    .promiseHasNoNetEffectOnStateVector()
    .markAsNotInterestedInControls()
    .markAsReachingOtherWires()
    .setStickyContextProvider((qubitIndex, gate) => [
      {
        key: `Input Default ${key}`,
        val: gate.param,
        sticky: true,
      },
    ])
    .setRenderer((args) => {
      paintLocationIndependentFrame(args, CanvasTheme.surface.quiet);
      paintGateSymbol(args, `${key}=${args.gate.param}`);
      paintGateButton(args);
    })
    .setParamDialog({
      title: `Enter new fallback value for input ${key}.`,
      message:
        `The fallback is used when no input gate sets ${key}.\n` +
        "It must be an integer between 0 and 65535.",
      applyText: (oldGate, text) => {
        if (text.trim() === "") {
          return { gate: oldGate };
        }
        const val = parseInt(text);
        if (!Number.isInteger(val) || val < 0 || val >= 1 << 16) {
          return { error: `'${text}' isn't an integer between 0 and 65535.` };
        }
        return { gate: oldGate.withParam(val) };
      },
    })
    .setExtraDisableReasonFinder((args) => {
      const p = args.gate.param;
      if (!Number.isInteger(p) || p < 0 || p > 1 << 16) {
        return "bad\nvalue";
      }
      return undefined;
    })
    .gate.withParam(2);

InputGates.InputAFamily = makeInputGate("A", false);
InputGates.InputBFamily = makeInputGate("B", false);
InputGates.InputRFamily = makeInputGate("R", false);
InputGates.InputRevAFamily = makeInputGate("A", true);
InputGates.InputRevBFamily = makeInputGate("B", true);
InputGates.SetA = makeSetInputGate("A");
InputGates.SetB = makeSetInputGate("B");
InputGates.SetR = makeSetInputGate("R");

InputGates.all = [
  ...InputGates.InputAFamily.all,
  ...InputGates.InputBFamily.all,
  ...InputGates.InputRFamily.all,
  ...InputGates.InputRevAFamily.all,
  ...InputGates.InputRevBFamily.all,
  InputGates.SetA,
  InputGates.SetB,
  InputGates.SetR,
];

export { InputGates };
