import { isTextEntry } from './typingTarget.js';

/** Light only when the system says so; a browser that cannot say gets the dark palette. */
const LIGHT_QUERY = '(prefers-color-scheme: light)';

/**
 * @returns {'light'|'dark'} The palette the system's appearance asks for. The app has no appearance
 *     setting of its own: it looks the way the system does, as every other app on the device does.
 */
export function systemColourScheme() {
    try {
        return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

/**
 * Follows the system's appearance while the app runs, as when an automatic appearance turns dark in
 * the evening. Every theme module works out its colours once, when it loads, so a new appearance is
 * applied by starting the app again: the circuit is in the address and the dock remembers its
 * arrangement, so the reload comes back to the same work, and the browser's history still steps
 * back through the edits.
 *
 * The reload waits for a moment with nothing in hand - no press held down and no text field being
 * typed in - so a drag or an entry in progress is never cut short. A hidden page reloads at once.
 *
 * @param {!function(): ('light'|'dark')} shownScheme The palette the app is showing now.
 * @param {!function(): void=} reload
 * @returns {void}
 */
export function followSystemColourScheme(shownScheme, reload = () => window.location.reload()) {
    let pressed = false;
    let pending = false;
    const busy = () => document.visibilityState !== 'hidden' &&
        (pressed || (document.activeElement !== null && isTextEntry(document.activeElement)));
    const attempt = () => {
        if (pending && !busy()) {
            pending = false;
            reload();
        }
    };

    document.addEventListener('pointerdown', () => { pressed = true; }, true);
    for (const type of ['pointerup', 'pointercancel']) {
        document.addEventListener(type, () => {
            pressed = false;
            // After the release has done its work: a drop commits on this same event.
            setTimeout(attempt, 0);
        }, true);
    }
    document.addEventListener('focusout', () => setTimeout(attempt, 0), true);
    document.addEventListener('visibilitychange', attempt);

    window.matchMedia(LIGHT_QUERY).addEventListener('change', () => {
        pending = systemColourScheme() !== shownScheme();
        attempt();
    });
}
