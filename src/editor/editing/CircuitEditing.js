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

import { highlightStatusAt } from "../interaction/CircuitHighlightStatus.js";

import {
  findGateOverlappingPos,
  findOpHalfColumnAt,
  findWireWithInitialStateAreaContaining,
  toColumnSpaceCoordinate,
  wireIndexAt,
} from "../interaction/CircuitHitTesting.js";
import {
  previewDropMovedGate,
  tryGrabGate,
} from "./gates/GatePlacement.js";
import {
  previewResizedGate,
  tryGrabResizeTab,
} from "./gates/GateResizing.js";
import {
  previewDropMovedGateColumn,
  tryGrabWholeColumn,
} from "./columns/ColumnEditing.js";
import { previewDropMovedRow, tryGrabRow } from "./wires/RowEditing.js";
import { withJustEnoughWires as wireCountEdit } from "./wires/WireCount.js";
import {
  previewNewRegister,
  tryStartWireSelection,
} from "./registers/RegisterSelection.js";

/** Captures read-only inputs and existing hit-test queries without exposing the editor object. */
function editingContext(circuit) {
  return {
    definition: circuit.circuitDefinition,
    geometry: circuit.geometry(),
    wireIndexAt: (y) => wireIndexAt(circuit.geometry(), y),
    findOpHalfColumnAt: (pos) => findOpHalfColumnAt(circuit.geometry(), pos),
    toColumnSpaceCoordinate: (x) => toColumnSpaceCoordinate(circuit.geometry(), x),
    findGateOverlappingPos: (pos) => findGateOverlappingPos(circuit.geometry(), pos),
    highlightStatusAt: (col, row, points) =>
      highlightStatusAt(
        {
          definition: circuit.circuitDefinition,
          geometry: circuit.geometry(),
          highlightedSlot: circuit._highlightedSlot,
          findGateAt: (pos) => findGateOverlappingPos(circuit.geometry(), pos),
        },
        col,
        row,
        points,
      ),
  };
}

/**
 * Applies an edit through the displayed circuit's existing immutable updates.
 * Omitted fields preserve state; explicitly present undefined fields clear a drag marker.
 * The optional hand field is consumed by tryGrab, not by this adapter.
 */
function applyEdit(circuit, edit) {
  return circuit.withEdit(edit);
}

/**
 * Returns the circuit preview for the current hand operation without committing it.
 *
 * @param {!CircuitViewState} circuit
 * @param {!PointerInteractionState} hand
 * @returns {!CircuitViewState}
 */
function previewDrop(circuit, hand) {
  const context = editingContext(circuit);
  const previews = {
    'select-wires': previewNewRegister,
    row: previewDropMovedRow,
    column: previewDropMovedGateColumn,
    gate: previewDropMovedGate,
    resize: previewResizedGate
  };
  return applyEdit(circuit, previews[hand.operation.type]?.(context, hand));
}

/**
 * Finalizes the same preview and clears its temporary column compression.
 *
 * @param {!CircuitViewState} circuit
 * @param {!PointerInteractionState} hand
 * @returns {!CircuitViewState}
 */
function afterDropping(circuit, hand) {
  return previewDrop(circuit, hand)._withCompressedColumnIndex(undefined);
}

/**
 * Adjusts temporary wires for an editing operation.
 *
 * @param {!CircuitViewState} circuit
 * @param {!int} extraWireCount
 * @returns {!CircuitViewState}
 */
function withJustEnoughWires(circuit, extraWireCount) {
  return applyEdit(
    circuit,
    wireCountEdit(editingContext(circuit), extraWireCount),
  );
}

/**
 * Clicks switch initial states; parameter-panel clicks are handled by the pointer controller.
 *
 * @param {!CircuitViewState} circuit
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!CircuitViewState}
 */
function tryClick(circuit, hand) {
  if (hand.pos === undefined || hand.heldGate !== undefined) return undefined;
  const wire = findWireWithInitialStateAreaContaining(circuit.geometry(), hand.pos);
  return wire === undefined
    ? undefined
    : circuit.withCircuit(
        circuit.circuitDefinition.withSwitchedInitialStateOn(wire),
      );
}

/**
 * Dispatches a grab and adapts its definition, drag markers and hand to the public result.
 *
 * @param {!CircuitViewState} circuit
 * @param {!PointerInteractionState} hand
 * @param {!boolean=false} duplicate
 * @param {!boolean=false} wholeColumn
 * @param {!boolean=false} ignoreResizeTabs
 * @param {!boolean=false} alt Whether or not to replace grabbed gates with their alternates.
 * @returns {!{newCircuit: !CircuitViewState, newHand: !PointerInteractionState}}
 */
function tryGrab(
  circuit,
  hand,
  duplicate = false,
  wholeColumn = false,
  ignoreResizeTabs = false,
  alt = false,
) {
  const context = editingContext(circuit);
  let edit;
  if (wholeColumn) {
    edit =
      tryGrabRow(context, hand, alt) ??
      tryGrabWholeColumn(context, hand, duplicate, alt);
  } else {
    edit = tryStartWireSelection(context, hand);
    if (edit === undefined && !ignoreResizeTabs)
      edit = tryGrabResizeTab(context, hand);
    // A selected wire or grabbed resize tab already makes the hand busy.
    if (edit === undefined) edit = tryGrabGate(context, hand, duplicate, alt);
  }
  return { newCircuit: applyEdit(circuit, edit), newHand: edit?.hand ?? hand };
}

export { previewDrop, afterDropping, withJustEnoughWires, tryClick, tryGrab };

/** Normalize the definition and clear temporary markers in one immutable update. */
export function tidyCircuit(circuit) {
  return circuit.withEdit({
    definition: circuit.circuitDefinition.withUncoveredColumnsRemoved().withHeightOverlapsFixed()
      .withWidthOverlapsFixed().withUncoveredColumnsRemoved().withTrailingSpacersIncluded(),
    compressedColumnIndex: undefined, highlightedSlot: undefined, extraWireStartIndex: undefined
  });
}
