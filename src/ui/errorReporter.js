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

import {describe} from "../base/Describe.js"

/**
 * The app's error surface: a dismissible banner over the circuit area, fed by the global error
 * handlers and by the places that recover from a failure instead of crashing. Non-modal on
 * purpose - every report is either a recovery (the app keeps working) or an environment problem
 * (nothing to interact with anyway), so nothing here should steal focus or evict an open dialog.
 */

const NEW_ISSUE_URL = 'https://github.com/EnesSakalliUniWien/Quirk/issues/new?title=';

/**
 * How long a fresh banner survives circuit changes. The change that *caused* a recovery (like a
 * broken URL committing its defaulted circuit) arrives within milliseconds of the report, and
 * must not dismiss the message it produced.
 */
const EDIT_DISMISS_GRACE_MILLIS = 2000;

/**
 * Browser noise that must never banner. The ResizeObserver overflow warnings are benign by
 * specification - the missed notifications are simply redelivered on the next frame - and the
 * redraw loop's own observer resizes the canvas it watches beside, so they fire in normal use.
 */
const IGNORED_ERROR_PATTERNS = [
    /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/,
];

/**
 * @type {undefined|!{
 *     host: !HTMLElement,
 *     prevOnError: *,
 *     onUnhandledRejection: !function(*): void,
 *     banner: undefined|!{kind: !string, title: !string, count: !number},
 *     elements: undefined|*,
 * }}
 */
let _state = undefined;

/**
 * @param {!string} subject
 * @param {*} context
 * @param {*} error
 * @returns {!string}
 */
function formatDetails(subject, context, error) {
    return [
        subject,
        '',
        'URL',
        String(document.location),
        '',
        'BROWSER',
        window.navigator.userAgent,
        '',
        'CONTEXT',
        describe(context),
        '',
        'ERROR',
        describe(error),
        '',
        'STACK',
        (error instanceof Object && error.stack) || 'unknown',
    ].join('\n');
}

/**
 * Builds the banner's DOM on first use; the host div ships empty in the page template.
 * @returns {*}
 */
function bannerElements() {
    if (_state.elements !== undefined) {
        return _state.elements;
    }

    let banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.id = 'error-banner';
    banner.hidden = true;

    let message = document.createElement('span');
    message.className = 'error-banner-message';
    message.id = 'error-banner-message';
    // An alert, so screen readers announce the failure without the banner stealing focus.
    message.setAttribute('role', 'alert');

    let count = document.createElement('span');
    count.className = 'error-banner-count';
    count.hidden = true;

    let copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'error-banner-button';
    copyButton.textContent = 'Copy details';
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(_state.detailsText || '').then(() => {
            copyButton.textContent = 'Copied';
            setTimeout(() => copyButton.textContent = 'Copy details', 1500);
        }, () => {});
    });

    let reportAnchor = document.createElement('a');
    reportAnchor.className = 'error-banner-button';
    reportAnchor.textContent = 'Report an issue';
    reportAnchor.target = '_blank';
    reportAnchor.rel = 'noreferrer noopener';

    let dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'error-banner-button error-banner-dismiss';
    dismissButton.textContent = '×';
    dismissButton.setAttribute('aria-label', 'Dismiss the error message');
    dismissButton.addEventListener('click', dismissErrorBanner);

    banner.append(message, count, copyButton, reportAnchor, dismissButton);
    _state.host.appendChild(banner);
    _state.elements = {banner, message, count, copyButton, reportAnchor, dismissButton};
    return _state.elements;
}

/**
 * @param {!{kind: !string, title: !string, detailsText: !string}} report
 */
function showBanner(report) {
    let els = bannerElements();
    if (_state.banner !== undefined && _state.banner.title === report.title) {
        _state.banner.count += 1;
    } else {
        _state.banner = {kind: report.kind, title: report.title, count: 1};
        els.message.textContent = report.title;
        els.reportAnchor.href = NEW_ISSUE_URL + encodeURIComponent('Encountered error: ' + report.title);
    }
    _state.detailsText = report.detailsText;
    _state.shownAt = Date.now();
    els.count.textContent = '×' + _state.banner.count;
    els.count.hidden = _state.banner.count < 2;
    // Environment problems aren't reportable bugs; the details buttons only accompany crashes.
    els.copyButton.hidden = report.kind === 'blocking';
    els.reportAnchor.hidden = report.kind === 'blocking';
    els.banner.hidden = false;
}

