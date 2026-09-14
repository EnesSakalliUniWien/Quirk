import {extend} from '@pixi/react';
import { Text, TextStyle } from "pixi.js";

/** Each label owns a native Text and changes its style only when its explicit inputs change. */
export class LabelView extends Text {
    constructor() { super(); }
  set label([text, font, fill, resolution, stroke, version]) {
    const key = JSON.stringify([version, font, fill, stroke]);
    if (this.appearanceKey !== key) {
      this.style = new TextStyle({ ...font, fill, stroke, padding: 2 });
      this.appearanceKey = key;
    }
    this.text = String(text);
    this.resolution = resolution;
    this.roundPixels = true;
  }
}

extend({LabelView});
