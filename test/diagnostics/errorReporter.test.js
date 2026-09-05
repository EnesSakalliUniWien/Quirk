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

import {Suite, assertThat, assertTrue} from "../TestUtil.js"
import {
    installErrorReporter,
    reportRecoveredError,
    reportBlockingIssue,
    noteCircuitEdited,
    dismissErrorBanner,
} from "../../src/diagnostics/errorReporter.js"

let suite = new Suite("errorReporter");

/**
 * Runs a body with the reporter installed on a scratch host, then uninstalls no matter what, so
 * the shared test page never keeps a global error handler that would swallow later failures.
 */
function withInstalledReporter(body) {
    let host = document.createElement('div');
    document.body.appendChild(host);
    let uninstall = installErrorReporter(host);
    try {
        body(host);
    } finally {
        uninstall();
        host.remove();
    }
}

const bannerIn = host => host.querySelector('.error-banner');
const messageIn = host => host.querySelector('.error-banner-message');
const countIn = host => host.querySelector('.error-banner-count');

suite.test("rethrows_the_exact_error_when_not_installed", () => {
    let error = new Error("test-only failure");
    try {
        reportRecoveredError("Defaulted to nothing.", {}, error);
        assertTrue(false);
    } catch (ex) {
        assertTrue(ex === error);
    }
});

suite.test("shows_an_alert_banner_for_a_recovered_error", () => {
    withInstalledReporter(host => {
        reportRecoveredError("Defaulted to an empty circuit.", {detail: 1}, new Error("boom"));

        assertThat(bannerIn(host).hidden).isEqualTo(false);
        assertThat(messageIn(host).getAttribute('role')).isEqualTo('alert');
        assertThat(messageIn(host).textContent).isEqualTo("Defaulted to an empty circuit.");
    });
});

suite.test("counts_repeats_and_resets_on_a_different_error", () => {
    withInstalledReporter(host => {
        reportRecoveredError("Same problem.", {}, new Error("a"));
        reportRecoveredError("Same problem.", {}, new Error("a"));
        assertThat(countIn(host).hidden).isEqualTo(false);
        assertThat(countIn(host).textContent).isEqualTo('×2');

        reportRecoveredError("Different problem.", {}, new Error("b"));
        assertThat(messageIn(host).textContent).isEqualTo("Different problem.");
        assertThat(countIn(host).hidden).isEqualTo(true);
    });
});

suite.test("dismisses_and_hides_on_circuit_edit", () => {
    withInstalledReporter(host => {
        reportRecoveredError("Oops.", {}, new Error("x"));
        dismissErrorBanner();
        assertThat(bannerIn(host).hidden).isEqualTo(true);

        // The edit that caused the report arrives within the grace period and must not hide it;
        // a later edit does.
        reportRecoveredError("Oops.", {}, new Error("x"));
        noteCircuitEdited();
        assertThat(bannerIn(host).hidden).isEqualTo(false);
        noteCircuitEdited(Date.now() + 60 * 1000);
        assertThat(bannerIn(host).hidden).isEqualTo(true);
    });
});

suite.test("keeps_a_blocking_banner_through_edits_and_crash_spam", () => {
    withInstalledReporter(host => {
        reportBlockingIssue("No WebGL.");
        noteCircuitEdited();
        assertThat(bannerIn(host).hidden).isEqualTo(false);
        assertThat(messageIn(host).textContent).isEqualTo("No WebGL.");

        // Later crashes only bump the count instead of hiding the root cause.
        reportRecoveredError("Defaulted to NaN results.", {}, new Error("gl"));
        assertThat(messageIn(host).textContent).isEqualTo("No WebGL.");
        assertThat(countIn(host).textContent).isEqualTo('×2');
    });
});

suite.test("ignores_the_benign_resize_observer_warnings", () => {
    withInstalledReporter(host => {
        window.onerror('ResizeObserver loop completed with undelivered notifications.', '', 0, 0, undefined);
        window.onerror('ResizeObserver loop limit exceeded', '', 0, 0, undefined);
        assertTrue(bannerIn(host) === null || bannerIn(host).hidden);

        // A real error still banners through the same handler.
        window.onerror('boom', '', 0, 0, new Error('boom'));
        assertThat(bannerIn(host).hidden).isEqualTo(false);
    });
});

suite.test("banners_an_unhandled_rejection_and_suppresses_the_default_log", () => {
    if (typeof PromiseRejectionEvent === 'undefined') {
        return;
    }
    withInstalledReporter(host => {
        // A synthetic event; the promise field is an already-settled placeholder so the test
        // doesn't create a second, real unhandled rejection.
        let ev = new PromiseRejectionEvent('unhandledrejection', {
            promise: Promise.resolve(),
            reason: new Error("late failure"),
            cancelable: true,
        });
        window.dispatchEvent(ev);

        assertThat(bannerIn(host).hidden).isEqualTo(false);
        assertTrue(messageIn(host).textContent.includes("late failure"));
        assertTrue(ev.defaultPrevented);
    });
});
