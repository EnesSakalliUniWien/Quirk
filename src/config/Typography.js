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

import {readStyleToken} from "./StyleTokens.js"

/**
 * Fonts the canvas draws text with, read from the theme in src/styles/globals.css so the canvas
 * and the DOM use one set of stacks.
 */
class Typography {}

Typography.DEFAULT_FONT_SIZE = 12;
Typography.DEFAULT_FONT_FAMILY = readStyleToken('--font-sans', "'Geist Variable', sans-serif");
Typography.MONO_FONT_FAMILY = readStyleToken(
    '--font-mono', 'ui-monospace, "SFMono-Regular", Consolas, monospace');
// Gate symbols are the tile's content, not a label, at the same medium weight the shadcn Button
// uses, so both control surfaces read alike.
Typography.GATE_SYMBOL_FONT_SIZE = 16;
Typography.GATE_SYMBOL_FONT_WEIGHT = 500;
// The smallest a gate symbol is allowed to get. Past this a symbol stops being readable, so long
// ones wrap to two lines rather than shrinking further.
Typography.GATE_SYMBOL_MIN_FONT_SIZE = 11;

export {Typography}
