import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCallTree, callLabel, layoutCallTree, nodeState, shortValue } from "../viewer/calltree.js";

const frame = (name, locals, extra = {}) => ({ func_name: name, locals, ...extra });
const step = (event, func_name, stack, heap = {}) => ({ event, func_name, line: 1, stack, heap });

// fib(2) -> fib(1) + fib(0)
const f2 = frame("fib", { n: 2 });
const TRACE = [
  step("line", "<module>", []),
  step("call", "fib", [f2]),
  step("call", "fib", [f2, frame("fib", { n: 1 })]),
  step("return", "fib", [f2, frame("fib", { n: 1, __return__: 1 })]),
  step("call", "fib", [f2, frame("fib", { n: 0 })]),
  step("return", "fib", [f2, frame("fib", { n: 0, __return__: 0 })]),
  step("return", "fib", [frame("fib", { n: 2, __return__: 1 })]),
  step("return", "<module>", []),
];

test("buildCallTree nests calls and records return values and step ranges", () => {
  const [root, ...others] = buildCallTree(TRACE);
  assert.equal(others.length, 0);
  assert.deepEqual([root.start, root.end, root.ret], [1, 6, 1]);
  assert.deepEqual(root.children.map((c) => [c.args, c.ret, c.start, c.end]), [
    [[["n", 2 - 1]], 1, 2, 3],
    [[["n", 0]], 0, 4, 5],
  ]);
});

test("class bodies, comprehensions and `self` are left out", () => {
  const trace = [
    step("call", "Solution", [frame("Solution", {}, { is_class_body: true })]),
    step("return", "Solution", [frame("Solution", {}, { is_class_body: true })]),
    step("call", "solve", [frame("solve", { self: ["REF", 1], k: 3 })]),
    step("call", "<genexpr>", [frame("solve", {}), frame("<genexpr>", {})]),
    step("return", "<genexpr>", [frame("solve", {}), frame("<genexpr>", {})]),
    step("return", "solve", [frame("solve", { __return__: 9 })]),
  ];
  const roots = buildCallTree(trace);
  assert.deepEqual(roots.map((r) => [r.name, r.args, r.children.length, r.ret]), [["solve", [["k", 3]], 0, 9]]);
});

test("an unfinished call (step limit) has no end", () => {
  const [root] = buildCallTree(TRACE.slice(0, 3));
  assert.equal(root.end, null);
  assert.equal(root.children[0].end, null);
});

test("layout: leaves side by side, parent centred above them, roots after each other", () => {
  const nodes = layoutCallTree([...buildCallTree(TRACE), ...buildCallTree(TRACE)]);
  assert.deepEqual(nodes.map((n) => [n.x, n.depth]), [[0.5, 0], [0, 1], [1, 1], [2.5, 0], [2, 1], [3, 1]]);
});

test("nodeState follows the current step", () => {
  const [root] = buildCallTree(TRACE);
  const child = root.children[0];
  assert.equal(nodeState(child, 1), "future");
  assert.equal(nodeState(child, 2), "active");
  assert.equal(nodeState(child, 3), "done");
});

test("shortValue keeps labels short", () => {
  const heap = {
    1: ["INSTANCE", "TreeNode", ["val", 3], ["left", null], ["right", null]],
    2: ["LIST", 1, 2],
    3: ["LIST", 1, 2, 3, 4, 5, 6],
    4: ["DICT", ["a", 1]],
  };
  assert.equal(shortValue(3, heap), "3");
  assert.equal(shortValue("ab", heap), "'ab'");
  assert.equal(shortValue(null, heap), "None");
  assert.equal(shortValue(true, heap), "True");
  assert.equal(shortValue(["REF", 1], heap), "TreeNode(3)");
  assert.equal(shortValue(["REF", 2], heap), "[1, 2]");
  assert.equal(shortValue(["REF", 3], heap), "[1, 2, 3, …]");
  assert.equal(shortValue(["REF", 4], heap), "{…}");
  assert.equal(shortValue(["INT", "100000000000000000000"], heap), "100000000000000000000");
});

test("callLabel", () => {
  const [root] = buildCallTree(TRACE);
  assert.equal(callLabel(root), "fib(2)");
});
