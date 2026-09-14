import {Suite, assertThat} from '../TestUtil.js';
import {createValueStore, observeStore} from '../../src/base/valueStore.js';

const suite = new Suite('valueStore');
suite.test('selectors skip unchanged state while event adapters preserve repeated commits', () => {
    const store = createValueStore('initial');
    const selected = [];
    const events = [];
    const stopSelected = store.subscribe(state => state.value, value => selected.push(value));
    const stopEvents = observeStore(store).subscribe(value => events.push(value));
    store.setState({value: 'next'});
    store.setState({value: 'next'});
    assertThat(selected).isEqualTo(['next']);
    assertThat(events).isEqualTo(['initial', 'next', 'next']);
    stopSelected();
    stopEvents();
    store.setState({value: 'after unsubscribe'});
    assertThat(selected).isEqualTo(['next']);
    assertThat(events).isEqualTo(['initial', 'next', 'next']);
});
