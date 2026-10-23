// Practice page: the topic roadmap card (NeetCode 150 order) with your progress per topic.
import { ladder, TOPICS } from "./topics.js";

const ROADMAP = "https://neetcode.io/roadmap";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function renderLadder(problems) {
  const { rows, next } = ladder(problems);
  const target = new Map(TOPICS.map((t) => [t.name, t.target]));

  const head = document.getElementById("ladder-next");
  if (next) {
    const link = el("a", null, "Find problems");
    Object.assign(link, { href: ROADMAP, target: "_blank", rel: "noopener" });
    head.replaceChildren(el("strong", null, `Next: ${next.topic}`), ` (${next.reason}). `, link);
  } else {
    head.textContent = "Every topic started. Keep reviewing to move them into long-term memory.";
  }

  const list = rows.map((r, i) => {
    const item = el("li", `topic${r.topic === next?.topic ? " next" : ""}${r.solved === 0 ? " empty" : ""}`);
    item.append(el("span", "topic-step", String(i + 1)));
    item.append(el("span", "topic-name", r.topic));
    const bar = el("span", "topic-bar");
    const goal = target.get(r.topic);
    const fill = el("span", "topic-fill");
    fill.style.width = `${Math.min(100, (r.solved / goal) * 100)}%`;
    const remembered = el("span", "topic-remembered");
    remembered.style.width = `${Math.min(100, (r.remembered / goal) * 100)}%`;
    bar.append(fill, remembered);
    bar.title = `${r.remembered} remembered long-term`;
    item.append(bar);
    item.append(el("span", "topic-count", `${r.solved} of ${goal}`));
    return item;
  });
  document.getElementById("ladder").replaceChildren(...list);
}
