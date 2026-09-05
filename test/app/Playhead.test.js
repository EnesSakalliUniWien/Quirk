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

import {Suite, assertThat} from "../TestUtil.js"
import {ObservableValue} from "../../src/base/Obs.js"
import {OverlayState} from "../../src/app/OverlayState.js"
import {Playhead} from "../../src/app/Playhead.js"

let suite = new Suite("Playhead");

/**
 * Stands in for setInterval, so tests advance playback by hand instead of by waiting.
 */
function fakeClock() {
    let callbacks = [];
    return {
        setInterval: callback => callbacks.push(callback),
        clearInterval: id => { callbacks[id - 1] = undefined; },
        pendingCount: () => callbacks.filter(e => e !== undefined).length,
        tick: () => {
            for (let callback of [...callbacks]) {
                if (callback !== undefined) {
                    callback();
                }
            }
        }
    };
}

function playheadOver(columnCount) {
    let columns = new ObservableValue(columnCount);
    let overlays = new OverlayState();
    overlays.close();
    let clock = fakeClock();
    let playhead = new Playhead(columns.observable(), overlays, clock.setInterval, clock.clearInterval);
    return {playhead, columns, overlays, clock};
}

suite.test("starts before the first column", () => {
    let {playhead} = playheadOver(3);

    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()).isEqualTo([{
        step: 0,
        columnCount: 3,
        playing: false,
        canPlay: true,
        canStepBack: false,
        canStepForward: true
    }]);
});

suite.test("next and previous move a column at a time, and clamp", () => {
    let {playhead} = playheadOver(2);

    playhead.previous();
    assertThat(playhead.step()).isEqualTo(0);

    playhead.next();
    playhead.next();
    playhead.next();
    assertThat(playhead.step()).isEqualTo(2);

    playhead.previous();
    assertThat(playhead.step()).isEqualTo(1);
});

suite.test("end runs to the last column and reset returns to the first", () => {
    let {playhead} = playheadOver(4);

    playhead.end();
    assertThat(playhead.step()).isEqualTo(4);
    assertThat(playhead.state().snapshot()[0].canStepForward).isEqualTo(false);

    playhead.reset();
    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()[0].canStepBack).isEqualTo(false);
});

suite.test("seek rounds and clamps", () => {
    let {playhead} = playheadOver(3);

    playhead.seek(1.6);
    assertThat(playhead.step()).isEqualTo(2);

    playhead.seek(-5);
    assertThat(playhead.step()).isEqualTo(0);

    playhead.seek(99);
    assertThat(playhead.step()).isEqualTo(3);

    playhead.seek(NaN);
    assertThat(playhead.step()).isEqualTo(3);
});

suite.test("playing advances a column per tick and stops at the end", () => {
    let {playhead, clock} = playheadOver(2);

    playhead.togglePlay();
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(true);

    clock.tick();
    assertThat(playhead.step()).isEqualTo(1);

    clock.tick();
    assertThat(playhead.step()).isEqualTo(2);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);
});

suite.test("playing from the end starts over", () => {
    let {playhead} = playheadOver(2);

    playhead.end();
    playhead.togglePlay();

    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(true);
});

suite.test("moving the playhead by hand stops playback", () => {
    let {playhead, clock} = playheadOver(4);

    playhead.togglePlay();
    playhead.next();

    assertThat(playhead.step()).isEqualTo(1);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);
});

suite.test("an overlay blocks the controls and stops playback", () => {
    let {playhead, overlays} = playheadOver(3);
    playhead.togglePlay();

    overlays.open("menu");

    assertThat(playhead.state().snapshot()).isEqualTo([{
        step: 0,
        columnCount: 3,
        playing: false,
        canPlay: false,
        canStepBack: false,
        canStepForward: false
    }]);
});

suite.test("an empty circuit has nothing to play", () => {
    let {playhead, clock} = playheadOver(0);

    playhead.togglePlay();

    assertThat(playhead.state().snapshot()[0].canPlay).isEqualTo(false);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);
});

suite.test("shortening the circuit pulls the playhead back to the new end", () => {
    let {playhead, columns} = playheadOver(5);
    playhead.end();

    columns.set(2);
    assertThat(playhead.step()).isEqualTo(2);

    columns.set(6);
    assertThat(playhead.step()).isEqualTo(2);
});
