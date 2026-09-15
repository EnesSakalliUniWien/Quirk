/** Enabled operation columns, excluding displays, spacers and input/control markers alone. */
export function operationColumns(circuit) {
    return circuit.columns.flatMap((column, col) => column.gates.some((gate, row) =>
        gate !== undefined && circuit.gateAtLocIsDisabledReason(col, row) === undefined &&
        (!gate.definitelyHasNoEffect() || gate.measureEffect !== undefined)) ? [col] : []);
}

/** Column coordinates remain the simulation/Tape format; the transport uses operation stops. */
export function operationSchedule(circuit) {
    return {columnCount: circuit.columns.length, operationColumns: operationColumns(circuit)};
}
