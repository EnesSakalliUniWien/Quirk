import { useMemo } from "react";
import { DataView } from "../../math/data-view.jsx";
import { Matrix } from "../../../engine/math/matrix/Matrix.js";

function Distribution({probabilities, label, colour, transparent = false}) {
    const data = useMemo(() => new Matrix(1, probabilities.length,
        Float64Array.from(probabilities.flatMap(p => [Number.isFinite(p) ? p : NaN, 0]))), [probabilities]);
    return <DataView kind="probabilities" data={data} width={260} height={Math.min(180, probabilities.length * 18)}
        options={{wireCount: Math.log2(probabilities.length), colour, transparent}} label={label} />;
}

export { Distribution };
