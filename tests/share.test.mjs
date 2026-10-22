import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { decodeShare, encodeShare } from "../viewer/share.js";

const require = createRequire(import.meta.url);
const { codeforcesSample, isPython, leetcodeExample, visualizerLink } = require("../extension/extract.js");

const CODE = "class Solution:\n    def f(self, s: str) -> bool:\n        return s == '#&=?%+'\n";

test("share links survive any code: newlines, quotes, #, &, =, %, +, unicode", () => {
  const shared = { mode: "leetcode", code: CODE + "# naïve ✓\n", input: 's = "a&b=c"', run: true };
  assert.deepEqual(decodeShare(encodeShare(shared)), shared);
});

test("a link without code keeps the editor's code; foreign hashes are ignored", () => {
  assert.deepEqual(decodeShare(encodeShare({ mode: "stdin", input: "3\n1 2 3\n" })), {
    mode: "stdin", code: null, input: "3\n1 2 3\n", run: false,
  });
  assert.equal(decodeShare("#section-2"), null);
  assert.equal(decodeShare("#m=java&c=x"), null);
  assert.equal(decodeShare(""), null);
});

test("the extension's links decode on the site", () => {
  const url = visualizerLink({ mode: "leetcode", code: CODE, input: "s = \"#1\"", run: true });
  assert.ok(url.startsWith("https://gokulduraisam.github.io/algo-visualizer/viewer/#"));
  assert.deepEqual(decodeShare(new URL(url).hash), { mode: "leetcode", code: CODE, input: 's = "#1"', run: true });
});

test("leetcodeExample takes the first example's input from the description text", () => {
  const text = "Given an array...\n\nExample 1:\n\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n" +
    "Explanation: ...\n\nExample 2:\n\nInput: nums = [3,2,4], target = 6\nOutput: [1,2]\n";
  assert.equal(leetcodeExample(text), "nums = [2,7,11,15], target = 9");
  assert.equal(leetcodeExample("Input: root = [1,null,2] \nOutput: [1,2]"), "root = [1,null,2]");
  assert.equal(leetcodeExample("no examples here"), "");
});

test("codeforcesSample tidies the sample input block", () => {
  assert.equal(codeforcesSample("3 \r\n1 2 3\r\n\n"), "3\n1 2 3\n");
});

test("both of LeetCode's Python editor languages count as Python", () => {
  assert.equal(isPython("python3"), true); // LeetCode's "Python3"
  assert.equal(isPython("python"), true); // LeetCode's "Python"
  assert.equal(isPython("cpp"), false);
  assert.equal(isPython(undefined), false);
});

test("short links carry only a saved problem's id", () => {
  const id = "8f14e45f-ceea-467f-a0e6-1d8e3b1c2a90";
  assert.equal(encodeShare({ problemId: id }), `#p=${id}`);
  assert.deepEqual(decodeShare(`#p=${id}`), { problemId: id });
  assert.equal(decodeShare("#p=not-a-uuid"), null);
});

test("extension links can carry the problem's page for the Save form", () => {
  const url = visualizerLink({ mode: "leetcode", code: "x", input: "", page: "https://leetcode.com/problems/two-sum/" });
  assert.equal(decodeShare(new URL(url).hash).page, "https://leetcode.com/problems/two-sum/");
});
