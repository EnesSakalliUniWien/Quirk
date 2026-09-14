import {Suite, assertThat, assertThrows} from '../../../TestUtil.js';
import {parseRotationDraft, parseMatrixDraft, inspectMatrix, validateCircuitRange, parseCircuitDraft,buildMatrixGate} from '../../../../src/components/panels/forge/construction.js';
import {MATRIX_RENDERER} from '../../../../src/draw/gate/GateRenderers.js';
import {renderCustomGateCircuit} from '../../../../src/draw/gate/CustomGateCircuitRenderer.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {QubitMatrix} from '../../../../src/engine/math/matrix/QubitMatrix.js';
import {GateBuilder} from '../../../../src/circuit/model/Gate.js';
import {GateColumn} from '../../../../src/circuit/model/GateColumn.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
const suite = new Suite('Gate construction');
suite.test('a whole-circuit range includes trailing columns occupied by a wide gate', () => {
    const gate = new GateBuilder().setWidth(2).setKnownEffectToMatrix(Matrix.identity(2)).gate;
    const circuit = new CircuitDefinition(2,[new GateColumn([gate,undefined])]);
    const result = parseCircuitDraft(circuit,{cols:'1:∞',rows:'1:∞',name:'Wide'});
    assertThat(result.range.colEnd).isEqualTo(2);
    assertThat(result.gate.knownCircuit.columns[0].gates[0]).isEqualTo(gate);
    assertThat(result.gate.customRenderer).isEqualTo(renderCustomGateCircuit);
    assertThat(result.gate.height).isEqualTo(1);
});
suite.test('unnamed construction previews use the matrix renderer',()=>{
    const gate=buildMatrixGate(Matrix.identity(4),'');
    assertThat(gate.customRenderer).isEqualTo(MATRIX_RENDERER);
    assertThat(gate.width).isEqualTo(2);
    assertThat(gate.knownMatrixAt(0)).isEqualTo(Matrix.identity(4));
});
suite.test('rotation includes global phase and rejects zero axes', () => {
    assertThat(parseRotationDraft({axis:'X+Z', angle:'180', phase:'90', unit:'degrees'})).isApproximatelyEqualTo(QubitMatrix.HADAMARD);
    assertThat(parseRotationDraft({axis:'Y', angle:'pi/3', phase:'0', unit:'radians'})).isApproximatelyEqualTo(
        parseRotationDraft({axis:'Y', angle:'60', phase:'0', unit:'degrees'}));
    assertThrows(() => parseRotationDraft({axis:'X-X', angle:'45', phase:'0', unit:'degrees'}));
});
suite.test('matrix correction is opt in and finite input is required', () => {
    assertThat(inspectMatrix(parseMatrixDraft('1,i,i,1')).unitary).isEqualTo(false);
    assertThat(inspectMatrix(parseMatrixDraft('1,i,i,1', true)).unitary).isEqualTo(true);
    assertThat(inspectMatrix(Matrix.identity(16)).qubits).isEqualTo(4);
    for (const text of ['', '1/0', '1+']) assertThrows(() => parseMatrixDraft(text));
});
suite.test('ranges cannot discard any part of an intersecting gate', () => {
    const gate = new GateBuilder().setHeight(2).setKnownEffectToMatrix(Matrix.identity(4)).gate;
    const circuit = new CircuitDefinition(2, [new GateColumn([gate, undefined])]);
    assertThat(validateCircuitRange(circuit, '1:1', '1:2')).isEqualTo({colStart:0,colEnd:1,wireStart:0,wireEnd:2});
    for (const range of ['1:1', '2:2', '1.5:2', '2:1', '1:3', '']) assertThrows(() => validateCircuitRange(circuit, '1:1', range));
});
