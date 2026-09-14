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

import {CircuitViewState} from '../../src/editor/state/CircuitViewState.js';
import {CircuitDefinition} from '../../src/circuit/model/CircuitDefinition.js';
import {DetailedError} from '../../src/base/DetailedError.js';
import {seq, Seq} from '../../src/base/Seq.js';
import {Point} from '../../src/geometry/Point.js';
import {Layout} from '../../src/config/Layout.js';
import {CIRCUIT_OP_LEFT_SPACING} from '../../src/editor/geometry/CircuitLayoutConstants.js';

/** Parses test circuit diagrams with numbered pointer positions. */
export function displayedCircuitFromTextDiagram(gateMap, diagramText) {
    const lines = diagramText.split('\n').map(e => {
        const p = e.split('|');
        if (p.length !== 2) {
            throw new DetailedError('Bad diagram', {diagramText, gateMap});
        }
        return p[1];
    });
    // The diagram interleaves content rows and columns with spacer ones; keep the odd indices.
    const odd = (_, i) => i % 2 === 1;
    const circuitDiagramSubset = lines.
        filter(odd).
        map(line => [...line].filter(odd).join("")).
        join('\n');
    const top = 10;
    const circuit = new CircuitViewState(
        top,
        CircuitDefinition.fromTextDiagram(gateMap, circuitDiagramSubset),
        undefined,
        undefined,
        undefined);
    const pts = Seq.naturals().
        takeWhile(k => diagramText.includes(k)).
        toArray().
        map(k => {
            const pos = seq(lines.
                map((line, row) => ({row, col: line.indexOf(k)})).
                filter(e => e.col !== -1)).
                single();
            if (lines[pos.row][pos.col + 1] === '^') {
                pos.row -= 1;
                pos.col += 1;
            }
            return new Point(
                pos.col * Layout.COLUMN_SPACING / 2 + CIRCUIT_OP_LEFT_SPACING +
                    Layout.GATE_RADIUS - Layout.COLUMN_SPACING / 2 + Layout.UNIT * 0.2 + 0.5,
                pos.row * Layout.WIRE_SPACING / 2 + 10.5);
        });
    return {circuit, pts};
}
