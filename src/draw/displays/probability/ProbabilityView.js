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

import {rectangle, frame, highlightRing} from '../../shapes/ShapeView.js';
import {TooltipLayer} from '../../tooltips/TooltipView.js';
import {drawText, fitText} from '../../text/TextLayout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Layout} from '../../../config/Layout.js';
import {Typography} from '../../../config/Typography.js';
import {Rect} from '../../../geometry/Rect.js';
import {wireLabel} from '../../../circuit/registerLabels.js';

import {Rectangle} from 'pixi.js';
import {DATA_RENDERERS} from '../../renderers/dataRenderers.js';
import {independentBlocks} from './ProbabilityBlocks.js';
import {ZERO_PROBABILITY, formatProbability, largestProbability} from './ProbabilityScale.js';
import {Appearance} from '../../../appearance/Appearance.js';

/** The thin bar under a readout's number, and the room it keeps from the tile's edge. */
const READOUT_BAR_HEIGHT = 4;
const READOUT_BAR_INSET = 6;

/** The key names every wire of a display this short, and only the first and last of a taller one. */
const KEY_WIRES_NAMED = 4;
/** The band between two independent blocks, which carries their ⊗. */
const BLOCK_GAP = 12;
const PRODUCT_FONT = {fontSize: 10, fontFamily: Typography.MONO_FONT_FAMILY};

/**
 * The multi-qubit probability display: the shared probabilities renderer, fed from the gate's
 * stats. The drawing itself lives in src/draw/renderers/dataRenderers.js, where the panels use it
 * too.
 *
 * Wires whose outcomes are independent of the rest split off (./ProbabilityBlocks.js): each block of
 * wires gets its own distribution beside those wires, and a ⊗ between blocks says the joint chance
 * is their product. Every block's bars share one scale. A circuit that animates keeps the joint
 * distribution, so a state passing through independence does not flash into blocks for a frame.
 *
 * Every row's hover card names the bit order and says what a bar measures: the square root of its
 * share of the largest probability, which it names.
 *
 * @param {!GateRenderParams} args
 */
function paintMultiProbabilityDisplay(args) {
    const probabilities = args.customStats;
    const wireCount = args.gate.height;
    const {row} = args.positionInCircuit;
    const {registers} = args.stats.circuitDefinition;
    const valid = probabilities !== undefined && !probabilities.hasNaN();
    const animated = args.stats.circuitDefinition.stableDuration() < Infinity;
    const blocks = valid && !animated ? independentBlocks(probabilities, wireCount) :
        [{start: 0, length: wireCount, probabilities}];
    const largest = valid ? Math.max(...blocks.map(block => largestProbability(block.probabilities))) : undefined;
    const namesOf = (start, length) => Array.from({length}, (_, i) => wireLabel(registers, row + start + length - 1 - i));
    const key = valid ? chartKey(namesOf(0, wireCount), largest, blocks.length > 1) : undefined;

    for (const block of blocks) {
        DATA_RENDERERS.probabilities(args.painter, block.probabilities, blockRect(args.rect, wireCount, block), {
            wireCount: block.length,
            focusPoints: args.focusPoints,
            largest,
            groupLabels: true,
            wireNames: blocks.length > 1 ? namesOf(block.start, block.length) : undefined,
            key,
        });
    }
    for (const {start} of blocks.slice(1)) {
        drawText(args.painter, '⊗', {x: args.rect.center().x, y: wireBoundary(args.rect, start),
            align: 'center', baseline: 'middle', font: PRODUCT_FONT, fill: CanvasTheme.text.muted});
    }
    if (!valid) {
        return;
    }

}

/**
 * What the key under the display used to say, now told by the hover card of every row: the bit
 * order, and what a bar measures.
 * @param {!Array.<!string>} names The wire names, highest wire first.
 * @param {!number} largest The probability a full bar stands for.
 * @param {!boolean} split Whether independent wires are drawn as separate blocks.
 * @returns {!string}
 */
function chartKey(names, largest, split) {
    const bits = names.length <= KEY_WIRES_NAMED ? names.join('') : `${names[0]}…${names.at(-1)}`;
    return `bits ${bits} · bars √ of ${formatProbability(largest)}${split ? ' · ⊗ independent' : ''}`;
}

