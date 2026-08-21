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
 * Sizes and spacings of the drawn circuit and toolbox. Spacing follows Carbon's scale.
 */
class Layout {}

/** Half of the span of a drawn gate, width-wise and height-wise.
* @type {!number} */
Layout.GATE_RADIUS = 20;
Layout.WIRE_SPACING = 50;
// Carbon $spacing-xl, and the shared control height.
Layout.TOOLBOX_GATE_SIZE = 32;
Layout.TOOLBOX_GATE_SPACING = 4;    // Carbon $spacing-2xs.
Layout.TOOLBOX_GROUP_SPACING = 16;  // Carbon $spacing-md.
Layout.TOOLBOX_GATE_SPAN = Layout.TOOLBOX_GATE_SIZE + Layout.TOOLBOX_GATE_SPACING;
Layout.TOOLBOX_GROUP_SPAN = Layout.TOOLBOX_GATE_SPAN * 2 + Layout.TOOLBOX_GROUP_SPACING;
Layout.TOOLBOX_MARGIN_X = 32;       // Carbon $spacing-xl.
Layout.TOOLBOX_MARGIN_Y = 16;       // Carbon $spacing-md.
// Padding above the gates when the group labels sit below them instead. Carbon $spacing-2xs.
Layout.TOOLBOX_GATE_PADDING_Y = 4;
// Vertical gap between the bottom toolbox and the circuit. Carbon $spacing-lg.
Layout.TOOLBOX_CIRCUIT_MARGIN = 24;
// Matches the shadcn button base, which is rounded-lg (--radius-lg = 0.625rem).
Layout.TOOLBOX_GATE_CORNER_RADIUS = 10;
// One control height across the app: the toolbox tile and the shadcn Button are both 32px.
Layout.CONTROL_HEIGHT = 32;
/**
 * Some tooltips end up looking terrible without available vertical space.
 * (e.g. the error box might not fit, or the gate tips might get squashed)
 * @type {number}
 */
Layout.MINIMUM_CANVAS_HEIGHT = 400;
Layout.REDRAW_COOLDOWN_MILLIS = 10; // Milliseconds. Rate-limit on redraws. Long draws pad this limit.
Layout.DEFAULT_STROKE_THICKNESS = 1;

export {Layout}
