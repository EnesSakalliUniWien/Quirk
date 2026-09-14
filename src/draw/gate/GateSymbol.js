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

import { fitText, measureText } from "../text/TextLayout.js";
import { gateStyle } from "../../config/CanvasTheme.js";
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
 * The sizes a gate symbol is allowed to take. fitText shrinks text to whatever fits, with no
 * floor, which let a long symbol like Rz(f(t)) render at a few pixels beside a Z at sixteen. The
 * symbol steps down this ramp instead, and wraps once it reaches the bottom.
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

/**
 * @param {!GateRenderParams} args
 * @param {undefined|!string=undefined} symbolOverride
 * @param {!boolean=} allowExponent
 */
function paintGateSymbol(
  args,
  symbolOverride = undefined,
  allowExponent = true,
) {
  const painter = args.painter;
  const ink = gateStyle(args.gate).text;
  const rect = args.rect.paddedBy(-2);
  if (symbolOverride === undefined) {
    symbolOverride = args.gate.symbol;
  }
  const { symbol, offsetY } = _paintSymbolHandleLines(
    painter,
    symbolOverride,
    rect,
    ink,
  );

  const splitIndex = allowExponent ? symbol.indexOf("^") : -1;
  const parts =
    splitIndex === -1
      ? [symbol]
      : [symbol.slice(0, Math.max(0, splitIndex)), symbol.slice(splitIndex + 1)];
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    const { font, lines: symbolLines } = fitGateSymbol(symbol, rect.w);
    const lineHeight = rect.h / symbolLines.length;
    for (let i = 0; i < symbolLines.length; i++) {
      fitText(painter, symbolLines[i], {
        x: rect.x + rect.w / 2,
        y:
          rect.y +
          rect.h / 2 +
          offsetY +
          (i - (symbolLines.length - 1) / 2) * lineHeight,
        align: "center",
        baseline: "middle",
        fill: ink,
        font,
        width: rect.w,
        height: lineHeight,
      });
    }
    return;
  }

  let [baseText, expText] = parts;
  const lines = baseText.split("\n");
  baseText = lines[0];

  // The same ramp as the plain branch, so a symbol with an exponent and one without come out at
  // the same size rather than as two typographic systems side by side.
  const { font: symbolFont } = fitGateSymbol(baseText + expText, rect.w);

  const baseWidth = measureText(baseText, symbolFont).width;
  const expWidth = measureText(expText, symbolFont).width;
  const scaleDown =
    Math.min(rect.w, baseWidth + expWidth) / (baseWidth + expWidth);
  const divider = rect.w / 2 + ((baseWidth - expWidth) * scaleDown) / 2;
  fitText(painter, baseText, {
    x: rect.x + divider,
    y: rect.y + rect.h / 2 + offsetY,
    align: "right",
    baseline: "hanging",
    fill: ink,
    font: symbolFont,
    width: divider,
    height: rect.h,
  });
  fitText(painter, expText, {
    x: rect.x + divider,
    y: rect.y + rect.h / 2 + offsetY,
    align: "left",
    baseline: "alphabetic",
    fill: ink,
    font: symbolFont,
    width: rect.w - divider,
    height: rect.h,
  });
}

/**
 * Draws every line of the symbol after the first, and says how far up the first line moves to
 * make room.
 * @param {!DisplayView} painter
 * @param {!string} symbol
 * @param {!Rect} rect
 * @param {!string} ink
 * @returns {!{symbol: !string, offsetY: !int}} The symbol without any extra lines.
 * @private
 */
function _paintSymbolHandleLines(painter, symbol, rect, ink) {
  const lines = symbol.split("\n");

  for (let i = 1; i < lines.length; i++) {
    fitText(painter, lines[i], {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2 + 9 * i,
      align: "center",
      baseline: "hanging",
      fill: ink,
      font: GATE_SYMBOL_FONT,
      width: rect.w,
      height: 16,
    });
  }

  return { symbol: lines[0], offsetY: lines.length > 1 ? -5 : 0 };
}

export {
  GATE_SYMBOL_FONT,
  splitGateSymbol,
  fitGateSymbol,
  paintGateSymbol,
};
