import {QubitMatrix} from '../../../engine/math/matrix/QubitMatrix.js';
import {OperatorMatrix} from '../../math/operator-matrix.jsx';
import {RotationFigure} from '../../gate/rotation-figure.jsx';
import {inspectMatrix} from './construction.js';

export function OperationPreview({matrix}) {
    const {qubits,unitary,residual} = inspectMatrix(matrix);
    const rotation = unitary && qubits === 1 ? QubitMatrix.operationToAngleAxisRotation(matrix) : undefined;
    return <div className="forge-operation-preview">
        <div className="operation-status"><strong>{matrix.width()}×{matrix.height()} · {qubits} qubit{qubits === 1 ? '' : 's'}</strong>
            <span>{unitary ? 'Unitary' : 'Nonunitary operation'}</span></div>
        <OperatorMatrix matrix={matrix} label="Operator" />
        <p className="field-description">Unitarity residual: {Number(residual.toPrecision(5))}</p>
        {rotation && <><h3>Bloch rotation</h3><RotationFigure axis={rotation.axis} angle={rotation.angle} /></>}
    </div>;
}
