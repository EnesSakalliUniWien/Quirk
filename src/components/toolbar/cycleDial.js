/** The t clock's dial is as big as a lucide icon: a 16-unit box with a face of this radius. */
const DIAL_RADIUS = 7;

/**
 * The swept sector of the t clock's dial at a phase, the way the canvas draws an X^t gate's: from
 * twelve o'clock, anticlockwise, a whole face at a whole turn.
 *
 * @param {!number} t The phase; whole turns come off, and below zero wraps round.
 * @returns {!string} An SVG path, empty at no turn at all.
 */
function sectorPath(t) {
  const turns = ((t % 1) + 1) % 1;
  if (turns === 0) {
    return "";
  }
  const angle = turns * 2 * Math.PI;
  const x = +(-DIAL_RADIUS * Math.sin(angle)).toFixed(3);
  const y = +(-DIAL_RADIUS * Math.cos(angle)).toFixed(3);
  const large = turns > 0.5 ? 1 : 0;
  return `M0 0V${-DIAL_RADIUS}A${DIAL_RADIUS} ${DIAL_RADIUS} 0 ${large} 0 ${x} ${y}Z`;
}

export { DIAL_RADIUS, sectorPath };
