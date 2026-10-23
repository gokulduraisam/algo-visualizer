import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

// The worker keeps its Python in a JS template literal; JS turns "\n" into a real line break
// before Python sees it. Rebuild the string the way the browser does and make Python compile it.
test("the worker's Python code compiles as Python receives it", () => {
  const source = readFileSync(new URL("../viewer/worker.js", import.meta.url), "utf8");
  const literal = /const RUN = (`[\s\S]*?`);/.exec(source)?.[1];
  assert.ok(literal, "RUN template found in worker.js");
  const python = new Function(`return ${literal};`)(); // evaluates our own constant, as the browser does
  const check = "import sys; compile(sys.stdin.read(), '<worker RUN>', 'exec'); print('ok')";
  const out = execFileSync(PYTHON, ["-I", "-c", check], { input: python, encoding: "utf8" });
  assert.equal(out.trim(), "ok");
});

// Run that same code the way the worker does (req_json in, JSON out), against our real tracer.
function runWorkerPython(request) {
  const source = readFileSync(new URL("../viewer/worker.js", import.meta.url), "utf8");
  const python = new Function(`return ${/const RUN = (`[\s\S]*?`);/.exec(source)[1]};`)();
  const root = fileURLToPath(new URL("..", import.meta.url)); // handles the space in "Claude Projects"
  // Our own worker code only; execFileSync passes arguments without a shell.
  const driver = [
    "import ast, json, sys",
    `sys.path.insert(0, ${JSON.stringify(root)})`,
    "code = sys.stdin.read()",
    "tree = ast.parse(code)",
    "last = ast.Expression(tree.body.pop().value)",
    `env = {"req_json": ${JSON.stringify(JSON.stringify(request))}}`,
    "exec(compile(tree, '<worker RUN>', 'exec'), env)",
    "print(eval(compile(last, '<worker RUN>', 'eval'), env))",
  ].join("\n");
  return JSON.parse(execFileSync(PYTHON, ["-I", "-c", driver], { input: python, encoding: "utf8" }));
}

test("the worker runs every test case in both modes", () => {
  const stdin = runWorkerPython({ mode: "stdin", code: "a, b = map(int, input().split())\nprint(a + b)\n", inputs: ["1 2", "40 2\n"], maxSteps: 5000 });
  assert.deepEqual(stdin.map((r) => [r.error, r.stdout]), [[null, "3\n"], [null, "42\n"]]);

  const code = "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n";
  const leet = runWorkerPython({ mode: "leetcode", code, inputs: ["nums = [2,7,11,15], target = 9", "nums = [3,3], target = 6"], maxSteps: 5000 });
  assert.deepEqual(leet.map((r) => r.stdout), ["[0,1]\n", "[0,1]\n"]);
  assert.ok(leet.every((r) => r.trace.length > 0));
});
