import {Suite, assertThat} from '../../TestUtil.js';
import {CanvasTheme} from '../../../src/config/CanvasTheme.js';
import {Layout} from '../../../src/config/Layout.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {DIAL_AXIS, dialArrowhead, dialGeometry, dialPlacement, paintTimeDial} from '../../../src/draw/gate/TimeDial.js';

const suite = new Suite("TimeDial");

suite.test("every face is round and starts at twelve o'clock, so the angle read is the angle turned", () => {
    assertThat(Object.keys(DIAL_AXIS)).isEqualTo(['X', 'Y', 'Z']);
    const {sector, hand} = dialGeometry(0, 10);
    assertThat(sector).isEqualTo([]);
    assertThat(hand.x).isApproximatelyEqualTo(0);
    assertThat(hand.y).isApproximatelyEqualTo(-10);
    // An eighth of a turn is 45° on the face, not bent by a squashed one.
    const eighth = dialGeometry(0.125, 10).hand;
    assertThat(Math.atan2(-eighth.x, -eighth.y) * 180 / Math.PI).isApproximatelyEqualTo(45);
});

suite.test("forward turns sweep anticlockwise and backward ones the mirror way, even at no turn", () => {
    // A quarter turn stands at nine o'clock forward and three o'clock backward.
    assertThat(dialGeometry(0.25, 10).hand.x).isApproximatelyEqualTo(-10);
    assertThat(dialGeometry(-0.25, 10).hand.x).isApproximatelyEqualTo(10);
    // At twelve, the hand heads left going forward and right going back: -0 is a backward gate's.
    assertThat(dialGeometry(0, 10).heading.x < -0.9).isEqualTo(true);
    assertThat(dialGeometry(-0, 10).heading.x > 0.9).isEqualTo(true);
});

suite.test("whole turns come off, so a full turn stands where none did", () => {
    const full = dialGeometry(1, 10);
    assertThat(full.sector).isEqualTo([]);
    assertThat(full.hand.y).isApproximatelyEqualTo(-10);
    assertThat(dialGeometry(1.25, 10).hand.x).isApproximatelyEqualTo(dialGeometry(0.25, 10).hand.x);
    // The sector closes on the centre and runs to the hand.
    const {sector, hand} = dialGeometry(0.4, 10);
    assertThat([sector[0].x, sector[0].y]).isEqualTo([0, 0]);
    assertThat(sector.at(-1).x).isApproximatelyEqualTo(hand.x);
    assertThat(sector.at(-1).y).isApproximatelyEqualTo(hand.y);
});

const GATE = 2 * Layout.GATE_RADIUS;
/** One gate's rectangle, then a tall one, a wide one, and one both tall and wide, as the circuit lays them out. */
const GATE_RECTS = Object.freeze({
    single: new Rect(100.5, 50.5, GATE, GATE),
    tall: new Rect(100.5, 50.5, GATE, GATE + 2 * Layout.WIRE_SPACING),
    wide: new Rect(100.5, 50.5, GATE + Layout.COLUMN_SPACING, GATE),
    both: new Rect(100.5, 50.5, GATE + Layout.COLUMN_SPACING, GATE + Layout.WIRE_SPACING),
});

suite.test("the dial is a badge on its gate's top-right corner, however tall or wide the gate is", () => {
    for (const rect of Object.values(GATE_RECTS)) {
        const {center, radius} = dialPlacement(rect);
        // The corner of the whole rectangle: on a tall gate's top wire, at a wide gate's last column.
        assertThat([center.x - rect.right(), center.y - rect.y]).isEqualTo([-3, 3]);
        // Past the gate it reaches 4 right and 4 up. The playhead's band reaches 3 beyond a gate and the
        // veil over the columns still to run begins at 4, so neither cuts it; the selection outline, 6
        // out with a line 1.5 wide, stays clear of it too.
        assertThat(center.x + radius - rect.right()).isApproximatelyEqualTo(4);
        assertThat(rect.y - (center.y - radius)).isApproximatelyEqualTo(4);
        // The superscripts of X^-t and Z^t come down to about 11 below the gate's top, so a face
        // that reaches further in touches them.
        assertThat(center.y + radius - rect.y <= 10).isEqualTo(true);
        assertThat(radius <= 8).isEqualTo(true);
    }
});

