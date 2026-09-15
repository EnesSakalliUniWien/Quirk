import {isAmplitudeCoherent} from "../../../engine/math/amplitudeCoherence.js";

/** Read the same local state that the selected circuit display paints. */
export function displayData(stats, target) {
    if (!stats || !target) return undefined;
    const gate = stats.circuitDefinition.columns[target.col]?.gates[target.row];
    if (!gate || gate.serializedId !== target.gate.serializedId) return undefined;
    if (gate.serializedId.startsWith('Density')) {
        return {kind: 'density', matrix: gate.height === 1 ? stats.qubitDensityMatrix(target.col, target.row).transpose() :
            stats.customStatsForSlot(target.col, target.row), coherent: true, wireCount: gate.height};
    }
    const data = stats.customStatsForSlot(target.col, target.row);
    if (!data) return undefined;
    const coherent = isAmplitudeCoherent(data.quality);
    return {kind: 'amplitudes', matrix: coherent ? data.ket : data.incoherentKet, coherent,
        phaseLockIndex: data.phaseLockIndex, wireCount: gate.height,
        registers: stats.circuitDefinition.registers.within(target.row, gate.height)};
}
