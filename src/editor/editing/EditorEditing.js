/** Coordinate circuit and pointer changes in one editor snapshot. */
export function grabInEditor(editor, duplicate, wholeColumn, ignoreResizeTabs, alternate) {
    const {newCircuit, newHand} = editor.displayedCircuit.tryGrab(
        editor.hand, duplicate, wholeColumn, ignoreResizeTabs, alternate);
    return editor.withChanges({circuit: newCircuit, hand: newHand});
}

export function previewEditorDrop(editor) {
    if (!editor.hand.isBusy()) return editor;
    const circuit = editor.displayedCircuit.previewDrop(editor.hand);
    const hand = circuit === editor.displayedCircuit ? editor.hand : editor.hand.withDrop();
    return editor.withChanges({circuit, hand});
}

export function dropInEditor(editor) {
    return editor.withChanges({
        circuit: editor.displayedCircuit.afterDropping(editor.hand), hand: editor.hand.withDrop()
    });
}
