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
import {operationSchedule} from '../../../src/circuit/operationColumns.js';
import {Serializer} from '../../../src/serialization/Serializer.js';
import {CircuitDefinition} from '../../../src/circuit/model/CircuitDefinition.js';

const suite = new Suite("Playhead");

suite.test("operation stops skip displays and empty columns but retain measurements and mixed columns", () => {
    const circuit = Serializer.fromJson(CircuitDefinition, {cols: [
        ['Amps1'], [], ['H'], ['Bloch'], ['Density'], ['Chance'], ['Sample1'],
        ['Measure'], ['Amps1', 'X'], ['Bloch']
    ]});
    const schedule = operationSchedule(circuit);
    assertThat(schedule.operationColumns).isEqualTo([2, 7, 8]);
    const clock = fakeClock();
    const playhead = new Playhead(observeStore(createValueStore(schedule)), clock.setInterval, clock.clearInterval);
    playhead.next();
    assertThat(playhead.step()).isEqualTo(3);
    playhead.next();
    assertThat(playhead.step()).isEqualTo(8);
    playhead.next();
    assertThat(playhead.step()).isEqualTo(10);
    playhead.previous();
    assertThat(playhead.step()).isEqualTo(8);
    playhead.seekOperation(1);
    assertThat(playhead.step()).isEqualTo(3);
    playhead.reset();
    playhead.togglePlay();
    clock.tick();
    assertThat(playhead.step()).isEqualTo(3);
    clock.tick();
    assertThat(playhead.step()).isEqualTo(8);
    clock.tick();
    assertThat(playhead.step()).isEqualTo(10);
    assertThat(clock.pendingCount()).isEqualTo(0);
});

suite.test("display-only circuits cannot play and same-length edits refresh the operation stops", () => {
    const schedules = createValueStore({columnCount: 2, operationColumns: []});
    const clock = fakeClock();
    const playhead = new Playhead(observeStore(schedules), clock.setInterval, clock.clearInterval);
    playhead.togglePlay();
    assertThat(clock.pendingCount()).isEqualTo(0);
    assertThat(playhead.state().snapshot()[0].canStepForward).isEqualTo(false);
    schedules.setState({value: {columnCount: 2, operationColumns: [0]}});
    assertThat(playhead.state().snapshot()[0].canStepForward).isEqualTo(true);
    playhead.next();
    assertThat(playhead.step()).isEqualTo(2);
    assertThat(playhead.state().snapshot()[0].operationIndex).isEqualTo(1);
});

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
    const playhead = new Playhead(observeStore(columns).map(count => ({
        columnCount: count, operationColumns: Array.from({length: count}, (_, i) => i)
    })), clock.setInterval, clock.clearInterval);
    return {playhead, columns, clock};
}

