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
 * Sizes and spacings of the drawn circuit and its gate tiles.
 */
const Layout = {};

// One logical unit is an ordinary gate's diameter. Camera zoom scales all of these together.
Layout.UNIT = 40;
Layout.GATE_RADIUS = Layout.UNIT / 2;
Layout.REGISTER_MARGIN = Layout.UNIT * 0.2;
Layout.REGISTER_INDEX_WIDTH = Layout.UNIT * 0.9;
Layout.REGISTER_KET_WIDTH = Layout.UNIT * 1.1;
Layout.REGISTER_HEIGHT = Layout.UNIT;
Layout.REGISTER_FONT_SIZE = Layout.UNIT * 0.4;
// Room for a register's name and the brace that groups its wires, added left of the gutter only
// while the circuit has registers.
Layout.REGISTER_NAME_WIDTH = Layout.UNIT * 1.3;
Layout.BLOCH_RADIUS = Layout.UNIT * 0.75;
Layout.BLOCH_LABEL_MARGIN = Layout.UNIT * 0.15;
Layout.BLOCH_READOUT_HEIGHT = Layout.UNIT * 0.45;
Layout.COLUMN_SPACING =
  2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN) + Layout.UNIT * 0.2;
// Leave room for the first column's half-slot insertion preview, including a Bloch display.
Layout.REGISTER_WIRE_GAP = Layout.COLUMN_SPACING / 2 + Layout.UNIT * 0.6;
Layout.WIRE_SPACING =
  2 *
    (Layout.BLOCH_RADIUS +
      Layout.BLOCH_LABEL_MARGIN +
      Layout.BLOCH_READOUT_HEIGHT) +
  Layout.UNIT * 0.1;
// The least vertical margin above the circuit band; also the margin the band keeps when the
// visible area is too short to center it.
Layout.CIRCUIT_TOP_MARGIN = 24;
Layout.MIN_COL_COUNT = 5;
Layout.DEFAULT_STROKE_THICKNESS = 1;

// Derived dimensions and their inputs must stay consistent for every consumer.
Object.freeze(Layout);

export { Layout };
