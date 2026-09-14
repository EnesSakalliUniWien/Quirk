import {createStore} from 'zustand/vanilla';
import {subscribeWithSelector} from 'zustand/middleware';

/** Editor actions publish one immutable snapshot; unrelated selectors retain their identity. */
export function createEditorStore(value) {
    return createStore(subscribeWithSelector(set => ({
        value,
        setPointer: pos => set(state => {
            const next = state.value.withHand(state.value.hand.withPos(pos));
            return next === state.value ? state : {value: next};
        })
    })));
}
