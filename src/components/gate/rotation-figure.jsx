import { projectPoint } from "../../draw/displays/bloch/BlochScene.js";

/** The view the figure is drawn from: yawed and tilted so all three axes stay distinct. */
const YAW = Math.PI * -0.15;
const PITCH = Math.PI * 0.11;
/** Half the drawing's side, in its own units. The sphere fills most of it. */
const HALF = 60;
const RADIUS = 44;

/**
 * @param {!number} x
 * @param {!number} y
 * @param {!number} z
 * @returns {!{x: !number, y: !number, front: !boolean}} A point in the figure's coordinates.
 */
function project(x, y, z) {
  const { sx, sy, depth } = projectPoint(x, y, z, YAW, PITCH);
  // SVG's y grows downward, the sphere's z grows up.
  return { x: HALF + sx * RADIUS, y: HALF - sy * RADIUS, front: depth <= 0 };
}

/** @returns {!string} An SVG path for the ellipse a great circle projects to. */
function greatCirclePath(pointAt) {
  const steps = 96;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = project(...pointAt((i * Math.PI * 2) / steps));
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join("");
}

/**
 * The turn a one-qubit gate performs, drawn large enough to read: the Bloch sphere with its three
 * axes named, the axis the gate turns around drawn through it, and an arc around that axis showing
 * how far the turn goes and which way.
 *
 * The old tooltip drew this 65 pixels wide with no axis labels, which is the size at which a
 * rotation figure stops being a figure and becomes a smudge.
 *
 * @param {!{axis: !Array.<!number>, angle: !number}} props angle in radians.
 */
function RotationFigure({ axis, angle }) {
  const [ax, ay, az] = axis;
  const tip = project(ax, ay, az);
  const tail = project(-ax, -ay, -az);

  // The turn is drawn as a ring around the axis, swept from a start point by the actual angle, so a
  // quarter turn looks like a quarter of the ring.
  const basis = Math.abs(az) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(basis, axis));
  const v = cross(axis, u);
  const ringRadius = 0.62;
  const arcPoint = (t) =>
    project(
      ...[0, 1, 2].map(
        (i) => ringRadius * (u[i] * Math.cos(t) + v[i] * Math.sin(t)),
      ),
    );
  const steps = 48;
  const sweep = Array.from({ length: steps + 1 }, (_, i) => {
    const p = arcPoint((angle * i) / steps);
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join("");
  const head = arcPoint(angle);
  const justBefore = arcPoint(angle - Math.sign(angle || 1) * 0.16);

  const axisLabel = (vector, text) => {
    const p = project(...vector.map((e) => e * 1.22));
    return (
      <text key={text} x={p.x} y={p.y} className="rotation-figure-axis-label">
        {text}
      </text>
    );
  };

  return (
    <svg
      className="rotation-figure"
      viewBox={`0 0 ${HALF * 2} ${HALF * 2}`}
      role="img"
      aria-label={`Rotation of ${Math.round((angle * 180) / Math.PI)} degrees`}
    >
      <circle
        cx={HALF}
        cy={HALF}
        r={RADIUS}
        className="rotation-figure-sphere"
      />
      <path
        d={greatCirclePath((t) => [Math.cos(t), Math.sin(t), 0])}
        className="rotation-figure-guide"
      />
      <path
        d={greatCirclePath((t) => [Math.cos(t), 0, Math.sin(t)])}
        className="rotation-figure-guide"
      />

      {[
        [[1, 0, 0], "X"],
        [[0, 1, 0], "Y"],
        [[0, 0, 1], "Z"],
      ].map(([vector, text]) => (
        <g key={text}>
          <line
            x1={project(0, 0, 0).x}
            y1={project(0, 0, 0).y}
            x2={project(...vector).x}
            y2={project(...vector).y}
            className="rotation-figure-axis"
          />
          {axisLabel(vector, text)}
        </g>
      ))}

      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        className="rotation-figure-turn-axis"
      />
      <path d={sweep} className="rotation-figure-turn" />
      <line
        x1={justBefore.x}
        y1={justBefore.y}
        x2={head.x}
        y2={head.y}
        className="rotation-figure-turn-head"
        markerEnd="url(#rotation-arrow)"
      />
      <defs>
        <marker
          id="rotation-arrow"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path
            d="M0 0 L8 4 L0 8 z"
            className="rotation-figure-turn-head-fill"
          />
        </marker>
      </defs>
    </svg>
  );
}

/** @returns {!Array.<!number>} */
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** @returns {!Array.<!number>} */
function normalize(a) {
  const length = Math.hypot(...a);
  return length === 0 ? [1, 0, 0] : a.map((e) => e / length);
}

export { RotationFigure };
