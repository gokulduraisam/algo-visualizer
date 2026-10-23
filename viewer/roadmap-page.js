// Roadmap page: every topic with what to know and what to solve, your progress, and what's next.
import { cloudEnabled, listProblems } from "./cloud.js";
import { mountNav } from "./nav.js";
import { problemActions, visualizeLink } from "./practice-roadmap.js";
import { leetcodeUrl } from "./roadmap-data.js";
import { roadmapProgress } from "./roadmap.js";

const $ = (id) => document.getElementById(id);
const STATUS_LABEL = { solved: "Solved", due: "Review due", remembered: "Remembered" };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

async function main() {
  let problems = [];
  const user = cloudEnabled ? await mountNav({ onError: (text) => showBanner(text) }) : null;
  if (user) {
    try {
      problems = await listProblems();
    } catch (err) {
      showBanner(err.message);
    }
  }
  render(roadmapProgress(problems), Boolean(user));
}

function showBanner(text, kind = "error") {
  $("banner").textContent = text;
  $("banner").className = `banner ${kind}`;
  $("banner").hidden = false;
}

function render({ topics, solvedCount, total, current, next }, signedIn) {
  $("overall-fill").style.width = `${(solvedCount / total) * 100}%`;
  $("overall-text").textContent = signedIn
    ? `${solvedCount} of ${total} problems solved`
    : `${total} problems in ${topics.length} topics. Sign in to track which ones you've solved.`;

  if (next) {
    $("next-card").hidden = false;
    $("next-title").textContent = next.problem.title;
    const topic = topics[current];
    $("next-why").textContent = `${next.problem.difficulty}, ${next.topic}: ${topic.solved} of ${topic.total} solved in this topic.`;
    $("next-actions").replaceChildren(problemActions(next.problem));
  }

  const requested = Number(/^#topic-(\d+)$/.exec(location.hash)?.[1]) - 1;
  $("stages").replaceChildren(...topics.map((t, i) => stage(t, i, i === current, i === requested)));
  if (requested >= 0) $(`topic-${requested + 1}`)?.scrollIntoView({ block: "start" });
}

function stage(t, i, isCurrent, isRequested) {
  const item = el("li", `stage${isCurrent ? " current" : ""}${t.solved >= Math.ceil(t.total / 2) ? " done" : ""}`);
  const details = el("details");
  details.id = `topic-${i + 1}`;
  details.open = isCurrent || isRequested;

  const summary = el("summary");
  const bar = el("span", "stage-bar");
  const fill = el("span");
  fill.style.width = `${(t.solved / t.total) * 100}%`;
  bar.append(fill);
  const label = isCurrent ? "You're here" : t.solved >= Math.ceil(t.total / 2) ? "Done" : "";
  summary.append(
    el("span", "stage-step", String(i + 1)),
    el("span", "stage-name", t.topic),
    el("span", "stage-label", label),
    bar,
    el("span", "stage-count", `${t.solved} of ${t.total}`),
  );
  details.append(summary);

  const body = el("div", "stage-body");
  const know = el("div", "know");
  know.append(el("h3", null, "Know this"));
  const ideas = el("ul");
  ideas.append(...t.know.map((idea) => el("li", null, idea)));
  know.append(ideas);

  const solve = el("div", "solve");
  solve.append(el("h3", null, "Solve these"));
  const list = el("ol", "solve-list");
  list.append(...t.problems.map(problemRow));
  solve.append(list);
  body.append(know, solve);
  details.append(body);
  item.append(details);
  return item;
}

function problemRow(p) {
  const row = el("li", `solve-row ${p.status}`);
  row.append(el("span", `solve-mark ${p.status}`, p.status === "todo" ? "" : "✓"));
  const title = el("a", "solve-title", p.title);
  Object.assign(title, { href: leetcodeUrl(p.slug), target: "_blank", rel: "noopener" });
  title.title = "Open on LeetCode";
  row.append(title, el("span", `difficulty ${p.difficulty.toLowerCase()}`, p.difficulty));
  const side = el("span", "solve-side");
  if (STATUS_LABEL[p.status]) side.append(el("span", `solve-status ${p.status}`, STATUS_LABEL[p.status]));
  if (p.design) side.append(el("span", "muted", "LeetCode only"));
  else {
    const viz = el("a", "solve-viz", "Visualize");
    viz.href = visualizeLink(p);
    side.append(viz);
  }
  row.append(side);
  return row;
}

main();
