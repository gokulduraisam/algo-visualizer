import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTags, problemRow, titleFromUrl } from "../viewer/problem-form.js";

const RUN = { mode: "leetcode", code: "class Solution: ...", input: "n = 3" };

test("titleFromUrl reads LeetCode and Codeforces problem links", () => {
  assert.equal(titleFromUrl("https://leetcode.com/problems/two-sum/description/"), "Two Sum");
  assert.equal(titleFromUrl("https://leetcode.com/problems/3sum"), "3sum");
  assert.equal(titleFromUrl("https://codeforces.com/problemset/problem/1/A"), "Codeforces 1A");
  assert.equal(titleFromUrl("https://codeforces.com/contest/1900/problem/B2"), "Codeforces 1900B2");
  assert.equal(titleFromUrl("https://example.com/x"), "");
  assert.equal(titleFromUrl("not a url"), "");
});

test("parseTags: comma-separated, trimmed, lowercase, no duplicates or blanks", () => {
  assert.deepEqual(parseTags(" Two Pointers, DP,dp ,, Binary Search "), ["two pointers", "dp", "binary search"]);
  assert.deepEqual(parseTags(""), []);
});

test("problemRow builds a clean row from the form and the run", () => {
  const row = problemRow(
    { title: "  Two Sum ", url: " https://leetcode.com/problems/two-sum/ ", difficulty: "Easy", tags: "hash map", notes: " seen-map ", shared: true },
    RUN,
  );
  assert.deepEqual(row, {
    title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "Easy", tags: ["hash map"],
    notes: "seen-map", is_shared: true, mode: "leetcode", code: RUN.code, input: "n = 3", solve_seconds: null,
  });
});

test("problemRow: optional fields become null, unknown difficulty is dropped", () => {
  const row = problemRow({ title: "Mine", url: "", difficulty: "", tags: "", notes: "", shared: false }, RUN);
  assert.equal(row.url, null);
  assert.equal(row.difficulty, null);
  assert.deepEqual(row.tags, []);
});

test("problemRow rejects what the database would reject, with readable messages", () => {
  const form = { title: "x", url: "", difficulty: "", tags: "", notes: "", shared: false };
  assert.throws(() => problemRow({ ...form, title: "  " }, RUN), /title/i);
  assert.throws(() => problemRow({ ...form, url: "javascript:alert(1)" }, RUN), /link/i);
  assert.throws(() => problemRow({ ...form, title: "x".repeat(201) }, RUN), /title/i);
  assert.throws(() => problemRow({ ...form, tags: Array.from({ length: 21 }, (_, i) => `t${i}`).join(",") }, RUN), /tags/i);
  assert.throws(() => problemRow(form, { ...RUN, code: "x".repeat(100_001) }), /code/i);
});

test("problemRow stores the solve time from the m:ss field, or null when empty", () => {
  const form = { title: "x", url: "", difficulty: "", tags: "", notes: "", shared: false };
  assert.equal(problemRow({ ...form, time: "18:05" }, RUN).solve_seconds, 1085);
  assert.equal(problemRow({ ...form, time: "" }, RUN).solve_seconds, null);
  assert.equal(problemRow(form, RUN).solve_seconds, null); // older callers without the field
  assert.throws(() => problemRow({ ...form, time: "later" }, RUN), /time/i);
});
