// Pure helpers for content.js (and the tests): read the example input from a problem page's
// text and build a link that opens it in Algo Visualizer. Same link format as viewer/share.js.
var __algoVisualizer = (() => {
  const VISUALIZER_URL = "https://gokulduraisam.github.io/algo-visualizer/viewer/";

  /** First "Input: ..." of a LeetCode description, e.g. "nums = [2,7,11,15], target = 9". */
  function leetcodeExample(text) {
    const match = /Input:\s*([\s\S]*?)\s*Output:/.exec(text.replace(/ /g, " "));
    return match ? match[1].trim() : "";
  }

  /** A Codeforces sample input block, with Windows line endings and trailing spaces removed. */
  function codeforcesSample(text) {
    const lines = text.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return `${lines.join("\n")}\n`;
  }

  function visualizerLink({ mode, code, input, run = false }) {
    const params = new URLSearchParams({ m: mode });
    if (code != null) params.set("c", code);
    if (input != null) params.set("i", input);
    if (run) params.set("run", "1");
    return `${VISUALIZER_URL}#${params}`;
  }

  return { leetcodeExample, codeforcesSample, visualizerLink };
})();

if (typeof module !== "undefined") module.exports = __algoVisualizer; // for the Node tests
