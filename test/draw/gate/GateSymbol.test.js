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

import {assertThat, Suite} from '../../TestUtil.js';
import {fitGateSymbol, splitGateSymbol} from '../../../src/draw/gate/GateSymbol.js';
import {Typography} from '../../../src/config/Typography.js';

const suite = new Suite("GateSymbol");

suite.test("splitGateSymbol_breaksAtArgumentOrNearestMiddle", () => {
    assertThat(splitGateSymbol("Rx(f(t))")).isEqualTo(["Rx", "(f(t))"]);
    assertThat(splitGateSymbol("a/b c")).isEqualTo(["a/", "b c"]);
    assertThat(splitGateSymbol("XYZ")).isEqualTo(["XYZ"]);
});

suite.test("fitGateSymbol_stepsDownTheRampBeforeWrapping", () => {
    const wide = fitGateSymbol("Z", 40);
    assertThat(wide.lines).isEqualTo(["Z"]);
    assertThat(wide.font.fontSize).isEqualTo(Typography.GATE_SYMBOL_FONT_SIZE);

    const narrow = fitGateSymbol("Rz(f(t))", 20);
    assertThat(narrow.lines).isEqualTo(["Rz", "(f(t))"]);
    assertThat(narrow.font.fontSize).isEqualTo(Typography.GATE_SYMBOL_MIN_FONT_SIZE);
});
