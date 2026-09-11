import {Suite, assertThat} from "../TestUtil.js"
import {CanvasTheme as theme, phaseColor, gateStyle} from "../../src/config/CanvasTheme.js"

const suite = new Suite("CanvasTheme");

suite.test("IQP-dark assigns operations by serialized ID including Quirk axis formulas", () => {
    for (const [ids, fill] of [
        [['H'], '#FA4D56'], [['X', 'Swap'], '#4589FF'],
        [['Y', 'Rx', 'Ry', 'X^½', 'Y^-½', 'Rxft', 'Y^ft', 'e^-iXt'], '#FF7EB6'],
        [['Z', 'Z^½', 'Z^-¼', 'Rz', 'Rzft', 'Z^ft', 'e^iZt'], '#BAE6FF'],
        [['Measure'], '#8D8D8D']
    ]) {
        for (const serializedId of ids) {
            const style = gateStyle({serializedId, symbol: 'different display label'});
            assertThat(style).isEqualTo({fill, text: '#000000'});
            check(style.text, style.fill, 4.5);
        }
    }
    assertThat(theme.surface.background).isEqualTo('#262626');
    assertThat(gateStyle({serializedId: '~custom', symbol: 'H'}).fill).isEqualTo(theme.surface.gate);
});

function rgb(color) {
    const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

function contrast(a, b) {
    const luminance = c => c.map(v => v / 255).
        map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).
        reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function check(foreground, background, target) {
    const ratio = contrast(rgb(foreground), rgb(background));
    if (ratio < target) throw new Error(`${foreground} on ${background}: ${ratio.toFixed(2)} < ${target}`);
}

// Machado, Oliveira & Fernandes (2009) red-green deficiencies at full severity, on linear RGB.
const DEFICIENCIES = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};

