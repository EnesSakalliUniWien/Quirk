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
    /**
     * @param {*} key
     * @param {!function(!DisplayView): *} update Describes the group's contents.
     * @param {!{pointer: (undefined|!boolean)}=} options `pointer: false` for a group nothing in which
     *     takes the pointer: Pixi then skips the whole subtree when it hit-tests a pointer move.
     */
    group(key, update, {pointer = true} = {}) {
        const child = new DisplayView(this.canvas, this.rng, this.pixelRatio);
        child.lineScale = this.lineScale;
        child.tooltips = this.tooltips;
        child.parent = this;
        child.pointer = pointer;
        child.result = update(child);
        this.elements.push(child.element(key));
        this.order++;
        return child;
    }
    element(key) {
        return createElement(FrameNode, {key, frame: this, transform: {
            x: this.position.x, y: this.position.y, scale: {x: this.scale.x, y: this.scale.y},
            rotation: this.rotation, alpha: this.alpha, eventMode: this.pointer === false ? 'none' : 'passive'
        }}, this.elements);
    }
    get children() { return this.native?.children ?? []; }
}

export function drawingArea(view) {
    const {width, height} = view.logicalArea || {width: view.canvas.width / view.pixelRatio, height: view.canvas.height / view.pixelRatio};
    return new Rect(0, 0, width, height);
}

/**
 * The Graphics calls a drawing makes, recorded rather than run: [method, args, method, args, …].
 * @param {!function(!Object): void} draw Called with a stand-in for a Graphics, whose every method
 *     records its call and returns the stand-in, so chained calls record in order.
 * @returns {!Array}
 */
export function recordGraphics(draw) {
    const commands = [];
    const recorder = new Proxy({}, {get: (_, method) => (...args) => {
        commands.push(method, args);
        return recorder;
    }});
    draw(recorder);
    return commands;
}

/** @returns {!boolean} Whether two recorded values - numbers, strings, arrays, plain objects - are the same. */
function sameRecorded(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!sameRecorded(a[i], b[i])) return false;
        return true;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(key => sameRecorded(a[key], b[key]));
}

/**
 * A Graphics that replays recorded commands, and only when they differ from the last ones. The
 * scene describes every drawing every frame; a drawing handed over as a fresh closure was cleared,
 * re-triangulated and re-uploaded every frame although nothing in it had changed.
 */
class RecordedGraphics extends Graphics {
    constructor() { super(); }
    set commands(commands) {
        if (this.recorded !== undefined && sameRecorded(this.recorded, commands)) return;
        this.recorded = commands;
        this.clear();
        for (let i = 0; i < commands.length; i += 2) this[commands[i]](...commands[i + 1]);
    }
}

extend({RecordedGraphics});

/** Native graphics commands, recorded now and replayed on the reconciler's object when they change. */
export function drawGraphics(view, draw) {
    return view.add('pixiRecordedGraphics', {commands: recordGraphics(draw)});
}
