# <a href="http://algassert.com/quirk">Quirk <img src="doc/favicon.ico" alt="Icon" title="Icon" /></a>

[![Build Status](https://travis-ci.org/Strilanc/Quirk.svg?branch=master)](https://travis-ci.org/Strilanc/Quirk)

Quirk is a toy quantum circuit simulator, intended to help people in learning about quantum computing.

If you want to quickly explore the behavior of a small quantum circuit, Quirk is the tool for you.
There's no installing or configuring or scripting: just go to **[algassert.com/quirk](http://algassert.com/quirk)**, drag gates onto the circuit, and the output displays will update in real time.

(If you're still trying to understand what a quantum circuit *even is*, then I recommend the video series [Quantum Computing for the Determined](https://www.youtube.com/playlist?list=PL1826E60FD05B44E4).
Quirk assumes you already know background facts like "each wire represents a qubit".)

**Defining features**:

- Runs in web browsers.
- Drag-and-drop circuit editing.
- Reacts, simulates, and animates in real time.
- Inline state displays.
- Bookmarkable / linkable circuits.
- Up to 16 qubits.

**Notable limitations**:

- Can't recohere measured qubits (because measurement is implemented as a hack based on the [deferred measurement principle](https://en.wikipedia.org/wiki/Deferred_Measurement_Principle)).

**Try it out**:

**[algassert.com/quirk](http://algassert.com/quirk)**

# Examples

**Basic usage demo**:

![Demo](/doc/README_Demo.gif)

**Grover search circuit** with chance and sample displays (showing that the chance of success increases):

![Grover search](/doc/README_Grover.gif)

**Quantum teleportation circuit** with Bloch sphere displays (showing that the qubit at the top has ended up at the bottom):

![Quantum teleportation](/doc/README_Teleportation.gif)

# Building

If you want to modify Quirk, this is how you get the code and turn your changes into working HTML and JavaScript.

1. Install [git](https://git-scm.com/) and Node.js 22.12 or newer.

2. Clone the repository.

    `git clone https://github.com/Strilanc/Quirk.git`

3. Install the dev dependencies.

    `cd Quirk`
    
    `npm ci`

4. Start the Vite development server while making changes.

    `npm run dev`

5. Run the browser tests.

    `npm test`

    `npm run test:e2e`

6. Build the standalone output.

    `npm run build`

7. Confirm the output works by opening `out/quirk.html` with a web browser.

    `firefox out/quirk.html`

8. Copy `out/quirk.html` to wherever you want.

# Disclaimer

Quirk is not an official Google product.
