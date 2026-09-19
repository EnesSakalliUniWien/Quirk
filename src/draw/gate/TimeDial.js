import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Layout} from '../../config/Layout.js';
import {Point} from '../../geometry/Point.js';
import {drawGraphics} from '../scene/DisplayView.js';
import {properMod} from '../../engine/math/modularArithmetic.js';

/**
 * The dial beside a time-dependent gate: a clock face as big as a gate, filling the column gap to
 * the gate's right, with the fraction of a turn the gate has come round swept as a sector. Outside
 * the circuit - held, or previewed - there is no beside, and it sits over the tile instead.
 *
 * The dial only shows the turns it is given, from the gate's own turnsAt: the gate's effect comes
 * from the same number, so the two can never disagree. Turns below zero sweep the other way round
 * the face, which is how a backward gate and its forward twin are told apart.
 *
 * @param {!GateRenderParams} args
 * @param {!number} turns How far round the gate is, in turns; whole turns come off.
 * @param {!{xScale: (undefined|!number), yScale: (undefined|!number), zeroAngle: (undefined|!number)}=} axis
 *     The face's shape, which says which axis the gate turns about: scales of less than one flatten
 *     it to an ellipse, and zeroAngle turns it, in radians. Never the direction, which is the turns'.
 */
function paintTimeDial(args, turns, {xScale = 1, yScale = 1, zeroAngle = 0} = {}) {
    const swept = properMod(-Math.abs(turns) * 2 * Math.PI, 2 * Math.PI);
    // Sweeping the other way is the face mirrored, so a pair of opposite gates are mirror images.
    const direction = turns < 0 ? -1 : 1;
    const r = Layout.GATE_RADIUS - 1;
    const c = args.positionInCircuit === undefined ?
        args.rect.center() :
        new Point(args.rect.right() + Layout.GATE_RADIUS, args.rect.center().y);

    args.painter.group('cycle-' + args.painter.order, painter => {
        painter.position.set(c.x, c.y);
        painter.scale.set(-xScale * direction, -yScale);
        painter.alpha = args.positionInCircuit === undefined ? 0.4 : 0.9;
        painter.group('angle', painter => {
            painter.rotation = zeroAngle;
            drawGraphics(painter, path => {
                // The face, so the swept sector reads as a fraction of a whole turn.
                path.circle(0, 0, r).stroke({color: CanvasTheme.text.primary, width: 1, alpha: 0.5});
                path.moveTo(0, 0);
                path.lineTo(0, r);
                path.arc(0, 0, r, Math.PI / 2, Math.PI / 2 + swept, true);
                path.lineTo(0, 0);
                path.closePath();
                path.stroke({color: CanvasTheme.text.primary, width: 1}).fill(CanvasTheme.operation.fill);
            });
        });
    });
}

/**
 * The face of a dial for a gate that turns about each axis: the X face is round, and the Y and Z
 * faces are flattened along the axis they turn about, so which one a gate turns about is read off
 * its dial. These are the shapes alone; a gate's direction is in its turnsAt.
 */
const DIAL_AXIS = Object.freeze({
    X: Object.freeze({xScale: 1, yScale: 1}),
    Y: Object.freeze({xScale: 0.5, yScale: 1}),
    Z: Object.freeze({xScale: -1, yScale: -0.5}),
});

export {paintTimeDial, DIAL_AXIS};
