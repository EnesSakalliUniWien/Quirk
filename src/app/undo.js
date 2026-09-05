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
 * Interface note: also requires #undo-button and #redo-button, rendered by
 * src/components/app-toolbar.jsx before this runs.
 *
 * @param {!CircuitActions} circuitActions
 */
function initUndoRedo(circuitActions) {
    const undoButton = /** @type {!HTMLButtonElement} */ document.getElementById('undo-button');
    const redoButton = /** @type {!HTMLButtonElement} */ document.getElementById('redo-button');

    let latestAvailability = {canUndo: false, canRedo: false};
    circuitActions.availability().subscribe(availability => {
        latestAvailability = availability;
        undoButton.disabled = !availability.canUndo;
        redoButton.disabled = !availability.canRedo;
    });

    undoButton.addEventListener('click', () => circuitActions.undo());
    redoButton.addEventListener('click', () => circuitActions.redo());

    document.addEventListener("keydown", e => {
        // Control on Windows and Linux, command on macOS.
        if (!(e.ctrlKey || e.metaKey) || e.altKey) {
            return;
        }

        let key = e.key.toLowerCase();
        let isUndo = key === 'z' && !e.shiftKey;
        let isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);

        // Availability already accounts for open overlays, so the shortcuts and the buttons stay in sync.
        if (isUndo && latestAvailability.canUndo) {
            circuitActions.undo();
            e.preventDefault();
        } else if (isRedo && latestAvailability.canRedo) {
            circuitActions.redo();
            e.preventDefault();
        }
    });
}

export {initUndoRedo}
