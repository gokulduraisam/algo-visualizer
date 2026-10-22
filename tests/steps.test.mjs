import assert from "node:assert/strict";
import { test } from "node:test";

import { changedItems, changedNames, lineHits, nextRun } from "../viewer/steps.js";

const line = (n) => ({ line: n, event: "line" });
const trace = [line(1), line(2), line(3), line(2), line(3), { line: 3, event: "return" }];

test("lineHits counts line events up to and including the current step", () => {
  assert.deepEqual([...lineHits(trace, 3)], [[1, 1], [2, 2], [3, 1]]);
  assert.equal(lineHits(trace, 5).get(3), 2); // the return event doesn't count as a run
});

test("nextRun finds the next time a line runs, wrapping to the start", () => {
  assert.equal(nextRun(trace, 2, 1), 3);
  assert.equal(nextRun(trace, 2, 3), 1); // no later run: wrap around
  assert.equal(nextRun(trace, 9, 0), -1);
});

test("changedNames: new or different values, refs compared by id", () => {
  const prev = { a: 1, b: ["REF", 4], c: "x" };
  const now = { a: 2, b: ["REF", 4], c: "x", d: 0 };
  assert.deepEqual([...changedNames(now, prev)].sort(), ["a", "d"]);
  assert.equal(changedNames(now, undefined).size, 0); // first step: nothing is "changed"
});

test("changedItems: list cells by index", () => {
  assert.deepEqual([...changedItems(["LIST", 1, 9, 3, 4], ["LIST", 1, 2, 3])], [1, 3]);
});

test("changedItems: dict entries and instance fields by key", () => {
  assert.deepEqual([...changedItems(["DICT", ["a", 1], ["b", 3]], ["DICT", ["a", 1], ["b", 2]])], ['"b"']);
  const node = (v) => ["INSTANCE", "ListNode", ["val", v], ["next", null]];
  assert.deepEqual([...changedItems(node(5), node(4))], ["val"]);
});

test("changedItems: sets by membership, and null for a brand-new object", () => {
  assert.deepEqual([...changedItems(["SET", 1, 2, 7], ["SET", 2, 1])], [2]);
  assert.equal(changedItems(["LIST", 1], undefined), null);
  assert.equal(changedItems(["LIST", 1], ["DICT"]), null);
});