/**
 * Installs the global error handlers and remembers where the banner lives. Returns an uninstall
 * function that restores the previous handlers, so the shared browser test page can hook and
 * unhook without leaking a handler that would swallow later suites' real failures.
 *
 * @param {!HTMLElement=} host
 * @returns {!function(): void}
 */
function installErrorReporter(host = /** @type {!HTMLElement} */ document.getElementById('error-banner-root')) {
    let prevOnError = window.onerror;
    let onUnhandledRejection = ev => {
        reportUnexpectedError(ev.reason instanceof Object && ev.reason.message || String(ev.reason), ev.reason);
        ev.preventDefault();
    };
    _state = {host, prevOnError, onUnhandledRejection, banner: undefined, elements: undefined};

    window.onerror = (errorMsg, url, lineNumber, columnNumber, errorObj) => {
        reportUnexpectedError(String(errorMsg), errorObj);
        return false;
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
        window.onerror = prevOnError;
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
        if (_state.elements !== undefined) {
            _state.elements.banner.remove();
        }
        _state = undefined;
    };
}

/**
 * @param {!string} subject
 * @param {*} error
 */
function reportUnexpectedError(subject, error) {
    try {
        if (_state === undefined || IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(subject))) {
            return;
        }
        if (_state.banner !== undefined && _state.banner.kind === 'blocking') {
            // The environment banner already explains the root cause; crash spam only counts up.
            _state.banner.count += 1;
            bannerElements().count.textContent = '×' + _state.banner.count;
            bannerElements().count.hidden = false;
            return;
        }
        showBanner({
            kind: 'recovered',
            title: 'An error happened. ' + subject,
            detailsText: formatDetails(subject, {source: 'global handler'}, error),
        });
    } catch (ex) {
        console.error('Caused an exception when handling an unexpected error.', ex);
    }
}

/**
 * Reports an error that was recovered from, then keeps going. THROWS the error instead when the
 * reporter was never installed: the browser test page doesn't install it, so recovery sites keep
 * surfacing real exceptions under test instead of quietly defaulting.
 *
 * @param {!string} recovery A short description of what happened and how it was recovered from.
 * @param {*} context Details about what caused the error.
 * @param {*} error The exception object.
 */
function reportRecoveredError(recovery, context, error) {
    if (_state === undefined) {
        throw error;
    }
    console.error('Recovered from unexpected error', {recovery, context, error});
    if (_state.banner !== undefined && _state.banner.kind === 'blocking') {
        _state.banner.count += 1;
        bannerElements().count.textContent = '×' + _state.banner.count;
        bannerElements().count.hidden = false;
        return;
    }
    showBanner({kind: 'recovered', title: recovery, detailsText: formatDetails(recovery, context, error)});
}

/**
 * A persistent banner for environment problems, such as WebGL being unavailable. Editing the
 * circuit never hides it, because the environment doesn't get better by editing.
 * @param {!string} message
 */
function reportBlockingIssue(message) {
    if (_state === undefined) {
        return;
    }
    showBanner({kind: 'blocking', title: message, detailsText: ''});
}

/**
 * Called whenever the circuit changes: an old recovery message is stale once the user has moved
 * on, and a still-live problem will simply re-raise the banner. A fresh banner survives the
 * change that produced it, via the grace period.
 * @param {!number=} now Injectable for tests.
 */
function noteCircuitEdited(now = Date.now()) {
    if (_state === undefined || _state.banner === undefined || _state.banner.kind === 'blocking') {
        return;
    }
    if (now - _state.shownAt < EDIT_DISMISS_GRACE_MILLIS) {
        return;
    }
    dismissErrorBanner();
}

function dismissErrorBanner() {
    if (_state === undefined || _state.elements === undefined) {
        return;
    }
    _state.elements.banner.hidden = true;
    _state.banner = undefined;
}

export {installErrorReporter, reportRecoveredError, reportBlockingIssue, noteCircuitEdited, dismissErrorBanner}
