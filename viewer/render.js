// Draws one trace step: frames on the left, heap objects on the right, arrows between them.
import { groupHeap, indexMarks } from "./layout.js?v=3";

const SVG_NS = "http://www.w3.org/2000/svg";
const TREE_COL = 46; // px per in-order position
const TREE_ROW = 70; // px per depth level

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function renderMemory(container, step) {
  const frames = el("div", "frames");
  const objects = el("div", "objects");
  const innermost = step.stack.length - 1;
  frames.append(frameBox("Global frame", step.globals, innermost < 0));
  step.stack.forEach((f, i) => frames.append(frameBox(f.func_name, withoutEmptySelf(f.locals, step.heap), i === innermost)));
  const marks = indexMarks(step);
  const { trees, chains, rest } = groupHeap(step.heap);
  for (const nodes of trees) objects.append(treeBox(nodes, step.heap));
  for (const row of chains) {
    const chain = el("div", "chain");
    chain.append(...row.map((id) => heapBox(id, step.heap[id])));
    objects.append(chain);
  }
  for (const id of rest) {
    if (!isEmptySolution(step.heap[id])) objects.append(heapBox(id, step.heap[id], marks.get(id)));
  }
  if (!objects.children.length) objects.append(el("p", "muted", "No objects yet"));

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("arrows");
  svg.setAttribute("aria-hidden", "true");
  container.replaceChildren(frames, objects, svg);
  drawArrows(container, svg);
}

/** LeetCode's `self` is a field-less Solution object; showing it only adds an arrow to an empty box. */
const isEmptySolution = (entry) => !!entry && entry[0] === "INSTANCE" && entry[1] === "Solution" && entry.length === 2;

function withoutEmptySelf(locals, heap) {
  const self = locals.self;
  if (!(Array.isArray(self) && self[0] === "REF" && isEmptySolution(heap[self[1]]))) return locals;
  const { self: _, ...rest } = locals;
  return rest;
}

function frameBox(title, vars, active) {
  const box = el("div", active ? "frame active" : "frame");
  box.append(el("div", "frame-title", title));
  const names = Object.keys(vars);
  if (!names.length) box.append(el("div", "muted", "(empty)"));
  else box.append(table(names.map((n) => [n, vars[n]]), false));
  return box;
}

function heapBox(id, entry, marks) {
  const box = el("div", "obj");
  box.id = `obj-${id}`;
  if (!entry) return box;
  const [kind, ...rest] = entry;
  const named = kind === "INSTANCE" || kind === "OTHER";
  box.append(el("div", "obj-kind", named ? rest[0] : kind.toLowerCase()));
  if (kind === "INSTANCE") box.append(table(rest.slice(1), false));
  else if (kind === "DICT") box.append(table(rest, true));
  else if (kind === "OTHER") box.append(el("code", "", rest[1]));
  else box.append(cells(rest, kind !== "SET", marks));
  return box;
}

/** A binary tree drawn top-down; left/right become edges instead of fields. */
function treeBox(nodes, heap) {
  const tree = el("div", "tree");
  tree.style.width = `${(Math.max(...nodes.map((n) => n.x)) + 1) * TREE_COL}px`;
  tree.style.height = `${Math.max(...nodes.map((n) => n.depth)) * TREE_ROW + 44}px`;
  for (const { id, x, depth, children } of nodes) {
    const [, className, ...fields] = heap[id];
    const node = el("div", "obj tree-node");
    node.id = `obj-${id}`;
    node.title = className;
    node.dataset.children = children.join(",");
    node.style.left = `${x * TREE_COL}px`;
    node.style.top = `${depth * TREE_ROW}px`;
    const extra = fields.filter(([n]) => !["left", "right", "val"].includes(n));
    const val = fields.find(([n]) => n === "val");
    node.append(val ? valueEl(val[1]) : el("span", "muted", className));
    if (extra.length) node.append(table(extra, false));
    tree.append(node);
  }
  return tree;
}

function table(pairs, keysAreValues) {
  const t = el("table", "vars");
  if (!pairs.length) return el("div", "muted", "(empty)");
  for (const [k, v] of pairs) {
    const row = t.insertRow();
    row.insertCell().append(keysAreValues ? valueEl(k) : el("span", "name", k));
    row.insertCell().append(valueEl(v));
  }
  return t;
}

function cells(items, indexed, marks) {
  const row = el("div", "cells");
  if (!items.length) row.append(el("span", "muted", "(empty)"));
  items.forEach((v, i) => {
    const cell = el("div", "cell");
    const isMore = Array.isArray(v) && v[0] === "MORE";
    if (indexed && !isMore) cell.append(el("span", "idx", String(i)));
    cell.append(valueEl(v));
    const names = marks?.get(i);
    if (names) {
      cell.classList.add("pointed");
      cell.append(el("span", "ptr", names.join(" ")));
    }
    row.append(cell);
  });
  return row;
}

export function valueEl(v) {
  if (v === null) return el("span", "v-none", "None");
  if (typeof v === "boolean") return el("span", "v-bool", v ? "True" : "False");
  if (typeof v === "number") return el("span", "v-num", String(v));
  if (typeof v === "string") return el("span", "v-str", `'${v}'`);
  const [tag, a, b] = v;
  switch (tag) {
    case "REF": {
      const dot = el("span", "ref");
      dot.dataset.ref = a;
      dot.title = `points to object #${a}`;
      return dot;
    }
    case "INT":
    case "FLOAT":
      return el("span", "v-num", a);
    case "STR":
      return el("span", "v-str", `'${a}…' (${b} chars)`);
    case "FUNCTION":
      return el("span", "v-fn", `function ${a}`);
    case "CLASS":
      return el("span", "v-fn", `class ${a}`);
    case "MODULE":
      return el("span", "v-fn", `module ${a}`);
    case "MORE":
      return el("span", "muted", `… +${a} more`);
    default:
      return el("span", "v-other", JSON.stringify(v));
  }
}

function drawArrows(container, svg) {
  // 1px + overflow:visible: arrows paint everywhere without the svg itself widening the panel
  svg.setAttribute("width", 1);
  svg.setAttribute("height", 1);
  svg.innerHTML =
    '<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
    '<path d="M0,0 L10,5 L0,10 z" class="arrow-head"/></marker></defs>';
  const base = container.getBoundingClientRect();
  const ox = container.scrollLeft - base.left;
  const oy = container.scrollTop - base.top;
  const find = (id) => container.querySelector(`#obj-${id}`);
  const addPath = (d, cls) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    if (cls) path.setAttribute("class", cls);
    else path.setAttribute("marker-end", "url(#head)");
    svg.append(path);
  };

  for (const src of container.querySelectorAll(".ref")) {
    const target = find(src.dataset.ref);
    if (!target) continue;
    const s = src.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const x1 = s.left + s.width / 2 + ox;
    const y1 = s.top + s.height / 2 + oy;
    const x2 = t.left + ox;
    const y2 = t.top + Math.min(14, t.height / 2) + oy;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    addPath(`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`);
  }

  for (const parent of container.querySelectorAll("[data-children]")) {
    const p = parent.getBoundingClientRect();
    for (const childId of parent.dataset.children.split(",").filter(Boolean)) {
      const child = find(childId);
      if (!child) continue;
      const c = child.getBoundingClientRect();
      const x1 = p.left + p.width / 2 + ox;
      const x2 = c.left + c.width / 2 + ox;
      addPath(`M${x1},${p.bottom + oy} L${x2},${c.top + oy}`, "tree-edge");
    }
  }
}
