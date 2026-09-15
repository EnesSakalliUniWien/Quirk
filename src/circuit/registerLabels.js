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

import { bin } from "../base/Format.js";
import { Registers } from "./model/Registers.js";

/**
 * How wires and basis states are written once wires have names. This is the one place a ket label
 * is made: the canvas and every panel ask here rather than formatting bit strings of their own, so
 * a register reads the same everywhere - a₁ for a wire, "a=6, b=3" for a basis state.
 *
 * With no registers everything reads as it always has: q3, and the bit string, highest wire first.
 * Register values are little-endian, like the rest of the app: a register's first wire is its
 * lowest bit. A value the register has labelled reads by its label: a=A rather than a=0.
 */

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * @param {!int} n
 * @returns {!string}
 */
function subscript(n) {
  return [...String(n)].map((d) => SUBSCRIPT_DIGITS[Number(d)]).join("");
}

/**
 * @param {!Registers} registers
 * @param {!int} wire
 * @returns {!string} a₀ for a register's first wire, q3 for a wire outside every register.
 */
function wireLabel(registers, wire) {
  const register = registers.at(wire);
  return register === undefined
    ? `q${wire}`
    : `${register.name}${subscript(wire - register.start)}`;
}

/**
 * @param {!Registers} registers
 * @param {!int} first
 * @param {!int} count
 * @returns {!string} The register's name for exactly its wires; otherwise the first and last wire.
 */
function wiresLabel(registers, first, count) {
  const register = registers.at(first);
  if (
    register !== undefined &&
    register.start === first &&
    register.length === count
  ) {
    return register.name;
  }
  return count === 1
    ? wireLabel(registers, first)
    : `${wireLabel(registers, first)}–${wireLabel(registers, first + count - 1)}`;
}

/**
 * @param {!Register} register
 * @param {!int} index A basis state of the whole circuit.
 * @returns {!int} The value the register holds in it.
 */
function registerValue(register, index) {
  return (index >> register.start) & ((1 << register.length) - 1);
}

/**
 * A basis state split the way the wires are grouped: each register's value, and each run of
 * wires outside every register as its bits.
 *
 * @param {!Registers} registers
 * @param {!int} numWires
 * @param {!int} index
 * @returns {!Array.<!{name: !string, text: !string, register: (undefined|!Register)}>} In wire order.
 */
function ketFields(registers, numWires, index) {
  const fields = [];
  let wire = 0;
  while (wire < numWires) {
    const register = registers.at(wire);
    if (register !== undefined) {
      fields.push({
        name: register.name,
        text: Registers.valueLabel(register, registerValue(register, index)),
        register,
      });
      wire = register.start + register.length;
      continue;
    }
    let end = wire;
    while (end < numWires && !registers.covers(end)) {
      end++;
    }
    const count = end - wire;
    fields.push({
      name: count === 1 ? `q${wire}` : `q${wire}–q${end - 1}`,
      text: bin((index >> wire) & ((1 << count) - 1), count),
      register: undefined,
    });
    wire = end;
  }
  return fields;
}

/**
 * @param {!Registers} registers
 * @param {!int} numWires
 * @param {!int} index
 * @returns {!string} The basis state, without its brackets: the bit string when there are no
 *     registers, otherwise each group by name - a=6, b=3, q5=1.
 */
function ketLabel(registers, numWires, index) {
  if (registers.isEmpty()) {
    return bin(index, numWires);
  }
  return ketFields(registers, numWires, index)
    .map((f) => `${f.name}=${f.text}`)
    .join(", ");
}

/**
 * @param {!Registers} registers
 * @param {!int} numWires
 * @param {!int} index
 * @returns {!string} The bit string, highest wire first, with a · where one group of wires ends.
 */
function ketBits(registers, numWires, index) {
  const bits = bin(index, numWires);
  if (registers.isEmpty()) {
    return bits;
  }
  const group = (wire) => registers.at(wire)?.name;
  let out = "";
  for (let wire = numWires - 1; wire >= 0; wire--) {
    out += bits[numWires - 1 - wire];
    if (wire > 0 && group(wire) !== group(wire - 1)) {
      out += "·";
    }
  }
  return out;
}

/**
 * @param {!Registers} registers
 * @param {!int} numWires
 * @returns {!string} Which wire each character of ketBits stands for, in its order: b₁b₀·a₂a₁a₀·q5.
 */
function ketBitsHeader(registers, numWires) {
  const groups = [];
  let wire = numWires - 1;
  while (wire >= 0) {
    const register = registers.at(wire);
    if (register !== undefined) {
      groups.push(
        Array.from(
          { length: register.length },
          (_, i) => `${register.name}${subscript(register.length - 1 - i)}`,
        ).join(""),
      );
      wire = register.start - 1;
      continue;
    }
    const labels = [];
    while (wire >= 0 && !registers.covers(wire)) {
      labels.push(`q${wire}`);
      wire--;
    }
    groups.push(labels.join(" "));
  }
  return groups.join("·");
}

export {
  ketBits,
  ketBitsHeader,
  ketFields,
  ketLabel,
  registerValue,
  wireLabel,
  wiresLabel,
};
