# Algo Visualizer

Step through your Python solutions line by line and watch variables, lists, dicts,
linked lists and trees change. Python runs in your browser (Pyodide); nothing is uploaded.

Live: https://gokulduraisam.github.io/algo-visualizer/

## Use it

- **Input/output mode** (Codeforces, AtCoder, CSES…): paste the full program and the sample input.
- **Function mode** (LeetCode): paste the `class Solution`, and an example like
  `nums = [2,7,11,15], target = 9` or one value per line. `ListNode`, `TreeNode`,
  `List`, `Optional`, `deque`, `heappush`, `inf`, … are predefined like on LeetCode.

Step with ◀ ▶ or the arrow keys. Click a code line to jump to the next time it runs.
**🔗 Share** copies a link with your code and input (they stay in the link, not on a server).

**Browser extension**: a ▶ Visualize button on LeetCode and Codeforces problems that opens
them here. See [extension/README.md](extension/README.md) to install it.

What you see at each step:

- **Changes** since the previous step are highlighted green; new objects get a dashed outline.
- **Conditions** on `if` / `elif` / `while` lines: `nums[m] <= nums[r] → 7 <= 2 → ❌ False`.
- **Index variables** (`i`, `j`, `left`, `right`, `lo`, `hi`, `mid`, `slow`, `fast`…) marked on
  array cells, and the range between `left`/`right` (or `l`/`r`, `lo`/`hi`) shaded.
- **Run counts** (`×3`) next to each line: how many times it has run so far.
- **Call tree** for recursion: each call with its arguments and return value; click one to jump there.
- Classes with `left`/`right` fields are drawn as binary trees, classes with `next` as linked lists.
- 2D lists (DP tables, grids) are drawn as a table, with `i`/`j`, `r`/`c`, `row`/`col`, `nr`/`nc`…
  marked; a warning appears when rows are the same list (`[[0] * n] * m`).

## Run locally

```
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/viewer/ (it must be served over http, not opened as a file).

## Layout

| Folder | What |
|---|---|
| `tracer/` | `run_trace()`: runs code under `sys.settrace`, one JSON snapshot per step; explains conditions |
| `harness/` | LeetCode function mode: parses examples, builds nodes, calls `Solution` |
| `viewer/` | the web page; `worker.js` runs Pyodide, `render.js` draws memory, `calltree.js` the call tree |
| `extension/` | the browser extension (not part of the website) |
| `.github/` | deploy workflow: tests, then publishes the site with cache-safe file names |
| `tests/` | `python -m unittest discover tests` and `node --test tests/*.test.mjs` |

## Limits

- Max 5000 steps per run, 10 s timeout in the browser; lists show the first 200 items.
- LeetCode "design" problems (`LRUCache` with a list of operations) aren't supported yet.
- After a deploy, a browser may show the previous version for up to 10 minutes (GitHub Pages
  caching; never a mix of old and new files). Ctrl+F5 loads the new one right away.
