import {Suite, assertThat} from '../TestUtil.js';
import {Appearance} from '../../src/appearance/Appearance.js';
import {CanvasTheme} from '../../src/config/CanvasTheme.js';
import {Theme} from '../../src/config/Theme.js';
import {Layout} from '../../src/config/Layout.js';

const suite = new Suite('Appearance');

suite.test('shared appearance is immutable plain data that survives serialization', () => {
    assertThat(JSON.parse(JSON.stringify(Appearance))).isEqualTo(Appearance);
    const visit = value => {
        if (value !== null && typeof value === 'object') {
            assertThat(Object.isFrozen(value)).isEqualTo(true);
            for (const child of Object.values(value)) visit(child);
        } else {
            assertThat(['string', 'number', 'boolean'].includes(typeof value)).isEqualTo(true);
        }
    };
    visit(Appearance);
    assertThat(Appearance.colours.surface.background).isEqualTo({r: 32, g: 38, b: 48, alpha: 1});
});

suite.test('DOM and drawing map shared units and alpha without changing their meaning', () => {
    assertThat(Theme.dom['--border-width']).isEqualTo(`${Appearance.borders.width.regular}px`);
    assertThat(Theme.dom['--border-width-strong']).isEqualTo(`${Appearance.borders.width.strong}px`);
    assertThat(Layout.DEFAULT_STROKE_THICKNESS).isEqualTo(Appearance.borders.width.regular);
    assertThat(Layout.UNIT).isEqualTo(Appearance.spacing.unit * 10);
    assertThat(Number.parseFloat(Theme.dom['--spacing']) * Appearance.typography.size.root).isEqualTo(Appearance.spacing.unit);
    const {r, g, b, alpha} = Appearance.colours.interaction.playheadBand;
    assertThat(CanvasTheme.interaction.playheadBand).isEqualTo(`rgba(${r}, ${g}, ${b}, ${alpha})`);
});

suite.test('DOM text sizes keep their rem scale', () => {
    assertThat(['--text-caption', '--text-small', '--text-body', '--text-heading', '--text-title'].map(key => Theme.dom[key]))
        .isEqualTo(['0.6875rem', '0.8125rem', '0.9375rem', '1.125rem', '1.75rem']);
});
