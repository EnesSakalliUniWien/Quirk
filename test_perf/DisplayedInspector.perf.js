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

import { perfGoal, millis } from "./TestPerfUtil.js";
import { CircuitDefinition } from "../src/circuit/model/CircuitDefinition.js";
import { CircuitStats } from "../src/engine/simulation/CircuitStats.js";
import { Rect } from "../src/geometry/Rect.js";
import { Gates } from "../src/gates/AllGates.js";
import { Hand } from "../src/editor/Hand.js";
import { DisplayView } from "../src/draw/pixi/DisplayView.js";
import { RestartableRng } from "../src/base/RestartableRng.js";
import { DisplayedCircuit } from "../src/editor/DisplayedCircuit.js";
import { DisplayedInspector } from "../src/editor/DisplayedInspector.js";
import { Serializer } from "../src/circuit/serialization/Serializer.js";

const scenes = new WeakMap();

perfGoal(
  "Update inspector circuit",
  millis(4),
  ([oldInspector, newCircuit]) => {
    let json = JSON.stringify(Serializer.toJson(newCircuit));
    let empty = Serializer.fromJson(CircuitDefinition, { cols: [] });
    let parsed = Serializer.fromJson(CircuitDefinition, JSON.parse(json));
    return oldInspector
      .withCircuitDefinition(parsed)
      .withCircuitDefinition(empty);
  },
  [
    DisplayedInspector.empty(new Rect(0, 0, 1000, 1000)),
    CircuitDefinition.fromTextDiagram(
      new Map([
        ["-", undefined],
        ["/", null],
        ["Q", Gates.FourierTransformGates.FourierTransformFamily],
      ]),
      `QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////
         //////////////////////////////`,
    ),
  ],
);

perfGoal(
  "Update Pixi scene for 16-qubit circuit",
  millis(200),
  ([
    canvas,
    {
      circuit,
      pts: [p1, p2],
    },
  ]) => {
    let inspector = DisplayedInspector.empty(new Rect(0, 0, 1000, 1000));
    let dy = inspector.displayedCircuit.top - circuit.top;
    inspector = inspector
      .withDisplayedCircuit(
        inspector.displayedCircuit.withCircuit(circuit.circuitDefinition),
      )
      .withHand(Hand.EMPTY.withPos(p1.offsetBy(0, dy)))
      .afterGrabbing();
    inspector = inspector
      .withHand(inspector.hand.withPos(p2.offsetBy(0, dy)))
      .afterDropping();
    canvas.width = inspector.desiredWidth();
    canvas.height = inspector.desiredHeight();
    let stats = CircuitStats.fromCircuitAtTime(
      inspector.displayedCircuit.circuitDefinition,
      0,
    );
    let view = scenes.get(canvas);
    if (!view) {
      view = new DisplayView(canvas);
      scenes.set(canvas, view);
    }
    view.begin(new RestartableRng());
    view.interaction.reset();
    view.tooltips?.begin();
    inspector.paint(view, stats);
    view.tooltips?.flush();
    view.finish();
  },
  [
    (() => {
      let c = document.createElement("canvas");
      document.body.appendChild(c);
      return c;
    })(),
    DisplayedCircuit.fromTextDiagram(
      new Map([
        ["-", undefined],
        ["/", null],
        ["0", null],
        ["1", null],
        ["Q", Gates.FourierTransformGates.FourierTransformFamily],
        ["H", Gates.HalfTurns.H],
        ["z", Gates.QuarterTurns.SqrtZForward],
        ["•", Gates.Controls.Control],
      ]),
      `|
             |-Q-H-z---z---z---z---z---z---z---z---z---z---z---z---z---z---z---
             |  0^
             |-/---•-H-z---z---z---z---z---z---z---z---z---z---z---z---z---z---
             |
             |-/-1-----•-H-z---z---z---z---z---z---z---z---z---z---z---z---z---
             |
             |-/-----------•-H-z---z---z---z---z---z---z---z---z---z---z---z---
             |
             |-/---------------•-H-z---z---z---z---z---z---z---z---z---z---z---
             |
             |-/-------------------•-H-z---z---z---z---z---z---z---z---z---z---
             |
             |-/-----------------------•-H-z---z---z---z---z---z---z---z---z---
             |
             |-/---------------------------•-H-z---z---z---z---z---z---z---z---
             |
             |-/-------------------------------•-H-z---z---z---z---z---z---z---
             |
             |-/-----------------------------------•-H-z---z---z---z---z---z---
             |
             |-/---------------------------------------•-H-z---z---z---z---z---
             |
             |-/-------------------------------------------•-H-z---z---z---z---
             |
             |-/-----------------------------------------------•-H-z---z---z---
             |
             |-/---------------------------------------------------•-H-z---z---
             |
             |-/-------------------------------------------------------•-H-z---
             |
             |-/-----------------------------------------------------------•-H-
             |`,
    ),
  ],
  (arg) => {
    scenes.get(arg[0])?.destroy();
    scenes.delete(arg[0]);
    document.body.removeChild(arg[0]);
  },
);
