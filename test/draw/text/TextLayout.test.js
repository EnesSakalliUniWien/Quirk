import {Suite, assertThat} from '../../TestUtil.js';
import {MEASUREMENT_LIMIT, drawText, fitText, invalidateTextLayout, measureText} from '../../../src/draw/text/TextLayout.js';
import {DisplayView} from '../../../src/draw/scene/DisplayView.js';
import {Typography} from '../../../src/config/Typography.js';
import {CanvasTextMetrics, TextStyle} from 'pixi.js';

const suite = new Suite('TextLayout');

const font = () => ({fontSize: 12, fontFamily: Typography.MONO_FONT_FAMILY});

suite.test('a string measures once in a font, and every later measure of it is that one', () => {
    invalidateTextLayout();
    const first = measureText('37.2%', font());
    // Another font object, with the same fields, is the same font.
    assertThat(measureText('37.2%', font()) === first).isEqualTo(true);
    assertThat(measureText(37.2, font()) === measureText('37.2', font())).isEqualTo(true);
    assertThat(measureText('37.3%', font()) === first).isEqualTo(false);
    assertThat(measureText('37.2%', {...font(), fontSize: 13}) === first).isEqualTo(false);
    assertThat(measureText('37.2%', {...font(), fontWeight: '600'}) === first).isEqualTo(false);
    assertThat(measureText('37.2%', font()).width).isEqualTo(first.width);
});

suite.test('what is measured is what the font says, for the string as a string', () => {
    const big = {...font(), fontSize: 20};
    // What is kept is Pixi's own measure of the string in a style of the same font, whatever fonts
    // the system has: a monospace family can fall back to a face that is not monospaced.
    for (const text of ['iiii', 'WWWW', '37.2%']) {
        const fresh = CanvasTextMetrics.measureText(text, new TextStyle({...big}));
        assertThat(measureText(text, big).width).withInfo({text}).isEqualTo(fresh.width);
    }
    assertThat(measureText('WWWW', big).width > measureText('WWWW', font()).width).isEqualTo(true);
    assertThat(measureText(1234, big)).isEqualTo(measureText('1234', big));
});

suite.test('measurements are forgotten when the layout is invalidated, and measured as before', () => {
    const before = measureText('37.2%', font());
    invalidateTextLayout();
    const after = measureText('37.2%', font());
    assertThat(after === before).isEqualTo(false);
    assertThat(after.width).isEqualTo(before.width);
    assertThat(after.fontProperties.ascent).isEqualTo(before.fontProperties.ascent);
});

suite.test('the measurements kept are bounded, the oldest forgotten first', () => {
    invalidateTextLayout();
    const first = measureText('0', font());
    for (let i = 1; i < MEASUREMENT_LIMIT; i++) measureText(String(i), font());
    assertThat(measureText('0', font()) === first).isEqualTo(true);
    measureText('beyond', font());
    assertThat(measureText('0', font()) === first).isEqualTo(false);
    assertThat(measureText('0', font()).width).isEqualTo(first.width);
});

suite.test('text that changes often is a bitmap label where its font can draw it, and a canvas label where not', () => {
    const typeOf = (text, options) => {
        const view = new DisplayView(document.createElement('canvas'));
        drawText(view, text, {font: font(), ...options});
        return view.elements[0].type;
    };
    assertThat(typeOf('37.2%', {changing: true})).isEqualTo('pixiBitmapLabelView');
    assertThat(typeOf('|r| 0.707', {changing: true})).isEqualTo('pixiBitmapLabelView');
    assertThat(typeOf('<0.1%', {changing: true})).isEqualTo('pixiBitmapLabelView');
    assertThat(typeOf('', {changing: true})).isEqualTo('pixiBitmapLabelView');
    // Text that does not change keeps its canvas label, which is sharper at any size.
    assertThat(typeOf('37.2%', {})).isEqualTo('pixiLabelView');
    // A character the bitmap font lacks, a stroke and wrapping are not for it.
    assertThat(typeOf('NaN', {changing: true})).isEqualTo('pixiLabelView');
    assertThat(typeOf('37.2% ⟩', {changing: true})).isEqualTo('pixiLabelView');
    assertThat(typeOf('37.2%', {changing: true, stroke: '#000000'})).isEqualTo('pixiLabelView');
    assertThat(typeOf('37.2%', {changing: true, font: {...font(), wordWrap: true, wordWrapWidth: 50}})).
        isEqualTo('pixiLabelView');
    assertThat(typeOf('37.2%', {changing: true, font: {...font(), letterSpacing: 1}})).isEqualTo('pixiLabelView');
});

suite.test('fitText passes the choice of label on, in the size it fits the text to', () => {
    const view = new DisplayView(document.createElement('canvas'));
    fitText(view, '37.2%', {font: {fontSize: 40, fontFamily: Typography.MONO_FONT_FAMILY}, width: 30, changing: true});
    const element = view.elements[0];
    assertThat(element.type).isEqualTo('pixiBitmapLabelView');
    assertThat(element.props.label[1].fontSize < 40).isEqualTo(true);
});
