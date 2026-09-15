/** The display accepts a dominant separable state when its quality reaches this threshold. */
export function isAmplitudeCoherent(quality) {
    return Number.isFinite(quality) && quality >= 0.99;
}
