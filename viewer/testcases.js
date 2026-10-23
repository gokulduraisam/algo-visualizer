// Several test cases in one input box, separated by "---" lines, each optionally ending with
// "Output: ..." (the expected answer, as LeetCode and Codeforces show it):
//
//   nums = [2,7,11,15], target = 9
//   Output: [0,1]
//   ---
//   nums = [3,2,4], target = 6
//   Output: [1,2]

const SEPARATOR = /^\s*-{3,}\s*$/;
const OUTPUT = /^\s*(?:expected\s+)?output\s*:\s?(.*)$/i;

const trimBlankLines = (lines) => {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end);
};

/** [{input, expected (string) | null}] */
export function parseTestCases(text) {
  const blocks = [[]];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (SEPARATOR.test(line)) blocks.push([]);
    else blocks[blocks.length - 1].push(line);
  }
  return blocks
    .map((lines) => {
      const at = lines.findIndex((l) => OUTPUT.test(l));
      if (at === -1) return { input: trimBlankLines(lines).join("\n"), expected: null };
      const expected = trimBlankLines([OUTPUT.exec(lines[at])[1], ...lines.slice(at + 1)]);
      return { input: trimBlankLines(lines.slice(0, at)).join("\n"), expected: expected.join("\n") };
    })
    .filter((t, i, all) => t.input || t.expected !== null || all.length === 1);
}

/** LeetCode answers compare without whitespace ([0, 1] == [0,1]); stdin compares line by line,
 *  ignoring trailing spaces and blank lines at the end, like most judges. */
export function outputsMatch(actual, expected, mode) {
  if (mode === "leetcode") return actual.replace(/\s+/g, "") === expected.replace(/\s+/g, "");
  const lines = (s) => trimBlankLines(s.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()));
  return lines(actual).join("\n") === lines(expected).join("\n");
}

/** "pass" | "fail" | "error" | "cut-off" (hit the step limit) | "ran" (no expected output to compare). */
export function verdict(result, expected, mode) {
  if (result.error) return "error";
  if (result.truncated) return "cut-off";
  if (expected === null) return "ran";
  return outputsMatch(result.stdout, expected, mode) ? "pass" : "fail";
}
