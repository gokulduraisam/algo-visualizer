import assert from "node:assert/strict";
import { test } from "node:test";

import { bucketByRating, practiceRange, solvedProblems } from "../viewer/codeforces.js";
import { outputsMatch, parseTestCases, verdict } from "../viewer/testcases.js";
import { formatDuration, parseDuration, stopwatch } from "../viewer/timer.js";
import { ladder, TOPICS, topicOf } from "../viewer/topics.js";

// ---------- timer ----------
test("formatDuration: m:ss under an hour, h:mm:ss above", () => {
  assert.deepEqual([0, 5, 65, 600, 3599, 3600, 3725].map(formatDuration), ["0:00", "0:05", "1:05", "10:00", "59:59", "1:00:00", "1:02:05"]);
});

test("parseDuration accepts what people type", () => {
  assert.equal(parseDuration("18:05"), 18 * 60 + 5);
  assert.equal(parseDuration("1:02:05"), 3725);
  assert.equal(parseDuration("25"), 25 * 60); // a bare number means minutes
  assert.equal(parseDuration(" 25m "), 25 * 60);
  assert.equal(parseDuration(""), null);
  assert.throws(() => parseDuration("soon"), /time/i);
  assert.throws(() => parseDuration("5:75"), /time/i);
});

// ---------- topics ----------
test("TOPICS follows the NeetCode roadmap order", () => {
  assert.equal(TOPICS[0].name, "Arrays & Hashing");
  assert.equal(TOPICS[1].name, "Two Pointers");
  assert.ok(TOPICS.some((t) => t.name === "2-D Dynamic Programming"));
});

test("topicOf maps common tags (yours or LeetCode's) to a roadmap topic", () => {
  assert.equal(topicOf("hash map"), "Arrays & Hashing");
  assert.equal(topicOf("Hash Table"), "Arrays & Hashing");
  assert.equal(topicOf("two pointers"), "Two Pointers");
  assert.equal(topicOf("dfs"), "Graphs");
  assert.equal(topicOf("Binary Tree"), "Trees");
  assert.equal(topicOf("dp"), "1-D Dynamic Programming");
  assert.equal(topicOf("2d dp"), "2-D Dynamic Programming");
  assert.equal(topicOf("Priority Queue"), "Heap / Priority Queue");
  assert.equal(topicOf("my own tag"), null);
});

test("ladder counts problems per topic and suggests where to go next", () => {
  const problems = [
    { tags: ["hash map"], interval_days: 30, lapses: 0 },
    { tags: ["hash map", "two pointers"], interval_days: 2, lapses: 3 },
    { tags: ["dfs"], interval_days: 1, lapses: 0 },
  ];
  const { rows, next } = ladder(problems);
  const row = (name) => rows.find((r) => r.topic === name);
  assert.deepEqual(row("Arrays & Hashing"), { topic: "Arrays & Hashing", solved: 2, remembered: 1, lapses: 3 });
  assert.equal(row("Two Pointers").solved, 1);
  assert.equal(row("Graphs").solved, 1);
  assert.equal(row("Sliding Window").solved, 0);
  // the first roadmap topic you haven't touched yet
  assert.deepEqual(next, { topic: "Sliding Window", reason: "next on the roadmap" });
});

test("ladder points at a shaky topic once the early roadmap is covered", () => {
  const early = TOPICS.slice(0, 4).map((t) => ({ tags: [t.aliases[0]], interval_days: 30, lapses: 0 }));
  const shaky = { tags: [TOPICS[1].aliases[0]], interval_days: 2, lapses: 4 };
  assert.deepEqual(ladder([...early, shaky]).next, { topic: TOPICS[1].name, reason: "you forget it most" });
});

// ---------- several test cases ----------
test("parseTestCases: one plain input stays one test with no expected output", () => {
  assert.deepEqual(parseTestCases("nums = [1,2], target = 3"), [{ input: "nums = [1,2], target = 3", expected: null }]);
});

