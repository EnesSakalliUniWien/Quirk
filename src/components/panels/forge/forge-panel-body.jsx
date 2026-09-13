import { useMemo, useState } from "react";
import { GateBuilder } from "../../../circuit/model/Gate.js";
import { Serializer, fromJsonText_CircuitDefinition } from "../../../serialization/Serializer.js";
import { parseUserMatrix, parseUserRotation, randomCustomGateId } from "../../../serialization/customGateParsing.js";
import { closePanel } from "../../dock.jsx";
import { useObservedValue } from "../../useObservedValue.js";
import { inputKey, entered } from "./inputs.js";
import { MatrixMethod } from "./matrix-method.jsx";
import { CircuitMethod } from "./circuit-method.jsx";

/**
 * @param {!{deps: !Object}} props
 */
function ForgePanelBody({ deps }) {
  const commits = useMemo(() => deps.revision.latestActiveCommit(), [deps]);
  const circuitJson = useObservedValue(commits) ?? "";
  const [axis, setAxis] = useState("");
  const [angle, setAngle] = useState("");
  const [phase, setPhase] = useState("");
  const [matrixText, setMatrixText] = useState("");
  const [ensureUnitary, setEnsureUnitary] = useState(true);

  const createGate = (gate, circuitDef = undefined) => {
    const circuit = circuitDef ?? fromJsonText_CircuitDefinition(circuitJson);
    deps.revision.commit(
      JSON.stringify(Serializer.toJson(circuit.withCustomGate(gate)), null, 0),
    );
    closePanel("forge");
  };

  return (
    <>
      <div className="panel-body forge-panel" aria-labelledby="forge-title">
        <header className="panel-header">
          <p className="panel-eyebrow">Custom operation</p>
          <h1 id="forge-title" className="panel-title">
            Make a gate
          </h1>
          <p className="panel-description">
            Define a gate from a rotation, a matrix, or part of the current circuit.
          </p>
        </header>
        <div className="forge-grid">
          <MatrixMethod
            heading="From Rotation"
            canvasId="gate-forge-rotation-canvas"
            buttonId="gate-forge-rotation-button"
            buttonLabel="Create Rotation Gate"
            nameId="gate-forge-rotation-name"
            namePlaceholder="[the matrix]"
            inputs={inputKey(axis, angle, phase)}
            parseOp={() =>
              parseUserRotation(
                entered(angle, "45"),
                entered(phase, "0"),
                entered(axis, "X+Z"),
              )
            }
            buildGate={(matrix, name) =>
              new GateBuilder()
                .setSerializedId(randomCustomGateId())
                .setSymbol(name)
                .setTitle("Custom Rotation Gate")
                .setKnownEffectToMatrix(matrix).gate
            }
            onCreate={createGate}
          >
            <label className="forge-field" htmlFor="gate-forge-rotation-axis">
              <span>Axis</span>
              <input
                id="gate-forge-rotation-axis"
                type="text"
                placeholder="X+Z"
                value={axis}
                onChange={(event) => setAxis(event.target.value)}
              />
            </label>
            <label className="forge-field" htmlFor="gate-forge-rotation-angle">
              <span>Angle (degrees)</span>
              <input
                id="gate-forge-rotation-angle"
                type="text"
                placeholder="45"
                value={angle}
                onChange={(event) => setAngle(event.target.value)}
              />
            </label>
            <label className="forge-field" htmlFor="gate-forge-rotation-phase">
              <span>Global phase (degrees)</span>
              <input
                id="gate-forge-rotation-phase"
                type="text"
                placeholder="0"
                value={phase}
                onChange={(event) => setPhase(event.target.value)}
              />
            </label>
          </MatrixMethod>

          <div className="forge-choice-divider" aria-hidden="true">
            or
          </div>

          <MatrixMethod
            heading="From Matrix"
            canvasId="gate-forge-matrix-canvas"
            buttonId="gate-forge-matrix-button"
            buttonLabel="Create Matrix Gate"
            nameId="gate-forge-matrix-name"
            namePlaceholder="[the matrix]"
            inputs={inputKey(matrixText, ensureUnitary)}
            parseOp={() =>
              parseUserMatrix(entered(matrixText, "1, i,  i, 1"), ensureUnitary)
            }
            buildGate={(matrix, rawName) => {
              const name = rawName.trim();
              const h = Math.round(Math.log2(matrix.height()));
              return new GateBuilder()
                .setSerializedId(randomCustomGateId())
                .setSymbol(name)
                .setTitle("Custom Matrix Gate")
                .setHeight(h)
                .setWidth(name === "" ? h : 1)
                .setKnownEffectToMatrix(matrix).gate;
            }}
            onCreate={createGate}
          >
            <label className="forge-field" htmlFor="gate-forge-matrix">
              <span>Matrix values</span>
              <textarea
                id="gate-forge-matrix"
                placeholder="1, i,  i, 1"
                value={matrixText}
                onChange={(event) => setMatrixText(event.target.value)}
              />
            </label>
            <label className="checkbox-row" htmlFor="gate-forge-matrix-fix">
              <input
                id="gate-forge-matrix-fix"
                type="checkbox"
                checked={ensureUnitary}
                onChange={(event) => setEnsureUnitary(event.target.checked)}
              />
              <span className="matrix-fix-label">Ensure unitary (by SVD)</span>
            </label>
          </MatrixMethod>

          <div className="forge-choice-divider" aria-hidden="true">
            or
          </div>

          <CircuitMethod deps={deps} circuitJson={circuitJson} onCreate={createGate} />
        </div>
      </div>
    </>
  );
}

export { ForgePanelBody };
