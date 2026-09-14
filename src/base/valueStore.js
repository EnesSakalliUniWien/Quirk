import {createStore} from 'zustand/vanilla';
import {subscribeWithSelector} from 'zustand/middleware';
import {Observable} from './Obs.js';

export function createValueStore(value) {
    return createStore(subscribeWithSelector(() => ({value})));
}

/** Compatibility with event-stream consumers. State subscriptions belong to Zustand. */
export function observeStore(store) {
    return new Observable(observer => store.subscribe(state => state.value, observer, {fireImmediately: true, equalityFn: () => false}));
}
