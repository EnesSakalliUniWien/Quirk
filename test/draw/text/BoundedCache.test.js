import {Suite, assertThat} from '../../TestUtil.js';
import {BoundedCache} from '../../../src/draw/text/BoundedCache.js';

const suite = new Suite('BoundedCache');

suite.test('remembers what it was given until it is full, then forgets the oldest entry', () => {
    const cache = new BoundedCache(3);
    for (const key of ['a', 'b', 'c']) assertThat(cache.set(key, key.toUpperCase())).isEqualTo(key.toUpperCase());
    assertThat(cache.get('a')).isEqualTo('A');
    assertThat(cache.size).isEqualTo(3);
    cache.set('d', 'D');
    assertThat(cache.size).isEqualTo(3);
    assertThat(cache.get('a')).isEqualTo(undefined);
    assertThat(['b', 'c', 'd'].map(key => cache.get(key))).isEqualTo(['B', 'C', 'D']);
});

suite.test('storing a key it already has replaces its value and forgets nothing', () => {
    const cache = new BoundedCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('b', 3);
    assertThat([cache.get('a'), cache.get('b'), cache.size]).isEqualTo([1, 3, 2]);
});

suite.test('can be cleared', () => {
    const cache = new BoundedCache(2);
    cache.set('a', 1);
    cache.clear();
    assertThat([cache.get('a'), cache.size]).isEqualTo([undefined, 0]);
});
