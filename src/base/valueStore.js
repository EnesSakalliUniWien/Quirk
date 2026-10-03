import {createStore} from 'zustand/vanilla';
import {subscribeWithSelector} from 'zustand/middleware';
import {Observable} from './Obs.js';

export function createValueStore(value) {
    return createStore(subscribeWithSelector(() => ({value})));
}

/**
 * Compatibility with event-stream consumers. State subscriptions belong to Zustand.
 *
 * Every write is delivered, an identical value included, and that is relied on: a Revision whose
 * pending commit is cancelled, or committed unchanged, publishes the commit it already had, and the
 * app's subscriber to it resets the displayed circuit to that commit, discarding a drag in progress.
 * A subscriber that wants only changes follows a selector on the store instead, or whenDifferent().
 */
export function observeStore(store) {
    return new Observable(observer => store.subscribe(state => state.value, observer, {fireImmediately: true, equalityFn: () => false}));
}
