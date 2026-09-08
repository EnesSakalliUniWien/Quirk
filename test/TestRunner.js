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

import {disposeTestScenes} from './draw/TestDisplayView.js';
import {Suite} from './TestUtil.js';

const TEST_SUITE_NAME_FILTER = /** @type {!RegExp|undefined} */ undefined;
const TEST_NAME_FILTER = /** @type {!RegExp|undefined} */ undefined;
const TEST_REPETITIONS = 1;

const tryPromiseRun = method => {
    try {
        return Promise.resolve(method());
    } catch (ex) {
        return Promise.reject(ex);
    }
};

/**
 * @param {!Suite} suite
 * @param {!string} name
 * @param {!function(status: *): (!Promise|*)} method
 * @param {!int} reps
 * @returns {!Promise}
 */
const promiseRepeatTest = (suite, name, method, reps) => {
    let root = promiseRunTest(suite, name, method);
    for (let k = 1; k < reps; k++) {
        root = root.then(e => e.success ? promiseRunTest(suite, name, method) : e);
    }
    return root;
};

/**
 * @param {!Suite} suite
 * @param {!string} name
 * @param {!function(status: *): (!Promise|*)} method
 * @returns {!Promise}
 */
const promiseRunTest = (suite, name, method) => {
    const result = {
        description: name,
        suite: [suite.name],
        success: false,
        log: [],
        time: undefined
    };
    const status = {warn_only: false, log: result.log};

    let t0;
    let t1;
    const promise = tryPromiseRun(() => {
        t0 = performance.now();
        const result = method(status);
        t1 = performance.now(); // Hack: only measures the synchronous time.
        return result;
    });
    const finish = () => {
        result.time = t1 - t0;
        if (result.time > 5000) {
            console.warn(`${suite.name}.${name} took ${Math.ceil(result.time)}ms to run.`)
        }
        __testRunner__.result(result);
        return result;
    };

    return promise.then(() => {
        result.success = true;
        if (status.warn_only && !status.ignore_warn_only_on_success) {
            console.warn(`${suite.name}.${name} passed, but is set to warn_only (${status.warn_only})`);
        }
        return finish();
    }, ex => {
        const msg = String(ex);
        result.log.push(msg);
        if (ex.details !== undefined) {
            result.log.push(ex.details);
        }
        if (ex.stack !== undefined) {
            let stackMsg = String(ex.stack);
            if (stackMsg.startsWith(msg)) {
                stackMsg = stackMsg.slice(msg.length);
            }
            result.log.push(stackMsg);
        }
        if (status.warn_only) {
            const msg = status.warn_failure_message !== undefined ?
                status.warn_failure_message :
                `${suite.name}.${name} FAILED, but is set to warn_only (${status.warn_only})`;
            console.warn(msg);

            if (status.warn_show_error) {
                for (const logMsg of result.log) {
                    for (const line of logMsg.split('\n')) {
                        console.warn('(ignored) ' + line);
                    }
                }
            }
        }
        result.success = status.warn_only;
        return finish();
    });
};

__testRunner__.start = () => {
    if (TEST_SUITE_NAME_FILTER !== undefined || TEST_NAME_FILTER !== undefined) {
        console.warn("TEST FILTERS IN EFFECT:");
        console.warn("    SUITE=" + TEST_SUITE_NAME_FILTER);
        console.warn("    TEST=" + TEST_NAME_FILTER);
    }
    const keptSuites = Suite.suites.
        filter(e => TEST_SUITE_NAME_FILTER === undefined || TEST_SUITE_NAME_FILTER.test(e.name));

    let total = 0;
    for (const suite of keptSuites) {
        total += suite.testsMatching(TEST_NAME_FILTER, false).length
            + suite.testsMatching(TEST_NAME_FILTER, true).length;
        if (suite.tests.length + suite.later_tests.length === 0) {
            console.warn(`Empty test suite: ${suite.name}`);
        }
    }
    __testRunner__.info({ total: total });

    let chain = Promise.resolve();

    for (const later of [false, true]) {
        for (const suite of keptSuites) {
            chain = chain.then(() => new Promise(resolver => setTimeout(() => {
                const suiteResult = Promise.all(
                    suite.testsMatching(TEST_NAME_FILTER, later).
                        map(e => promiseRepeatTest(suite, e[0], e[1], TEST_REPETITIONS)));
                suiteResult.catch(() => console.error(`${suite.name} suite failed`));
                suiteResult.finally(resolver);
            }, 0)));
        }
    }

    return chain.then(disposeTestScenes).then(() => __testRunner__.complete());
};
