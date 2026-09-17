import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Suite, assertThat} from '../../../TestUtil.js';
import {createValueStore} from '../../../../src/base/valueStore.js';
import {appStore} from '../../../../src/state/appStore.js';
import {useCompletedResult} from '../../../../src/components/panels/shared/usePlayheadStats.js';
import {PanelVisibility} from '../../../../src/components/panels/shared/usePanelVisibility.js';

const suite = new Suite('usePlayheadStats');

/** Polls on timers: the sampling cooldown and React's own scheduling both run there. */
async function until(condition, timeout = 2000) {
    const start = performance.now();
    while (!condition()) {
        if (performance.now() - start > timeout) throw new Error('The sample never arrived.');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

/** Longer than the sampling cooldown, so a sample that was going to arrive has arrived. */
const settle = () => new Promise(resolve => setTimeout(resolve, 250));

/** A panel reading the completed result, inside a dock that can hide it. */
function mountPanel() {
    const completed = createValueStore(undefined);
    const previousDeps = appStore.getState().panelDeps;
    appStore.setState({panelDeps: {completed}});
    const root = createRoot(document.createElement('div'));
    const samples = [];
    function Probe() {
        samples.push(useCompletedResult());
        return null;
    }
    return {
        show: visible => flushSync(() => root.render(
            createElement(PanelVisibility.Provider, {value: visible}, createElement(Probe)))),
        publish: value => completed.setState({value}),
        latest: () => samples.at(-1),
        unmount: () => {
            root.unmount();
            appStore.setState({panelDeps: previousDeps});
        },
    };
}

suite.test('a hidden panel keeps the sample it had, and takes the newest one when shown', async () => {
    const panel = mountPanel();
    try {
        panel.show(true);
        panel.publish('a');
        await until(() => panel.latest() === 'a');

        panel.show(false);
        panel.publish('b');
        panel.publish('c');
        await settle();
        assertThat(panel.latest()).isEqualTo('a');

        panel.show(true);
        await until(() => panel.latest() === 'c');
    } finally {
        panel.unmount();
    }
});

suite.test('a panel shown again with nothing new keeps what it has', async () => {
    const panel = mountPanel();
    try {
        panel.show(true);
        panel.publish('a');
        await until(() => panel.latest() === 'a');
        const delivered = () => panel.latest();

        panel.show(false);
        panel.show(true);
        await settle();
        assertThat(delivered()).isEqualTo('a');
    } finally {
        panel.unmount();
    }
});
