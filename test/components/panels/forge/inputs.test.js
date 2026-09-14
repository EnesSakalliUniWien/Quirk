import {Suite, assertThat} from '../../../TestUtil.js';
import {inputKey} from '../../../../src/components/panels/forge/inputs.js';

const suite = new Suite('Forge inputs');
suite.test('distinct drafts cannot share a preview key', () => {
    assertThat(inputKey('a b', 'c') === inputKey('a', 'b c')).isEqualTo(false);
});
