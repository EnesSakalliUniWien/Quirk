/**
 * Where each column of a circuit went in an edited copy of it, for whatever is kept beside the
 * circuit by column and has to follow an edit: a debugger's breakpoints, like a debugger's
 * breakpoints follow the lines of an edited file.
 *
 * Equal columns are matched in order, the longest run of them that lines up (a longest common
 * subsequence), so an inserted, removed or moved column shifts the others rather than mismatching
 * them. Between two matched columns, columns that changed in place - a gate added or removed - are
 * matched in order too, as far as both sides have them.
 *
 * @param {!Array.<!GateColumn>} before
 * @param {!Array.<!GateColumn>} after
 * @returns {!Map.<!int, !int>} Each index in `before` that survives, to its index in `after`.
 */
function alignColumns(before, after) {
    // lengths[i][j]: the longest match between before[i..] and after[j..].
    const lengths = Array.from({length: before.length + 1}, () => new Int32Array(after.length + 1));
    for (let i = before.length - 1; i >= 0; i--) {
        for (let j = after.length - 1; j >= 0; j--) {
            lengths[i][j] = before[i].isEqualTo(after[j]) ?
                lengths[i + 1][j + 1] + 1 :
                Math.max(lengths[i + 1][j], lengths[i][j + 1]);
        }
    }
    // The matched path, then the gaps between its matches paired in order.
    const matches = [];
    let i = 0;
    let j = 0;
    while (i < before.length && j < after.length) {
        if (before[i].isEqualTo(after[j])) {
            matches.push([i++, j++]);
        } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
            i++;
        } else {
            j++;
        }
    }
    const moved = new Map();
    let [iGap, jGap] = [0, 0];
    for (const [iMatch, jMatch] of [...matches, [before.length, after.length]]) {
        while (iGap < iMatch && jGap < jMatch) moved.set(iGap++, jGap++);
        if (iMatch < before.length) moved.set(iMatch, jMatch);
        [iGap, jGap] = [iMatch + 1, jMatch + 1];
    }
    return moved;
}

export {alignColumns};
