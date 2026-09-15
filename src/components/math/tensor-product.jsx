import {useMemo, useState, Fragment} from 'react';
import {tensorFactors} from '../../engine/math/matrix/tensorFactors.js';
import {MatrixMath} from './mathml.jsx';
import {operatorModel, stateModel} from './matrixModel.js';

/** Keep the verified factors beside the expanded matrix; q0 is the rightmost tensor factor. */
export function TensorProduct({matrix}) {
    const [open, setOpen] = useState(false);
    const factors = useMemo(() => tensorFactors(matrix, matrix.width() === 1 ? 1e-6 : 1e-10), [matrix]);
    if (factors.length < 2) return null;
    return <details className="tensor-details" onToggle={event => setOpen(event.currentTarget.open)}>
        <summary>{open ? 'Hide tensor factors' : 'Show tensor factors'}</summary>
        {open && <div className="tensor-decomposition">
        <p className="algebra-step-note">Tensor factors · highest wire first, q0 last</p>
        <div className="tensor-product" aria-label="Tensor product of smaller matrices">
            {factors.map(({matrix:factor, firstWire, wireCount}, index) => {
                const label = Array.from({length:wireCount}, (_, i) => `q${firstWire+wireCount-1-i}`).join(', ');
                const model = factor.width() === 1 ? stateModel(factor) : operatorModel(factor);
                return <Fragment key={firstWire}>
                    {index > 0 && <span className="equation-sign" aria-label="tensor product">⊗</span>}
                    <figure className="matrix-factor tensor-factor">
                        <figcaption>{label}</figcaption>
                        <MatrixMath model={model} label={`Factor on ${label}`} />
                    </figure>
                </Fragment>;
            })}
        </div>
        <p className="algebra-step-note">≈ Full {matrix.width() === 1 ? 'state vector' : 'matrix'} above</p>
    </div>}
    </details>;
}
