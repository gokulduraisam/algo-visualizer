// Adds a "Visualize" button to LeetCode and Codeforces problem pages. Runs in the page's own
// JavaScript world (manifest "world": "MAIN") so it can read LeetCode's Monaco editor.
(() => {
  const { leetcodeExample, codeforcesSample, visualizerLink } = __algoVisualizer;
  const onLeetCode = location.hostname === "leetcode.com";

  const button = document.createElement("button");
  button.textContent = "▶ Visualize";
  button.title = "Open your Python code and the example input in Algo Visualizer";
  Object.assign(button.style, {
    position: "fixed", right: "20px", bottom: "20px", zIndex: 2147483647,
    padding: "8px 14px", border: "0", borderRadius: "8px", cursor: "pointer",
    font: "600 14px system-ui, sans-serif", color: "#fff", background: "#2f6fdb",
    boxShadow: "0 2px 8px rgba(0,0,0,.25)",
  });
  document.body.append(button);

  // LeetCode is a single-page app: only show the button while a problem is open.
  const onProblemPage = () => !onLeetCode || location.pathname.startsWith("/problems/");
  const sync = () => (button.style.display = onProblemPage() ? "" : "none");
  sync();
  setInterval(sync, 1000);

  button.addEventListener("click", () => {
    try {
      window.open(onLeetCode ? leetcodeLink() : codeforcesLink(), "_blank", "noopener");
    } catch (err) {
      flash(`⚠ ${err.message}`);
    }
  });

  function leetcodeLink() {
    const code = leetcodeCode();
    const description = document.querySelector('[data-track-load="description_content"]');
    const input = leetcodeExample((description || document.body).innerText);
    return visualizerLink({ mode: "leetcode", code, input, run: true });
  }

  function leetcodeCode() {
    const models = window.monaco?.editor?.getModels?.() ?? [];
    // The answer editor is the largest model; LeetCode also keeps small ones (e.g. test cases).
    const model = models.slice().sort((a, b) => b.getValueLength() - a.getValueLength())[0];
    if (!model) throw new Error("Couldn't find the code editor. Reload the page and try again.");
    const language = model.getLanguageId?.() ?? model.getModeId?.(); // older Monaco: getModeId
    if (language !== "python") throw new Error("Switch the editor language to Python3 first.");
    return model.getValue();
  }

  function codeforcesLink() {
    const sample = document.querySelector(".sample-test .input pre");
    if (!sample) throw new Error("This page has no sample input.");
    // No code: Codeforces solutions are written elsewhere, so the site keeps your saved draft.
    return visualizerLink({ mode: "stdin", input: codeforcesSample(sample.innerText) });
  }

  function flash(text) {
    button.textContent = text;
    button.style.background = "#b3261e";
    setTimeout(() => {
      button.textContent = "▶ Visualize";
      button.style.background = "#2f6fdb";
    }, 4000);
  }
})();
