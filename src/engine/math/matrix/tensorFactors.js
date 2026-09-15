import {Matrix} from './Matrix.js';

/**
 * Factor a qubit operator or state across consecutive wire groups, high bits first.
 * Every split is checked against all entries; a coupled group stays one matrix.
 * Factors are numerical, with scalar/phase freedom; their product retains the original phase.
 */
export function tensorFactors(matrix, tolerance = 1e-10, firstWire = 0) {
    const wires = Math.log2(matrix.height());
    if (!Number.isInteger(wires) || (matrix.width() !== 1 && matrix.width() !== matrix.height())) {
        throw new Error('Tensor factors require a qubit state column or square operator.');
    }
    for (let lowWires = 1; lowWires < wires; lowWires++) {
        const split = splitTensor(matrix, lowWires, tolerance);
        if (split) return [
            ...tensorFactors(split.high, tolerance, firstWire+lowWires),
            ...tensorFactors(split.low, tolerance, firstWire),
        ];
    }
    return [{matrix, firstWire, wireCount:wires}];
}

function splitTensor(matrix, lowWires, tolerance) {
    const lowRows = 2 ** lowWires;
    const lowCols = matrix.width() === 1 ? 1 : lowRows;
    const highRows = matrix.height()/lowRows, highCols = matrix.width()/lowCols;
    const source = matrix.rawBuffer(), width = matrix.width();
    const index = (hr,hc,lr,lc) => ((hr*lowRows+lr)*width+hc*lowCols+lc)*2;
    let best = 0, pivotRow = 0, pivotCol = 0, norm = 0;
    for (let hr=0;hr<highRows;hr++) for (let hc=0;hc<highCols;hc++) {
        let blockNorm=0;
        for (let lr=0;lr<lowRows;lr++) for (let lc=0;lc<lowCols;lc++) {
            const k=index(hr,hc,lr,lc);
            blockNorm+=source[k]**2+source[k+1]**2;
        }
        norm+=blockNorm;
        if(blockNorm>best){best=blockNorm;pivotRow=hr;pivotCol=hc;}
    }
    if (!Number.isFinite(norm) || best===0) return undefined;
    // Unit norm for state factors; Frobenius norm sqrt(d) for d-dimensional unitary factors.
    const scale=Math.sqrt(best/lowCols);
    const low=new Float64Array(lowRows*lowCols*2);
    for(let lr=0;lr<lowRows;lr++) for(let lc=0;lc<lowCols;lc++) {
        const k=index(pivotRow,pivotCol,lr,lc), j=(lr*lowCols+lc)*2;
        low[j]=source[k]/scale;low[j+1]=source[k+1]/scale;
    }
    const high=new Float64Array(highRows*highCols*2);
    let error=0;
    for(let hr=0;hr<highRows;hr++) for(let hc=0;hc<highCols;hc++) {
        let real=0, imag=0;
        for(let lr=0;lr<lowRows;lr++) for(let lc=0;lc<lowCols;lc++) {
            const k=index(hr,hc,lr,lc), j=(lr*lowCols+lc)*2;
            real+=source[k]*low[j]+source[k+1]*low[j+1];
            imag+=source[k+1]*low[j]-source[k]*low[j+1];
        }
        real/=lowCols;imag/=lowCols;
        const at=(hr*highCols+hc)*2;high[at]=real;high[at+1]=imag;
        for(let lr=0;lr<lowRows;lr++) for(let lc=0;lc<lowCols;lc++) {
            const k=index(hr,hc,lr,lc), j=(lr*lowCols+lc)*2;
            error+=(source[k]-real*low[j]+imag*low[j+1])**2+
                (source[k+1]-real*low[j+1]-imag*low[j])**2;
        }
    }
    if(error>tolerance*tolerance*norm) return undefined;
    return {high:new Matrix(highCols,highRows,high),low:new Matrix(lowCols,lowRows,low)};
}