suite.test("starts before the first column", () => {
    const {playhead} = playheadOver(3);

    assertThat(playhead.step()).isEqualTo(0);
    assertThat(playhead.state().snapshot()).isEqualTo([{
        step: 0,
        columnCount: 3,
        operationIndex: 0,
        operationCount: 3,
        breakpoints: [],
        nextColumn: 0,
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


suite.test("counts the operations stepped over, forwards less backwards, but not an edit's pull", () => {
    const {playhead, columns, clock} = playheadOver(4);
    assertThat(playhead.operationsStepped()).isEqualTo(0);
    playhead.next();
    playhead.next();
    assertThat(playhead.operationsStepped()).isEqualTo(2);
    playhead.previous();
    assertThat(playhead.operationsStepped()).isEqualTo(1);
    playhead.end();
    assertThat(playhead.operationsStepped()).isEqualTo(4);

    // Playing from the end steps back to the start first, then on a tick at a time.
    playhead.togglePlay();
    assertThat(playhead.operationsStepped()).isEqualTo(0);
    clock.tick();
    assertThat(playhead.operationsStepped()).isEqualTo(1);
    playhead.end();

    columns.setState({value: 2});
    assertThat(playhead.step()).isEqualTo(2);
    assertThat(playhead.operationsStepped()).isEqualTo(4);
});

suite.test("a run halts before a breakpoint, and a single step does not care", () => {
    const {playhead, clock} = playheadOver(5);
    playhead.toggleBreakpoint(2);
    playhead.toggleBreakpoint(4);
    playhead.toggleBreakpoint(7);
    assertThat(playhead.state().snapshot()[0].breakpoints).isEqualTo([2, 4]);

    // End is a debugger's continue: to the next breakpoint, and from one on to the one after.
    playhead.end();
    assertThat(playhead.step()).isEqualTo(2);
    playhead.end();
    assertThat(playhead.step()).isEqualTo(4);
    playhead.end();
    assertThat(playhead.step()).isEqualTo(5);

    playhead.reset();
    playhead.next();
    playhead.next();
    playhead.next();
    assertThat(playhead.step()).isEqualTo(3);

    playhead.reset();
    playhead.togglePlay();
    clock.tick();
    clock.tick();
    assertThat(playhead.step()).isEqualTo(2);
    assertThat(playhead.state().snapshot()[0].playing).isEqualTo(false);
    assertThat(clock.pendingCount()).isEqualTo(0);

    // Cleared, it holds nothing back; a halt column from elsewhere halts the same way.
    playhead.toggleBreakpoint(2);
    playhead.toggleBreakpoint(4);
    playhead.setHaltColumns([3]);
    playhead.end();
    assertThat(playhead.step()).isEqualTo(3);
});

suite.test("a breakpoint stands before its column's operation, whatever displays lie between", () => {
    const circuit = Serializer.fromJson(CircuitDefinition, {cols: [['H'], ['Bloch'], [], ['X'], ['Bloch']]});
    const clock = fakeClock();
    const playhead = new Playhead(
        observeStore(createValueStore(operationSchedule(circuit))), clock.setInterval, clock.clearInterval);
    playhead.toggleBreakpoint(1);
    assertThat(playhead.state().snapshot()[0].breakpoints).isEqualTo([]);
    playhead.toggleBreakpoint(3);
    playhead.end();
    assertThat(playhead.step()).isEqualTo(1);
    assertThat(playhead.state().snapshot()[0].nextColumn).isEqualTo(3);
    // A halt column after the last operation halts once every operation has run.
    playhead.toggleBreakpoint(3);
    playhead.setHaltColumns([4]);
    playhead.reset();
    playhead.end();
    assertThat(playhead.step()).isEqualTo(5);
});

suite.test("breakpoints set at once keep the operation columns, in order and once each", () => {
    const circuit = Serializer.fromJson(CircuitDefinition, {cols: [['H'], ['Bloch'], ['X'], ['Z']]});
    const clock = fakeClock();
    const playhead = new Playhead(
        observeStore(createValueStore(operationSchedule(circuit))), clock.setInterval, clock.clearInterval);
    playhead.setBreakpoints([3, 1, 0, 3, 9]);
    assertThat(playhead.breakpoints()).isEqualTo([0, 3]);
    assertThat(playhead.state().snapshot()[0].breakpoints).isEqualTo([0, 3]);
});

suite.test("breakpoints follow their columns through an edit", () => {
    const schedule = createValueStore(operationSchedule(Serializer.fromJson(CircuitDefinition, {cols: [['H'], ['X'], ['Z']]})));
    const clock = fakeClock();
    const playhead = new Playhead(observeStore(schedule), clock.setInterval, clock.clearInterval);
    playhead.setBreakpoints([1, 2]);

    // A column inserted before them shifts them; one edited in place keeps its breakpoint.
    schedule.setState({value: operationSchedule(Serializer.fromJson(CircuitDefinition, {cols: [['Y'], ['H'], ['X', 'Y'], ['Z']]}))});
    assertThat(playhead.breakpoints()).isEqualTo([2, 3]);
    // A removed column takes its breakpoint along.
    schedule.setState({value: operationSchedule(Serializer.fromJson(CircuitDefinition, {cols: [['Y'], ['H'], ['Z']]}))});
    assertThat(playhead.breakpoints()).isEqualTo([2]);
    // One that turns into a display column is no operation, and loses it.
    schedule.setState({value: operationSchedule(Serializer.fromJson(CircuitDefinition, {cols: [['Y'], ['H'], ['Bloch']]}))});
    assertThat(playhead.breakpoints()).isEqualTo([]);
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
