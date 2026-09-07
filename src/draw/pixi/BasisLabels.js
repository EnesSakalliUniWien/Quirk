import { DisplayView } from "./DisplayView.js";
import { textLayoutVersion } from "./TextLayout.js";
let nextId = 0;
/** Basis labels retain their text and geometry until wire count or font metrics change. */
export class BasisLabels {
  constructor(size, draw) {
    this.size = size;
    this.draw = draw;
    this.version = 0;
    this.id = nextId++;
  }
  clear() {
    this.version++;
  }
  paint(x, y, view, key) {
    view.group("basis-" + this.id + "-" + view.order, (placement) => {
      placement.position.set(x, y);
      const content = placement.use(DisplayView, "labels");
      const version = [
        this.version,
        textLayoutVersion,
        view.pixelRatio,
        key,
      ].join(":");
      if (content.labelVersion !== version) {
        content.canvas = view.canvas;
        content.begin(view.rng, view.pixelRatio);
        content.logicalArea = this.size(key);
        this.draw(content, key);
        content.finish();
        content.labelVersion = version;
      }
    });
  }
}
