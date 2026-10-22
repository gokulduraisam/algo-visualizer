// Decides where heap objects go: binary-tree nodes as trees, linked-list nodes in rows,
// 2D lists as grids, everything else in a plain column. Also finds index variables
// (i, left, mid…) to mark array cells, and (i, j)-style pairs to mark grid cells.

const INDEX_NAME = /^(i|j|k|l|r|m|p|q|lo|hi|low|high|mid|left|right|start|end|begin|slow|fast|ptr|idx|index|pos|front|back|top)\d?$/;
const ARRAY_KINDS = new Set(["LIST", "TUPLE", "DEQUE"]);
const GRID_PAIRS = [["i", "j"], ["r", "c"], ["row", "col"], ["x", "y"], ["nr", "nc"], ["ni", "nj"]];

const fieldsOf = (entry) => Object.fromEntries(entry.slice(2));
const refId = (v) => (Array.isArray(v) && v[0] === "REF" ? String(v[1]) : null);
const isArray = (entry) => !!entry && ARRAY_KINDS.has(entry[0]);

export function groupHeap(heap) {
  const treeIds = new Set();
  const listIds = new Set();
  const grids = [];
  const inGrid = new Set();
  for (const [id, entry] of Object.entries(heap)) {
    const rows = gridRows(heap, entry);
    if (rows) {
      grids.push({ id, rows, sharedRows: new Set(rows).size < rows.length });
      inGrid.add(id);
      rows.forEach((r) => inGrid.add(r));
    }
  }
  const rest = [];
  for (const [id, entry] of Object.entries(heap)) {
    const f = entry && entry[0] === "INSTANCE" ? fieldsOf(entry) : {};
    if ("left" in f && "right" in f) treeIds.add(id);
    else if ("next" in f) listIds.add(id);
    else if (!inGrid.has(id)) rest.push(id);
  }
  return { trees: layoutTrees(heap, treeIds), chains: layoutChains(heap, listIds), grids, rest };
}

/** Row ids if `entry` is a list of equal-length (non-empty) lists of plain values, else null. */
function gridRows(heap, entry) {
  if (!isArray(entry) || entry.length < 2) return null;
  const rows = entry.slice(1).map(refId);
  if (rows.some((r) => !r || !isArray(heap[r]))) return null;
  const width = heap[rows[0]].length - 1;
  const plain = (row) => row.slice(1).every((v) => !refId(v));
  return width > 0 && rows.every((r) => heap[r].length - 1 === width && plain(heap[r])) ? rows : null;
}

/** [{row, col, names}] for (i, j)-style pairs in the frame that holds this grid. */
export function gridMarks(step, grid) {
  const vars = step.stack.length ? step.stack[step.stack.length - 1].locals : step.globals;
  if (!Object.values(vars).some((v) => refId(v) === grid.id)) return [];
  const height = grid.rows.length;
  const width = step.heap[grid.rows[0]].length - 1;
  return GRID_PAIRS.filter(([a, b]) => Number.isInteger(vars[a]) && Number.isInteger(vars[b]))
    .map(([a, b]) => ({ row: vars[a], col: vars[b], names: [a, b] }))
    .filter(({ row, col }) => row >= 0 && row < height && col >= 0 && col < width);
}

function layoutChains(heap, ids) {
  const nextOf = (id) => {
    const n = refId(fieldsOf(heap[id]).next);
    return n && ids.has(n) ? n : null;
  };
  const pointedAt = new Set([...ids].map(nextOf).filter(Boolean));
  const seen = new Set();
  const rows = [];
  const walk = (start) => {
    const row = [];
    for (let id = start; id && !seen.has(id); id = nextOf(id)) {
      seen.add(id);
      row.push(id);
    }
    if (row.length) rows.push(row);
  };
  for (const id of ids) if (!pointedAt.has(id)) walk(id);
  for (const id of ids) walk(id); // whatever is left is part of a cycle
  return rows;
}

/** Returns one array per tree of {id, x, depth, children}; x is the in-order position. */
function layoutTrees(heap, ids) {
  const kids = (id) => {
    const f = fieldsOf(heap[id]);
    return [refId(f.left), refId(f.right)].filter((c) => c && ids.has(c));
  };
  const isChild = new Set([...ids].flatMap(kids));
  const seen = new Set();
  const trees = [];
  const build = (root) => {
    const nodes = [];
    let x = 0;
    const visit = (id, depth) => {
      if (seen.has(id)) return;
      seen.add(id);
      const f = fieldsOf(heap[id]);
      const [left, right] = [refId(f.left), refId(f.right)];
      if (left && ids.has(left)) visit(left, depth + 1);
      nodes.push({ id, x: x++, depth, children: kids(id) });
      if (right && ids.has(right)) visit(right, depth + 1);
    };
    visit(root, 0);
    if (nodes.length) trees.push(nodes);
  };
  for (const id of ids) if (!isChild.has(id)) build(id);
  for (const id of ids) build(id); // cycles / shared nodes
  return trees;
}

const WINDOW_PAIRS = [["left", "right"], ["l", "r"], ["lo", "hi"], ["low", "high"]];

/** The active frame's variables and the arrays they point to: [[id, length], ...]. */
function activeArrays(step) {
  const vars = step.stack.length ? step.stack[step.stack.length - 1].locals : step.globals;
  const arrays = new Map();
  for (const v of Object.values(vars)) {
    const id = refId(v);
    const entry = id && step.heap[id];
    if (entry && ARRAY_KINDS.has(entry[0])) arrays.set(id, entry.length - 1);
  }
  return { vars, arrays };
}

/** Map of array heap id -> Map(index -> [variable names]) for the active frame. */
export function indexMarks(step) {
  const { vars, arrays } = activeArrays(step);
  const pointers = Object.entries(vars).filter(([n, v]) => Number.isInteger(v) && INDEX_NAME.test(n));
  const marks = new Map();
  for (const [id, length] of arrays) {
    const byIndex = new Map();
    for (const [name, i] of pointers) {
      if (i >= 0 && i < length) byIndex.set(i, [...(byIndex.get(i) || []), name]);
    }
    marks.set(id, new Map([...byIndex].sort((a, b) => a[0] - b[0])));
  }
  return marks;
}

/** Map of array heap id -> [from, to] for a left/right-style pair (sliding window, binary search). */
export function windowRanges(step) {
  const { vars, arrays } = activeArrays(step);
  const pair = WINDOW_PAIRS.find(([a, b]) => Number.isInteger(vars[a]) && Number.isInteger(vars[b]));
  const ranges = new Map();
  if (!pair) return ranges;
  const [from, to] = [vars[pair[0]], vars[pair[1]]];
  for (const [id, length] of arrays) {
    const lo = Math.max(from, 0);
    const hi = Math.min(to, length - 1);
    if (from <= to && lo <= hi) ranges.set(id, [lo, hi]);
  }
  return ranges;
}
