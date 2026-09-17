import {useEffect, useRef, useState} from 'react';
import {useStore} from 'zustand';
import {appStore} from '../../../state/appStore.js';
import {useCompletedResult} from '../shared/usePlayheadStats.js';
import {displayData} from './displayData.js';
import {paintInto} from '../../../draw/surface/SharedPaintSurface.js';
import {DATA_RENDERERS, stateGridRect} from '../../../draw/renderers/dataRenderers.js';
import {densityGridRect} from '../../../draw/displays/density/DensityMatrixView.js';
import {rectangle, circle, strokePath} from '../../../draw/shapes/ShapeView.js';
import {drawText} from '../../../draw/text/TextLayout.js';
import {CanvasTheme, phaseColor} from '../../../config/CanvasTheme.js';
import {Rect} from '../../../geometry/Rect.js';
import {Point} from '../../../geometry/Point.js';
import {bin} from '../../../base/Format.js';
import {ketLabel} from '../../../circuit/registerLabels.js';

const SIZE = 320;

export function ComplexDisplayPanel() {
    const target = useStore(appStore, state => state.complexDisplayTarget);
    const result = useCompletedResult();
    const data = displayData(result?.fullStats, target);
    if (!data?.matrix) return <div className="panel-body">Select an amplitude or density display in the circuit to inspect its values.</div>;
    return <DisplayInspector key={`${target.col}:${target.row}:${target.gate.serializedId}`} data={data} />;
}

function DisplayInspector({data}) {
    const {matrix, kind, coherent, wireCount, registers, phaseLockIndex} = data;
    const [selection, select] = useState({row: 0, col: 0});
    const row = Math.min(selection.row, matrix.height()-1), col = Math.min(selection.col, matrix.width()-1);
    const value = matrix.cell(col, row);
    const finite = Number.isFinite(value.real) && Number.isFinite(value.imag);
    const magnitude = Math.hypot(value.real, value.imag);
    const phase = finite && coherent && magnitude > 0 ? Math.atan2(value.imag, value.real) * 180 / Math.PI : undefined;
    const bits = Math.round(Math.log2(matrix.height()));
    const label = kind === 'density' ? `Row |${bin(row, bits)}⟩ · column ⟨${bin(col, bits)}|` :
        `Basis |${ketLabel(registers, wireCount, row*matrix.width()+col)}⟩`;
    return <div className="panel-body complex-display-panel">
        <h2>{kind === 'density' ? 'Density matrix' : 'Amplitudes'}</h2>
        <p>Choose a cell, or use the arrow keys on the grid.</p>
        <DisplayGrid data={data} row={row} col={col} select={select} />
        <div className="complex-cell-controls">
            <label>Row <input type="number" min="0" max={matrix.height()-1} value={row}
                onChange={event => select({row: Math.max(0, Math.min(matrix.height()-1, Math.trunc(Number(event.target.value))||0)), col})} /></label>
            <label>Column <input type="number" min="0" max={matrix.width()-1} value={col}
                onChange={event => select({row, col: Math.max(0, Math.min(matrix.width()-1, Math.trunc(Number(event.target.value))||0))})} /></label>
        </div>
        <h3>{label}</h3>
        <PhaseFigure value={value} defined={phase !== undefined} />
        <dl aria-live="polite">
            <dt>{coherent ? 'Stored complex value' : 'Probability'}</dt>
            <dd>{!finite ? 'Unavailable' : coherent ? `${value.real} ${value.imag < 0 ? '−' : '+'} ${Math.abs(value.imag)}i` : `${magnitude*magnitude}`}</dd>
            {coherent && <><dt>Magnitude</dt><dd>{finite ? String(magnitude) : 'Unavailable'}</dd></>}
            {coherent && (kind !== 'density' || row === col) && <><dt>Probability</dt>
                <dd>{finite ? String(kind === 'density' ? value.real : magnitude*magnitude) : 'Unavailable'}</dd></>}
            <dt>Phase</dt><dd>{phase === undefined ? 'Undefined' : `${phase.toFixed(6)}°`}</dd>
        </dl>
        <h3>How to read the display</h3>
        <p>The enlarged circle shows phase direction only; its radius is normalized.</p>
        <p>{kind === 'density' ? 'Diagonal bar height is probability. Circle radius is the magnitude of the density-matrix entry.' :
            'Circle area and bar height show probability; circle radius shows amplitude magnitude.'} A hand shows phase and ends on a faint ring that makes small nonzero values visible on a logarithmic scale.</p>
        <p>Dense grids use colour for phase and opacity for magnitude relative to the largest entry, with a visibility floor for small values. Select a cell for its stored value.</p>
        {coherent && <div className="complex-phase-key" aria-label="Phase colour key">
            {[0,90,180,270].map(degrees => <span key={degrees}><i aria-hidden="true" style={{backgroundColor: phaseColor(degrees)}} />{degrees}°</span>)}
        </div>}
        {!coherent && <p>Entanglement with other qubits makes local amplitudes and phase undefined. This view shows probabilities. Dense cells use one colour, with opacity based on the square root of probability relative to the largest entry.</p>}
        {kind === 'amplitudes' && coherent && phaseLockIndex !== undefined && <p>Phase reference: |{ketLabel(registers, wireCount, phaseLockIndex)}⟩.</p>}
        <p>Values are the simulator’s stored floating-point results, not symbolic expressions.</p>
    </div>;
}

