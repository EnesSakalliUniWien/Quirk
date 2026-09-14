import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Suite, assertThat} from '../../../TestUtil.js';
import {useDraftPreview} from '../../../../src/components/panels/forge/useDraftPreview.js';

const suite = new Suite('useDraftPreview');

/** Polls on timers: the debounce and React's own scheduling both run there. */
async function until(condition, timeout = 2000) {
    const start = performance.now();
    while (!condition()) {
        if (performance.now() - start > timeout) throw new Error('The preview never settled.');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function mountPreview() {
    const root = createRoot(document.createElement('div'));
    const results = [];
    const parsed = [];
    function Probe({draft}) {
        results.push(useDraftPreview(JSON.stringify(draft), () => {
            parsed.push(draft.name);
            if (!draft.valid) throw new Error(`${draft.name} is invalid`);
            return draft.name;
        }));
        return null;
    }
    return {
        show: draft => flushSync(() => root.render(createElement(Probe, {draft}))),
        latest: () => results.at(-1),
        parsed,
        unmount: () => root.unmount(),
    };
}

suite.test('rapid valid, invalid and valid edits authorize only the settled draft', async () => {
    const preview = mountPreview();
    try {
        preview.show({name: 'a', valid: true});
        await until(() => !preview.latest().pending);
        assertThat(preview.latest().value).isEqualTo('a');

        preview.show({name: 'a', valid: false});
        preview.show({name: 'b', valid: true});
        // The old preview stays on screen, but no longer authorizes the changed draft.
        assertThat(preview.latest().pending).isEqualTo(true);
        assertThat(preview.latest().value).isEqualTo('a');
        await until(() => !preview.latest().pending);
        assertThat(preview.latest().value).isEqualTo('b');
        assertThat(preview.parsed).isEqualTo(['a', 'b']);

        preview.show({name: 'b', valid: false});
        await until(() => !preview.latest().pending);
        assertThat(preview.latest().error).isEqualTo('b is invalid');
        assertThat(preview.latest().value).isEqualTo(undefined);
    } finally {
        preview.unmount();
    }
});

suite.test('unmounting during a pending preview never parses its draft', async () => {
    const preview = mountPreview();
    preview.show({name: 'a', valid: true});
    await until(() => !preview.latest().pending);
    preview.show({name: 'late', valid: true});
    preview.unmount();
    await new Promise(resolve => setTimeout(resolve, 250));
    assertThat(preview.parsed).isEqualTo(['a']);
});
