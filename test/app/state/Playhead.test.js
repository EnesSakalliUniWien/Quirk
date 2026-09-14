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

import {createValueStore, observeStore} from '../../../src/base/valueStore.js';
import {Suite, assertThat} from "../../TestUtil.js"

import {Playhead} from "../../../src/app/state/Playhead.js"

const suite = new Suite("Playhead");

/**
 * Stands in for setInterval, so tests advance playback by hand instead of by waiting.
 */
function fakeClock() {
    const callbacks = [];
    return {
        setInterval: callback => callbacks.push(callback),
        clearInterval: id => { callbacks[id - 1] = undefined; },
        pendingCount: () => callbacks.filter(e => e !== undefined).length,
        tick: () => {
            for (const callback of [...callbacks]) {
                if (callback !== undefined) {
                    callback();
                }
            }
        }
    };
}

function playheadOver(columnCount) {
    const columns = createValueStore(columnCount);
    const clock = fakeClock();
    const playhead = new Playhead(observeStore(columns), clock.setInterval, clock.clearInterval);
    return {playhead, columns, clock};
}

suite.test("starts before the first column", () => {
    const {playhead} = playheadOver(3);

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
    const {playhead} = playheadOver(2);

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
    const {playhead} = playheadOver(4);

    playhead.end();
    assertThat(playhead.step()).isEqualTo(4);
    assertThat(playhead.state().snapshot()[0].canStepForward).isEqualTo(false);

    playhead.reset();
    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()[0].canStepBack).isEqualTo(false);
});

suite.test("seek rounds and clamps", () => {
    const {playhead} = playheadOver(3);

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
    const {playhead, clock} = playheadOver(2);

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
    const {playhead} = playheadOver(2);

    playhead.end();
    playhead.togglePlay();

    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(true);
});

suite.test("moving the playhead by hand stops playback", () => {
    const {playhead, clock} = playheadOver(4);

    playhead.togglePlay();
    playhead.next();

    assertThat(playhead.step()).isEqualTo(1);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);
});


suite.test("an empty circuit has nothing to play", () => {
    const {playhead, clock} = playheadOver(0);

    playhead.togglePlay();

    assertThat(playhead.state().snapshot()[0].canPlay).isEqualTo(false);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);
});

suite.test("shortening the circuit pulls the playhead back to the new end", () => {
    const {playhead, columns} = playheadOver(5);
    playhead.end();

    columns.setState({value: 2});
    assertThat(playhead.step()).isEqualTo(2);

    columns.setState({value: 6});
    assertThat(playhead.step()).isEqualTo(2);
});
