import { z } from "zod";
import {
  toJson_CircuitDefinition,
  fromJson_CircuitDefinition,
} from "./circuit.js";

/**
 * Circuit JSON on the clipboard: the form a URL and the export panel already write, so a copied
 * part of a circuit pastes into another tab, and exported JSON pastes into the circuit.
 */
const clipboardCircuit = z.looseObject({
  cols: z.array(z.array(z.unknown())),
  gates: z.array(z.unknown()).optional(),
});

/**
 * @param {!CircuitDefinition} circuit
 * @returns {!string}
 */
function circuitToClipboardText(circuit) {
  return JSON.stringify(toJson_CircuitDefinition(circuit));
}

/**
 * @param {!string} text
 * @returns {undefined|!CircuitDefinition} The circuit the text holds, or undefined for any text
 *     that is not circuit JSON, so pasting other text is left alone.
 */
function circuitFromClipboardText(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!clipboardCircuit.safeParse(json).success) {
    return undefined;
  }
  try {
    return fromJson_CircuitDefinition(json);
  } catch {
    return undefined;
  }
}

export { circuitToClipboardText, circuitFromClipboardText };