test("parseTestCases: tests split by --- lines, each with an optional Output:", () => {
  const text = "nums = [2,7,11,15], target = 9\nOutput: [0,1]\n---\nnums = [3,2,4], target = 6\nOutput: [1,2]\n---\nnums = [3,3], target = 6\n";
  assert.deepEqual(parseTestCases(text), [
    { input: "nums = [2,7,11,15], target = 9", expected: "[0,1]" },
    { input: "nums = [3,2,4], target = 6", expected: "[1,2]" },
    { input: "nums = [3,3], target = 6", expected: null },
  ]);
});

test("parseTestCases: stdin tests keep multi-line input and multi-line expected output", () => {
  const text = "2\n1 2\n3 4\nOutput:\n3\n7\n---\n1\n5 5\nOutput: 10";
  assert.deepEqual(parseTestCases(text), [
    { input: "2\n1 2\n3 4", expected: "3\n7" },
    { input: "1\n5 5", expected: "10" },
  ]);
});

test("outputsMatch ignores spacing differences that don't change the answer", () => {
  assert.equal(outputsMatch("[0,1]\n", "[0, 1]", "leetcode"), true);
  assert.equal(outputsMatch("true\n", "true", "leetcode"), true);
  assert.equal(outputsMatch("[1,0]\n", "[0,1]", "leetcode"), false);
  assert.equal(outputsMatch("3 \n7\n", "3\n7", "stdin"), true);
  assert.equal(outputsMatch("3\n7\n", "3 7", "stdin"), false); // line breaks matter for stdin
  assert.equal(outputsMatch("YES\n", "yes", "stdin"), false);
});

// ---------- Codeforces ----------
const sub = (contestId, index, rating, verdict, time) => ({
  problem: { contestId, index, name: `P${contestId}${index}`, rating },
  verdict,
  creationTimeSeconds: time,
});

test("solvedProblems: unique accepted problems, newest first", () => {
  const subs = [sub(1, "A", 800, "OK", 300), sub(1, "A", 800, "OK", 200), sub(2, "B", 1200, "WRONG_ANSWER", 100), sub(3, "C", 1400, "OK", 50)];
  assert.deepEqual(solvedProblems(subs).map((p) => p.id), ["1A", "3C"]);
});

test("bucketByRating groups solved problems by rating (unrated last)", () => {
  const solved = solvedProblems([sub(1, "A", 800, "OK", 3), sub(1, "B", 800, "OK", 2), sub(2, "A", 1200, "OK", 1), sub(9, "A", undefined, "OK", 0)]);
  assert.deepEqual(bucketByRating(solved), [{ rating: 800, count: 2 }, { rating: 1200, count: 1 }, { rating: null, count: 1 }]);
});

test("practiceRange: a bit above your rating, in Codeforces' 100-point steps", () => {
  assert.deepEqual(practiceRange(1437), { min: 1400, max: 1600 });
  assert.deepEqual(practiceRange(0), { min: 800, max: 1000 }); // unrated / new
  assert.deepEqual(practiceRange(3500), { min: 3400, max: 3500 });
});

test("stopwatch: start, pause and resume add up; reset clears", () => {
  let t = 0;
  const watch = stopwatch(() => t);
  watch.start();
  t = 5000;
  watch.pause();
  t = 9000; // paused: doesn't count
  watch.start();
  t = 12_000;
  assert.equal(watch.seconds(), 8);
  assert.equal(watch.running, true);
  watch.reset();
  assert.equal(watch.seconds(), 0);
  assert.equal(watch.running, false);
});

test("verdict: pass / fail against the expected output, error when it crashed, ran when nothing to compare", () => {
  const ok = { trace: [{}], stdout: "[0,1]\n", error: null, truncated: false };
  assert.equal(verdict(ok, "[0, 1]", "leetcode"), "pass");
  assert.equal(verdict(ok, "[1,0]", "leetcode"), "fail");
  assert.equal(verdict(ok, null, "leetcode"), "ran");
  assert.equal(verdict({ ...ok, error: { type: "IndexError" } }, "[0,1]", "leetcode"), "error");
  assert.equal(verdict({ ...ok, truncated: true }, "[0,1]", "leetcode"), "cut-off");
});

test("topic targets add up to the NeetCode 150", () => {
  assert.equal(TOPICS.reduce((sum, t) => sum + t.target, 0), 150);
});
