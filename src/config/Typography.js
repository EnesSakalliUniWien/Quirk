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

/**
 * Fonts the canvas draws text with. Kept consistent with the HTML shell.
 */
class Typography {}

Typography.DEFAULT_FONT_SIZE = 12;
// Keep these font stacks in sync with --font-ui and --font-mono in html/quirk.template.html.
Typography.DEFAULT_FONT_FAMILY = '"Geist Variable", system-ui, sans-serif';
Typography.MONO_FONT_FAMILY = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
// Carbon's productive type scale, for dense UI.
Typography.TOOLBOX_LABEL_FONT_SIZE = 12;  // Carbon label-01.
Typography.TOOLBOX_NAME_FONT_SIZE = 16;   // Carbon heading-compact-02.
// Gate symbols are the tile's content, not a label: Carbon body-compact-02 at the
// same medium weight the shadcn Button uses, so both control surfaces read alike.
Typography.GATE_SYMBOL_FONT_SIZE = 16;
Typography.GATE_SYMBOL_FONT_WEIGHT = 500;

export {Typography}
