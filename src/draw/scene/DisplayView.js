/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '@pixi/layout';
import {createElement, useLayoutEffect, useRef} from 'react';
import {extend} from '@pixi/react';
import {Container, Graphics, Point} from 'pixi.js';
import {Rect} from '../../geometry/Rect.js';
import {RestartableRng} from '../../base/RestartableRng.js';

// @pixi/react removes a subtree with destroy(); Pixi requires children:true to release descendants.
class SceneContainer extends Container {
    destroy(options) { super.destroy({children: true, ...options}); }
}
extend({SceneContainer, Graphics});

function FrameNode({frame, transform, children}) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        frame.native = ref.current;
        ref.current.mask = frame.mask?.native ?? null;
    });
    return createElement('pixiSceneContainer', {...transform, tooltipBounds: frame.bounds, ref}, children);
}

/** A frame description. React owns the Pixi objects; this object has no child registry. */
export class DisplayView {
    constructor(canvas = {width: 300, height: 150}, rng = new RestartableRng(), pixelRatio = 1) {
        this.canvas = canvas;
        this.position = new Point();
        this.scale = new Point(1, 1);
        this.begin(rng, pixelRatio);
    }
    begin(rng = this.rng, pixelRatio = this.pixelRatio, lineScale = 1) {
        this.rng = rng;
        this.pixelRatio = pixelRatio;
        this.lineScale = lineScale;
        this.order = 0;
        this.elements = [];
        this.position.set(0);
        this.scale.set(1);
        this.rotation = 0;
        this.alpha = 1;
        this.mask = undefined;
        return this;
    }
    add(type, props, key = this.order) {
        const reference = {native: undefined};
        this.elements.push(createElement(type, {...props, key, ref: node => {reference.native = node;}}));
        this.order++;
        return reference;
    }
    group(key, update) {
        const child = new DisplayView(this.canvas, this.rng, this.pixelRatio);
        child.lineScale = this.lineScale;
        child.tooltips = this.tooltips;
        child.parent = this;
        child.result = update(child);
        this.elements.push(child.element(key));
        this.order++;
        return child;
    }
    element(key) {
        return createElement(FrameNode, {key, frame: this, transform: {
            x: this.position.x, y: this.position.y, scale: {x: this.scale.x, y: this.scale.y},
            rotation: this.rotation, alpha: this.alpha
        }}, this.elements);
    }
    get children() { return this.native?.children ?? []; }
}

export function drawingArea(view) {
    const {width, height} = view.logicalArea || {width: view.canvas.width / view.pixelRatio, height: view.canvas.height / view.pixelRatio};
    return new Rect(0, 0, width, height);
}

/** Native graphics commands execute on the object supplied by the React reconciler. */
export function drawGraphics(view, draw) {
    return view.add('pixiGraphics', {draw: graphics => {graphics.clear(); draw(graphics);}});
}
