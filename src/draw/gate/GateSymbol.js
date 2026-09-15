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

import { measureText } from "../text/TextLayout.js";
import { gateStyle } from "../../config/CanvasTheme.js";
import {paintGateLabel} from "./GateLabel.js";
import { Typography } from "../../config/Typography.js";

/** @typedef {import('../scene/DisplayView.js').DisplayView} DisplayView */
/** @typedef {import('./GateRenderParams.js').GateRenderParams} GateRenderParams */

/**
 * @param {!number} size
 * @returns {!Object}
 */
function gateSymbolFont(size) {
  return {
    fontWeight: Typography.GATE_SYMBOL_FONT_WEIGHT,
    fontSize: size,
    fontFamily: Typography.DEFAULT_FONT_FAMILY,
  };
}

const GATE_SYMBOL_FONT = gateSymbolFont(Typography.GATE_SYMBOL_FONT_SIZE);

/**
 * Preferred gate symbol sizes. Try wrapping at the smallest size before Pixi Layout
 * scales an overlong unbreakable label to keep it inside the gate.
 * @type {!Array.<!number>}
 */
const GATE_SYMBOL_FONT_SIZES = [
  Typography.GATE_SYMBOL_FONT_SIZE,
  13,
  Typography.GATE_SYMBOL_MIN_FONT_SIZE,
];

/**
 * Splits a symbol across two lines at the break nearest its middle, so neither line is a stub.
 * @param {!string} text
 * @returns {!Array.<!string>}
 */
function splitGateSymbol(text) {
  // A name and its argument, which is the seam in Rx(f(t)) and its kin.
  let best = text.indexOf("(");
  if (best < 1) {
    // Otherwise the break nearest the middle, so neither line is a stub.
    const middle = text.length / 2;
    best = -1;
    for (let i = 1; i < text.length; i++) {
      const isBreak = text[i - 1] === "/" || text[i - 1] === " ";
      if (
        isBreak &&
        (best === -1 || Math.abs(i - middle) < Math.abs(best - middle))
      ) {
        best = i;
      }
    }
  }
  return best === -1
    ? [text]
    : [text.slice(0, best).trim(), text.slice(best).trim()];
}

/**
 * The largest step of the ramp the text fits on, and the lines to draw it as.
 * @param {!string} text
 * @param {!number} maxWidth
 * @returns {!{font: !Object, lines: !Array.<!string>}}
 */
function fitGateSymbol(text, maxWidth) {
  for (const size of GATE_SYMBOL_FONT_SIZES) {
    const font = gateSymbolFont(size);
    if (measureText(text, font).width <= maxWidth) {
      return { font, lines: [text] };
    }
  }
  return {
    font: gateSymbolFont(Typography.GATE_SYMBOL_MIN_FONT_SIZE),
    lines: splitGateSymbol(text),
  };
}

/** Draw a symbol without changing the stored gate notation or its circuit footprint. */
function paintGateSymbol(args, symbolOverride = args.gate.symbol, allowExponent = true) {
  const rect = args.rect.paddedBy(-2);
  const rows = symbolOverride.split("\n").flatMap((line, index) => {
    // Only the first explicit line uses exponent notation, matching existing gate symbols.
    const splitIndex = allowExponent && index === 0 ? line.indexOf("^") : -1;
    if (splitIndex > 0 && splitIndex < line.length - 1) {
      const base = line.slice(0, splitIndex);
      const exponent = line.slice(splitIndex + 1);
      const {font} = fitGateSymbol(base + exponent, rect.w);
      return [[{text: base, font}, {text: exponent, font, exponent: true}]];
    }
    const {font, lines} = fitGateSymbol(line, rect.w);
    return lines.map(text => [{text, font}]);
  });
  paintGateLabel(args.painter, rect, rows, gateStyle(args.gate).text);
}

export {GATE_SYMBOL_FONT, splitGateSymbol, fitGateSymbol, paintGateSymbol};
