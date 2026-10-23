import assert from "node:assert/strict";
import { test } from "node:test";

import { ROADMAP } from "../viewer/roadmap-data.js";
import { roadmapProgress, slugFromUrl } from "../viewer/roadmap.js";

const NOW = new Date("2026-10-22T12:00:00Z");
const saved = (slug, due, interval = 3) => ({ url: `https://leetcode.com/problems/${slug}/description/`, due_at: due, interval_days: interval });

test("roadmap data is complete and consistent", () => {
  const slugs = ROADMAP.flatMap((t) => t.problems.map((p) => p.slug));
  assert.equal(new Set(slugs).size, slugs.length, "no problem appears twice");
  for (const t of ROADMAP) {
    assert.ok(t.know.length >= 3, `${t.topic} has ideas to know`);
    assert.ok(t.problems.length >= 3, `${t.topic} has problems`);
    for (const p of t.problems) assert.ok(["Easy", "Medium", "Hard"].includes(p.difficulty), p.slug);
  }
  assert.equal(ROADMAP[0].topic, "Arrays & Hashing");
});

test("slugFromUrl reads LeetCode problem links only", () => {
  assert.equal(slugFromUrl("https://leetcode.com/problems/two-sum/description/"), "two-sum");
  assert.equal(slugFromUrl("https://leetcode.com/problems/3sum"), "3sum");
  assert.equal(slugFromUrl("https://codeforces.com/problemset/problem/1/A"), null);
  assert.equal(slugFromUrl(null), null);
  assert.equal(slugFromUrl("not a link"), null);
});

test("progress marks saved problems by review state, and points at the next one", () => {
  const mine = [
    saved("contains-duplicate", "2026-10-25T00:00:00Z"), // scheduled
    saved("valid-anagram", "2026-10-21T00:00:00Z"), // due
    saved("two-sum", "2026-12-01T00:00:00Z", 30), // remembered
  ];
  const { topics, solvedCount, total, current, next } = roadmapProgress(mine, NOW);
  const arrays = topics[0];
  assert.deepEqual(arrays.problems.slice(0, 4).map((p) => p.status), ["solved", "due", "remembered", "todo"]);
  assert.deepEqual([arrays.solved, arrays.total, arrays.remembered, arrays.due], [3, 8, 1, 1]);
  assert.equal(solvedCount, 3);
  assert.equal(total, ROADMAP.reduce((n, t) => n + t.problems.length, 0));
  assert.equal(current, 0); // 3 of 8 isn't half yet
  assert.deepEqual([next.topic, next.problem.slug], ["Arrays & Hashing", "group-anagrams"]);
});

test("a topic counts as done at half its problems; next skips design problems", () => {
  const arrays = ROADMAP[0].problems.slice(0, 4).map((p) => saved(p.slug, "2026-10-30T00:00:00Z"));
  const { current, next } = roadmapProgress(arrays, NOW);
  assert.equal(current, 1);
  assert.equal(next.problem.slug, "valid-palindrome");

  // Stack's first unsolved problem after Valid Parentheses is Min Stack (design): skip to the next one.
  const upToStack = ROADMAP.slice(0, 3).flatMap((t) => t.problems).map((p) => saved(p.slug, "2026-10-30T00:00:00Z"));
  const atStack = roadmapProgress([...upToStack, saved("valid-parentheses", "2026-10-30T00:00:00Z")], NOW);
  assert.equal(ROADMAP[atStack.current].topic, "Stack");
  assert.equal(atStack.next.problem.slug, "evaluate-reverse-polish-notation");
});

test("everything solved: no next problem", () => {
  const all = ROADMAP.flatMap((t) => t.problems).map((p) => saved(p.slug, "2026-10-30T00:00:00Z"));
  const { next, current } = roadmapProgress(all, NOW);
  assert.equal(next, null);
  assert.equal(current, null);
});
