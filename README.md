# Shadow-Quant <img src="doc/favicon.ico" alt="Icon" title="Icon" />

[![ci](https://github.com/EnesSakalliUniWien/Quirk/actions/workflows/ci.yml/badge.svg)](https://github.com/EnesSakalliUniWien/Quirk/actions/workflows/ci.yml)

Shadow-Quant is a toy quantum circuit simulator, intended to help people in learning about quantum
computing. It is a fork of Craig Gidney's [Quirk](https://github.com/Strilanc/Quirk)
([algassert.com/quirk](http://algassert.com/quirk)), rebuilt around a modern app shell: a gate
sidebar with search and folding, a playhead transport with a state table, circuit zoom with an
overview minimap, adjustable Rx/Ry/Rz rotation gates, and an enlarged rotatable Bloch sphere view.

If you want to quickly explore the behavior of a small quantum circuit, this is the tool for you:
drag gates onto the circuit and the output displays update in real time.

(If you're still trying to understand what a quantum circuit *even is*, then I recommend the video
series [Quantum Computing for the Determined](https://www.youtube.com/playlist?list=PL1826E60FD05B44E4).
Shadow-Quant assumes you already know background facts like "each wire represents a qubit".)

**Defining features**:

- Runs in web browsers.
- Drag-and-drop circuit editing.
- Reacts, simulates, and animates in real time.
- Inline state displays, plus a click-to-open enlarged Bloch sphere view.
- Bookmarkable / linkable circuits.
- Up to 16 qubits.

**Notable limitations**:

- Can't recohere measured qubits (because measurement is implemented as a hack based on the [deferred measurement principle](https://en.wikipedia.org/wiki/Deferred_Measurement_Principle)).

# Examples

**The app**, with a small circuit using Bloch, amplitude, density, and chance displays:

![Demo](/doc/README_Demo.png)

**Grover search circuit** with chance displays (showing that the chance of success increases):

![Grover search](/doc/README_Grover.png)

**Quantum teleportation circuit** with Bloch sphere displays (showing that the qubit at the top has ended up at the bottom):

![Quantum teleportation](/doc/README_Teleportation.png)

# Building and running

1. Install [git](https://git-scm.com/) and Node.js 22.12 or newer.

2. Clone the repository.

    `git clone https://github.com/EnesSakalliUniWien/Quirk.git`

3. Install the dependencies.

    `cd Quirk`

    `npm ci`

4. Start the Vite development server while making changes.

    `npm run dev`

5. Run the browser tests.

    `npm test`

    `npm run test:e2e`

6. Build and serve the app.

    `npm run serve`

    This builds into `out/` and serves it at <http://localhost:8080> (set `PORT` to change the
    port). With an existing build, `npm start` serves without rebuilding. The built page loads
    its scripts as ES modules, so it has to be served over http rather than opened from disk;
    share a circuit by sharing its URL.

# Disclaimer

Shadow-Quant is a fork of [Quirk](https://github.com/Strilanc/Quirk). Neither is an official
Google product; the original code is Copyright 2017 Google Inc., licensed under Apache 2.0.
