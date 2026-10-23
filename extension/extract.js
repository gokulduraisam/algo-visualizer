// Pure helpers for content.js (and the tests): read the example input from a problem page's
// text and build a link that opens it in Algo Visualizer. Same link format as viewer/share.js.
var __algoVisualizer = (() => {
  const VISUALIZER_URL = "https://gokulduraisam.github.io/algo-visualizer/viewer/";

  /** First "Input: ..." of a LeetCode description, e.g. "nums = [2,7,11,15], target = 9". */
  function leetcodeExample(text) {
    const match = /Input:\s*([\s\S]*?)\s*Output:/.exec(text.replace(/ /g, " "));
    return match ? match[1].trim() : "";
  }

  /** Every "Input: … Output: …" example of a LeetCode description. */
  function leetcodeExamples(text) {
    const examples = [];
    for (const m of text.replace(/ /g, " ").matchAll(/Input:\s*([\s\S]*?)\s*Output:[ \t]*([^\n]*)/g)) {
      examples.push({ input: m[1].trim(), output: m[2].trim() });
    }
    return examples;
  }

  /** Examples in the visualizer's test format: "input\nOutput: x", separated by "---" lines. */
  const testsText = (examples) => examples.map((e) => `${e.input.trim()}\nOutput: ${e.output.trim()}`).join("\n---\n");

  /** A Codeforces sample input block, with Windows line endings and trailing spaces removed. */
  function codeforcesSample(text) {
    const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return `${lines.join("\n")}\n`;
  }

  /** LeetCode's editor calls its "Python" option `python` and its "Python3" option `python3`. */
  const isPython = (languageId) => languageId === "python" || languageId === "python3";

  /** `page`, `difficulty` and `tags` describe the problem, so Save can fill itself in. */
  function visualizerLink({ mode, code, input, run = false, page, difficulty, tags }) {
    const params = new URLSearchParams({ m: mode });
    if (code != null) params.set("c", code);
    if (input != null) params.set("i", input);
    if (run) params.set("run", "1");
    if (page) params.set("page", page);
    if (difficulty) params.set("d", difficulty);
    if (tags?.length) params.set("t", tags.join(","));
    return `${VISUALIZER_URL}#${params}`;
  }

  return { leetcodeExample, leetcodeExamples, testsText, codeforcesSample, isPython, visualizerLink };
})();

if (typeof module !== "undefined") module.exports = __algoVisualizer; // for the Node tests
