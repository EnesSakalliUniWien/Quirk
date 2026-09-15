/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {isAmplitudeCoherent} from "../../../engine/math/amplitudeCoherence.js";
import { fitParagraph } from "../../text/TextLayout.js";

import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { makeDisplayRenderer } from "../../gate/GateRenderers.js";
import { Matrix } from "../../../engine/math/matrix/Matrix.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import { ketLabel } from "../../../circuit/registerLabels.js";
import { DATA_RENDERERS } from "../../renderers/dataRenderers.js";

/** Room under the gate for the caption: two lines at the default size. */
const CAPTION_HEIGHT = 30;
const CAPTION_GAP = 2;

/**
 * @type {!function(!GateRenderParams)}
 */
const AMPLITUDE_RENDERER_FROM_CUSTOM_STATS = makeDisplayRenderer((args) => {
  const n = args.gate.height;
  const { quality, ket, phaseLockIndex, incoherentKet } = args.customStats || {
    ket: (n === 1
      ? Matrix.zero(2, 1)
      : Matrix.zero(1 << Math.floor(n / 2), 1 << Math.ceil(n / 2))
    ).times(NaN),
    quality: 1,
    phaseLockIndex: 0,
    incoherentKet: undefined,
  };

  const isIncoherent = !isAmplitudeCoherent(quality);
  const matrix = isIncoherent ? incoherentKet : ket;
  const dw = args.rect.w - (args.rect.h * ket.width()) / ket.height();
  const drawRect = args.rect.skipLeft(dw / 2).skipRight(dw / 2);
  const indicatorAlpha = isIncoherent ? 0 : 1;
  // The gate's wires may be some of a register's: its basis states read in the words of the
  // registers as its wires see them.
  const registers = args.stats.circuitDefinition.registers.within(
    args.positionInCircuit.row,
    n,
  );
  // The drawing is the shared state renderer's (src/draw/renderers/dataRenderers.js); this gate
  // only decides which amplitudes, where, and how sure it is of their phases.
  DATA_RENDERERS.state(args.painter, matrix, drawRect, {
    wireCount: n,
    focusPoints: args.focusPoints,
    coherent: !isIncoherent,
    indicatorAlpha,
    phaseLockIndex,
    registers,
  });

  paintCaption(args, indicatorAlpha, phaseLockIndex, registers);
});

/**
 * What the picture leaves unsaid, on a line under the gate: that a measurement is taken as
 * deferred, that the phases are not defined, and which cell's phase was taken as zero. These are
 * caveats on a display that is working, so they wear the muted ink, not the error's.
 *
 * @param {!GateRenderParams} args
 * @param {!number} indicatorAlpha
 * @param {undefined|!int} phaseLockIndex
 * @param {!Registers} registers
 */
function paintCaption(args, indicatorAlpha, phaseLockIndex, registers) {
  const parts = [];
  const { col, row } = args.positionInCircuit;
  const measured =
    ((args.stats.circuitDefinition.colIsMeasuredMask(col) >> row) &
      ((1 << args.gate.height) - 1)) !==
    0;
  if (measured) {
    parts.push(
      "Measurement deferred",
    );
  }
  if (indicatorAlpha < 0.999) {
    parts.push("Entangled: phase undefined");
  }
  if (phaseLockIndex !== undefined && indicatorAlpha > 0) {
    parts.push(
      `Phase ref |${ketLabel(registers, args.gate.height, phaseLockIndex)}⟩`,
    );
  }
  if (parts.length === 0) {
    return;
  }
  fitParagraph(
    args.painter,
    parts.join(" · "),
    new Rect(
      args.rect.x,
      args.rect.bottom() + CAPTION_GAP,
      args.rect.w,
      CAPTION_HEIGHT,
    ),
    {
      alignment: new Point(0.5, 0),
      fill: CanvasTheme.text.muted,
    },
  );
}

export { AMPLITUDE_RENDERER_FROM_CUSTOM_STATS };
