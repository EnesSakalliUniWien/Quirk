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

suite.test("colour definitions are immutable", () => {
    assertThat(Object.isFrozen(theme)).isEqualTo(true);
    for (const value of Object.values(theme)) {
        if (typeof value === 'object') assertThat(Object.isFrozen(value)).isEqualTo(true);
    }
});

suite.test("text contrasts on normal hover error tooltip and data-label surfaces", () => {
    for (const background of [theme.surface.background, theme.surface.gate, theme.surface.quiet,
        theme.gate.hover, theme.gate.time, theme.probability.background, theme.amplitude.background,
        theme.operation.background, theme.bloch.background, theme.tooltip.background]) {
        for (const foreground of [theme.text.primary, theme.text.default, theme.text.muted]) {
            check(foreground, background, 4.5);
        }
        check(theme.error.text, background, 4.5);
    }
    check(theme.error.text, theme.error.background, 4.5);
    check(theme.tooltip.title, theme.tooltip.background, 4.5);
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

suite.test("phase wraps consistently and remains visible against its halo", () => {
    assertThat(phaseColor(-180)).isEqualTo(phaseColor(180));
    assertThat(phaseColor(0)).isEqualTo(phaseColor(360));
    for (let angle = -180; angle <= 180; angle++) check(phaseColor(angle), theme.amplitude.phaseHalo, 3);
});

suite.test("playhead and drop overlays preserve text contrast after compositing", () => {
    for (const overlay of [theme.interaction.playheadBand, theme.interaction.drop]) {
        const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
        ctx.fillStyle = theme.surface.background;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, 1, 1);
        const background = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        assertThat(contrast(rgb(theme.text.primary), background) >= 4.5).isEqualTo(true);
        assertThat(contrast(rgb(theme.text.muted), background) >= 4.5).isEqualTo(true);
    }
});
