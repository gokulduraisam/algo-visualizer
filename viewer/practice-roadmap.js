// Practice page: the roadmap at a glance (progress per topic) and the next problem to solve.
import { leetcodeUrl } from "./roadmap-data.js";
import { roadmapProgress } from "./roadmap.js";
import { encodeShare } from "./share.js";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Link that opens the visualizer empty, with the problem's page set so Save fills itself in. */
export const visualizeLink = (problem) =>
  `./${encodeShare({ mode: "leetcode", code: "", input: "", page: leetcodeUrl(problem.slug), difficulty: problem.difficulty })}`;

/** Buttons for one roadmap problem: solve on LeetCode, and (unless it's a design problem) visualize here. */
export function problemActions(problem) {
  const actions = el("span", "roadmap-actions");
  const solve = el("a", "button primary", "Solve on LeetCode");
  Object.assign(solve, { href: leetcodeUrl(problem.slug), target: "_blank", rel: "noopener" });
  actions.append(solve);
  if (problem.design) {
    actions.append(el("span", "muted", "Design problem: LeetCode only for now"));
  } else {
    const viz = el("a", "button", "Visualize here");
    viz.href = visualizeLink(problem);
    actions.append(viz);
  }
  return actions;
}

export function renderRoadmapCard(problems) {
  const { topics, solvedCount, total, current, next } = roadmapProgress(problems);
  const head = document.getElementById("ladder-next");
  if (next) {
    const title = el("strong", null, next.problem.title);
    head.replaceChildren("Next up: ", title, ` (${next.problem.difficulty}, ${next.topic})`);
    document.getElementById("ladder-actions").replaceChildren(problemActions(next.problem));
  } else {
    head.textContent = "You've solved every roadmap problem. Keep reviewing to lock them in.";
    document.getElementById("ladder-actions").replaceChildren();
  }
  document.getElementById("ladder-total").textContent = `${solvedCount} of ${total} solved`;
  document.getElementById("ladder").replaceChildren(
    ...topics.map((t, i) => {
      const item = el("li", `topic${i === current ? " next" : ""}${t.solved === 0 ? " empty" : ""}`);
      const name = el("a", "topic-name", t.topic);
      name.href = `roadmap.html#topic-${i + 1}`;
      const bar = el("span", "topic-bar");
      const fill = el("span", "topic-fill");
      fill.style.width = `${(t.solved / t.total) * 100}%`;
      const remembered = el("span", "topic-remembered");
      remembered.style.width = `${(t.remembered / t.total) * 100}%`;
      bar.append(fill, remembered);
      bar.title = `${t.solved} solved, ${t.remembered} remembered long-term`;
      item.append(el("span", "topic-step", String(i + 1)), name, bar, el("span", "topic-count", `${t.solved} of ${t.total}`));
      return item;
    }),
  );
}
