/**
 * The one clock everything that moves is timed by: it says what time it is, and it calls back on
 * its frames. Whatever waits - a cooldown, the playhead's next step, a glide's next frame - waits on
 * these frames, so nothing keeps a timer of its own and everything that moves does so in step.
 *
 * The frames are the browser's animation frames, requested only while something is waiting. A page
 * that is not shown gets none, so nothing moves where nobody can see it.
 *
 * The time source and the frame source are accepted rather than created, so a test can wind the
 * clock by hand; the app shares the one `clock` below.
 */
class Clock {
    /**
     * @param {!function(): !number} nowMillisFunc
     * @param {!function(!function(): void): *} requestFrameFunc
     * @param {!function(*): void} cancelFrameFunc
     */
    constructor(nowMillisFunc = () => performance.now(),
                requestFrameFunc = callback => requestAnimationFrame(callback),
                cancelFrameFunc = request => cancelAnimationFrame(request)) {
        this._nowMillis = nowMillisFunc;
        this._requestFrame = requestFrameFunc;
        this._cancelFrame = cancelFrameFunc;
        /** @type {!Set.<!function(!number): void>} */
        this._listeners = new Set();
        /** @type {undefined|*} */
        this._request = undefined;
    }

    /**
     * @returns {!number} The time in milliseconds.
     */
    now() {
        return this._nowMillis();
    }

    /**
     * Calls back on every frame, with the time, until the returned function is called.
     *
     * @param {!function(!number): void} callback
     * @returns {!function(): void}
     */
    onFrame(callback) {
        // Wrapped, so one callback given twice is two listeners, each with its own end.
        const listener = now => callback(now);
        this._listeners.add(listener);
        this._schedule();
        return () => {
            this._listeners.delete(listener);
            if (this._listeners.size === 0 && this._request !== undefined) {
                this._cancelFrame(this._request);
                this._request = undefined;
            }
        };
    }

    /**
     * Calls back once, on the first frame at least `millis` from now - never before the next frame.
     *
     * @param {!number} millis
     * @param {!function(!number): void} callback
     * @returns {!function(): void} Cancels the call.
     */
    after(millis, callback) {
        const due = this.now() + millis;
        const cancel = this.onFrame(now => {
            if (now >= due) {
                cancel();
                callback(now);
            }
        });
        return cancel;
    }

    /**
     * Calls back every `millis`, on the first frame each period has passed by, until the returned
     * function is called. A period missed whole, behind a hidden page, is not made up for.
     *
     * @param {!number} millis
     * @param {!function(!number): void} callback
     * @returns {!function(): void}
     */
    every(millis, callback) {
        let due = this.now() + millis;
        return this.onFrame(now => {
            if (now >= due) {
                due = due + millis > now ? due + millis : now + millis;
                callback(now);
            }
        });
    }

    /**
     * @private
     */
    _schedule() {
        if (this._request !== undefined || this._listeners.size === 0) return;
        this._request = this._requestFrame(() => {
            this._request = undefined;
            const now = this.now();
            try {
                // A listener added during a frame waits for the next one.
                for (const listener of [...this._listeners]) {
                    if (this._listeners.has(listener)) listener(now);
                }
            } finally {
                this._schedule();
            }
        });
    }
}

/** The app's clock. */
const clock = new Clock();

export {Clock, clock};
