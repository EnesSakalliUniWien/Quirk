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

import {Rect} from '../../geometry/Rect.js';
import {Container, Graphics} from 'pixi.js';
import {RestartableRng} from '../../base/RestartableRng.js';
import {InteractionState} from './InteractionState.js';

/** Owns the objects for one gate, display, or circuit layer. Pixi owns their transforms. */
export class DisplayView extends Container {
    constructor(canvas = {width: 300, height: 150}, rng = new RestartableRng(), pixelRatio = 1) {
        super();
        this.canvas = canvas;
        this.objects = new Map();
        this.interaction = new InteractionState();
        this.begin(rng, pixelRatio);
    }

    begin(rng = this.rng, pixelRatio = this.pixelRatio) {
        this.rng = rng;
        this.pixelRatio = pixelRatio;
        this.order = 0;
        this.used = new Set();
        this.position.set(0);
        this.scale.set(1);
        this.rotation = 0;
        this.alpha = 1;
        return this;
    }

    /** Named children retain identity; unnamed marks retain their occurrence within this view. */
    use(Type, key = this.order) {
        let child = this.objects.get(key);
        if (child?.constructor !== Type) {
            child?.destroy({children: true});
            child = new Type();
            this.objects.set(key, child);
        }
        this.used.add(key);
        if (this.children[this.order] !== child) this.addChildAt(child, this.order);
        this.order++;
        return child;
    }

    group(key, update, Type = DisplayView) {
        const child = this.use(Type, key);
        child.canvas = this.canvas;
        child.interaction = this.interaction;
        child.tooltips = this.tooltips;
        child.begin(this.rng, this.pixelRatio);
        const result = update(child);
        child.finish();
        child.result = result;
        return child;
    }

    /** Free-form geometry is rebuilt by its owner; fixed shapes use ShapeView.update. */
    graphics() { return this.use(Graphics).clear(); }

    finish() {
        for (const [key, child] of this.objects) {
            if (!this.used.has(key)) {
                child.destroy({children: true});
                this.objects.delete(key);
            }
        }
    }

    destroy() {
        this.objects.clear();
        super.destroy({children: true});
    }
}

export function drawingArea(view) {
    const {width, height} = view.logicalArea || {width: view.canvas.width / view.pixelRatio, height: view.canvas.height / view.pixelRatio};
    return new Rect(0, 0, width, height);
}
