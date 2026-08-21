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
 * Configuration parameters for quantum circuit visualizer.
 */
class Config {}

Config.EMPTY_CIRCUIT_TITLE = 'Shadow-Quant: Quantum Circuit Simulator';

// Each qubit (when actually used) doubles the cost of simulating each gate applied to the circuit.
// Also each qubit tends to increase the amount of accuracy required.
// I see obvious errors when I set this to 20, and things get pretty laggy past 16.
// Beware setting it too high.
Config.MAX_WIRE_COUNT = 16;
Config.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD = 14;

Config.MIN_WIRE_COUNT = 2;
Config.MIN_COL_COUNT = 5;
Config.URL_CIRCUIT_PARAM_KEY = 'circuit';

// The canvas paints a real dark theme (no CSS invert filter).
// Keep these values visually consistent with the CSS variables in html/quirk.template.html.

// Gate background colors.
Config.GATE_FILL_COLOR = '#18181B';
Config.HIGHLIGHTED_GATE_FILL_COLOR = '#92400E';
Config.TIME_DEPENDENT_HIGHLIGHT_COLOR = '#3A3A12';

// Mixed-state displays are green.
Config.DISPLAY_GATE_IN_TOOLBOX_FILL_COLOR = '#16A34A';
Config.DISPLAY_GATE_BACK_COLOR = '#0F1F14';
Config.DISPLAY_GATE_FORE_COLOR = '#22C55E';

// Changes are yellow.
Config.OPERATION_BACK_COLOR = '#2E2A12';
Config.OPERATION_FORE_COLOR = '#EAB308';

// Pure-state displays are cyan.
Config.SUPERPOSITION_BACK_COLOR = '#0E1B1E';
Config.SUPERPOSITION_MID_COLOR = '#0E7490';
Config.SUPERPOSITION_FORE_COLOR = '#22D3EE';

// Shared canvas ink/surface tones.
Config.INK_COLOR = '#E4E4E7';              // Primary strokes and text.
Config.SURFACE_COLOR = '#18181B';          // Panel and widget fills.
Config.ERROR_COLOR = '#F87171';            // Error text and marks.
Config.GRID_LINE_COLOR = '#3F3F46';        // Faint grid lines.
Config.MID_LINE_COLOR = '#71717A';         // Secondary strokes.
Config.MUTED_TEXT_COLOR = '#A1A1AA';       // Secondary text.
Config.FAINT_LINE_COLOR = '#52525B';       // Subtle strokes.
Config.HIGHLIGHT_STROKE_COLOR = '#F59E0B'; // Focus/highlight strokes.
Config.HIGHLIGHT_FILL_COLOR = '#EAB308';   // Attention fills.

// Time constants.
Config.CYCLE_DURATION_MS = 8000; // How long it takes for evolving gates to cycle, in milliseconds.
Config.TIME_CACHE_GRANULARITY = 196; // The number of buckets the cycle is divided into.
Config.REDRAW_COOLDOWN_MILLIS = 10; // Milliseconds. Rate-limit on redraws. Long draws pad this limit.

/** Half of the span of a drawn gate, width-wise and height-wise.
* @type {!number} */
Config.GATE_RADIUS = 20;
Config.WIRE_SPACING = 50;

Config.BACKGROUND_COLOR = '#0A0A0A';
Config.BACKGROUND_COLOR_CIRCUIT = '#0A0A0A';

// Toolbox layout.
// Spacing follows Carbon's spacing scale: 2, 4, 8, 12, 16, 24, 32, 40, 48.
Config.BACKGROUND_COLOR_TOOLBOX = '#18181B';
// Carbon $spacing-xl, and the shared control height.
Config.TOOLBOX_GATE_SIZE = 32;
Config.TOOLBOX_GATE_SPACING = 4;    // Carbon $spacing-2xs.
Config.TOOLBOX_GROUP_SPACING = 16;  // Carbon $spacing-md.
Config.TOOLBOX_GATE_SPAN = Config.TOOLBOX_GATE_SIZE + Config.TOOLBOX_GATE_SPACING;
Config.TOOLBOX_GROUP_SPAN = Config.TOOLBOX_GATE_SPAN * 2 + Config.TOOLBOX_GROUP_SPACING;
Config.TOOLBOX_MARGIN_X = 32;       // Carbon $spacing-xl.
Config.TOOLBOX_MARGIN_Y = 16;       // Carbon $spacing-md.
// Padding above the gates when the group labels sit below them instead. Carbon $spacing-2xs.
Config.TOOLBOX_GATE_PADDING_Y = 4;
// Vertical gap between the bottom toolbox and the circuit. Carbon $spacing-lg.
Config.TOOLBOX_CIRCUIT_MARGIN = 24;
// Matches the shadcn button base, which is rounded-lg (--radius-lg = 0.625rem).
Config.TOOLBOX_GATE_CORNER_RADIUS = 10;
Config.TOOLBOX_GATE_FILL_COLOR = '#27272A';
// Carbon treats a component boundary as non-text contrast: at least 3:1 against both
// the fill it encloses and the surface behind it (WCAG 1.4.11).
Config.TOOLBOX_GATE_BORDER_COLOR = '#71717A';
Config.TOOLBOX_GATE_HOVER_BORDER_COLOR = '#A1A1AA';
Config.TOOLBOX_GATE_HOVER_FILL_COLOR = '#3F3F46';
Config.TOOLBOX_LABEL_COLOR = '#A1A1AA';
// Carbon's productive type scale, for dense UI.
Config.TOOLBOX_LABEL_FONT_SIZE = 12;  // Carbon label-01.
Config.TOOLBOX_NAME_FONT_SIZE = 16;   // Carbon heading-compact-02.
// Gate symbols are the tile's content, not a label: Carbon body-compact-02 at the
// same medium weight the shadcn Button uses, so both control surfaces read alike.
Config.GATE_SYMBOL_FONT_SIZE = 16;
Config.GATE_SYMBOL_FONT_WEIGHT = 500;
// One control height across the app: the toolbox tile and the shadcn Button are both 32px.
Config.CONTROL_HEIGHT = 32;

/**
 * Some tooltips end up looking terrible without available vertical space.
 * (e.g. the error box might not fit, or the gate tips might get squashed)
 * @type {number}
 */
Config.MINIMUM_CANVAS_HEIGHT = 400;

Config.SUPPRESSED_GLSL_WARNING_PATTERNS = [];

// Draw constants.
Config.DEFAULT_FILL_COLOR = '#18181B';
Config.DEFAULT_STROKE_COLOR = '#E4E4E7';
Config.DEFAULT_TEXT_COLOR = '#FAFAFA';
Config.DEFAULT_FONT_SIZE = 12;
// Keep these font stacks in sync with --font-ui and --font-mono in html/quirk.template.html.
Config.DEFAULT_FONT_FAMILY = '"Geist Variable", system-ui, sans-serif';
Config.MONO_FONT_FAMILY = 'ui-monospace, "SFMono-Regular", Consolas, monospace';
Config.DEFAULT_STROKE_THICKNESS = 1;

// Calling WebGLRenderingContext.getError forces a CPU/GPU sync. It's very expensive.
Config.CHECK_WEB_GL_ERRORS_EVEN_ON_HOT_PATHS = false;
Config.SEMI_STABLE_RANDOM_VALUE_LIFETIME_MILLIS = 300;

Config.IGNORED_WEBGL_INFO_TERMS = [];

export {Config}
