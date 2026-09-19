/** Font names and logical sizes, without CSS syntax or renderer objects. */
export const Typography = Object.freeze({
    family: Object.freeze({sans: Object.freeze(['Geist Variable', 'sans-serif']), mono: Object.freeze(['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'])}),
    // readout and label: the two sizes a value on the circuit is drawn at, the number and its name.
    size: Object.freeze({root: 16, default: 12, caption: 11, small: 13, body: 15, heading: 18, title: 28, gate: 16, gateMinimum: 11,
        readout: 13, label: 11}),
    weight: Object.freeze({gate: 500}),
});
