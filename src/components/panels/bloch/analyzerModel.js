import {
  MIXED_NOTE,
  UNDEFINED_TEXT,
  analyzerReadout,
  blochReading,
  pureStateText,
} from "../../../engine/math/bloch.js";

/**
 * The Bloch analyzer's model: its types, its fixed choices, and the pure functions that turn the
 * app's state into what the panel shows. Nothing here renders or touches the DOM, so each piece
 * can be read, and tested, on its own.
 */

/**
 * @typedef {{ row: number, col: (number | undefined) }} BlochTarget The sphere the analyzer was
 *     opened for: a Bloch gate at {row, col}, or a wire's output at {row}.
 * @typedef {{ x: number, y: number, z: number }} BlochVector
 * @typedef {{ kind: "circuit" }
 *     | { kind: "step", index: number }
 *     | { kind: "explore", vec: BlochVector, preset: (string | undefined) }} ViewMode Which state
 *     is shown: the one opened for, one of the circuit's earlier steps, or a free one explored.
 * @typedef {{ circles: boolean, grid: boolean, components: boolean, planes: boolean,
 *     angles: boolean, quaternion: boolean, trig: boolean }} Layers The constructions drawn.
 * @typedef {{ vec: (BlochVector | undefined), label: string }} Step The qubit after one column,
 *     and the gates that column holds.
 * @typedef {ReturnType<typeof analyzerReadout> & { state: string, thetaDegrees: number,
 *     phiDegrees: number }} PanelReadout Everything the readout prints, and the angles the
 *     controls hold.
 * @typedef {{ theta: number, phi: number, thetaDefined: boolean, phiDefined: boolean }} Angles
 *     The angles in degrees, and whether each exists for the state shown.
 */

/** Above this length the state is pure enough to name as a ket. */
const PURE_STATE_THRESHOLD = 0.999;

/** How long a preset takes to arrive, in milliseconds. */
const PRESET_TRANSITION = 300;

/**
 * What a fresh reading draws: the components against the coloured frame. The constructions that
 * answer a narrower question - the planes, and the turn the quaternion names - are switched on when
 * they are the question, because all of them at once is a thicket rather than a diagnosis.
 * @type {Layers}
 */
const INITIAL_LAYERS = {
  circles: true,
  grid: false,
  components: true,
  planes: false,
  angles: true,
  quaternion: false,
  trig: false,
};

/** @type {Array<[keyof Layers, string]>} Each layer's switch, in the order they are offered. */
const LAYERS = [
  ["components", "Components"],
  ["planes", "Planes"],
  ["angles", "Angles θ ϕ"],
  ["quaternion", "Quaternion"],
  ["circles", "Unit circles"],
  ["grid", "Grid 30°"],
  ["trig", "cos · sin"],
];

/** @type {Array<[string, string]>} Each axis, with the two kets at its poles. */
const AXES = [
  ["x", "|+⟩ |−⟩"],
  ["y", "|+i⟩ |−i⟩"],
  ["z", "|0⟩ |1⟩"],
];

/**
 * The single-qubit state the panel was opened for, or undefined if that sphere has gone: an undo
 * or a URL change can remove it underneath the panel, and showing some other slot's state would be
 * worse than closing.
 *
 * @param {!Object} deps
 * @param {BlochTarget} target
 * @returns {undefined|!import("../../../engine/math/matrix/Matrix.js").Matrix}
 */
function densityMatrixOf(deps, target) {
  const result = deps.completed.getState().value;
  if (result === undefined) return undefined;
  const circuitDefinition = result.circuit;
  const stats = result.fullStats;
  if (target.col !== undefined) {
    const gate = circuitDefinition.gateInSlot(target.col, target.row);
    if (gate === undefined || gate.serializedId !== "Bloch") {
      return undefined;
    }
    return stats.qubitDensityMatrix(target.col, target.row);
  }
  if (
    target.row >=
    deps.displayed.getState().value.displayedCircuit.importantWireCount()
  ) {
    return undefined;
  }
  return stats.qubitDensityMatrix(Infinity, target.row);
}

/**
 * @param {ViewMode} mode
 * @param {BlochTarget | undefined} target
 * @returns {string} The line under the title: whose state is shown, and from where.
 */
function subtitleFor(mode, target) {
  if (mode.kind === "explore") {
    return "Exploring a free state — not from the circuit";
  }
  if (target === undefined) {
    return "Click a Bloch sphere in the circuit.";
  }
  const qubit = `Qubit ${target.row + 1} · `;
  if (mode.kind === "step") {
    return (
      qubit +
      (mode.index === 0
        ? "before the first column"
        : `after column ${mode.index}`)
    );
  }
  return (
    qubit +
    (target.col === undefined
      ? "final output state"
      : `at column ${target.col + 1}`)
  );
}

/**
 * @param {BlochVector} vec
 * @returns {PanelReadout}
 */
function panelReadout(vec) {
  const reading = blochReading(vec);
  const toDegrees = (radians) => (radians * 180) / Math.PI;
  return {
    ...analyzerReadout(vec),
    // On the z axis ϕ is only a global phase, so the ket takes it as zero.
    state:
      reading.rule === "mixed"
        ? MIXED_NOTE
        : reading.r > PURE_STATE_THRESHOLD
          ? pureStateText(reading.theta ?? 0, reading.phi ?? 0)
          : "mixed — |r| < 1 (entangled or decohered)",
    thetaDegrees: reading.theta === undefined ? 0 : toDegrees(reading.theta),
    phiDegrees:
      reading.phi === undefined ? 0 : (toDegrees(reading.phi) + 360) % 360,
  };
}

/**
 * @param {PanelReadout | null | undefined} readout
 * @returns {Angles} What the angle controls hold; with nothing shown, both are undefined.
 */
function anglesOf(readout) {
  if (readout === null || readout === undefined) {
    return { theta: 0, phi: 0, thetaDefined: false, phiDefined: false };
  }
  return {
    theta: readout.thetaDegrees,
    phi: readout.phiDegrees,
    thetaDefined: readout.theta !== UNDEFINED_TEXT,
    phiDefined: readout.phi !== UNDEFINED_TEXT,
  };
}

export {
  PRESET_TRANSITION,
  INITIAL_LAYERS,
  LAYERS,
  AXES,
  densityMatrixOf,
  subtitleFor,
  panelReadout,
  anglesOf,
};
