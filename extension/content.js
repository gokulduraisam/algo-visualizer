// Adds a "Visualize" button to LeetCode and Codeforces problem pages. Runs in the page's own
// JavaScript world (manifest "world": "MAIN") so it can read LeetCode's Monaco editor.
(() => {
  const { leetcodeExample, leetcodeExamples, testsText, codeforcesSample, isPython, visualizerLink } = __algoVisualizer;
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
    const description = (document.querySelector('[data-track-load="description_content"]') || document.body).innerText;
    const examples = leetcodeExamples(description);
    // All examples with their expected outputs, so the visualizer can grade each one.
    const input = examples.length ? testsText(examples) : leetcodeExample(description);
    return visualizerLink({ mode: "leetcode", code, input, run: true, page: location.href, ...leetcodeMeta() });
  }

  /** Difficulty and topic tags, best effort: a missing one just leaves that Save field empty. */
  function leetcodeMeta() {
    const difficulty = document.querySelector('[class*="text-difficulty-"]')?.textContent.trim();
    const tags = [...document.querySelectorAll('a[href^="/tag/"]')].map((a) => a.textContent.trim()).filter(Boolean);
    return {
      difficulty: ["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : undefined,
      tags: [...new Set(tags)].slice(0, 20),
    };
  }

  function leetcodeCode() {
    const models = window.monaco?.editor?.getModels?.() ?? [];
    // The answer editor is the largest model; LeetCode also keeps small ones (e.g. test cases).
    const model = models.slice().sort((a, b) => b.getValueLength() - a.getValueLength())[0];
    if (!model) throw new Error("Couldn't find the code editor. Reload the page and try again.");
    const language = model.getLanguageId?.() ?? model.getModeId?.(); // older Monaco: getModeId
    if (!isPython(language)) throw new Error("Switch the editor language to Python3 first.");
    return model.getValue();
  }

  function codeforcesLink() {
    const inputs = [...document.querySelectorAll(".sample-test .input pre")];
    const outputs = [...document.querySelectorAll(".sample-test .output pre")];
    if (!inputs.length) throw new Error("This page has no sample input.");
    // Every sample with its expected output. No code: Codeforces solutions are written
    // elsewhere, so the site keeps your saved draft.
    const samples = inputs.map((pre, i) => ({
      input: codeforcesSample(pre.innerText),
      output: outputs[i] ? codeforcesSample(outputs[i].innerText) : "",
    }));
    const input = samples.every((s) => s.output) ? testsText(samples) : samples[0].input;
    return visualizerLink({ mode: "stdin", input, page: location.href });
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
