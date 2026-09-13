import { QubitMatrix } from "../../../engine/math/matrix/QubitMatrix.js";
import { OperatorMatrix } from "../../math/operator-matrix.jsx";
import { RotationFigure } from "../../gate/rotation-figure.jsx";

/** The operator uses the shared presentation; its Bloch rotation keeps the Forge's unitary tolerance. */
function OperationPreview({matrix}) {
  const unitary = matrix.isUnitary(0.009);
  const rotation = unitary && matrix.width() === 2 ? QubitMatrix.operationToAngleAxisRotation(matrix) : undefined;
  return <div className="forge-operation-preview">
    <OperatorMatrix matrix={matrix} label="Operator" />
    {rotation ? <RotationFigure axis={rotation.axis} angle={rotation.angle} /> :
      <p>{unitary ? "(Not a 1-qubit rotation)" : "NOT UNITARY"}</p>}
  </div>;
}

export { OperationPreview };
