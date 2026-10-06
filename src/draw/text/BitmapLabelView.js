import { extend } from "@pixi/react";
import { BitmapText, Color } from "pixi.js";
import {
  acquireBitmapFont,
  bitmapFontKey,
  inBitmapFont,
  releaseBitmapFont,
} from "./BitmapFonts.js";

/**
 * @param {*} text
 * @param {!Object} font
 * @param {*} stroke
 * @returns {!boolean} Whether a bitmap label can draw the text as a canvas label would: every
 *     character has a glyph, on one line, in one weight and style, with no stroke around it.
 */
export function canSetInBitmap(text, font, stroke) {
  return (
    stroke === undefined &&
    !font.wordWrap &&
    font.letterSpacing === undefined &&
    font.lineHeight === undefined &&
    inBitmapFont(text)
  );
}

/**
 * A label in a bitmap font, for numbers that change every frame (see drawText). It is described
 * with the same inputs as a LabelView, and touched only where they changed. The glyphs are white and
 * the label's tint is its colour.
 */
export class BitmapLabelView extends BitmapText {
  constructor() {
    super();
  }
  set label([text, font, fill, , , version]) {
    const face = bitmapFontKey(font, version);
    if (this.face !== face) {
      if (this.bitmapFont !== undefined) releaseBitmapFont(this.bitmapFont);
      this.bitmapFont = acquireBitmapFont(font, version);
      this.face = face;
      this.style.fontFamily = this.bitmapFont;
    }
    if (this.style.fontSize !== font.fontSize)
      this.style.fontSize = font.fontSize;
    this.text = String(text);
    if (this.ink !== fill) {
      const colour = new Color(fill);
      this.tint = colour.toNumber();
      this.alpha = colour.alpha;
      this.ink = fill;
    }
    if (!this.roundPixels) this.roundPixels = true;
  }
  destroy(options) {
    if (this.bitmapFont !== undefined) releaseBitmapFont(this.bitmapFont);
    this.bitmapFont = undefined;
    super.destroy(options);
  }
}

extend({ BitmapLabelView });
