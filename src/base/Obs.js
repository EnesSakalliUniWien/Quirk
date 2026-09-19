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

import { createStore } from "zustand/vanilla";

import { CooldownThrottle } from "./CooldownThrottle.js";

/**
 * An observable sequence of events.
 *
 * WARNING: this class is not written to be re-entrant safe! If an observable ends up triggering itself, there may be
 * unexpected bugs.
 */
class Observable {
  /**
   * @param {!function(!function(T):void): (!function():void)} subscribe
   * @template T
   */
  constructor(subscribe) {
    /**
     * @type {!(function(!(function(T): void)): !(function(): void))}
     * @template T
     * @private
     */
    this._subscribe = subscribe;
  }

  /**
   * @param {!function(T):void} observer
   * @returns {!function():void} unsubscriber
   * @template T
   */
  subscribe(observer) {
    return this._subscribe(observer);
  }

  /**
   * @param {T} items
   * @returns {!Observable.<T>} An observable that immediately forwards all the given items to any new subscriber.
   * @template T
   */
  static of(...items) {
    return new Observable((observer) => {
      for (const item of items) {
        observer(item);
      }
      return () => {};
    });
  }

  /**
   * Subscribes to the receiving observable for a moment and returns any collected items.
   * @returns {!Array.<T>}
   * @template T
   */
  snapshot() {
    const result = [];
    const unsub = this.subscribe((e) => result.push(e));
    unsub();
    return result;
  }

  /**
   * @param {!function(TIn) : TOut} transformFunc
   * @returns {!Observable.<TOut>} An observable with the same items, but transformed by the given function.
   * @template TIn, TOut
   */
  map(transformFunc) {
    return new Observable((observer) =>
      this.subscribe((item) => observer(transformFunc(item))),
    );
  }

  /**
   * @param {!function(T) : !boolean} predicate
   * @returns {!Observable.<T>} An observable with the same items, but skipping items that don't match the predicate.
   * @template T
   */
  filter(predicate) {
    return new Observable((observer) =>
      this.subscribe((item) => {
        if (predicate(item)) {
          observer(item);
        }
      }),
    );
  }

  /**
   * @param {!Observable.<T2>} other
   * @param {!function(T1, T2): TOut} mergeFunc
   * @returns {!Observable.<TOut>}
   * @template T1, T2, TOut
   */
  zipLatest(other, mergeFunc) {
    return new Observable((observer) => {
      let has1 = false;
      let has2 = false;
      let last1;
      let last2;
      const unreg1 = this.subscribe((e1) => {
        last1 = e1;
        has1 = true;
        if (has2) {
          observer(mergeFunc(last1, last2));
        }
      });
      const unreg2 = other.subscribe((e2) => {
        last2 = e2;
        has2 = true;
        if (has1) {
          observer(mergeFunc(last1, last2));
        }
      });
      return () => {
        unreg1();
        unreg2();
      };
    });
  }

  /**
   * @returns {!Observable.<T>} An observable that subscribes to each sub-observables arriving on this observable
   * in turns, only forwarding items from the latest sub-observable.
   * @template T
   */
  flattenLatest() {
    return new Observable((observer) => {
      let unregLatest = () => {};
      let isDone = false;
      const unregAll = this.subscribe((subObservable) => {
        if (isDone) {
          return;
        }
        const prevUnreg = unregLatest;
        unregLatest = subObservable.subscribe(observer);
        prevUnreg();
      });
      return () => {
        isDone = true;
        unregLatest();
        unregAll();
      };
    });
  }

  /**
   * @param {!function(T):void} action
   * @returns {!Observable.<T>}
   * @template T
   */
  peek(action) {
    return this.map((e) => {
      action(e);
      return e;
    });
  }

  /**
   * @returns {!Observable.<T>} An observable that forwards all the items from all the observables observed by the
   * receiving observable of observables.
   * @template T
   */
  flatten() {
    return new Observable((observer) => {
      const unsubs = [];
      unsubs.push(
        this.subscribe((observable) =>
          unsubs.push(observable.subscribe(observer)),
        ),
      );
      return () => {
        for (const unsub of unsubs) {
          unsub();
        }
      };
    });
  }

  /**
   * Starts a timer after each completed send, delays sending any more values until the timer expires, and skips
   * intermediate values when a newer value arrives from the source while the timer is still running down.
   * @param {!number} cooldownMillis
   * @returns {!Observable.<T>}
   * @template T
   */
  throttleLatest(cooldownMillis) {
    return new Observable((observer) => {
      let latest = undefined;
      let isKilled = false;
      const throttle = new CooldownThrottle(() => {
        if (!isKilled) {
          observer(latest);
        }
      }, cooldownMillis);
      const unsub = this.subscribe((e) => {
        latest = e;
        throttle.trigger();
      });
      return () => {
        isKilled = true;
        unsub();
      };
    });
  }

  /**
   * @param {!HTMLElement|!HTMLDocument} element
   * @param {!string} eventKey
   * @returns {!Observable.<*>} An observable corresponding to an event fired from an element.
   */
  static elementEvent(element, eventKey) {
    return new Observable((observer) => {
      element.addEventListener(eventKey, observer);
      return () => element.removeEventListener(eventKey, observer);
    });
  }

  /**
   *
   * @param {!int} count
   * @returns {!Observable.<T>}
   * @template T
   */
  skip(count) {
    return new Observable((observer) => {
      let remaining = count;
      return this.subscribe((item) => {
        if (remaining > 0) {
          remaining -= 1;
        } else {
          observer(item);
        }
      });
    });
  }

  /**
   * @returns {!Observable.<T>} An observable with the same events, but filtering out any event value that's the same
   * as the previous one.
   * @template T
   */
  whenDifferent(equater = undefined) {
    const eq = equater || ((e1, e2) => e1 === e2);
    return new Observable((observer) => {
      let hasLast = false;
      let last = undefined;
      return this.subscribe((item) => {
        if (!hasLast || !eq(last, item)) {
          last = item;
          hasLast = true;
          observer(item);
        }
      });
    });
  }
}

/** Event streams use a fresh envelope so repeated events still notify. */
class ObservableSource {
  constructor() {
    this._store = createStore(() => ({ value: undefined }));
    this._observable = new Observable((observer) =>
      this._store.subscribe((state) => observer(state.value)),
    );
  }
  observable() {
    return this._observable;
  }
  send(value) {
    this._store.setState({ value });
  }
}

export { Observable, ObservableSource };
