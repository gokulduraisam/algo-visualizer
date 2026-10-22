// Facts about the trace across steps: how often lines ran, where a line runs next,
// and what changed since the previous step.

/** Map line -> how many times it has started running, up to and including step `upto`. */
export function lineHits(trace, upto) {
  const hits = new Map();
  for (let i = 0; i <= upto && i < trace.length; i++) {
    if (trace[i].event === "line") hits.set(trace[i].line, (hits.get(trace[i].line) || 0) + 1);
  }
  return hits;
}

/** Index of the next step (after `from`) where `line` runs, wrapping around; -1 if it never runs. */
export function nextRun(trace, line, from) {
  const runs = (i) => trace[i].line === line && trace[i].event === "line";
  for (let i = from + 1; i < trace.length; i++) if (runs(i)) return i;
  for (let i = 0; i <= from && i < trace.length; i++) if (runs(i)) return i;
  return -1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Variable names whose value is new or different from `prev` (refs compare by object id). */
export function changedNames(vars, prev) {
  if (!prev) return new Set();
  return new Set(Object.keys(vars).filter((n) => !(n in prev) || !same(vars[n], prev[n])));
}

/** Changed parts of one heap object: list indexes, dict keys (as JSON), field names, or set items.
 *  Returns null when the object is brand new (or changed kind) so the whole box can be marked. */
export function changedItems(entry, prevEntry) {
  if (!prevEntry || prevEntry[0] !== entry[0]) return null;
  const [kind, ...items] = entry;
  const before = prevEntry.slice(1);
  if (kind === "DICT" || kind === "INSTANCE") {
    const pairs = kind === "INSTANCE" ? items.slice(1) : items;
    const old = new Map((kind === "INSTANCE" ? before.slice(1) : before).map(([k, v]) => [JSON.stringify(k), v]));
    const changed = pairs.filter(([k, v]) => !old.has(JSON.stringify(k)) || !same(old.get(JSON.stringify(k)), v));
    return new Set(changed.map(([k]) => (kind === "INSTANCE" ? k : JSON.stringify(k))));
  }
  if (kind === "SET") {
    const old = new Set(before.map((v) => JSON.stringify(v)));
    return new Set(items.map((v, i) => (old.has(JSON.stringify(v)) ? -1 : i)).filter((i) => i >= 0));
  }
  return new Set(items.map((v, i) => (i < before.length && same(v, before[i]) ? -1 : i)).filter((i) => i >= 0));
}
