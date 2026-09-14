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

import {circuitInArea, inspectorDesiredHeight} from "../geometry/InspectorLayout.js";

import { Layout } from "../../config/Layout.js";
import { CircuitViewState } from "./CircuitViewState.js";
import { PointerInteractionState } from "../interaction/PointerInteractionState.js";

import { Rect } from "../../geometry/Rect.js";
import { Serializer } from "../../serialization/Serializer.js";

/** Immutable editor snapshot; layout and rendering have separate owners. */
class EditorState {
  /**
   * @param {!Rect} drawArea
   * @param {!CircuitViewState} circuit
   * @param {!PointerInteractionState} hand
   */
  constructor(drawArea, circuit, hand) {
    /** @type {!CircuitViewState} */
    this.displayedCircuit = circuitInArea(circuit, drawArea);
    /** @type {!PointerInteractionState} */
    this.hand = hand;
    /** @type {!Rect} */
    this.drawArea = Object.freeze(new Rect(drawArea.x, drawArea.y, drawArea.w, drawArea.h));
    Object.freeze(this);
  }

  desiredWidth() {
    return this.displayedCircuit.desiredWidth();
  }

  /**
   * @param {!Rect} drawArea
   * @returns {!EditorState}
   */
  withArea(drawArea) {
    return this.drawArea.isEqualTo(drawArea) ? this :
      new EditorState(drawArea, this.displayedCircuit, this.hand);
  }

  /**
   * @param {!Rect} drawArea
   * @returns {!EditorState}
   */
  static empty(drawArea) {
    return new EditorState(
      drawArea,
      CircuitViewState.empty(Layout.CIRCUIT_TOP_MARGIN),
      PointerInteractionState.EMPTY,
    );
  }

  /**
   * @returns {undefined|!EditorState}
   */
  tryClick() {
    const newDisplayedCircuit = this.displayedCircuit.tryClick(this.hand);
    return newDisplayedCircuit === undefined
      ? undefined
      : this.withDisplayedCircuit(newDisplayedCircuit);
  }

  /**
   * @param {!boolean=false} duplicate
   * @param {!boolean=false} wholeCol
   * @param {!boolean=false} ignoreResizeTabs
   * @param {!boolean=false} alt
   * @returns {!EditorState}
   */
  afterGrabbing(duplicate = false, wholeCol = false, ignoreResizeTabs = false, alt = false) {
    const {newCircuit, newHand} = this.displayedCircuit.tryGrab(
      this.hand, duplicate, wholeCol, ignoreResizeTabs, alt);
    return this.withChanges({circuit: newCircuit, hand: newHand});
  }

  /**
   * @param {!EditorState|*} other
   * @returns {!boolean}
   */
  isEqualTo(other) {
    if (this === other) {
      return true;
    }
    return (
      other instanceof EditorState &&
      this.drawArea.isEqualTo(other.drawArea) &&
      this.displayedCircuit.isEqualTo(other.displayedCircuit) &&
      this.hand.isEqualTo(other.hand)
    );
  }

  /**
   * @param {!CircuitViewState} displayedCircuit
   * @returns {!EditorState}
   */
  withDisplayedCircuit(circuit) { return this.withChanges({circuit}); }

  withChanges({circuit = this.displayedCircuit, hand = this.hand}) {
    return circuit === this.displayedCircuit && hand === this.hand ? this :
      new EditorState(this.drawArea, circuit, hand);
  }

  /**
   * @param {!int} extraWires
   * @returns {!EditorState}
   */
  withJustEnoughWires(extraWires) {
    return this.withDisplayedCircuit(
      this.displayedCircuit.withJustEnoughWires(extraWires),
    );
  }

  /**
   * @returns {!EditorState}
   */
  afterTidyingUp() {
    return this.withDisplayedCircuit(this.displayedCircuit.afterTidyingUp());
  }

  /**
   * @returns {!EditorState}
   */
  previewDrop() {
    if (!this.hand.isBusy()) return this;
    const circuit = this.displayedCircuit.previewDrop(this.hand);
    const hand = circuit === this.displayedCircuit ? this.hand : this.hand.withDrop();
    return this.withChanges({circuit, hand});
  }

  /**
   * @returns {!EditorState}
   */
  afterDropping() {
    return this.withChanges({
      circuit: this.displayedCircuit.afterDropping(this.hand), hand: this.hand.withDrop()
    });
  }

  /**
   * @returns {Infinity|!number}
   */
  stableDuration() {
    return Math.min(
      this.hand.stableDuration(),
      this.displayedCircuit.stableDuration(),
    );
  }

  /**
   * @param {!PointerInteractionState} hand
   * @returns {!EditorState}
   */
  withHand(hand) { return this.withChanges({hand}); }

  /**
   * @param {!CircuitDefinition} newCircuitDefinition
   * @returns {!EditorState}
   */
  withCircuitDefinition(newCircuitDefinition) {
    return new EditorState(
      this.drawArea,
      CircuitViewState.empty(Layout.CIRCUIT_TOP_MARGIN).withCircuit(
        newCircuitDefinition,
      ),
      this.hand.withDrop(),
    );
  }

  /**
   * @returns {!number} The least height the content wants: the circuit band with a symmetric
   *     margin above and below. The visible area wins when it is taller; the circuit then
   *     centers inside it.
   */
  desiredHeight() {
    return inspectorDesiredHeight(this.displayedCircuit);
  }

  /**
   * @returns {!string}
   */
  snapshot() {
    return JSON.stringify(
      Serializer.toJson(this.displayedCircuit.circuitDefinition),
      null,
      0,
    );
  }
}

export { EditorState };
