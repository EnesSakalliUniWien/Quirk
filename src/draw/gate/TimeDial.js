import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Point } from "../../geometry/Point.js";
import { drawGraphics } from "../scene/DisplayView.js";
import { lineWidth } from "../shapes/ShapeView.js";

/** @typedef {import('../../geometry/Rect.js').Rect} Rect */

/**
 * Which axis a dial's gate turns about. Every face is round, so the angle read off it is the angle
 * the gate has come round; the axis is in the sector's colour, the hue that axis wears on its gates,
 * its controls and the Bloch sphere. Every face starts at twelve o'clock, and a gate's direction is
 * in its turnsAt.
 */
const DIAL_AXIS = Object.freeze({
  X: Object.freeze({ axis: "x" }),
  Y: Object.freeze({ axis: "y" }),
  Z: Object.freeze({ axis: "z" }),
});

/**
 * @param {undefined|!{axis: (undefined|!string)}} axis
 * @returns {!string} The sector's colour: the axis's hue, or t's own violet for a gate without one.
 */
function sectorColor(axis) {
  switch (axis?.axis) {
    case "x":
      return CanvasTheme.bloch.axisX;
    case "y":
      return CanvasTheme.bloch.axisY;
    case "z":
      return CanvasTheme.bloch.axisZ;
    default:
      return CanvasTheme.operation.fill;
  }
}

/** How finely a swept sector follows its face. */
const STEPS_PER_TURN = 64;

/**
 * A point on a dial's face a fraction of a turn round from twelve o'clock, from the face's centre,
 * in the canvas's own axes (y down). Positive turns go anticlockwise, the way the Time lane's clock
 * and every forward gate sweep; negative turns go the mirror way.
 *
 * @param {!number} turns
 * @param {!number} radius
 * @returns {!Point}
 */
function dialPoint(turns, radius) {
  const angle = turns * 2 * Math.PI;
  return new Point(-Math.sin(angle) * radius, -Math.cos(angle) * radius);
}

/**
 * The swept sector, the hand and the way it heads, for a dial `turns` round, from the face's centre.
 * Whole turns come off: a gate a full turn round stands where it stood at none, its hand at twelve.
 *
 * @param {!number} turns
 * @param {!number} radius
 * @returns {!{sector: !Array.<!Point>, hand: !Point, heading: !Point}} The sector's outline (empty
 *     at no turn), the hand's tip, and a unit vector along the face the way the hand moves on.
 */
function dialGeometry(turns, radius) {
  // A backward gate at no turn is -0 turns round, and still heads its own way.
  const direction = turns < 0 || Object.is(turns, -0) ? -1 : 1;
  const swept = Math.abs(turns) % 1;
  const steps = Math.ceil(swept * STEPS_PER_TURN);
  const sector =
    steps === 0
      ? []
      : [
          new Point(0, 0),
          ...Array.from({ length: steps + 1 }, (_, i) =>
            dialPoint((direction * swept * i) / steps, radius),
          ),
        ];
  const hand = dialPoint(direction * swept, radius);
  const ahead = dialPoint(direction * (swept + 1 / STEPS_PER_TURN), radius);
  const [dx, dy] = [ahead.x - hand.x, ahead.y - hand.y];
  const length = Math.hypot(dx, dy);
  return { sector, hand, heading: new Point(dx / length, dy / length) };
}

/**
 * The dial's face in circuit units, as a gate is 40 across: large enough to read as a clock, small
 * enough to keep off the superscripts of X^-t and Z^t, which come down to about 11 below the gate's
 * top. See dialPlacement for how far it may reach out.
 */
const DIAL_RADIUS = 7;

/** How far inside its gate's corner the dial's centre sits, so the gate's corner is under the face. */
const DIAL_INSET = 3;

/**
 * How much of text.primary the ring wears over the face. The face is the canvas's own colour, so
 * where the badge hangs over the canvas the ring alone says where it ends, and it needs 3:1 there
 * and on any tile the face does not set off. At this alpha it holds in both themes: 9.1:1 on the
 * dark canvas and 8.7:1 on the light one, 6.8:1 and 7.0:1 on a custom gate's tile, and 3.7:1 on Z's
 * light blue in the light theme. The tiles it cannot hold - Z's and Y's pale ones in the dark theme -
 * are the ones the dark face sets off by more than 6:1.
 */
const RING_ALPHA = 0.75;

/**
 * The hand's parts as fractions of the face's radius inside its ring, so the hand keeps its look at
 * any size. They were drawn for a face of 15 - a hand 1.5 wide on a halo 3.5, an arrowhead reaching
 * 2 past the hand's end, 4 back and 2.5 either side - and are a little heavier than that scaled
 * down, because a hand under a unit wide turns grey on a pale sector.
 */
const HAND = Object.freeze({
  width: 0.16,
  halo: 0.36,
  tip: 0.15,
  back: 0.33,
  across: 0.2,
});

/**
 * Where a gate's dial sits: a small badge on the top-right corner of the gate's whole rectangle,
 * its centre a little inside the corner. The dial is a status mark that belongs to its gate, so it
 * overlaps the gate instead of taking room in the gap its neighbours share, which stays the wire's
 * and keeps the columns' rhythm. A tall gate wears it on its top wire and a wide one at the edge of
 * its last column, wherever it is drawn: in the circuit, held, or previewed.
 *
 * The badge reaches 4 past the gate's right edge and 4 above its top, which is as far as the
 * circuit's own marks around a gate leave it: the playhead's band reaches 3 and the veil over the
 * columns still to run begins at 4, and the selection outline keeps 6 from a gate with a line 1.5
 * wide, thickening inward as the view zooms out. It is 20 short of a Bloch display in the next
 * column and 36 short of the next gate's tile. It is in circuit units, so it keeps these distances
 * at every zoom.
 *
 * @param {!Rect} rect The gate's whole rectangle.
 * @returns {!{center: !Point, radius: !number}} The face's centre, and its radius to its outer edge.
 */
