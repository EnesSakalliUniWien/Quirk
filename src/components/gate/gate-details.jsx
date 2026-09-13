import { useMemo } from "react";

import { Format } from "../../base/Format.js";
import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { CustomGateSet } from "../../circuit/model/CustomGateSet.js";
import { GateColumn } from "../../circuit/model/GateColumn.js";
import {
  describeAxis,
  describeGateTransformations,
} from "../../circuit/gateDescription.js";
import { decompositionOf } from "../../circuit/gateDecomposition.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { QubitMatrix } from "../../engine/math/matrix/QubitMatrix.js";
import { preparedStateVector } from "../../engine/math/preparedStates.js";
import { columnStructure, structureMatrix } from "../../engine/simulation/columnStructure.js";
import { Serializer } from "../../serialization/Serializer.js";
import { MatrixMath } from "../math/mathml.jsx";
import { DataView } from "../math/data-view.jsx";
import { stateGrid } from "../../draw/renderers/dataRenderers.js";
import { OperatorMatrix } from "../math/operator-matrix.jsx";
import { stateModel } from "../math/matrixModel.js";
import { CircuitFigure } from "./circuit-figure.jsx";
import { RotationFigure } from "./rotation-figure.jsx";

/** Past two qubits one sentence per basis state is a wall of text, not an explanation. */
const MAX_DESCRIBED_ROWS = 4;
/**
 * Up to this height the card builds a gate's whole matrix, to write out or to draw. A taller gate's
 * 2^n x 2^n matrix is never built: it is drawn tile by tile from the gate's structure.
 */
const MAX_MATRIX_QUBITS = 4;
/** The side of a drawn matrix, in pixels. */
const DRAWN_MATRIX_SIZE = 260;
/** Up to this many amplitudes a prepared state is written out; past it, it is drawn. */
const MAX_WRITTEN_AMPLITUDES = 8;

/**
 * The state a prepare box puts its wires in, as a column vector.
 *
 * @param {!Gate} gate
 * @returns {!Matrix}
 */
function preparedState(gate) {
  return new Matrix(1, 1 << gate.height, preparedStateVector(gate.knownPreparation, gate.height));
}

/**
 * A gate too tall to build its matrix, set alone in a circuit as tall as itself - which is what the
 * operator view draws: the gate's structure, and the circuit JSON the tile worker rebuilds it from.
 *
 * @param {!Gate} gate
 * @param {!number} time
 * @returns {undefined|!{structure: !ColumnStructure, source: !Object}|!{reason: !string}} Undefined
 *     when the gate is disabled on its own, as a gate that reads inputs is.
 */
function gateAlone(gate, time) {
  const column = new GateColumn([gate, ...Array(gate.height - 1).fill(undefined)]);
  const customGates = gate.serializedId.startsWith("~") ? new CustomGateSet(gate) : new CustomGateSet();
  const circuit = new CircuitDefinition(gate.height, [column], 0, new Map(), customGates);
  if (circuit.gateAtLocIsDisabledReason(0, 0) !== undefined) {
    return undefined;
  }
  const structure = columnStructure(circuit, 0, gate.height, time);
  if (!structure.ok) {
    return { reason: structure.reason };
  }
  return {
    structure,
    source: {
      json: JSON.stringify(Serializer.toJson(circuit)),
      col: 0,
      wireCount: gate.height,
      time: gate.stableDuration() === Infinity ? 0 : time,
    },
  };
}

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
  // Once per gate and moment: a tall gate's structure can hold a dense block of up to 10 qubits.
  const { matrix, alone } = useMemo(() => {
    if (gate === undefined || gate.definitelyHasNoEffect()) {
      return {};
    }
    const small = gate.height <= MAX_MATRIX_QUBITS;
    const known = small ? gate.knownMatrixAt(time) : undefined;
    if (known !== undefined || (small && gate.knownCircuit === undefined)) {
      return { matrix: known };
    }
    // Too tall to build, or with no matrix of its own - a gate built from a circuit: read the
    // gate off its structure, whole while it is small, tile by tile past that.
    const found = gateAlone(gate, time);
    return small && found?.structure !== undefined
      ? { matrix: structureMatrix(found.structure) }
      : { alone: found };
  }, [gate, time]);
  if (gate === undefined) {
    return (
      <div className="gate-details">
        <p className="gate-details-empty">Hover a gate to see what it does.</p>
      </div>
    );
  }

  const format =
    gate.stableDuration() < 0.2 ? Format.CONSISTENT : Format.SIMPLIFIED;
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

      {gate.knownPreparation !== undefined && (
        <section className="gate-details-section">
          <h3>Prepares</h3>
          {(1 << gate.height) <= MAX_WRITTEN_AMPLITUDES ? (
            <MatrixMath model={stateModel(preparedState(gate))} label={`The state the ${gate.name} prepares`} />
          ) : (
            <>
              <DataView
                kind="state"
                data={stateGrid(preparedState(gate))}
                width={220}
                height={220}
                options={{ wireCount: gate.height }}
                label={`The state the ${gate.name} prepares: state-vector amplitudes reshaped as a grid`}
              />
              <p className="gate-details-legend">disc area is magnitude, the hand is phase</p>
            </>
          )}
          <p className="gate-details-legend">
            Its wires start in this state. Nothing may have acted on them before the box.
          </p>
        </section>
      )}

      {(matrix !== undefined || alone?.structure !== undefined) && (
        <section className="gate-details-section">
          <h3>Matrix</h3>
          <OperatorMatrix matrix={matrix} source={alone?.source} structure={alone?.structure}
            size={DRAWN_MATRIX_SIZE} label={"The matrix of the " + gate.name} />
          <p className="gate-details-legend">Rows: output basis states. Columns: input basis states. Basis order runs from |0…0⟩ to |1…1⟩.</p>
        </section>
      )}

      {matrix !== undefined && matrix.height() <= MAX_DESCRIBED_ROWS && (
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

      {matrix === undefined && alone?.structure === undefined && decomposition === undefined && (
        <p className="gate-details-note">
          {alone?.reason ?? "This gate has no fixed matrix: what it does depends on its inputs."}
        </p>
      )}
    </div>
  );
}

export { GateDetails };
