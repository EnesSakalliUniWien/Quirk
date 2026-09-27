/**
 * @param {!EventTarget} node
 * @returns {!boolean} Whether the node takes typed text: a field, a math field or editable content.
 */
export function isTextEntry(node) {
    return ['INPUT', 'TEXTAREA', 'MATH-FIELD'].includes(node.tagName) || node.isContentEditable === true;
}

/**
 * @param {!Event} event A key or clipboard event.
 * @returns {!boolean} Whether the event belongs to a text field, where editing keys and the clipboard
 *     are the field's own, not the circuit's.
 */
export function isTypingTarget(event) {
    return event.composedPath().some(isTextEntry);
}
