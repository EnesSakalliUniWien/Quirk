import {extend} from '@pixi/react';
import { Text, TextStyle } from "pixi.js";
import {BoundedCache} from './BoundedCache.js';

/**
 * A TextStyle for a font description. A field left undefined keeps Pixi's default: spread as
 * undefined it would replace the default, the canvas font string would be invalid, and the browser
 * would keep whichever font was set last, so a regular line could come out in a title's weight.
 * @param {!Object} font
 * @returns {!TextStyle}
 */
export function textStyle(font) {
  const defined = { padding: 2 };
  for (const [key, value] of Object.entries(font)) if (value !== undefined) defined[key] = value;
  return new TextStyle(defined);
}

/** How many styles are kept. A drawing uses a few dozen: a font, size and colour apiece. */
export const SHARED_STYLE_LIMIT = 256;
/** @type {!BoundedCache<!string, !TextStyle>} */
const sharedStyles = new BoundedCache(SHARED_STYLE_LIMIT);
let sharedStylesVersion;

/** @returns {!string} A value as a part of a key: a colour is usually a string, but may be an object. */
const part = value => typeof value === "object" ? JSON.stringify(value) : String(value);

/**
 * The one TextStyle for an appearance. Pixi keys a text's texture by its text, its resolution and its
 * style's identity, so labels that each made a style of their own never shared a texture, however
 * alike; labels set in the same style and text share one, which Pixi reference-counts. Styles are
 * forgotten when the version moves on, which is when the webfont arrives and every texture must be
 * rasterised again; a label keeps the style it holds until it asks for another.
 * @param {!Object} font
 * @param {*} fill
 * @param {*} stroke
 * @param {*} version textLayoutVersion.
 * @returns {!TextStyle} Not to be changed: other labels hold it too.
 */
export function sharedTextStyle(font, fill, stroke, version) {
  if (version !== sharedStylesVersion) {
    sharedStyles.clear();
    sharedStylesVersion = version;
  }
  // Fields left undefined are left out of the key as textStyle leaves them out of the style.
  let key = `${part(fill)}|${part(stroke)}`;
  for (const name in font) if (font[name] !== undefined) key += `|${name}:${part(font[name])}`;
  const style = sharedStyles.get(key);
  return style !== undefined ? style : sharedStyles.set(key, textStyle({ ...font, fill, stroke }));
}

/**
 * Each label owns a native Text and touches it only where its inputs changed. The scene describes
 * every label every frame; Pixi's resolution setter marks the text for re-validation even when the
 * value is the same, which made every frame rebuild the whole render group's instructions.
 */
export class LabelView extends Text {
    constructor() { super(); }
  set label([text, font, fill, resolution, stroke, version]) {
    const style = sharedTextStyle(font, fill, stroke, version);
    if (this.style !== style) {
      this.style = style;
      this.appearance = [version, font, fill, stroke];
    }
    this.text = String(text);
    if (this.resolution !== resolution) this.resolution = resolution;
    if (!this.roundPixels) this.roundPixels = true;
  }
  /** @returns {!string} What the label's style was made from, as JSON: [version, font, fill, stroke]. */
  get appearanceKey() {
    return JSON.stringify(this.appearance);
  }
}

extend({LabelView});
