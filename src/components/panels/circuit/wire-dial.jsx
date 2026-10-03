import {memo, useEffect, useMemo, useReducer, useRef} from 'react';
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
export function WireDials({host}) {
    const deps = useStore(appStore, s => s.panelDeps);
    const actions = useStore(appStore, s => s.gateActions);
    return deps === undefined || actions === undefined ? null : <CircuitDials deps={deps} actions={actions} host={host} />;
}

/** @param {{host: (undefined|!{current: (null|!HTMLElement)})}} props host is the scroll container, found by its id when not given. */
function CircuitDials({deps, actions, host}) {
    const zoom = useStore(appStore, s => s.zoom);
    // The circuit and whether the hand is busy, not the whole state: its hand moves with every mouse
    // move over the canvas, and the dials stay where they are. The circuit's identity holds while
    // only the hand moves.
    const circuit = useStore(deps.displayed, s => s.value.displayedCircuit);
    const busy = useStore(deps.displayed, s => s.value.hand.isBusy());
    // The circuit centres in the cell, so a resized cell moves the dials without a new state.
    const [resized, resize] = useReducer(n => n + 1, 0);
    useEffect(() => {
        const observer = new ResizeObserver(resize);
        observer.observe(host?.current ?? document.getElementById('canvasDiv'));
        return () => observer.disconnect();
    }, [host]);
    return useMemo(() => {
        // A held gate is out of the circuit, so its dial waits until it is put down.
        if (busy) {
            return null;
        }
        const geometry = deps.syncArea(deps.displayed.getState().value).displayedCircuit.geometry();
        const dials = [];
        circuit.circuitDefinition.columns.forEach((column, col) => column.gates.forEach((gate, row) => {
            if (gate?.hasAngleDial()) {
                const rect = geometry.dialRect(row, col, gate);
                dials.push(<Dial key={`${col}:${row}`} col={col} row={row} gate={gate}
                    left={rect.x} top={rect.y} width={rect.w} height={rect.h} zoom={zoom} actions={actions} />);
            }
        }));
        return dials;
        // resized is the cell's size, which syncArea reads.
    }, [deps, actions, circuit, busy, zoom, resized]);
}

/**
 * A flat encoder seen from above: a pale face, a dark core, and an arc from the top round to the
 * angle - anticlockwise for a positive one, by the right-hand rule the time dials keep, clockwise
 * for a negative one - in the axis's tone. Turn it by dragging round, by the wheel, or by the arrow keys, and the gate takes
 * the angle it lands on - each step shown at once, the whole turn one commit once it settles. It
 * reads the gate's angle, so an angle typed into the panel turns the dial too; while the parameter
 * is not a constant angle the dial rests where it was.
 *
 * Interaction is @use-gesture's drag: pointer capture, touch and mouse alike, with taps ignored.
 * It renders again only when its gate, its place or the zoom changes, not with every render of the
 * dials, and parses the gate's angle only when that changes.
 */
const Dial = memo(function Dial({col, row, gate, left, top, width, height, zoom, actions}) {
    const degrees = useMemo(() => {
        try { return parseAngleExpression(String(gate.param)).degrees; } catch { return undefined; }
    }, [gate.param]);
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
        // The pointer's bearing from the face's centre; the dial turns by its change. The screen's y
        // runs down, so a bearing that grows is a clockwise drag: the angle grows the other way.
        const box = face.current.getBoundingClientRect();
        const bearing = Math.atan2(y - (box.top + box.height / 2), x - (box.left + box.width / 2)) * 180 / Math.PI;
        if (first) return {bearing, value: resting.current};
        const turned = -(((bearing - memo.bearing + 540) % 360) - 180);
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
        left: `${left * zoom}px`,
        top: `${top * zoom}px`,
        width: `${width}px`,
        height: `${height}px`,
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
});
