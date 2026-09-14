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

import {Suite, assertThat} from '../../TestUtil.js';
import {DisplayView} from '../scene/TestDisplayView.js';
import {TooltipLayer} from '../../../src/draw/tooltips/TooltipView.js';
const suite = new Suite('TooltipView');

suite.test("valueTooltip_staysInsideZoomedScrolledViewport", async () => {
    for (const dpr of [1, 2]) {
        for (const zoom of [0.5, 1, 1.5, 2]) {
            for (const scroll of [0, 180]) {
                for (const corner of [[0, 0], [320, 0], [0, 240], [320, 240]]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 320 * dpr;
                    canvas.height = 240 * dpr;
                    const painter = new DisplayView(canvas, undefined, dpr * zoom);
                    painter.position.set(-scroll / zoom, -scroll / zoom);
                    TooltipLayer.forView(painter).show(painter, {x: (corner[0] + scroll) / zoom, y: (corner[1] + scroll) / zoom, labelText: 'Amplitude', valueText: '0.5', valueText2: 'phase: 0'});
                    await painter.commit();
                    assertThat(painter.tooltips.children.length).isEqualTo(1);
                    const tooltip = painter.tooltips.children[0];
                    const a = tooltip.toGlobal(tooltip.tooltipBounds.topLeft());
                    const b = tooltip.toGlobal(tooltip.tooltipBounds.bottomRight());
                    const halfStroke = dpr * zoom / 2;
                    assertThat(a.x - halfStroke >= 0 && a.y - halfStroke >= 0 &&
                        b.x + halfStroke <= canvas.width && b.y + halfStroke <= canvas.height).isEqualTo(true);
                }
            }
        }
    }
});