/**
 * @param {!Rect} rect The display gate.
 * @param {!int} k A wire of the display, counted from its top.
 * @returns {!number} Halfway between wire k-1 and wire k.
 */
function wireBoundary(rect, k) {
    return rect.y + Layout.GATE_RADIUS + (k - 0.5) * Layout.WIRE_SPACING;
}

/**
 * @param {!Rect} rect The display gate.
 * @param {!int} wireCount
 * @param {!{start: !int, length: !int}} block
 * @returns {!Rect} The part of the gate beside the block's wires, less half a gap at each inner edge.
 */
function blockRect(rect, wireCount, {start, length}) {
    const end = start + length;
    const top = start === 0 ? rect.y : wireBoundary(rect, start) + BLOCK_GAP / 2;
    const bottom = end === wireCount ? rect.bottom() : wireBoundary(rect, end) - BLOCK_GAP / 2;
    return new Rect(rect.x, top, rect.w, bottom - top);
}

export {paintMultiProbabilityDisplay};

/**
 * @param {!number} p
 * @param {!int} fractionalDigits
 * @returns {!string} "Off" and "On" only for a qubit that is certainly off or on; a chance that
 *     merely rounds there reads "<0.1%" or ">99.9%".
 */
export function describeProbability(p, fractionalDigits) {
    const text = formatProbability(p, fractionalDigits);
    return text === "0%" ? "Off" : text === "100%" ? "On" : text;
}

/**
 * A single wire's chance, as a readout tile: the number above, in the readout size, and a thin bar
 * along a track below it. The number never sits on the bar, so it reads at every level.
 */
export function paintProbabilityBox(painter,
                           probability,
                           drawArea,
                           focusPoints = [],
                           backgroundColor = CanvasTheme.surface.readout,
                           fillColor = CanvasTheme.probability.fill) {
    rectangle(painter, drawArea, {fill: backgroundColor}, Appearance.borders.radius.tile);
    const cen = drawArea.center();
    if (Number.isNaN(probability)) {
        rectangle(painter, drawArea, {fill: CanvasTheme.error.background}, Appearance.borders.radius.tile);
        fitText(painter, "NaN", {
            x: cen.x,
            y: cen.y,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.error.text,
            font: {fontSize: Typography.READOUT_FONT_SIZE, fontFamily: Typography.MONO_FONT_FAMILY},
            width: drawArea.w,
            height: drawArea.h
        });
    } else {
        const {x, y, w, h} = drawArea;
        const track = new Rect(x + READOUT_BAR_INSET, y + h - READOUT_BAR_INSET - READOUT_BAR_HEIGHT,
            w - 2 * READOUT_BAR_INSET, READOUT_BAR_HEIGHT);
        fitText(painter, describeProbability(probability, 1), {
            x: cen.x,
            y: y + (track.y - y) / 2,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: Typography.READOUT_FONT_SIZE, fontFamily: Typography.MONO_FONT_FAMILY},
            width: w - 4,
            height: track.y - y,
        });
        rectangle(painter, track, {fill: CanvasTheme.probability.track}, READOUT_BAR_HEIGHT / 2);
        if (probability > ZERO_PROBABILITY) {
            // A possible outcome keeps a dot of bar, so it never looks like an impossible one.
            rectangle(painter, new Rect(track.x, track.y, Math.max(READOUT_BAR_HEIGHT, track.w * probability), track.h),
                {fill: fillColor}, READOUT_BAR_HEIGHT / 2);
        }
    }

    frame(painter, drawArea, CanvasTheme.stroke.displayFrame);

    painter.add('pixiSceneContainer', {
        eventMode: 'static', hitArea: new Rectangle(drawArea.x, drawArea.y, drawArea.w, drawArea.h)
    });

    // Tool tips.
    if (focusPoints.some(pt => drawArea.containsPoint(pt))) {
        highlightRing(painter, drawArea);
        TooltipLayer.forView(painter).show(painter, {
            x: drawArea.right(),
            y: drawArea.y,
            labelText: 'Chance of being ON if measured',
            valueText: (100*probability).toFixed(5) + "%"
        });
    }
}