suite.test("the dial leaves the gap after its gate to the wire, clear of a Bloch display and the next tile", () => {
    const rect = GATE_RECTS.single;
    const {center, radius} = dialPlacement(rect);
    const reach = center.x + radius - rect.right();
    const gap = Layout.COLUMN_SPACING - GATE;
    const blochGap = gap - (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN - Layout.GATE_RADIUS);
    assertThat(blochGap - reach).isApproximatelyEqualTo(20);
    assertThat(gap - reach).isApproximatelyEqualTo(36);
    // Nor does it come down to the wire, which runs through the gate's middle.
    assertThat(center.y + radius < rect.center().y).isEqualTo(true);
});

suite.test("the arrowhead stays inside the face, whichever way the hand points and turns", () => {
    for (let i = -40; i <= 40; i++) {
        const radius = 7;
        const {hand, heading} = dialGeometry(i / 16, radius);
        const {base, head} = dialArrowhead(hand, heading, radius);
        for (const corner of head) {
            assertThat(Math.hypot(corner.x, corner.y) < radius + 1e-9).isEqualTo(true);
        }
        // The hand ends on its own line, short of the rim, and the arrowhead's point is ahead of it.
        assertThat(Math.hypot(base.x, base.y) < radius).isEqualTo(true);
        assertThat(base.x * hand.y - base.y * hand.x).isApproximatelyEqualTo(0);
        assertThat((head[0].x - base.x) * heading.x + (head[0].y - base.y) * heading.y > 0).isEqualTo(true);
    }
});

/**
 * @param {!{deactivated: !boolean}} gate
 * @param {undefined|!{row: !int, col: !int}} positionInCircuit
 * @param {!{lineScale: (undefined|!number), disabledReason: (undefined|!string)}=} options What the
 *     painter's lines are scaled by, and why the circuit disables the gate's slot, if it does.
 * @returns {!{placed: !Array, drawn: !Array, child: !Object}} What paintTimeDial asked of a stand-in painter.
 */
function paintedDial(gate, positionInCircuit, {lineScale = 1, disabledReason = undefined} = {}) {
    const placed = [];
    const drawn = [];
    const child = {position: {set: (x, y) => placed.push([x, y])}, lineScale, add: (_, props) => drawn.push(props.commands)};
    const painter = {order: 0, group: (_, draw) => draw(child)};
    const stats = {circuitDefinition: {gateAtLocIsDisabledReason: () => disabledReason}};
    paintTimeDial({painter, gate, stats, rect: GATE_RECTS.single, positionInCircuit}, 0.3, DIAL_AXIS.Z);
    return {placed, drawn, child};
}

suite.test("a gate in the circuit, held or previewed wears the same dial, whole, on its corner", () => {
    const {center} = dialPlacement(GATE_RECTS.single);
    for (const position of [{row: 0, col: 1}, undefined]) {
        const {placed, drawn, child} = paintedDial({deactivated: false}, position);
        assertThat(placed).isEqualTo([[center.x, center.y]]);
        assertThat(drawn.length).isEqualTo(1);
        // Nothing dims it, so the face covers the corner under it whole.
        assertThat(child.alpha).isEqualTo(undefined);
        assertThat(drawn[0].slice(0, 4)).isEqualTo(['circle', [0, 0, 7], 'fill', [CanvasTheme.surface.background]]);
    }
});

suite.test("the ring is drawn inside the face's edge, so the badge reaches its radius at every zoom", () => {
    for (const lineScale of [1, 1.25, 2]) {
        const {drawn} = paintedDial({deactivated: false}, {row: 0, col: 1}, {lineScale});
        const commands = drawn[0];
        const ring = commands.indexOf('circle', 2);
        const [, , radius] = commands[ring + 1];
        const {width, alpha} = commands[commands.indexOf('stroke', ring) + 1][0];
        assertThat(radius + width / 2).isApproximatelyEqualTo(7);
        assertThat(width).isApproximatelyEqualTo(lineScale);
        // Enough of text.primary to hold 3:1 against the canvas and the tiles; see RING_ALPHA.
        assertThat(alpha).isEqualTo(0.75);
    }
});

suite.test("a gate switched off, or disabled, draws no dial, which the circuit's veil over its rectangle would cut", () => {
    for (const [gate, position, disabledReason] of [
        [{deactivated: true}, {row: 0, col: 1}, 'off'],
        [{deactivated: true}, undefined, undefined],
        [{deactivated: false}, {row: 0, col: 1}, 'control inside'],
    ]) {
        const {placed, drawn} = paintedDial(gate, position, {disabledReason});
        assertThat(placed).isEqualTo([]);
        assertThat(drawn).isEqualTo([]);
    }
});
