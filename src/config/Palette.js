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
 * Every colour the canvas paints with, read from the --canvas-* custom properties in
 * src/styles/globals.css. The stylesheet is the only place a colour is written down, so the canvas
 * and the DOM cannot drift apart.
 */
class Palette {}

// Gate background colors.
Palette.GATE_FILL_COLOR = readStyleToken('--canvas-gate-fill', '#18181B');
Palette.HIGHLIGHTED_GATE_FILL_COLOR = readStyleToken('--canvas-gate-fill-highlighted', '#92400E');
Palette.TIME_DEPENDENT_HIGHLIGHT_COLOR = readStyleToken('--canvas-time-dependent-highlight', '#3A3A12');
// Mixed-state displays are green.
Palette.DISPLAY_GATE_BACK_COLOR = readStyleToken('--canvas-display-back', '#0F1F14');
Palette.DISPLAY_GATE_FORE_COLOR = readStyleToken('--canvas-display-fore', '#22C55E');
// Changes are yellow.
Palette.OPERATION_BACK_COLOR = readStyleToken('--canvas-operation-back', '#2E2A12');
Palette.OPERATION_FORE_COLOR = readStyleToken('--canvas-operation-fore', '#EAB308');
// Pure-state displays are cyan.
Palette.SUPERPOSITION_BACK_COLOR = readStyleToken('--canvas-superposition-back', '#0E1B1E');
Palette.SUPERPOSITION_MID_COLOR = readStyleToken('--canvas-superposition-mid', '#0E7490');
Palette.SUPERPOSITION_FORE_COLOR = readStyleToken('--canvas-superposition-fore', '#22D3EE');
// Shared canvas ink/surface tones.
Palette.INK_COLOR = readStyleToken('--canvas-ink', '#E4E4E7');
Palette.SURFACE_COLOR = readStyleToken('--canvas-surface', '#18181B');
Palette.ERROR_COLOR = readStyleToken('--canvas-error', '#F87171');
Palette.GRID_LINE_COLOR = readStyleToken('--canvas-grid-line', '#3F3F46');
Palette.MID_LINE_COLOR = readStyleToken('--canvas-mid-line', '#71717A');
Palette.MUTED_TEXT_COLOR = readStyleToken('--canvas-muted-text', '#A1A1AA');
Palette.FAINT_LINE_COLOR = readStyleToken('--canvas-faint-line', '#52525B');
Palette.HIGHLIGHT_STROKE_COLOR = readStyleToken('--canvas-highlight-stroke', '#F59E0B');
Palette.HIGHLIGHT_FILL_COLOR = readStyleToken('--canvas-highlight-fill', '#EAB308');
// The band behind the column the playhead is about to execute, at low alpha so the gates and wires
// under it stay legible.
Palette.PLAYHEAD_BAND_COLOR = readStyleToken('--canvas-playhead-band', 'rgba(245, 158, 11, 0.27)');
Palette.BACKGROUND_COLOR = readStyleToken('--canvas-background', '#0A0A0A');
Palette.BACKGROUND_COLOR_CIRCUIT = Palette.BACKGROUND_COLOR;
// Draw constants.
Palette.DEFAULT_FILL_COLOR = Palette.GATE_FILL_COLOR;
Palette.DEFAULT_STROKE_COLOR = Palette.INK_COLOR;
Palette.DEFAULT_TEXT_COLOR = readStyleToken('--canvas-default-text', '#FAFAFA');
// Gates that name or route values rather than transform them share one quiet fill.
Palette.QUIET_GATE_FILL_COLOR = readStyleToken('--canvas-quiet-gate-fill', '#232327');
Palette.BRIGHT_LINE_COLOR = readStyleToken('--canvas-bright-line', '#D4D4D8');
Palette.DISPLAY_DIM_COLOR = readStyleToken('--canvas-display-dim', '#15803D');
// The gate name at the top of a tooltip.
Palette.TOOLTIP_TITLE_COLOR = readStyleToken('--canvas-tooltip-title', '#60A5FA');
Palette.TOOLTIP_BACK_COLOR = readStyleToken('--canvas-tooltip-back', '#101812');
// The column or row a held gate would land on.
Palette.DROP_TARGET_FILL_COLOR = readStyleToken('--canvas-drop-target-fill', 'rgba(255, 196, 112, 0.7)');

export {Palette}
