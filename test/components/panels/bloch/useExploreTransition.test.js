import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Suite, assertThat} from '../../../TestUtil.js';
import {createMotionSettings} from '../../../../src/state/motionSettings.js';
import {useExploreTransition} from '../../../../src/components/panels/bloch/useExploreTransition.js';

const suite = new Suite('useExploreTransition');

/** Mounts the hook and hands back its explore function and every mode it set. */
function mountExplorer(settings) {
    const modes = [];
    let explorer;
    function Probe() {
        explorer = useExploreTransition(mode => modes.push(mode), {current: {x: 0, y: 0, z: 1}}, settings);
        return null;
    }
    const root = createRoot(document.createElement('div'));
    flushSync(() => root.render(createElement(Probe)));
    return {explore: (...args) => explorer.explore(...args), modes, unmount: () => root.unmount()};
}

suite.test('a glide set to no time lands at once', () => {
    const settings = createMotionSettings(undefined);
    settings.getState().set('glideMs', 0);
    const explorer = mountExplorer(settings);
    try {
        const to = {x: 1, y: 0, z: 0};
        explorer.explore(to, {preset: '|+⟩', glide: true});
        assertThat(explorer.modes).isEqualTo([{kind: 'explore', vec: to, preset: '|+⟩'}]);
    } finally {
        explorer.unmount();
    }
});
