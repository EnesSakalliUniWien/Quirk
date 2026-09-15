import { OperatorMatrix } from "../../math/operator-matrix.jsx";
import { PLOT_SIZE } from "./plotSize.js";
import { StateFactor } from "./state-factor.jsx";

/** An entry that moved less than this between steps did not change. */
const CHANGE_TOLERANCE = 1e-6;

/** Every card uses the same header, complete equation and explanation rows. */
function StepCard({ index, step, before, after, wireCount, current, onSeek, source, formatKet }) {
  const changed = (row) => {
    const a = before.rawBuffer(), b = after.rawBuffer();
    return Math.hypot(a[row * 2] - b[row * 2], a[row * 2 + 1] - b[row * 2 + 1]) > CHANGE_TOLERANCE;
  };
  const number = index + 1;
  const hasOperator = step.matrix !== undefined || step.structure !== undefined;
  const relation = !hasOperator || step.residual === undefined ? "→" : step.residual >= 1e-5 ? "≠" : "=";
  return <li className="algebra-step" data-step={number} aria-current={current ? "step" : undefined}>
    <button type="button" className="algebra-step-header" onClick={() => onSeek(number)}>
      <span className="algebra-step-number">{number}</span>
      <span className="algebra-step-description">{step.description}</span>
    </button>
    <div className="algebra-equation" role="group" aria-label={hasOperator ?
      "Step " + number + ": operator times input state, compared with simulated output state" :
      "Step " + number + ": simulated input and output; no matrix representation"}>
      {hasOperator && <><OperatorMatrix showTensorFactors matrix={step.matrix} source={source} structure={step.structure}
        formatKet={formatKet} size={PLOT_SIZE} label={"Operator " + number} />
        <span className="equation-sign" aria-hidden="true">×</span></>}
      <StateFactor state={before} step={index} wireCount={wireCount} formatKet={formatKet} label="Input" />
      <span className="equation-sign" aria-label={relation === "→" ? "simulated result" : undefined}>{relation}</span>
      <StateFactor state={after} step={number} wireCount={wireCount} formatKet={formatKet} highlight={changed} label="Output" />
    </div>
    <p className={"algebra-step-note" + (step.reason !== undefined || step.residual === undefined || relation === "≠" ? " debug-panel-note" : "")}>{step.reason ?? (step.residual === undefined ?
      "Simulated output; matrix equality has not been checked at this size." :
      relation === "≠" ? "The operator product differs from the simulated output; see the circuit's measurement or normalization behavior." :
      "Rows name output basis states; columns name input basis states. Highlighted output entries changed.")}</p>
  </li>;
}

export { StepCard };
