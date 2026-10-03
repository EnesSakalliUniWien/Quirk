import {BitmapFontManager} from 'pixi.js';
import {textStyle} from './LabelView.js';

/**
 * Bitmap fonts for text that changes as often as every frame. A canvas label rasterises its text on a
 * canvas and uploads it as a texture each time the text changes, which an animated circuit's readouts
 * do every frame; a bitmap label lays out quads from glyphs rasterised once, the cheap way to draw
 * numbers that move.
 *
 * One font stands for a family, weight and style at every size: its glyphs are rasterised large, and
 * a label scales them to the size it is drawn at. A font holds only the characters readouts are made
 * of: digits, the signs of a percentage or of a vector's length, and the few letters spelled by "Off",
 * "On" and "|r|". Text with any other character is drawn as a canvas label.
 */
export const BITMAP_CHARACTERS = "0123456789.%<>+-| rOfn";
const GLYPHS = new Set(BITMAP_CHARACTERS);

/** Glyphs are rasterised at this size, times the resolution, and a label scales them to its own. */
const GLYPH_FONT_SIZE = 16;
/** Glyphs are rasterised at this many times their size, so labels stay sharp when zoomed in. */
const GLYPH_RESOLUTION = 4;

/** @typedef {{key: !string, name: !string, version: *, uses: !int}} InstalledFont */
/** @type {!Map<!string, !InstalledFont>} */
const fonts = new Map();
/** @type {!Map<!string, !InstalledFont>} */
const fontsByName = new Map();
let installedCount = 0;
let latestVersion;

/** @returns {!boolean} Whether every character of the text has a glyph in the bitmap fonts. */
export function inBitmapFont(text) {
    for (const char of String(text)) if (!GLYPHS.has(char)) return false;
    return true;
}

/** @returns {!string} What the installed font for a font description and version is known by. */
export function bitmapFontKey(font, version) {
    return `${version}|${font.fontFamily}|${font.fontWeight}|${font.fontStyle}`;
}

/** Lets go of a font of an earlier version that no label is set in any longer. */
function discardIfStale(font) {
    if (font.uses > 0 || font.version === latestVersion) return;
    BitmapFontManager.uninstall(font.name);
    fonts.delete(font.key);
    fontsByName.delete(font.name);
}

/**
 * The name of the installed bitmap font for a font description's family, weight and style, installed
 * if this is its first use. Whoever acquires a font gives it back with releaseBitmapFont, when it is
 * set in another or destroyed.
 *
 * Fonts are installed again for each new version, when the webfont arrives and every glyph must be
 * rasterised in it. An earlier version's fonts are kept until nothing is set in them: a label that
 * has not been drawn anew since still points at their textures, and destroying those would blank it.
 * @param {!{fontFamily: (undefined|!string), fontWeight: (undefined|!string|!number), fontStyle: (undefined|!string)}} font
 * @param {*} version textLayoutVersion.
 * @returns {!string}
 */
export function acquireBitmapFont(font, version) {
    if (version !== latestVersion) {
        latestVersion = version;
        for (const earlier of [...fonts.values()]) discardIfStale(earlier);
    }
    const key = bitmapFontKey(font, version);
    let installed = fonts.get(key);
    if (installed === undefined) {
        const name = `quirk-bitmap-${installedCount++}`;
        BitmapFontManager.install({
            name,
            style: textStyle({fontFamily: font.fontFamily, fontWeight: font.fontWeight, fontStyle: font.fontStyle,
                fontSize: GLYPH_FONT_SIZE, fill: 0xffffff}),
            chars: BITMAP_CHARACTERS,
            resolution: GLYPH_RESOLUTION,
            padding: 2,
        });
        installed = {key, name, version, uses: 0};
        fonts.set(key, installed);
        fontsByName.set(name, installed);
    }
    installed.uses++;
    return installed.name;
}

/** @param {!string} name A name acquireBitmapFont returned, no longer used by whoever acquired it. */
export function releaseBitmapFont(name) {
    const installed = fontsByName.get(name);
    if (installed === undefined) return;
    installed.uses--;
    discardIfStale(installed);
}
