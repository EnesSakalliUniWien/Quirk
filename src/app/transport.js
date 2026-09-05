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

/**
 * Interface note: also requires the #playhead-* buttons, icons, scrub slider, and position
 * readout, rendered by src/components/transport-bar.jsx before this runs.
 *
 * @param {!Playhead} playhead
 */
function initTransport(playhead) {
    const resetButton = /** @type {!HTMLButtonElement} */ document.getElementById('playhead-reset-button');
    const prevButton = /** @type {!HTMLButtonElement} */ document.getElementById('playhead-prev-button');
    const playButton = /** @type {!HTMLButtonElement} */ document.getElementById('playhead-play-button');
    const playLabel = /** @type {!HTMLElement} */ document.getElementById('playhead-play-label');
    const playIcon = /** @type {!HTMLElement} */ document.getElementById('playhead-play-icon');
    const pauseIcon = /** @type {!HTMLElement} */ document.getElementById('playhead-pause-icon');
    const nextButton = /** @type {!HTMLButtonElement} */ document.getElementById('playhead-next-button');
    const endButton = /** @type {!HTMLButtonElement} */ document.getElementById('playhead-end-button');
    const scrub = /** @type {!HTMLInputElement} */ document.getElementById('playhead-scrub');
    const positionElement = /** @type {!HTMLElement} */ document.getElementById('playhead-position');

    playhead.state().subscribe(state => {
        resetButton.disabled = !state.canStepBack;
        prevButton.disabled = !state.canStepBack;
        playButton.disabled = !state.canPlay;
        nextButton.disabled = !state.canStepForward;
        endButton.disabled = !state.canStepForward;

        playLabel.textContent = state.playing ? 'Pause' : 'Play';
        playIcon.hidden = state.playing;
        pauseIcon.hidden = !state.playing;
        playButton.setAttribute('aria-pressed', state.playing ? 'true' : 'false');

        scrub.max = String(state.columnCount);
        scrub.value = String(state.step);
        scrub.disabled = !state.canPlay;
        // A column is what executes at once, and in practice holds a single gate, so ket's gate
        // counter reads the same here.
        positionElement.textContent = `gate ${state.step} / ${state.columnCount}`;
    });

    resetButton.addEventListener('click', () => playhead.reset());
    prevButton.addEventListener('click', () => playhead.previous());
    playButton.addEventListener('click', () => playhead.togglePlay());
    nextButton.addEventListener('click', () => playhead.next());
    endButton.addEventListener('click', () => playhead.end());
    scrub.addEventListener('input', () => playhead.seek(parseInt(scrub.value, 10)));

    // Space plays and pauses, but only when nothing else claims the key: on the page body or the
    // circuit area. A focused button or text field keeps Space for itself.
    document.addEventListener('keydown', ev => {
        if (ev.key !== ' ' || ev.ctrlKey || ev.metaKey || ev.altKey) {
            return;
        }
        if (ev.target !== document.body && ev.target.id !== 'canvasDiv') {
            return;
        }
        playhead.togglePlay();
        ev.preventDefault();
    });
}

export {initTransport}
