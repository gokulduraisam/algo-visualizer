# Algo Visualizer

Step through your Python solutions line by line and watch variables, lists, dicts,
linked lists and trees change. Python runs in your browser (Pyodide); nothing is uploaded.

## Run it

```
cd "D:\Claude Projects\algo-visualizer"
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/viewer/ (it must be served over http, not opened as a file).

- **Input/output mode** (Codeforces, AtCoder, CSES…): paste the full program and the sample input.
- **Function mode** (LeetCode): paste the `class Solution`, and an example like
  `nums = [2,7,11,15], target = 9` or one value per line. `ListNode`, `TreeNode`,
  `List`, `Optional`, `deque`, `heappush`, `inf`, … are predefined like on LeetCode.

Use ◀ ▶ or the arrow keys to step.

## Layout

| Folder | What |
|---|---|
| `tracer/` | `run_trace()`: runs code under `sys.settrace`, one JSON snapshot per step |
| `harness/` | LeetCode function mode: parses examples, builds nodes, calls `Solution` |
| `viewer/` | the web page; `worker.js` runs Pyodide, `render.js` draws memory |
| `tests/` | `python -m unittest discover tests` and `node --test tests/layout.test.mjs` |

Drawing: classes with `left` and `right` fields are drawn as binary trees, classes with
`next` as linked-list rows. Integer variables named like indexes (`i`, `j`, `left`, `right`,
`lo`, `hi`, `mid`, `slow`, `fast`…) are marked on the arrays in the same function.

Command line: `python -m tracer solution.py < input.txt > trace.json`

## Releasing

GitHub Pages lets browsers cache files for 10 minutes. Every asset is loaded with a `?v=N`
tag so a visitor never mixes old and new files. Bump it on each release:

```
sed -i 's/?v=3/?v=4/g' viewer/*.html viewer/*.js
```

## Limits

- Max 5000 steps per run, 10 s timeout in the browser; lists show the first 200 items.
- LeetCode "design" problems (`LRUCache` with a list of operations) aren't supported yet.
