// Run with: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";

import { groupHeap, indexMarks, windowRanges } from "../viewer/layout.js";

const ref = (id) => ["REF", id];
const listNode = (val, next) => ["INSTANCE", "ListNode", ["val", val], ["next", next]];
const treeNode = (val, left, right) => ["INSTANCE", "TreeNode", ["val", val], ["left", left], ["right", right]];

test("linked list nodes become one row per chain, in next-order", () => {
  // mid-reversal: prev = 2 -> 1, head = 3
  const heap = { 1: listNode(1, null), 2: listNode(2, ref(1)), 3: listNode(3, null) };
  assert.deepEqual(groupHeap(heap).chains, [["2", "1"], ["3"]]);
});

test("a cyclic list is still laid out once", () => {
  const heap = { 1: listNode(1, ref(2)), 2: listNode(2, ref(1)) };
  assert.deepEqual(groupHeap(heap).chains, [["1", "2"]]);
});

test("binary tree nodes get in-order x and depth", () => {
  const heap = { 1: treeNode(1, ref(2), ref(3)), 2: treeNode(2, null, null), 3: treeNode(3, null, null) };
  const [tree] = groupHeap(heap).trees;
  const pos = Object.fromEntries(tree.map((n) => [n.id, [n.x, n.depth]]));
  assert.deepEqual(pos, { 1: [1, 0], 2: [0, 1], 3: [2, 1] });
  assert.deepEqual(tree.find((n) => n.id === "1").children, ["2", "3"]);
});

test("everything else stays in the plain column", () => {
  const heap = { 1: ["LIST", 1, 2], 2: ["INSTANCE", "Solution"], 3: listNode(5, null) };
  assert.deepEqual(groupHeap(heap).rest, ["1", "2"]);
});

test("index-like int variables mark cells of arrays in the same frame", () => {
  const step = {
    globals: {},
    stack: [{ locals: { nums: ref(1), left: 0, right: 2, n: 1, done: true, mid: 9 } }],
    heap: { 1: ["LIST", 5, 6, 7] },
  };
  const marks = indexMarks(step).get("1");
  assert.deepEqual([...marks.entries()], [[0, ["left"]], [2, ["right"]]]);
});

test("module-level code uses globals for index marks", () => {
  const step = { globals: { a: ref(4), i: 1 }, stack: [], heap: { 4: ["LIST", 9, 9] } };
  assert.deepEqual([...indexMarks(step).get("4").entries()], [[1, ["i"]]]);
});

test("a left/right pair shades the window between them", () => {
  const step = { globals: {}, stack: [{ locals: { nums: ref(1), l: 1, r: 3 } }], heap: { 1: ["LIST", 0, 0, 0, 0, 0] } };
  assert.deepEqual([...windowRanges(step)], [["1", [1, 3]]]);
});

test("no window when the pair is crossed, missing, or outside the array", () => {
  const at = (locals) => windowRanges({ globals: {}, stack: [{ locals }], heap: { 1: ["LIST", 0, 0, 0] } });
  assert.equal(at({ a: ref(1), lo: 2, hi: 1 }).size, 0);
  assert.equal(at({ a: ref(1), left: 0 }).size, 0);
  assert.deepEqual([...at({ a: ref(1), left: 1, right: 9 })], [["1", [1, 2]]]); // clipped to the array
});
