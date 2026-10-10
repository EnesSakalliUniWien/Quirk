// Shared by the unit and performance pages. Keep these globals available to the
// browser runners and Puppeteer while keeping the implementation under ESLint.
globalThis.__total_done = 0;
globalThis.__total_tests = 0;
globalThis.__any_failures = false;

const updateProgress = () => {
  document.getElementById("progress").innerText =
    `Progress: ${globalThis.__total_done} / ${globalThis.__total_tests}`;
};

globalThis.__testRunner__ = {
  start: undefined,
  result(arg) {
    globalThis.__total_done++;
    if (
      globalThis.__total_done % 100 === 0 ||
      globalThis.__total_done === globalThis.__total_tests
    ) {
      console.log(
        `Finished running ${globalThis.__total_done}/${globalThis.__total_tests} tests`,
      );
    }
    updateProgress();
    if (!arg.success) {
      const message = `FAILED: ${arg.suite[0]} ${arg.description}`;
      console.error(message);
      globalThis.__any_failures = true;
      document.getElementById("output").innerText += `\n${message}`;
    }
    for (const message of arg.log) {
      document.getElementById("output").innerText += `\n     ${message}`;
      console.log(`    ${message}`);
    }
  },
  info(arg) {
    globalThis.__total_tests = arg.total;
    updateProgress();
    document.getElementById("output").innerText +=
      `\nTotal tests: ${arg.total}\nRunning...`;
    console.log(`Running ${arg.total} tests...`);
  },
  complete() {
    const doneDiv = document.createElement("div");
    doneDiv.id = "done";
    doneDiv.innerText = "Done";
    document.body.appendChild(doneDiv);
  },
};
