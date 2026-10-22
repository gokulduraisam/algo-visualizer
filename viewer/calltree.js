// Recursion tree: every function call as a node, labelled with its arguments and,
// once it returns, its return value. Built from the trace's call/return events.

const COL = 92; // px per leaf
const ROW = 58; // px per depth level

/** Nested call nodes: {name, args: [[name, value]], heap, start, end, ret, retHeap, children}. */
export function buildCallTree(trace) {
  const roots = [];
  const open = [];
  trace.forEach((step, i) => {
    const frame = step.stack[step.stack.length - 1];
    const isCall = frame && !frame.is_class_body && !step.func_name.startsWith("<");
    if (!isCall) return;
    if (step.event === "call") {
      const args = Object.entries(frame.locals).filter(([n]) => n !== "self");
      const node = { name: step.func_name, args, heap: step.heap, start: i, end: null, ret: null, retHeap: null, children: [] };
      (open.length ? open[open.length - 1].children : roots).push(node);
      open.push(node);
    } else if (step.event === "return" && open.length) {
      const node = open.pop();
      node.end = i;
      node.ret = frame.locals.__return__ ?? null;
      node.retHeap = step.heap;
    }
  });
  return roots;
}

/** Flat pre-order list of {node, x, depth, parent}: leaves side by side, parents centred above. */
export function layoutCallTree(roots) {
  const out = [];
  let nextLeaf = 0;
  const place = (node, depth, parent) => {
    const item = { node, x: 0, depth, parent };
    out.push(item);
    if (!node.children.length) {
      item.x = nextLeaf++;
    } else {
      const kids = node.children.map((child) => place(child, depth + 1, item));
      item.x = (kids[0].x + kids[kids.length - 1].x) / 2;
    }
    return item;
  };
  roots.forEach((root) => place(root, 0, null));
  return out;
}

export function nodeState(node, stepIndex) {
  if (node.start > stepIndex) return "future";
  if (node.end !== null && node.end <= stepIndex) return "done";
  return "active";
}

/** One short, readable value for a label: 3, 'ab', TreeNode(3), [1, 2], [1, 2, 3, …], {…}. */
export function shortValue(v, heap) {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return `'${v.length > 12 ? `${v.slice(0, 12)}…` : v}'`;
  const [tag, a] = v;
  if (tag !== "REF") return String(a);
  const entry = heap?.[a];
  if (!entry) return "…";
  const [kind, ...items] = entry;
  if (kind === "INSTANCE") {
    const val = items.slice(1).find(([n]) => n === "val");
    return val ? `${items[0]}(${shortValue(val[1], heap)})` : items[0];
  }
  if (kind === "LIST" || kind === "TUPLE" || kind === "DEQUE") {
    const simple = items.every((x) => x === null || typeof x !== "object");
    if (!simple) return "[…]";
    const shown = items.slice(0, 3).map((x) => shortValue(x, heap));
    return `[${shown.join(", ")}${items.length > 3 ? ", …" : ""}]`;
  }
  return "{…}";
}

export const callLabel = (node) => `${node.name}(${node.args.map(([, v]) => shortValue(v, node.heap)).join(", ")})`;

/** Does this run have nested calls (recursion or helpers)? Only then is the tree worth showing. */
export const hasNestedCalls = (roots) => roots.some((r) => r.children.length > 0);

/** Draw the tree as of `stepIndex`: future calls hidden, active path highlighted, returns shown. */
export function renderCallTree(container, laidOut, stepIndex, onJump) {
  const visible = laidOut.filter(({ node }) => nodeState(node, stepIndex) !== "future");
  const active = visible.filter(({ node }) => nodeState(node, stepIndex) === "active");
  const current = active[active.length - 1]; // pre-order: the deepest active call comes last
  const width = (Math.max(0, ...laidOut.map((n) => n.x)) + 1) * COL;
  const height = (Math.max(0, ...laidOut.map((n) => n.depth)) + 1) * ROW;

  const canvas = document.createElement("div");
  canvas.className = "calltree-canvas";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("aria-hidden", "true");
  canvas.append(svg);

  const centre = (item) => [item.x * COL + COL / 2, item.depth * ROW];
  for (const item of visible) {
    if (item.parent) {
      const [x1, y1] = centre(item.parent);
      const [x2, y2] = centre(item);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      Object.entries({ x1, y1: y1 + 30, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
      if (nodeState(item.node, stepIndex) === "active") line.setAttribute("class", "on-path");
      svg.append(line);
    }
    const { node } = item;
    const state = nodeState(node, stepIndex);
    const box = document.createElement("button");
    box.type = "button";
    box.className = `call ${state}${item === current ? " current" : ""}`;
    box.style.left = `${centre(item)[0]}px`;
    box.style.top = `${centre(item)[1]}px`;
    box.title = `Jump to this call (step ${node.start + 1})`;
    const label = document.createElement("span");
    label.textContent = callLabel(node);
    box.append(label);
    if (state === "done" && node.ret !== null) {
      const ret = document.createElement("span");
      ret.className = "ret";
      ret.textContent = `→ ${shortValue(node.ret, node.retHeap)}`;
      box.append(ret);
    }
    box.onclick = () => onJump(node.start);
    canvas.append(box);
  }
  container.replaceChildren(canvas);
  container.querySelector(".call.current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
