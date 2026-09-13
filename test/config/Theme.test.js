import {Suite, assertThat} from "../TestUtil.js";
import {Theme, CanvasTheme, phaseColor} from "../../src/config/Theme.js";
import {applyTheme} from "../../src/browser/applyTheme.js";

const suite = new Suite("Theme");

suite.test("DOM and canvas read the same scientific colours and font assignments", () => {
    assertThat(Theme.dom["--state-probability-fill"]).isEqualTo(CanvasTheme.probability.fill);
    assertThat(Theme.dom["--state-probability-back"]).isEqualTo(CanvasTheme.probability.background);
    assertThat(Theme.dom["--operator"]).isEqualTo(CanvasTheme.operation.fill);
    assertThat(Theme.dom["--font-sans"]).isEqualTo(Theme.typography.DEFAULT_FONT_FAMILY);
    assertThat(Theme.dom["--font-mono"]).isEqualTo(Theme.typography.MONO_FONT_FAMILY);
    for (let angle = -180; angle <= 180; angle += 45) {
        assertThat(Theme.dom["--phase-legend"].includes(phaseColor(angle))).isEqualTo(true);
    }
});

suite.test("startup assigns the theme without a stylesheet and can reapply without duplicate metadata", () => {
    const doc = document.implementation.createHTMLDocument("theme");
    applyTheme(doc);
    const root = doc.documentElement;
    assertThat(root.style.getPropertyValue("--card")).isEqualTo(Theme.dom["--card"]);
    assertThat(root.style.getPropertyValue("--dv-group-view-background-color")).isEqualTo(Theme.dom["--card"]);
    assertThat(root.style.colorScheme).isEqualTo(Theme.colorScheme);
    assertThat(doc.querySelector('meta[name="theme-color"]').content).isEqualTo(Theme.dom["--background"]);
    root.style.setProperty("--card", "wrong");
    applyTheme(doc);
    assertThat(root.style.getPropertyValue("--card")).isEqualTo(Theme.dom["--card"]);
    assertThat(doc.querySelectorAll('meta[name="theme-color"]').length).isEqualTo(1);
    assertThat(doc.querySelectorAll('meta[name="color-scheme"]').length).isEqualTo(1);
    assertThat(doc.styleSheets.length).isEqualTo(0);
});
