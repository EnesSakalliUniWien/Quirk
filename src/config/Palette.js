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
 * Every colour the canvas paints with. Kept consistent with the CSS variables in
 * html/quirk.template.html.
 */
class Palette {}

// Gate background colors.
Palette.GATE_FILL_COLOR = '#18181B';
Palette.HIGHLIGHTED_GATE_FILL_COLOR = '#92400E';
Palette.TIME_DEPENDENT_HIGHLIGHT_COLOR = '#3A3A12';
// Mixed-state displays are green.
Palette.DISPLAY_GATE_IN_TOOLBOX_FILL_COLOR = '#16A34A';
Palette.DISPLAY_GATE_BACK_COLOR = '#0F1F14';
Palette.DISPLAY_GATE_FORE_COLOR = '#22C55E';
// Changes are yellow.
Palette.OPERATION_BACK_COLOR = '#2E2A12';
Palette.OPERATION_FORE_COLOR = '#EAB308';
// Pure-state displays are cyan.
Palette.SUPERPOSITION_BACK_COLOR = '#0E1B1E';
Palette.SUPERPOSITION_MID_COLOR = '#0E7490';
Palette.SUPERPOSITION_FORE_COLOR = '#22D3EE';
// Shared canvas ink/surface tones.
Palette.INK_COLOR = '#E4E4E7';              // Primary strokes and text.
Palette.SURFACE_COLOR = '#18181B';          // Panel and widget fills.
Palette.ERROR_COLOR = '#F87171';            // Error text and marks.
Palette.GRID_LINE_COLOR = '#3F3F46';        // Faint grid lines.
Palette.MID_LINE_COLOR = '#71717A';         // Secondary strokes.
Palette.MUTED_TEXT_COLOR = '#A1A1AA';       // Secondary text.
Palette.FAINT_LINE_COLOR = '#52525B';       // Subtle strokes.
Palette.HIGHLIGHT_STROKE_COLOR = '#F59E0B'; // Focus/highlight strokes.
Palette.HIGHLIGHT_FILL_COLOR = '#EAB308';   // Attention fills.
Palette.BACKGROUND_COLOR = '#0A0A0A';
Palette.BACKGROUND_COLOR_CIRCUIT = '#0A0A0A';
// Toolbox layout.
// Spacing follows Carbon's spacing scale: 2, 4, 8, 12, 16, 24, 32, 40, 48.
Palette.BACKGROUND_COLOR_TOOLBOX = '#18181B';
Palette.TOOLBOX_GATE_FILL_COLOR = '#27272A';
// Carbon treats a component boundary as non-text contrast: at least 3:1 against both
// the fill it encloses and the surface behind it (WCAG 1.4.11).
Palette.TOOLBOX_GATE_BORDER_COLOR = '#71717A';
Palette.TOOLBOX_GATE_HOVER_BORDER_COLOR = '#A1A1AA';
Palette.TOOLBOX_GATE_HOVER_FILL_COLOR = '#3F3F46';
Palette.TOOLBOX_LABEL_COLOR = '#A1A1AA';
// Draw constants.
Palette.DEFAULT_FILL_COLOR = '#18181B';
Palette.DEFAULT_STROKE_COLOR = '#E4E4E7';
Palette.DEFAULT_TEXT_COLOR = '#FAFAFA';

export {Palette}
