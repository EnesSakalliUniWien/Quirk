import {TensorProduct} from "./tensor-product.jsx";
import {useMemo} from "react";
import {MatrixMath} from "./mathml.jsx";
import {operatorModel, SYMBOLIC_MAX_ROWS} from "./matrixModel.js";
import {OperatorView} from "./operator-view.jsx";

/** One operator presentation for Algebra, gate details and Forge; never expands a large structure. */
function OperatorMatrix({matrix, source, structure, formatKet, size = 260, label = "Operator", showTensorFactors = false}) {
    const symbolic = matrix !== undefined && Math.max(matrix.width(), matrix.height()) <= SYMBOLIC_MAX_ROWS;
    const model = useMemo(() => symbolic ? operatorModel(matrix, formatKet) : undefined, [symbolic, matrix, formatKet]);
    const side = matrix?.height() ?? 2 ** source.wireCount;
    return <figure className="matrix-factor operator-matrix">
        <figcaption>{label} · {side}×{side}</figcaption>
        {symbolic ? <div><MatrixMath model={model} label={label} />{showTensorFactors && <TensorProduct matrix={matrix} />}</div> :
            <OperatorView matrix={matrix} source={source} structure={structure} size={size} label={label} formatKet={formatKet} />}
    </figure>;
}

export {OperatorMatrix};
