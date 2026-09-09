import { Format } from "../../base/Format.js";
import {
  describeAxis,
  describeGateTransformations,
} from "../../circuit/gateDescription.js";
import { decompositionOf } from "../../circuit/gateDecomposition.js";
import { QubitMatrix } from "../../engine/math/matrix/QubitMatrix.js";
import { MatrixMath } from "../math/mathml.jsx";
import { MatrixPlot } from "../math/matrix-plot.jsx";
import { operatorModel } from "../math/matrixModel.js";
import { CircuitFigure } from "./circuit-figure.jsx";
import { RotationFigure } from "./rotation-figure.jsx";

/** Past two qubits the entries stop fitting a card, and the plot says more than the symbols. */
const MAX_SYMBOLIC_ROWS = 4;
/** Past two qubits one sentence per basis state is a wall of text, not an explanation. */
const MAX_DESCRIBED_ROWS = 4;
/** Asking a larger gate for its matrix builds a 2^n x 2^n one, which is a way to exhaust memory. */
const MAX_MATRIX_QUBITS = 4;

/**
 * @param {!number} degrees
 * @returns {!string} Trimmed: 45 degrees reads as 45, not 45.000.
 */
function formatDegrees(degrees) {
  return `${Math.round(degrees * 100) / 100}°`;
}

/**
 * The angle in radians, written the way a reader expects: π, π/2, 3π/4, -π/2. Not "0.5π", and not
 * "1/2π", which reads as one over two-pi.
 *
 * @param {!number} angle In radians.
 * @returns {!string}
 */
function turnsText(angle) {
  const turns = angle / Math.PI;
  for (const denominator of [1, 2, 3, 4, 6, 8, 12]) {
    const numerator = Math.round(turns * denominator);
    if (Math.abs(turns - numerator / denominator) < 1e-6 && numerator !== 0) {
      const size = Math.abs(numerator);
      return (
        (numerator < 0 ? "-" : "") +
        (size === 1 ? "π" : `${size}π`) +
        (denominator === 1 ? "" : `/${denominator}`)
      );
    }
  }
  return `${turns.toFixed(3)}π`;
}

/**
 * Everything the app can say about one gate: what it is, the matrix it applies, what that matrix
 * does to each basis state, and - for a one-qubit gate - the turn it performs on the Bloch sphere.
 *
 * This is the module, not the window. The hover card renders it beside a palette tile; a dock panel
 * can render the same thing with more room.
 *
 * @param {!{gate: undefined|!Gate, time: !number}} props
 */
function GateDetails({ gate, time }) {
  if (gate === undefined) {
    return (
      <div className="gate-details">
        <p className="gate-details-empty">Hover a gate to see what it does.</p>
      </div>
    );
  }

  const matrix =
    gate.height <= MAX_MATRIX_QUBITS ? gate.knownMatrixAt(time) : undefined;
  const format =
    gate.stableDuration() < 0.2 ? Format.CONSISTENT : Format.SIMPLIFIED;
  const model = matrix === undefined ? undefined : operatorModel(matrix);
  // The circuit the gate stands for: its own, when it was built from one, or the one the app knows
  // it is equivalent to. The simulator reaches most of these another way, so this is display only.
  const decomposition = decompositionOf(gate);
  const rotation =
    matrix !== undefined && matrix.width() === 2 && matrix.isUnitary(0.001)
      ? QubitMatrix.operationToAngleAxisRotation(matrix)
      : undefined;

  return (
    <div className="gate-details">
      <header className="gate-details-header">
        <h2 className="gate-details-title">{gate.name}</h2>
        {gate.blurb !== "" && <p className="gate-details-blurb">{gate.blurb}</p>}
      </header>

      {model !== undefined && (
        <section className="gate-details-section">
          <h3>Matrix</h3>
          {model.rows <= MAX_SYMBOLIC_ROWS ? (
            <MatrixMath model={model} label={`The matrix of the ${gate.name}`} />
          ) : (
            <>
              <MatrixPlot
                model={model}
                label={`The matrix of the ${gate.name}, plotted: hue is phase, opacity is magnitude`}
              />
              <p className="gate-details-legend">hue is phase, opacity is magnitude</p>
            </>
          )}
        </section>
      )}

      {model !== undefined && model.rows <= MAX_DESCRIBED_ROWS && (
        <section className="gate-details-section">
          <h3>Acts on</h3>
          <ul className="gate-details-actions">
            {describeGateTransformations(matrix, format).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {rotation !== undefined && (
        <section className="gate-details-section">
          <h3>Rotation</h3>
          <div className="gate-details-rotation">
            <RotationFigure axis={rotation.axis} angle={rotation.angle} />
            <dl className="gate-details-facts">
              <dt>turns</dt>
              <dd>
                {formatDegrees((rotation.angle * 180) / Math.PI)}
                <span className="gate-details-aside">
                  {" "}
                  ({turnsText(rotation.angle)})
                </span>
              </dd>
              <dt>around</dt>
              <dd>{describeAxis(rotation.axis, format)}</dd>
              <dt>axis</dt>
              <dd className="gate-details-vector">
                {rotation.axis
                  .map((e, i) => `${"xyz"[i]} ${format.formatFloat(e)}`)
                  .join("   ")}
              </dd>
              <dt>phase</dt>
              <dd>exp({formatDegrees((rotation.phase * 180) / Math.PI)}i)</dd>
            </dl>
          </div>
        </section>
      )}

      {decomposition !== undefined && (
        <section className="gate-details-section">
          <h3>Stands for</h3>
          <CircuitFigure circuit={decomposition} time={time} />
          <p className="gate-details-legend">
            gate weight {decomposition.gateWeight()}
          </p>
        </section>
      )}

      {model === undefined && decomposition === undefined && (
        <p className="gate-details-note">
          {gate.height > MAX_MATRIX_QUBITS
            ? `${gate.height} qubits is too many for a matrix to be worth showing.`
            : "This gate has no fixed matrix: what it does depends on its inputs."}
        </p>
      )}
    </div>
  );
}

export { GateDetails };
