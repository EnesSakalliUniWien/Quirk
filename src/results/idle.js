// Browsers with no idle signal at all (Safari has neither of the first two) can only leave the
// next few frames time to draw before the work starts.
const FALLBACK_DELAY_MILLIS = 100;
// A page that never idles still gets its background work done, only later.
const IDLE_TIMEOUT_MILLIS = 2000;

/**
 * Runs `task` once nothing more urgent waits: a background-priority task where the scheduler
 * offers them, else an idle callback, else a timer. `host` is the global scope to ask.
 *
 * @param {() => void} task
 * @param {!Object<string, *>=} host
 */
function whenIdle(task, host = globalThis) {
  if (typeof host.scheduler?.postTask === "function") {
    host.scheduler.postTask(task, { priority: "background" });
  } else if (typeof host.requestIdleCallback === "function") {
    host.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MILLIS });
  } else {
    host.setTimeout(task, FALLBACK_DELAY_MILLIS);
  }
}

export { whenIdle };