function DisplayGrid({data, row, col, select}) {
    const canvas = useRef(null);
    const {matrix, kind} = data;
    const area = new Rect(0, 0, SIZE, SIZE);
    const grid = kind === 'density' ? densityGridRect(matrix, area) : stateGridRect(matrix, area).grid;
    const cell = Math.min(grid.w/matrix.width(), grid.h/matrix.height());
    useEffect(() => {
        let active = true;
        void paintInto(canvas.current, SIZE, SIZE, view => {
            if (kind === 'density') DATA_RENDERERS.matrix(view, matrix, area, {style: 'density'});
            else DATA_RENDERERS.state(view, matrix, area, {...data, indicatorAlpha: data.coherent ? 1 : 0});
            rectangle(view, new Rect(grid.x+col*cell, grid.y+row*cell, cell, cell),
                {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
        }, () => active).catch(() => {});
        return () => {active = false;};
    }, [data, row, col]);
    return <canvas ref={canvas} className="complex-display-grid" tabIndex="0" role="img"
        aria-label={`Select cell: row ${row}, column ${col}. Use arrow keys.`}
        onClick={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const c = Math.floor(((event.clientX-bounds.left)*SIZE/bounds.width-grid.x)/cell);
            const r = Math.floor(((event.clientY-bounds.top)*SIZE/bounds.height-grid.y)/cell);
            if (r >= 0 && r < matrix.height() && c >= 0 && c < matrix.width()) select({row:r,col:c});
        }} onKeyDown={event => {
            const moves = {ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
            const delta = moves[event.key];
            if (!delta) return;
            event.preventDefault(); event.stopPropagation();
            select({row:Math.max(0,Math.min(matrix.height()-1,row+delta[0])),col:Math.max(0,Math.min(matrix.width()-1,col+delta[1]))});
        }} />;
}

function PhaseFigure({value, defined}) {
    const canvas = useRef(null);
    useEffect(() => {
        let active = true;
        void paintInto(canvas.current, 180, 150, view => {
            const center = new Point(90,75), radius = 50;
            circle(view, center, radius, {stroke:{color:CanvasTheme.stroke.guide,width:1}});
            strokePath(view,[new Point(25,75),new Point(155,75)],CanvasTheme.stroke.guide,1);
            strokePath(view,[new Point(90,15),new Point(90,135)],CanvasTheme.stroke.guide,1);
            drawText(view,'Re',{x:155,y:90});drawText(view,'Im',{x:95,y:15});
            if (defined) {
                const angle = Math.atan2(value.imag,value.real);
                strokePath(view,[center,new Point(90+radius*Math.cos(angle),75-radius*Math.sin(angle))],CanvasTheme.text.primary,2);
            } else drawText(view,'Phase undefined',{x:90,y:145,align:'center'});
        }, () => active).catch(() => {});
        return () => {active=false;};
    },[value.real,value.imag,defined]);
    return <canvas ref={canvas} className="complex-phase-figure" role="img" aria-label={defined ? 'Phase direction on the complex plane; radius is normalized' : 'Phase undefined'} />;
}
