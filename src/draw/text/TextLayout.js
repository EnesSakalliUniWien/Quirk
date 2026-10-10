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

import { textStyle } from "./LabelView.js";
import { BoundedCache } from "./BoundedCache.js";
import { canSetInBitmap } from "./BitmapLabelView.js";
import { CanvasTextMetrics } from "pixi.js";
import { Typography } from "../../config/Typography.js";
import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Rect } from "../../geometry/Rect.js";
import { Point } from "../../geometry/Point.js";

const DEFAULT_FONT = {
  fontSize: Typography.DEFAULT_FONT_SIZE,
  fontFamily: Typography.DEFAULT_FONT_FAMILY,
};
export let textLayoutVersion = 0;
/**
 * One TextStyle per font. Pixi keys its measurement cache by the style's identity, so a fresh style
 * per call never hit it: every frame re-measured every label from scratch.
 * @type {!BoundedCache<!string, !TextStyle>}
 */
const measuringStyles = new BoundedCache(256);
/** How many measurements are kept. */
export const MEASUREMENT_LIMIT = 4096;
/**
 * What each string measures in each font. A frame measures every label it draws, some of them
 * several times over, and a deep circuit draws more than the thousand strings Pixi's own cache
 * keeps. The metrics are shared by every caller: none may change them.
 * @type {!BoundedCache<!string, !CanvasTextMetrics>}
 */
const measurements = new BoundedCache(MEASUREMENT_LIMIT);
export function invalidateTextLayout() {
  CanvasTextMetrics.clearMetrics();
  measuringStyles.clear();
  measurements.clear();
  textLayoutVersion++;
}

/** A font's key: the fields a TextStyle measures by, joined, which is cheaper than serialising it. */
const fontKey = (font) =>
  `${font.fontSize}|${font.fontFamily}|${font.fontWeight}|${font.fontStyle}|${font.wordWrap}|` +
  `${font.wordWrapWidth}|${font.breakWords}|${font.lineHeight}|${font.align}|${font.letterSpacing}`;

function measuringStyle(key, font) {
  const style = measuringStyles.get(key);
  return style !== undefined
    ? style
    : measuringStyles.set(key, textStyle(font));
}

/**
 * @param {*} text
 * @param {!Object=} font
 * @returns {!CanvasTextMetrics} What the text measures set in the font. Shared: not to be changed.
 */
export function measureText(text, font = DEFAULT_FONT) {
  const string = String(text);
  const fontId = fontKey(font);
  const key = `${fontId}\u0000${string}`;
  const known = measurements.get(key);
  return known !== undefined
    ? known
    : measurements.set(
        key,
        CanvasTextMetrics.measureText(string, measuringStyle(fontId, font)),
      );
}

/**
 * Draws a line of text as a label view.
 * @param {!DisplayView} view
 * @param {*} text
 * @param {!{changing: (undefined|!boolean)}} options `changing`: the text changes as often as every
 *     frame, an animated circuit's readout. A canvas label rasterises its text again and uploads a
 *     new texture each time it changes; a label in a bitmap font only lays out glyphs rasterised
 *     once. So where every character of the text has a glyph there, and it asks for nothing a
 *     bitmap font cannot do (a stroke, wrapping), it is set in one: same family, size, weight,
 *     colour, alignment and baseline.
 */
export function drawText(
  view,
  text,
  {
    x = 0,
    y = 0,
    fill = CanvasTheme.text.primary,
    font = DEFAULT_FONT,
    align = "left",
    baseline = "alphabetic",
    scale = 1,
    stroke,
    changing = false,
  } = {},
) {
  const { ascent, descent } = measureText(text, font).fontProperties;
  const anchor = [
    align === "center" ? 0.5 : align === "right" || align === "end" ? 1 : 0,
    baseline === "middle"
      ? 0.5
      : baseline === "bottom"
        ? 1
        : baseline === "alphabetic"
          ? ascent / (ascent + descent)
          : 0,
  ];
  return view.add(
    changing && canSetInBitmap(text, font, stroke)
      ? "pixiBitmapLabelView"
      : "pixiLabelView",
    {
      label: [text, font, fill, view.pixelRatio, stroke, textLayoutVersion],
      anchor: { x: anchor[0], y: anchor[1] },
      x,
      y,
      scale,
    },
  );
}

/** A fitted label's size moves in steps this fine, rounding down, so it never ends a hair over its box. */
const FIT_STEP = 0.5;

