import { Suite, assertThat } from "../../TestUtil.js";
import {
  BITMAP_CHARACTERS,
  acquireBitmapFont,
  inBitmapFont,
  releaseBitmapFont,
} from "../../../src/draw/text/BitmapFonts.js";
import { BitmapLabelView } from "../../../src/draw/text/BitmapLabelView.js";
import { LabelView } from "../../../src/draw/text/LabelView.js";
import {
  drawText,
  invalidateTextLayout,
  textLayoutVersion,
} from "../../../src/draw/text/TextLayout.js";
import { RenderSurface } from "../../../src/draw/surface/RenderSurface.js";
import { Typography } from "../../../src/config/Typography.js";
import { Cache, Color } from "pixi.js";

const suite = new Suite("BitmapLabelView");

const mono = { fontSize: 13, fontFamily: Typography.MONO_FONT_FAMILY };
// A weight nothing else draws in, so that no label elsewhere holds the fonts these tests count on being let go.
const own = { ...mono, fontWeight: "300" };
const installed = (name) => Cache.has(`${name}-bitmap`);

suite.test(
  "a bitmap font has the characters readouts are made of, and nothing is drawn in it that it lacks",
  () => {
    for (const text of [
      "0123456789",
      "37.2%",
      "<0.1%",
      ">99.9%",
      "|r| 0.707",
      "Off",
      "On",
      "",
      "-1.5",
    ]) {
      assertThat(inBitmapFont(text)).withInfo({ text }).isEqualTo(true);
    }
    for (const text of ["NaN", "|0⟩", "a", "37.2%\n", "½"]) {
      assertThat(inBitmapFont(text)).withInfo({ text }).isEqualTo(false);
    }
    assertThat(BITMAP_CHARACTERS.includes("5")).isEqualTo(true);
  },
);

suite.test(
  "one bitmap font stands for a family, weight and style at every size, and is installed once",
  () => {
    const version = textLayoutVersion;
    const a = acquireBitmapFont({ ...mono, fontSize: 11 }, version);
    const b = acquireBitmapFont({ ...mono, fontSize: 30 }, version);
    const bold = acquireBitmapFont({ ...mono, fontWeight: "700" }, version);
    try {
      assertThat(a).isEqualTo(b);
      assertThat(bold === a).isEqualTo(false);
      assertThat(installed(a) && installed(bold)).isEqualTo(true);
    } finally {
      for (const name of [a, b, bold]) releaseBitmapFont(name);
    }
    // Released, a font of the current version stays, for the next label that wants it.
    assertThat(installed(a)).isEqualTo(true);
    assertThat(acquireBitmapFont(mono, version)).isEqualTo(a);
    releaseBitmapFont(a);
  },
);

suite.test(
  "a font of an earlier version is destroyed only once no label is set in it",
  () => {
    const early = acquireBitmapFont(own, textLayoutVersion);
    invalidateTextLayout();
    const late = acquireBitmapFont(own, textLayoutVersion);
    try {
      assertThat(late === early).isEqualTo(false);
      // A label that has not been drawn since still points at the old font's glyphs.
      assertThat(installed(early)).isEqualTo(true);
    } finally {
      releaseBitmapFont(early);
      releaseBitmapFont(late);
    }
    assertThat(installed(early)).isEqualTo(false);
    assertThat(installed(late)).isEqualTo(true);
  },
);

suite.test(
  "a bitmap label reads as the canvas label would: text, colour, anchor and place",
  async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    const surface = new RenderSurface(canvas);
    const ink = "#2a6f97";
    try {
      const view = surface.beginFrame();
      drawText(view, "37.2%", {
        x: 100,
        y: 40,
        font: mono,
        fill: ink,
        align: "center",
        baseline: "middle",
      });
      drawText(view, "37.2%", {
        x: 100,
        y: 40,
        font: mono,
        fill: ink,
        align: "center",
        baseline: "middle",
        changing: true,
      });
      await surface.render();
      const labels = [];
      const collect = (node) =>
        node.text === undefined
          ? node.children.forEach(collect)
          : labels.push(node);
      collect(surface.app.stage);
      const [canvasLabel, bitmapLabel] = labels;
      assertThat(
        canvasLabel instanceof LabelView &&
          bitmapLabel instanceof BitmapLabelView,
      ).isEqualTo(true);
      assertThat(bitmapLabel.text).isEqualTo("37.2%");
      assertThat(bitmapLabel.tint).isEqualTo(new Color(ink).toNumber());
      assertThat([bitmapLabel.anchor.x, bitmapLabel.anchor.y]).isEqualTo([
        canvasLabel.anchor.x,
        canvasLabel.anchor.y,
      ]);
      // The same family and size, so the same box, a hair apart at most.
      const a = canvasLabel.getBounds(),
        b = bitmapLabel.getBounds();
      assertThat([b.x, b.y, b.width, b.height]).isApproximatelyEqualTo(
        [a.x, a.y, a.width, a.height],
        0.5,
      );
    } finally {
      await surface.destroy();
    }
  },
);

suite.test(
  "a label that changes every frame draws no canvas text, which a canvas label does each time",
  async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    const surface = new RenderSurface(canvas);
    const context = CanvasRenderingContext2D.prototype;
    const fillText = context.fillText;
    let drawn = 0;
    context.fillText = function (...args) {
      drawn++;
      return fillText.apply(this, args);
    };
    const frames = async (changing) => {
      // The first frame installs the font and rasterises its glyphs; it is not what is counted.
      for (let i = 0; i < 12; i++) {
        if (i === 2) drawn = 0;
        const view = surface.beginFrame();
        drawText(view, `${((i * 7.3) % 100).toFixed(1)}%`, {
          x: 20,
          y: 40,
          font: mono,
          changing,
        });
        await surface.render();
      }
      return drawn;
    };
    try {
      assertThat(await frames(true)).isEqualTo(0);
      assertThat((await frames(false)) > 0).isEqualTo(true);
    } finally {
      context.fillText = fillText;
      await surface.destroy();
    }
  },
);

suite.test(
  "a bitmap label hands its font back when it is destroyed, and a new version sets it in the new font",
  async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 40;
    const surface = new RenderSurface(canvas);
    const labelsIn = (node) =>
      node.text === undefined ? node.children.flatMap(labelsIn) : [node];
    try {
      const view = surface.beginFrame();
      drawText(view, "5%", { x: 10, y: 20, font: own, changing: true });
      await surface.render();
      const [label] = labelsIn(surface.app.stage);
      const early = label.style.fontFamily;
      assertThat(installed(early)).isEqualTo(true);
      invalidateTextLayout();
      const refreshed = surface.beginFrame();
      drawText(refreshed, "5%", { x: 10, y: 20, font: own, changing: true });
      await surface.render();
      const [same] = labelsIn(surface.app.stage);
      assertThat(same === label).isEqualTo(true);
      assertThat(label.style.fontFamily === early).isEqualTo(false);
      assertThat(installed(label.style.fontFamily)).isEqualTo(true);
      assertThat(installed(early)).isEqualTo(false);
      const current = label.style.fontFamily;
      surface.beginFrame();
      await surface.render();
      assertThat(label.destroyed).isEqualTo(true);
      // Nothing holds the current font now, and it is kept for the next label.
      assertThat(installed(current)).isEqualTo(true);
    } finally {
      await surface.destroy();
    }
  },
);
