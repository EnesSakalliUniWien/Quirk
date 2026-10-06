import { Suite, assertThat } from "../../TestUtil.js";
import {
  SHARED_STYLE_LIMIT,
  sharedTextStyle,
  textStyle,
} from "../../../src/draw/text/LabelView.js";
import { drawText } from "../../../src/draw/text/TextLayout.js";
import { RenderSurface } from "../../../src/draw/surface/RenderSurface.js";
import { TextStyle } from "pixi.js";

const suite = new Suite("LabelView");

suite.test(
  "a field of a font that is undefined stays at Pixi's default",
  () => {
    const style = textStyle({
      fontSize: 12,
      fontFamily: "serif",
      fontWeight: undefined,
      fontStyle: undefined,
    });
    assertThat(style.fontSize).isEqualTo(12);
    assertThat(style.fontFamily).isEqualTo("serif");
    assertThat(style.fontWeight).isEqualTo(new TextStyle().fontWeight);
    assertThat(style.fontStyle).isEqualTo(new TextStyle().fontStyle);
  },
);

suite.test(
  "the same appearance gets the same style, whoever asks and however they describe it",
  () => {
    const version = 1000;
    const a = sharedTextStyle(
      { fontSize: 12, fontFamily: "serif" },
      "#112233",
      undefined,
      version,
    );
    const b = sharedTextStyle(
      { fontSize: 12, fontFamily: "serif", fontWeight: undefined },
      "#112233",
      undefined,
      version,
    );
    assertThat(a === b).isEqualTo(true);
    assertThat(a.fontSize).isEqualTo(12);
    // Any difference in what the style is made of is a style of its own.
    for (const other of [
      sharedTextStyle(
        { fontSize: 13, fontFamily: "serif" },
        "#112233",
        undefined,
        version,
      ),
      sharedTextStyle(
        { fontSize: 12, fontFamily: "serif", fontWeight: "500" },
        "#112233",
        undefined,
        version,
      ),
      sharedTextStyle(
        { fontSize: 12, fontFamily: "serif" },
        "#112234",
        undefined,
        version,
      ),
      sharedTextStyle(
        { fontSize: 12, fontFamily: "serif" },
        "#112233",
        { color: "#000000", width: 2 },
        version,
      ),
    ]) {
      assertThat(other === a).isEqualTo(false);
    }
    // A stroke is told from another by what it holds, not by being an object.
    const stroked = sharedTextStyle(
      { fontSize: 12 },
      "#112233",
      { color: "#000000", width: 2 },
      version,
    );
    assertThat(
      sharedTextStyle(
        { fontSize: 12 },
        "#112233",
        { color: "#000000", width: 2 },
        version,
      ) === stroked,
    ).isEqualTo(true);
    assertThat(
      sharedTextStyle(
        { fontSize: 12 },
        "#112233",
        { color: "#000000", width: 3 },
        version,
      ) === stroked,
    ).isEqualTo(false);
  },
);

suite.test(
  "styles are made again when the layout version moves on, which is when the webfont arrives",
  () => {
    const font = { fontSize: 12, fontFamily: "serif" };
    const before = sharedTextStyle(font, "#112233", undefined, 2000);
    assertThat(
      sharedTextStyle(font, "#112233", undefined, 2000) === before,
    ).isEqualTo(true);
    assertThat(
      sharedTextStyle(font, "#112233", undefined, 2001) === before,
    ).isEqualTo(false);
  },
);

suite.test(
  "the styles kept are bounded: the oldest is forgotten, and asked for again is made anew",
  () => {
    const version = 3000;
    const first = sharedTextStyle(
      { fontSize: 1 },
      "#112233",
      undefined,
      version,
    );
    for (let size = 2; size <= SHARED_STYLE_LIMIT; size++)
      sharedTextStyle({ fontSize: size }, "#112233", undefined, version);
    assertThat(
      sharedTextStyle({ fontSize: 1 }, "#112233", undefined, version) === first,
    ).isEqualTo(true);
    sharedTextStyle(
      { fontSize: SHARED_STYLE_LIMIT + 1 },
      "#112233",
      undefined,
      version,
    );
    assertThat(
      sharedTextStyle({ fontSize: 1 }, "#112233", undefined, version) === first,
    ).isEqualTo(false);
  },
);

suite.test(
  "labels set alike share one style and so one texture, and a label that differs does not",
  async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const surface = new RenderSurface(canvas);
    const font = { fontSize: 14, fontFamily: "serif" };
    try {
      const view = surface.beginFrame();
      drawText(view, "twin", { x: 10, y: 20, font, fill: "#336699" });
      drawText(view, "twin", { x: 80, y: 60, font, fill: "#336699" });
      drawText(view, "twin", { x: 140, y: 60, font, fill: "#993366" });
      drawText(view, "other", { x: 10, y: 90, font, fill: "#336699" });
      await surface.render();
      const labels = [];
      const collect = (node) =>
        node.text === undefined
          ? node.children.forEach(collect)
          : labels.push(node);
      collect(surface.app.stage);
      const [first, second, recoloured, other] = labels;
      assertThat(first.style === second.style).isEqualTo(true);
      assertThat(first.style === recoloured.style).isEqualTo(false);
      assertThat(first.styleKey).isEqualTo(second.styleKey);
      assertThat(first.styleKey === recoloured.styleKey).isEqualTo(false);
      // Pixi counts the labels holding a texture: the twins hold one between them.
      const { canvasText } = surface.app.renderer;
      assertThat(canvasText.getReferenceCount(first.styleKey)).isEqualTo(2);
      assertThat(canvasText.getReferenceCount(recoloured.styleKey)).isEqualTo(
        1,
      );
      assertThat(canvasText.getReferenceCount(other.styleKey)).isEqualTo(1);
      // The appearance each label was made from is on it, as JSON: version, font, fill, stroke.
      assertThat(JSON.parse(first.appearanceKey).slice(1)).isEqualTo([
        font,
        "#336699",
        null,
      ]);
    } finally {
      await surface.destroy();
    }
  },
);
