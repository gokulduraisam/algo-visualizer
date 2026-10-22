// Decides where heap objects go: binary-tree nodes as trees, linked-list nodes in rows,
// everything else in a plain column. Also finds index variables (i, left, mid…) to mark array cells.

const INDEX_NAME = /^(i|j|k|l|r|m|p|q|lo|hi|low|high|mid|left|right|start|end|begin|slow|fast|ptr|idx|index|pos|front|back|top)\d?$/;
const ARRAY_KINDS = new Set(["LIST", "TUPLE", "DEQUE"]);

const fieldsOf = (entry) => Object.fromEntries(entry.slice(2));
const refId = (v) => (Array.isArray(v) && v[0] === "REF" ? String(v[1]) : null);

export function groupHeap(heap) {
  const treeIds = new Set();
  const listIds = new Set();
  const rest = [];
  for (const [id, entry] of Object.entries(heap)) {
    const f = entry && entry[0] === "INSTANCE" ? fieldsOf(entry) : {};
    if ("left" in f && "right" in f) treeIds.add(id);
    else if ("next" in f) listIds.add(id);
    else rest.push(id);
  }
  return { trees: layoutTrees(heap, treeIds), chains: layoutChains(heap, listIds), rest };
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

/** Map of array heap id -> Map(index -> [variable names]) for the active frame. */
export function indexMarks(step) {
  const vars = step.stack.length ? step.stack[step.stack.length - 1].locals : step.globals;
  const pointers = Object.entries(vars).filter(([n, v]) => Number.isInteger(v) && INDEX_NAME.test(n));
  const marks = new Map();
  for (const v of Object.values(vars)) {
    const id = refId(v);
    const entry = id && step.heap[id];
    if (!entry || !ARRAY_KINDS.has(entry[0]) || marks.has(id)) continue;
    const length = entry.length - 1;
    const byIndex = new Map();
    for (const [name, i] of pointers) {
      if (i >= 0 && i < length) byIndex.set(i, [...(byIndex.get(i) || []), name]);
    }
    marks.set(id, new Map([...byIndex].sort((a, b) => a[0] - b[0])));
  }
  return marks;
}
