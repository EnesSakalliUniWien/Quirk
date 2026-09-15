# Display gates

Each display has its own directory. The `*Display.js` entry defines its gate or
resizable family and connects statistics, result conversion, serialization, and
rendering through `GateBuilder`.

| Directory | Responsibilities |
| --- | --- |
| `amplitudes/` | Conditional amplitude textures, coherence and phase processing, JSON output, and the amplitude gate family. Each GPU shader lives in `shaders/`. |
| `density/` | Density textures, normalization, measured-bit decoherence, renderers, and the density gate family. The coupling shader lives in `shaders/`. |
| `probability/` | Probability textures, normalization, JSON output, renderers, and the probability gate family. The probability shader lives in `shaders/`. |
| `bloch/` | Bloch gate definition and renderer using existing single-qubit density statistics. |
| `sample/` | Sample gate family and renderer; statistics and JSON conversion reuse `probability/`. |

Dependencies run from gate definitions to their helpers. Amplitude statistics
import `probabilityStatTexture` directly; Detector imports the probability shader
directly. Neither imports the probability gate family.

Drawing and geometry remain in `src/draw/displays/`. These gate renderers select
the circuit statistics and pass them to those drawing functions. Circuit output
drawing imports the Bloch drawing function directly, without a gate re-export.

Tests mirror these directories under `test/gates/displays/` and import shader or
statistics helpers directly when testing them.