function dialPlacement(rect) {
  return {
    center: new Point(rect.right() - DIAL_INSET, rect.y + DIAL_INSET),
    radius: DIAL_RADIUS,
  };
}

/**
 * The arrowhead at the hand's tip, drawn so that all of it stays inside the face: a barb that
 * reached past the rim would stick out of the badge, and out of its place on the gate.
 *
 * @param {!Point} hand The hand's tip on a face of this radius, from dialGeometry.
 * @param {!Point} heading The unit vector along the face the way the hand moves on.
 * @param {!number} radius The face's radius.
 * @returns {!{base: !Point, head: !Array.<!Point>}} Where the hand ends under the arrowhead, and
 *     the arrowhead's three corners: its point, then a barb either side of the way it heads.
 */
function dialArrowhead(hand, heading, radius) {
  const [tip, back, across] = [HAND.tip, HAND.back, HAND.across].map(
    (fraction) => fraction * radius,
  );
  // Along the face and across it at the hand's tip, exactly: the heading is a chord a step on, and
  // only on the true tangent does the outer barb land on the rim.
  const out = hand.times(1 / radius);
  const sideways = new Point(-out.y, out.x);
  const along = sideways.times(
    Math.sign(sideways.x * heading.x + sideways.y * heading.y),
  );
  // The outer barb lies back from the hand's end and across it, so the end comes in far enough
  // that the barb lands on the rim.
  const base = out.times(Math.sqrt(radius * radius - back * back) - across);
  const barb = (sign) =>
    base.minus(along.times(back)).plus(out.times(across * sign));
  return { base, head: [base.plus(along.times(tip)), barb(1), barb(-1)] };
}

/**
 * The dial of a time-dependent gate: a round clock face the size of a badge, on the gate's
 * top-right corner (see dialPlacement), with the fraction of a turn the gate has come round swept
 * as a sector in its axis's hue and a hand at the sector's edge. The face is opaque, in the
 * canvas's colour, so the gate's corner under it does not show through and it reads the same on
 * any tile, and its ring says where it ends over the canvas.
 *
 * The dial only shows the turns it is given, from the gate's own turnsAt: the gate's effect comes
 * from the same number, so the two can never disagree. The hand carries an arrowhead the way the
 * gate turns, so a paused gate at no turn still says which way it goes, and the wrap from a full
 * turn back to none reads as the hand passing twelve rather than the sector vanishing.
 *
 * A gate that is switched off, or disabled, draws no dial. The circuit dims it with a veil over its
 * own rectangle, which would cut the badge where it leaves the gate, and a gate that does nothing
 * has no turn to show.
 *
 * @param {!GateRenderParams} args
 * @param {!number} turns How far round the gate is, in turns; whole turns come off.
 * @param {undefined|!{axis: (undefined|!string)}=} axis Which axis the gate turns about; see
 *     DIAL_AXIS. Without one the sector takes t's own violet.
 */
function paintTimeDial(args, turns, axis = undefined) {
  // The stats of a gate drawn on its own may name no circuit, and then nothing disables it.
  const { positionInCircuit: at, stats } = args;
  if (
    args.gate.deactivated ||
    (at !== undefined &&
      stats.circuitDefinition?.gateAtLocIsDisabledReason(at.col, at.row) !==
        undefined)
  ) {
    return;
  }
  const { center, radius } = dialPlacement(args.rect);
  args.painter.group("cycle-" + args.painter.order, (painter) => {
    painter.position.set(center.x, center.y);
    // The ring is drawn inside the face's outer edge, so the badge reaches exactly its radius.
    const ring = lineWidth(painter, 1);
    // Inside the ring a channel of the face's own colour keeps the sector off it, so a pale sector
    // on a pale tile, Z's on Z's, still has the dark face round it.
    const inner = radius - 2 * ring;
    const { sector, hand, heading } = dialGeometry(turns, inner);
    const { base, head } = dialArrowhead(hand, heading, inner);
    drawGraphics(painter, (path) => {
      // The face, so the swept sector reads as a fraction of a whole turn.
      path.circle(0, 0, radius).fill(CanvasTheme.surface.background);
      if (sector.length > 0) {
        path.poly(sector.flatMap((p) => [p.x, p.y])).fill(sectorColor(axis));
      }
      path.circle(0, 0, radius - ring / 2).stroke({
        color: CanvasTheme.text.primary,
        width: ring,
        alpha: RING_ALPHA,
      });
      // A halo under the hand, so it reads on a pale sector as on the dark face.
      path
        .moveTo(0, 0)
        .lineTo(base.x, base.y)
        .stroke({
          color: CanvasTheme.surface.background,
          width: HAND.halo * inner,
        });
      path
        .moveTo(0, 0)
        .lineTo(base.x, base.y)
        .stroke({ color: CanvasTheme.text.primary, width: HAND.width * inner });
      path.poly(head.flatMap((p) => [p.x, p.y])).fill(CanvasTheme.text.primary);
    });
  });
}

export { paintTimeDial, dialGeometry, dialPlacement, dialArrowhead, DIAL_AXIS };
