import {TensorProduct} from "../../math/tensor-product.jsx";
import { useMemo } from "react";
import { stateGrid } from "../../../draw/renderers/dataRenderers.js";
import { DataView } from "../../math/data-view.jsx";
import { MatrixMath } from "../../math/mathml.jsx";
import { stateModel, SYMBOLIC_MAX_ROWS } from "../../math/matrixModel.js";
import { plotSize } from "./plotSize.js";

/** A state vector stays a vector mathematically; its large overview is explicitly labelled. */
function StateFactor({state, step, wireCount, formatKet, highlight, label}) {
  const grid = useMemo(() => stateGrid(state), [state]);
  const symbolic = (1 << wireCount) <= SYMBOLIC_MAX_ROWS;
  const model = useMemo(() => symbolic ? stateModel(state, formatKet) : undefined, [symbolic, state, formatKet]);
  return <figure className="matrix-factor state-factor">
    <figcaption>{label} ψ<sub>{step}</sub> · {1 << wireCount}×1</figcaption>
    {symbolic ? <div><MatrixMath model={model} label={label} highlight={highlight} /><TensorProduct matrix={state} /></div> :
      <div><DataView kind="state" data={grid} {...plotSize(grid)} options={{wireCount}}
        label={label + ": state-vector amplitudes reshaped as a grid"} />
        <p className="matrix-grid-label">State-vector amplitudes · reshaped grid</p></div>}
  </figure>;
}

export { StateFactor };
