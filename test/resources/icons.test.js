import {Suite, assertThat} from "../TestUtil.js"
import {ICON_MARKUP, ICON_STROKE_WIDTH, iconElement} from "../../src/resources/icons/index.js"
import {PANELS} from "../../src/components/panels/panels.jsx"

const suite = new Suite("icons");

suite.test("the icons the app draws itself match Lucide's grid, colour and stroke", () => {
    for (const [name, markup] of Object.entries(ICON_MARKUP)) {
        for (const attribute of ['viewBox="0 0 24 24"', 'stroke="currentColor"', 'fill="none"',
            `stroke-width="${ICON_STROKE_WIDTH}"`, 'stroke-linecap="round"', 'stroke-linejoin="round"']) {
            assertThat(markup.includes(attribute)).withInfo({name, attribute}).isEqualTo(true);
        }
    }
});

suite.test("an icon element is one hidden svg", () => {
    const svg = iconElement('x');
    assertThat(svg.tagName.toLowerCase()).isEqualTo('svg');
    assertThat(svg.getAttribute('aria-hidden')).isEqualTo('true');
    assertThat(svg.querySelectorAll('path').length).isEqualTo(2);
});

suite.test("every panel has a mark for its tab and for the button that opens it", () => {
    for (const [name, panel] of Object.entries(PANELS)) {
        assertThat(panel.icon !== undefined).withInfo({panel: name}).isEqualTo(true);
        assertThat(panel.title.length > 0).withInfo({panel: name}).isEqualTo(true);
    }
});
