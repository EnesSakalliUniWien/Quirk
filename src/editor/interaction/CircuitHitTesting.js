/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Layout } from "../../config/Layout.js";
/** @typedef {import("./PointerInteractionState.js").PointerInteractionState} PointerInteractionState */
/** @typedef {import("../../geometry/Rect.js").Rect} Rect */
import {
  CIRCUIT_OP_HORIZONTAL_SPACING,
  CIRCUIT_OP_LEFT_SPACING,
} from "../geometry/CircuitLayoutConstants.js";

/**
 * Maps a position on the canvas back to what is under it: a wire, a column, a gate, a resize
 * tab. Pure geometry queries also support editing previews without a mounted scene.
 */

/**
 * @param {!CircuitGeometry} geometry
 * @param {!number} y
 * @returns {!int}
 */
function wireIndexAt(geometry, y) {
  return Math.floor((y - geometry.top) / Layout.WIRE_SPACING);
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!number} x
 * @returns {!number} The continuous column-space coordinate corresponding to the given display-space coordinate.
 */
function toColumnSpaceCoordinate(geometry, x) {
  const spacing = CIRCUIT_OP_HORIZONTAL_SPACING + Layout.GATE_RADIUS * 2;
  const left = geometry.gutterLeft() + CIRCUIT_OP_LEFT_SPACING - CIRCUIT_OP_HORIZONTAL_SPACING / 2;
  return (x - left) / spacing - 0.5;
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!number} y
 * @returns {undefined|!int}
 */
function indexOfDisplayedRowAt(geometry, y) {
  const i = Math.floor((y - geometry.top) / Layout.WIRE_SPACING);
  if (i < 0 || i >= geometry.circuitDefinition.numWires) {
    return undefined;
  }
  return i;
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!number} x
 * @returns {undefined|!int}
 */
function indexOfDisplayedColumnAt(geometry, x) {
  const col = toColumnSpaceCoordinate(geometry, x);
  const compressedColumnIndex = geometry.compressedColumnIndex;
  let i;
  if (
    compressedColumnIndex === undefined ||
    col < compressedColumnIndex - 0.75
  ) {
    i = Math.round(col);
  } else if (col < compressedColumnIndex - 0.25) {
    i = compressedColumnIndex;
  } else {
    i = Math.round(col) - 1;
  }

  if (i < 0 || i >= geometry.circuitDefinition.columns.length) {
    return undefined;
  }

  return i;
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!Point} p
 * @returns {undefined|!number}
 */
function findOpHalfColumnAt(geometry, p) {
  if (
    p.x < 0 ||
    p.y < geometry.top ||
    p.y > geometry.top + geometry.desiredHeight()
  ) {
    return undefined;
  }

  return Math.max(
    -0.5,
    Math.round(toColumnSpaceCoordinate(geometry, p.x) * 2) / 2,
  );
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!Point} pos
 * @returns {undefined|!{col: !int, row: !int, offset: !Point}}
 */
function findGateOverlappingPos(geometry, pos) {
  const col = indexOfDisplayedColumnAt(geometry, pos.x);
  const row = indexOfDisplayedRowAt(geometry, pos.y);
  if (col === undefined || row === undefined) {
    return undefined;
  }

  const target = geometry.circuitDefinition.findGateCoveringSlot(col, row);
  if (target === undefined) {
    return undefined;
  }

  const gateRect = geometry.gateRect(
    target.row,
    target.col,
    target.gate.width,
    target.gate.height,
  );
  if (
    !geometry
      .gateDrawRect(target.row, target.col, target.gate)
      .containsPoint(pos)
  ) {
    return undefined;
  }

  return {
    col: target.col,
    row: target.row,
    offset: pos.minus(gateRect.topLeft()),
};
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!int} wire
 * @returns {!Rect}
 */
function wireInitialStateClickableRect(geometry, wire) {
  return geometry.wireInitialStateRect(wire);
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!Point} pt
 * @returns {undefined|!int}
 */
function findWireWithInitialStateAreaContaining(geometry, pt) {
  // Which wire is it? Is it one that's actually in the circuit?
  const wire = wireIndexAt(geometry, pt.y);
  if (wire < 0 || wire >= geometry.circuitDefinition.numWires) {
    return undefined;
  }

  // Is it inside the intended click area, instead of just off to the side?
  const r = wireInitialStateClickableRect(geometry, wire);
  if (!r.containsPoint(pt)) {
    return undefined;
  }

  // Good to go.
  return wire;
}

export {
  wireIndexAt,
  toColumnSpaceCoordinate,
  indexOfDisplayedRowAt,
  findOpHalfColumnAt,
  findGateOverlappingPos,
  findWireWithInitialStateAreaContaining,
  };