/** OKLab coordinates of a colour, seen with full colour vision or with the given deficiency. */
function oklab(color, deficiency = undefined) {
    const linear = rgb(color).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = deficiency === undefined ? linear : DEFICIENCIES[deficiency].map(row =>
        Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

/** Colour difference as OKLab distance ×100. At 15 two colours are told apart at a glance. */
function difference(a, b, deficiency = undefined) {
    const [x, y] = [oklab(a, deficiency), oklab(b, deficiency)];
    return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

suite.test("colour definitions are immutable", () => {
    assertThat(Object.isFrozen(theme)).isEqualTo(true);
    for (const value of Object.values(theme)) {
        if (typeof value === 'object') assertThat(Object.isFrozen(value)).isEqualTo(true);
    }
});

suite.test("each colour that carries a meaning carries only one", () => {
    const meanings = {
        hadamard: theme.iqp.hadamard, not: theme.iqp.not, rotation: theme.iqp.rotation,
        phase: theme.iqp.phase, measure: theme.iqp.measure,
        stateReadout: theme.probability.fill, amplitude: theme.amplitude.fill, operator: theme.operation.fill,
        highlight: theme.interaction.outline, error: theme.error.text,
    };
    const owners = new Map();
    for (const [meaning, color] of Object.entries(meanings)) {
        assertThat(owners.get(color.toUpperCase())).withInfo({meaning, color}).isEqualTo(undefined);
        owners.set(color.toUpperCase(), meaning);
    }
    // Shared on purpose: one meaning, drawn in two places.
    assertThat(theme.bloch.vector).isEqualTo(theme.probability.fill);
    assertThat(theme.bloch.background).isEqualTo(theme.probability.background);
    assertThat(theme.interaction.playhead).isEqualTo(theme.interaction.outline);
    assertThat(theme.operation.background).isEqualTo(theme.surface.gate);
});

suite.test("the three look-alike displays stay apart, also with red-green colour blindness", () => {
    // The amplitude grid, the density matrix (a state readout) and an operator matrix are all grids
    // of discs, so colour is what tells them apart.
    const kinds = {stateReadout: theme.probability.fill, amplitude: theme.amplitude.fill, operator: theme.operation.fill};
    const names = Object.keys(kinds);
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const [a, b] = [kinds[names[i]], kinds[names[j]]];
            const pair = `${names[i]}~${names[j]}`;
            assertThat(difference(a, b) >= 15).withInfo({pair, normal: difference(a, b)}).isEqualTo(true);
            for (const deficiency of Object.keys(DEFICIENCIES)) {
                const d = difference(a, b, deficiency);
                assertThat(d >= 8).withInfo({pair, deficiency, d}).isEqualTo(true);
            }
        }
    }
});

suite.test("the highlight stands apart from every colour that means something", () => {
    for (const color of [theme.iqp.hadamard, theme.iqp.not, theme.iqp.rotation, theme.iqp.phase,
        theme.iqp.measure, theme.probability.fill, theme.amplitude.fill, theme.operation.fill, theme.error.text]) {
        const d = difference(theme.interaction.outline, color);
        assertThat(d >= 15).withInfo({color, d}).isEqualTo(true);
    }
});

suite.test("text contrasts on normal hover error and data-label surfaces", () => {
    for (const background of [theme.surface.background, theme.surface.gate, theme.surface.quiet,
        theme.gate.hover, theme.gate.time, theme.probability.background, theme.amplitude.background,
        theme.operation.background, theme.bloch.background]) {
        for (const foreground of [theme.text.primary, theme.text.default, theme.text.muted]) {
            check(foreground, background, 4.5);
        }
        check(theme.error.text, background, 4.5);
    }
    check(theme.error.text, theme.error.background, 4.5);
    for (const fill of [theme.probability.fill, theme.operation.fill,
        theme.interaction.button, theme.interaction.buttonFocus]) check(theme.text.onBright, fill, 4.5);
});

suite.test("essential boundaries and Bloch guides contrast with dark surfaces", () => {
    for (const background of [theme.surface.background, theme.surface.gate, theme.surface.quiet,
        theme.probability.background, theme.amplitude.background, theme.operation.background]) {
        for (const foreground of [theme.stroke.grid, theme.stroke.guide, theme.stroke.faint,
            theme.interaction.outline, theme.interaction.playhead]) check(foreground, background, 3);
    }
    check(theme.bloch.vector, theme.bloch.background, 3);
    check(theme.probability.fill, theme.probability.background, 3);
    check(theme.amplitude.fill, theme.amplitude.background, 3);
    check(theme.stroke.grid, theme.amplitude.phaseHalo, 3);
});

suite.test("frames read clearly on every surface an element can have", () => {
    // Dark fills are within 1.2:1 of the canvas, so the frame is their edge: it clears 4.5:1, not
    // just the 3:1 minimum, and the highlight ring around it clears 3:1.
    for (const background of [theme.surface.background, theme.surface.gate, theme.surface.quiet,
        theme.gate.hover, theme.gate.time, theme.probability.background, theme.amplitude.background,
        theme.bloch.background, theme.error.background]) {
        check(theme.stroke.frame, background, 4.5);
        check(theme.interaction.outline, background, 3);
    }
});

suite.test("phase wraps consistently and remains visible against its halo", () => {
    assertThat(phaseColor(-180)).isEqualTo(phaseColor(180));
    assertThat(phaseColor(0)).isEqualTo(phaseColor(360));
    for (let angle = -180; angle <= 180; angle++) check(phaseColor(angle), theme.amplitude.phaseHalo, 3);
});

function composited(overlay) {
    const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    ctx.fillStyle = theme.surface.background;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

suite.test("playhead and drop overlays preserve text contrast after compositing", () => {
    for (const overlay of [theme.interaction.playheadBand, theme.interaction.drop]) {
        const background = composited(overlay);
        assertThat(contrast(rgb(theme.text.primary), background) >= 4.5).isEqualTo(true);
        assertThat(contrast(rgb(theme.text.muted), background) >= 4.5).isEqualTo(true);
    }
    // A disabled gate's reason can sit in the playhead's column.
    assertThat(contrast(rgb(theme.error.text), composited(theme.interaction.playheadBand)) >= 4.5).isEqualTo(true);
});
