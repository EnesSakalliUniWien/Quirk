import {createElement} from 'react';
import '../text/LabelView.js';
import {measureText, textLayoutVersion} from '../text/TextLayout.js';

/** Rows of text runs, arranged within the gate by Pixi Layout. Circuit geometry owns the outer rect. */
export function paintGateLabel(painter, rect, rows, fill) {
    painter.add(GateLabel, {rect, rows, fill, pixelRatio: painter.pixelRatio, version: textLayoutVersion});
}

function GateLabel({rect, rows, fill, pixelRatio, version}) {
    return createElement('pixiSceneContainer', {
        label: 'gate-label', x: rect.x, y: rect.y,
        layout: {width: rect.w, height: rect.h, flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', gap: 1}
    }, rows.map((runs, index) => createElement(GateLabelRow, {key: index, runs, fill, pixelRatio, version})));
}

function GateLabelRow({runs, fill, pixelRatio, version}) {
    return createElement('pixiSceneContainer', {
        layout: {width: '100%', height: Math.max(...runs.map(run => run.font.fontSize)) * 1.4,
            minHeight: 0, flexShrink: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}
    }, runs.map(({text, font, exponent = false}, runIndex) => createElement('pixiLabelView', {
        key: runIndex,
        label: [text, font, fill, pixelRatio, undefined, version],
        // Round up so Yoga's pixel rounding cannot shrink an otherwise fitting glyph.
        layout: {width: Math.ceil(measureText(text, font).width), height: '100%', minWidth: 0, flexShrink: 1,
            objectFit: 'scale-down', objectPosition: exponent ? 'left top' : 'center',
            marginTop: runs.length > 1 && !exponent ? font.fontSize * 0.3 : 0,
            marginBottom: exponent ? font.fontSize * 0.3 : 0}
    })));
}
