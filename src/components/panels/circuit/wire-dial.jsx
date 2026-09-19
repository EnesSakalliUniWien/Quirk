import {useEffect, useRef} from 'react';
import {useStore} from 'zustand';
import {useDrag} from '@use-gesture/react';
import {appStore} from '../../../state/appStore.js';
import {parseAngleExpression} from '../../../engine/math/formula/AngleExpression.js';
import {DIAL_DETENT, DIAL_STEP, radiansExpression, readoutDegrees, snapAngle, stepAngle} from './dialAngle.js';

/** The index mark's colour tones, one per rotation axis; anything else takes the plain one. */
const TONES = ['x', 'y', 'z'];
/** How long after the last notch a turn by keys or wheel settles into its one commit. */
const SETTLE_MILLIS = 350;

/** @param {!Gate} gate @returns {undefined|!string} The rotation axis the gate's id ends in, which tones its dial. */
const axisOf = gate => /([xyz])$/i.exec(gate.serializedId)?.[1].toLowerCase();

/**
 * The dials on the wires: one beside every rotation gate whose parameter is a constant angle, in
 * the last column of the gate's footprint (src/editor/geometry/CircuitGeometry.js's dialRect).
 * They live in the circuit's scroll content, at the drawing's zoom, so they stay with their gate
 * as the circuit scrolls and zooms, and a gate that goes takes its dial with it.
 */
export function WireDials() {
    const deps = useStore(appStore, s => s.panelDeps);
    const actions = useStore(appStore, s => s.gateActions);
    return deps === undefined || actions === undefined ? null : <CircuitDials deps={deps} actions={actions} />;
}

function CircuitDials({deps, actions}) {
    const zoom = useStore(appStore, s => s.zoom);
    const shown = useStore(deps.displayed, s => s.value);
    // A held gate is out of the circuit, so its dial waits until it is put down.
    if (shown.hand.isBusy()) {
        return null;
    }
    const circuit = deps.syncArea(shown).displayedCircuit;
    const geometry = circuit.geometry();
    const dials = [];
    circuit.circuitDefinition.columns.forEach((column, col) => column.gates.forEach((gate, row) => {
        if (gate?.hasAngleDial()) {
            dials.push(<Dial key={`${col}:${row}`} col={col} row={row} gate={gate}
                rect={geometry.dialRect(row, col, gate)} zoom={zoom} actions={actions} />);
        }
    }));
    return dials;
}

/**
 * A flat encoder seen from above: a pale face, a dark core, and an arc from the top round to the
 * angle, the other way for a negative one, in the axis's tone. Turn it by dragging round, by the wheel, or by the arrow keys, and the gate takes
 * the angle it lands on - each step shown at once, the whole turn one commit once it settles. It
 * reads the gate's angle, so an angle typed into the panel turns the dial too; while the parameter
 * is not a constant angle the dial rests where it was.
 *
 * Interaction is @use-gesture's drag: pointer capture, touch and mouse alike, with taps ignored.
 */
function Dial({col, row, gate, rect, zoom, actions}) {
    let degrees;
    try { degrees = parseAngleExpression(String(gate.param)).degrees; } catch { degrees = undefined; }
    const resting = useRef(0);
    if (degrees !== undefined && Number.isFinite(degrees)) resting.current = degrees;
    const value = resting.current;
    const valid = degrees !== undefined;

    const face = useRef(null);
    const settle = useRef({timer: undefined, text: undefined});
    /** Shows the angle now, and commits it when the turn settles - at once when the turn is over. */
    const turn = (next, over) => {
        const text = radiansExpression(next);
        clearTimeout(settle.current.timer);
        if (over) {
            settle.current.text = undefined;
            actions.setParamText(col, row, text);
            return;
        }
        settle.current.text = text;
        actions.setParamText(col, row, text, {preview: true});
        settle.current.timer = setTimeout(() => {
            settle.current.text = undefined;
            actions.setParamText(col, row, text);
        }, SETTLE_MILLIS);
    };

    useEffect(() => {
        const element = face.current;
        const wheel = event => {
            event.preventDefault();
            turn(stepAngle(resting.current, event.deltaY < 0 ? +1 : -1, event.shiftKey), false);
        };
        // Not passive: the circuit must not scroll while the dial turns.
        element.addEventListener('wheel', wheel, {passive: false});
        return () => {
            element.removeEventListener('wheel', wheel);
            // A turn still settling commits as the dial goes, so nothing shown is lost.
            clearTimeout(settle.current.timer);
            if (settle.current.text !== undefined) actions.setParamText(col, row, settle.current.text);
        };
        // The dial is keyed by its slot, so its slot and actions hold for its whole life.
    }, []);

    const bind = useDrag(({xy: [x, y], first, last, memo, shiftKey}) => {
        // The pointer's bearing from the face's centre; the dial turns by its change.
        const box = face.current.getBoundingClientRect();
        const bearing = Math.atan2(y - (box.top + box.height / 2), x - (box.left + box.width / 2)) * 180 / Math.PI;
        if (first) return {bearing, value: resting.current};
        const turned = ((bearing - memo.bearing + 540) % 360) - 180;
        const next = memo.value + turned;
        turn(snapAngle(next, shiftKey ? DIAL_DETENT : DIAL_STEP), last);
        return {bearing, value: next};
    }, {filterTaps: true, pointer: {capture: true}});

    const onKeyDown = event => {
        const jumps = {ArrowUp: +1, ArrowRight: +1, ArrowDown: -1, ArrowLeft: -1};
        let next;
        if (event.key in jumps) next = stepAngle(value, jumps[event.key], event.shiftKey);
        else if (event.key === 'PageUp') next = value + 45;
        else if (event.key === 'PageDown') next = value - 45;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 360;
        else if (event.key === 'Escape') { event.currentTarget.blur(); return; }
        else return;
        event.preventDefault();
        turn(next, false);
    };

    const tone = TONES.includes(axisOf(gate)) ? axisOf(gate) : 'plain';
    // The arc covers the angle within one turn; a full turn or more shows as full.
    const arc = Math.min(360, Math.abs(value));
    const style = {
        left: `${rect.x * zoom}px`,
        top: `${rect.y * zoom}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        transform: `scale(${zoom})`,
        '--arc': `${arc}deg`,
        '--knob-index': `var(--dial-${tone})`,
    };
    return <div {...bind()} ref={face} id={`wire-dial-${col}-${row}`} className="wire-dial" style={style}
        role="slider" tabIndex={0} aria-label={`${gate.name} angle, wire ${row + 1}, column ${col + 1}`}
        aria-valuenow={Math.round(value)} aria-valuetext={valid ? readoutDegrees(value) : 'a formula'}
        data-valid={valid} data-tone={tone} data-negative={value < 0} onKeyDown={onKeyDown}>
        <span className="wire-dial-index" aria-hidden="true" />
        <span className="wire-dial-core" aria-hidden="true" />
    </div>;
}