/**
 * The application's single-line fitting convention, which also sizes the opaque plate behind a
 * label. A line is as tall as the font's own ascent and descent say. A label too big for its box is
 * set in a smaller font rather than drawn scaled down, so it is rasterised at full resolution: a
 * shrunken texture is blurred, and a guessed line height had shrunk labels that already fitted.
 */
export function fitText(
  view,
  text,
  {
    x = 0,
    y = 0,
    align = "left",
    baseline = "alphabetic",
    fill = CanvasTheme.text.primary,
    font = DEFAULT_FONT,
    width = Infinity,
    height = Infinity,
    beforeDraw,
    stroke,
    changing,
  } = {},
) {
  const metrics = measureText(text, font);
  const lineHeight =
    metrics.fontProperties.ascent + metrics.fontProperties.descent;
  const scale = Math.min(
    width / (metrics.width || 1),
    height / (lineHeight || 1),
    1,
  );
  const fitted =
    scale >= 1
      ? font
      : {
          ...font,
          fontSize: Math.max(
            FIT_STEP,
            Math.floor((font.fontSize * scale) / FIT_STEP) * FIT_STEP,
          ),
        };
  const size = fitted === font ? metrics : measureText(text, fitted);
  beforeDraw?.(
    size.width,
    size.fontProperties.ascent + size.fontProperties.descent,
  );
  return drawText(view, text, {
    x,
    y,
    fill,
    font: fitted,
    align,
    baseline,
    stroke,
    changing,
  });
}

function fit(text, area, maxFontSize, fontFamily, wrap) {
  for (let fontSize = maxFontSize; ; fontSize--) {
    // A paragraph wraps between words, and shrinks before it would break one; only a word too
    // long for the area at the smallest size is broken.
    const font = {
      fontSize,
      fontFamily,
      wordWrap: wrap,
      wordWrapWidth: area.w,
      breakWords: fontSize <= 4,
    };
    const metrics = measureText(text, font);
    const { ascent, descent } = metrics.fontProperties;
    const height = wrap
      ? (ascent + descent) * metrics.lines.length
      : ascent + descent;
    if ((metrics.width <= area.w && height <= area.h) || fontSize <= 4)
      return { font, metrics, height };
  }
}

function layoutParagraph(text, area, alignment, maxFontSize, fontFamily) {
  const { font, metrics, height } = fit(
    text,
    area,
    maxFontSize,
    fontFamily,
    true,
  );
  const x = area.x + (area.w - metrics.width) * alignment.x;
  const y = area.y + (area.h - height) * alignment.y;
  return { font, metrics, rect: new Rect(x, y, metrics.width, height) };
}

/** Where fitParagraph would set `text` in `area`, with the same options, without drawing it. */
export function paragraphBounds(
  text,
  area,
  {
    alignment = new Point(0, 0),
    maxFontSize = Typography.DEFAULT_FONT_SIZE,
    fontFamily = Typography.DEFAULT_FONT_FAMILY,
  } = {},
) {
  return layoutParagraph(text, area, alignment, maxFontSize, fontFamily).rect;
}

export function fitParagraph(
  view,
  text,
  area,
  {
    alignment = new Point(0, 0),
    fill = CanvasTheme.text.default,
    maxFontSize = Typography.DEFAULT_FONT_SIZE,
    fontFamily = Typography.DEFAULT_FONT_FAMILY,
  } = {},
) {
  const { font, metrics, rect } = layoutParagraph(
    text,
    area,
    alignment,
    maxFontSize,
    fontFamily,
  );
  const { x, y } = rect;
  const lineHeight =
    metrics.fontProperties.ascent + metrics.fontProperties.descent;
  drawText(view, text, {
    x,
    y,
    fill,
    font: {
      ...font,
      lineHeight,
      align:
        alignment.x === 1 ? "right" : alignment.x === 0.5 ? "center" : "left",
    },
    align: "left",
    baseline: "top",
  });
  return rect;
}

export function fitLine(
  view,
  text,
  area,
  {
    horizontal = 0,
    fill = CanvasTheme.text.default,
    maxFontSize = Typography.DEFAULT_FONT_SIZE,
    fontFamily = Typography.DEFAULT_FONT_FAMILY,
    vertical,
  } = {},
) {
  const { font, metrics, height } = fit(
    text,
    area,
    maxFontSize,
    fontFamily,
    false,
  );
  const x = area.x + (area.w - metrics.width) * horizontal;
  const y =
    area.y +
    (area.h - height) * (vertical ?? metrics.fontProperties.ascent / height);
  drawText(view, text, {
    x,
    y: y + metrics.fontProperties.ascent,
    fill,
    font,
  });
  return new Rect(x, y, metrics.width, height);
}
