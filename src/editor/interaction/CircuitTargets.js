import {Rectangle} from 'pixi.js';
import {gateButtonRect, rectForResizeTab} from '../../draw/gate/GateRects.js';
import {CircuitGeometry} from '../geometry/CircuitGeometry.js';

/** Semantic targets use the same geometry as rendering; Pixi owns containment and ordering. */
export function renderCircuitTargets(view, {definition, geometry}, hand) {
    const activeCursor = hand.isHoldingSomething() ? 'move' : hand.isBusy() ? 'ns-resize' : undefined;
    const target = (key, rect, data, cursor = 'pointer') => view.add('pixiSceneContainer', {
        eventMode: 'static', hitArea: new Rectangle(rect.x, rect.y, rect.w, rect.h),
        circuitTarget: data, cursor: activeCursor ?? cursor
    }, key);
    for (let row = 0; row < definition.numWires; row++) {
        const label = geometry.wireIndexRect(row);
        target(`wire-${row}`, {x: 0, y: label.y, w: label.right(), h: label.h},
            {type: 'wire', row}, 'ns-resize');
        target(`initial-${row}`, geometry.wireInitialStateRect(row), {type: 'initial', row});
    }
    // Register gaps are interactive too. Initial-state kets remain outside these rectangles.
    for (const register of definition.registers.list) {
        const rect = geometry.registerNameRect(register.start, register.length);
        target(`register-${register.start}-${register.length}`, {...rect, w: geometry.wireIndexRect(register.start).right()},
            {type: 'register', row: register.start});
    }
    for (let col = 0; col < definition.columns.length; col++) {
        for (let row = 0; row < definition.numWires; row++) {
            const gate = definition.columns[col].gates[row];
            if (!gate) continue;
            const rect = geometry.gateDrawRect(row, col, gate);
            target(`gate-${col}-${row}`, rect, {type: 'gate', col, row, gate});
            if (gate.canChangeInSize()) target(`resize-${col}-${row}`, rectForResizeTab(rect),
                {type: 'resize', col, row, gate}, 'ns-resize');
            if (gate.paramDialog) target(`button-${col}-${row}`,
                gateButtonRect(geometry.gateRect(row, col, CircuitGeometry.drawnWidth(gate), gate.height)),
                {type: 'button', col, row, gate});
        }
    }
    const col = geometry.clampedCircuitColCount() + 2;
    for (let row = 0; row < geometry.importantWireCount(); row++) {
        target(`bloch-${row}`, CircuitGeometry.blochDisplayRect(geometry.gateRect(row, col)),
            {type: 'bloch', row});
    }
}
