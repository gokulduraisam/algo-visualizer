// "Test 1 ✅  Test 2 ❌  Test 3 ⚠" tabs above the step viewer, and the expected-output line.

const ICON = { pass: "✅", fail: "❌", error: "⚠️", "cut-off": "⏹", ran: "▶" };
const SUMMARY = {
  pass: "Matches the expected output.",
  fail: "Doesn't match the expected output.",
  error: "Crashed before finishing.",
  "cut-off": "Stopped at the step limit, so the output is incomplete.",
};

/** tests: [{expected}], verdicts: ["pass", ...]. Hidden for a single test with nothing to compare. */
export function renderTestBar(container, tests, verdicts, selected, onSelect) {
  const show = tests.length > 1 || tests.some((t) => t.expected !== null);
  container.hidden = !show;
  if (!show) return;
  const passed = verdicts.filter((v) => v === "pass").length;
  const compared = tests.filter((t) => t.expected !== null).length;
  const summary = document.createElement("span");
  summary.className = "tests-summary";
  summary.textContent = compared ? `${passed} of ${compared} passed` : `${tests.length} tests`;
  const tabs = verdicts.map((v, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `test-tab ${v}${i === selected ? " selected" : ""}`;
    b.textContent = `Test ${i + 1} ${ICON[v]}`;
    b.setAttribute("aria-pressed", String(i === selected));
    b.onclick = () => onSelect(i);
    return b;
  });
  container.replaceChildren(summary, ...tabs);
}

/** The line under Output: what was expected, when it differs. */
export function renderVerdict(el, test, verdictValue) {
  el.hidden = test.expected === null || verdictValue === "ran";
  if (el.hidden) return;
  el.className = `verdict ${verdictValue}`;
  const summary = `${ICON[verdictValue]} ${SUMMARY[verdictValue]}`;
  el.textContent = verdictValue === "pass" ? summary : `${summary}\nExpected:\n${test.expected}`;
}
