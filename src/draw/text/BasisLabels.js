import {createElement, useMemo} from 'react';
import {DisplayView} from '../scene/DisplayView.js';
import {textLayoutVersion} from './TextLayout.js';

function LabelContent({labels, version, canvas, rng, ratio, labelKey}) {
    return useMemo(() => {
        const content = new DisplayView(canvas, rng, ratio);
        content.logicalArea = labels.size(labelKey);
        labels.draw(content, labelKey);
        return content.element('labels');
    }, [labels, version]);
}

/** React retains the label subtree; useMemo rebuilds it only when label inputs change. */
export class BasisLabels {
    constructor(size, draw) { this.size = size; this.draw = draw; this.version = 0; }
    clear() { this.version++; }
    paint(x, y, view, key) {
        view.elements.push(createElement('pixiSceneContainer', {key: 'basis-' + view.order++, x, y},
            createElement(LabelContent, {labels: this,
                version: [this.version, textLayoutVersion, view.pixelRatio, key].join(':'),
                canvas: view.canvas, rng: view.rng, ratio: view.pixelRatio, labelKey: key})));
    }
}
