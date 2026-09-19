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

import { clock as appClock } from "./Clock.js";

/**
 * Performs an action when triggered, but defers the action if it happens too soon after the last one.
 *
 * Triggering multiple times during the cooldown period only results in one action being performed.
 *
 * The cooldown runs on the app's clock, like everything else that waits: a deferred action comes
 * back on the first of the clock's frames after the cooldown.
 */
class CooldownThrottle {
  /**
   * @param {!function() : void} action
   * @param {!number} cooldownMs
   * @param {!number} slowActionCooldownPumpUpFactor
   * @param {!Clock} clock
   * @constructor
   */
  constructor(
    action,
    cooldownMs,
    slowActionCooldownPumpUpFactor = 0,
    clock = appClock,
  ) {
    /** @type {!function() : void} */
    this.action = action;
    /** @type {!number} */
    this.cooldownDuration = cooldownMs;
    /** @type {!number} */
    this.slowActionCooldownPumpupFactor = slowActionCooldownPumpUpFactor;
    /** @type {!Clock} */
    this._clock = clock;

    /**
     * @type {!string}
     * @private
     */
    this._state = "idle";
    /**
     * @type {!number}
     * @private
     */
    this._cooldownStartTime = -Infinity;
  }

  _triggerIdle() {
    // Still cooling down?
    const remainingCooldownDuration =
      this.cooldownDuration - (this._clock.now() - this._cooldownStartTime);
    if (remainingCooldownDuration > 0) {
      this._forceIdleTriggerAfter(remainingCooldownDuration);
      return;
    }

    // Go go go!
    this._state = "running";
    const t0 = this._clock.now();
    try {
      this.action();
    } finally {
      const dt = this._clock.now() - t0;
      this._cooldownStartTime =
        this._clock.now() + dt * this.slowActionCooldownPumpupFactor;
      // Were there any triggers while we were running?
      if (this._state === "running-and-triggered") {
        this._forceIdleTriggerAfter(this.cooldownDuration);
      } else {
        this._state = "idle";
      }
    }
  }

  /**
   * Asks for the action to be performed as soon as possible.
   * (No effect if the action was already requested but not performed yet.)
   */
  trigger() {
    switch (this._state) {
      case "idle":
        this._triggerIdle();
        break;
      case "waiting":
        // Already triggered. Do nothing.
        break;
      case "running":
        // Re-trigger.
        this._state = "running-and-triggered";
        break;
      case "running-and-triggered":
        // Already re-triggered. Do nothing.
        break;
      default:
        throw new Error("Unrecognized throttle state: " + this._state);
    }
  }

  /**
   * @private
   */
  _forceIdleTriggerAfter(duration) {
    this._state = "waiting";
    this._clock.after(duration, () => {
      this._state = "idle";
      this._cooldownStartTime = -Infinity;
      this.trigger();
    });
  }
}

export { CooldownThrottle };
