// Practice: what's due today, your rank and streak, review activity, your problem library,
// and the review flow (recall first, then reveal your insight, then rate).
import { cloudEnabled, deleteProblem, listProblems, listReviews, recordReview } from "./cloud.js";
import { mountNav, refreshProgress } from "./nav.js";
import { activityGrid, practiceSummary, rankFor, streak, xpFor } from "./progress.js";
import { encodeShare } from "./share.js";
import { formatDays, nextIntervals, RATINGS, reviewStatus } from "./srs.js";

const $ = (id) => document.getElementById(id);
const RATING_LABEL = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const RATING_HINT = { again: "Forgot it", hard: "Got there slowly", good: "Remembered", easy: "Instantly" };

let problems = [];
let reviews = []; // [{rating, reviewed_at}], newest first
const session = { queue: [], index: 0, done: 0, xpBefore: 0 };

// ---------- helpers ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function showBanner(text, kind = "error") {
  $("banner").textContent = text;
  $("banner").className = `banner ${kind}`;
  $("banner").hidden = false;
}
const replayLink = (p) => new URL(`./${encodeShare({ problemId: p.id })}`, location.href).href;
const xpNow = () => xpFor(problems.length, reviews.map((r) => r.rating));
const dueProblems = () =>
  problems.filter((p) => reviewStatus(p).kind === "due").sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

// ---------- start ----------
async function main() {
  if (!cloudEnabled) {
    $("today-title").textContent = "Practice needs accounts";
    $("today-detail").textContent = "Accounts aren't set up on this site yet.";
    return;
  }
  const user = await mountNav({ onError: (text) => showBanner(text) });
  if (!user) {
    $("today-title").textContent = "Keep every solution, and remember it";
    $("today-detail").textContent =
      "Sign in with Google (top right) to save problems, review them at the right time, and climb from Newbie to Grandmaster.";
    return;
  }
  try {
    [problems, reviews] = await Promise.all([listProblems(), listReviews()]);
    renderHome();
  } catch (err) {
    $("today-title").textContent = "Practice couldn't load";
    showBanner(err.message);
  }
}

// ---------- home ----------
function renderHome() {
  renderToday();
  renderRank();
  renderActivity();
  renderLibrary();
  $("rank-card").hidden = false;
  $("activity-card").hidden = false;
  $("library-card").hidden = problems.length === 0;
}

function renderToday() {
  const due = dueProblems();
  const names = (list) => {
    const shown = list.slice(0, 3).map((p) => p.title).join(", ");
    return list.length > 3 ? `${shown} and ${list.length - 3} more` : shown;
  };
  $("start-review").hidden = due.length === 0;
  if (due.length) {
    $("today-title").textContent = `${due.length} problem${due.length === 1 ? "" : "s"} to review today`;
    $("today-detail").textContent = names(due);
  } else if (problems.length) {
    const next = problems.slice().sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
    $("today-title").textContent = "All caught up";
    $("today-detail").textContent = `Next up: ${next.title}, ${reviewStatus(next).label.toLowerCase()}. Solve something new in the meantime.`;
  } else {
    $("today-title").textContent = "Start your practice log";
    $("today-detail").textContent =
      "Visualize a solution and click Save. It comes back here the day after, and then less and less often as it sticks.";
  }
  $("solve-new").className = due.length ? "button" : "button primary big";
}

function renderRank() {
  const { rank, next, progress, toNext } = rankFor(xpNow());
  $("rank-card").style.setProperty("--rank", rank.color);
  $("rank-name").textContent = rank.name;
  $("rank-fill").style.width = `${Math.round(progress * 100)}%`;
  $("rank-card").querySelector(".rank-bar").setAttribute("aria-valuenow", Math.round(progress * 100));
  $("rank-next").textContent = next ? `${toNext} XP to ${next.name}` : "Top rank. Keep the streak going.";
  const days = streak(reviews.map((r) => r.reviewed_at));
  $("streak").textContent = days ? `🔥 ${days}-day streak` : "Review something today to start a streak";
}

function renderActivity() {
  const grid = activityGrid(reviews.map((r) => r.reviewed_at));
  const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);
  const columns = grid.map((week) => {
    const col = el("div", "week");
    for (const { date, count } of week) {
      const cell = el("span", `day l${level(count)}`);
      cell.title = `${new Date(`${date}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${count} review${count === 1 ? "" : "s"}`;
      col.append(cell);
    }
    return col;
  });
  $("activity").replaceChildren(...columns);
  const total = grid.flat().reduce((sum, d) => sum + d.count, 0);
  $("activity").setAttribute("aria-label", `${total} reviews in the last 16 weeks`);
  $("activity-total").textContent = total ? `${total} review${total === 1 ? "" : "s"}` : "Your reviews show up here";

  const { thisWeek, longTerm, weakest } = practiceSummary(problems, reviews.map((r) => r.reviewed_at));
  $("sum-week").textContent = `${thisWeek} review${thisWeek === 1 ? "" : "s"}`;
  $("sum-long").textContent = `${longTerm} of ${problems.length} problem${problems.length === 1 ? "" : "s"}`;
  $("sum-weak").replaceChildren(
    ...(weakest
      ? [weakest.tag, el("span", "sub", `forgotten ${weakest.lapses} time${weakest.lapses === 1 ? "" : "s"}`)]
      : ["Nothing yet"]),
  );
}

function renderLibrary() {
  const query = $("search").value.trim().toLowerCase();
  const difficulty = $("difficulty").value;
  const shown = problems.filter(
    (p) =>
      (!difficulty || p.difficulty === difficulty) &&
      (!query || [p.title, p.notes, ...p.tags].join(" ").toLowerCase().includes(query)),
  );
  $("list").replaceChildren(...shown.map(row));
  if (!shown.length) $("list").append(el("li", "empty", "No problems match that search."));
}

function row(p) {
  const item = el("li", "problem");
  const status = reviewStatus(p);
  item.append(el("span", `status-dot ${status.kind}`));

  const main = el("div", "problem-main");
  const head = el("div", "problem-head");
  const title = el("a", "problem-title", p.title);
  title.href = replayLink(p);
  title.title = "Replay in the visualizer";
  head.append(title);
  if (p.difficulty) head.append(el("span", `difficulty ${p.difficulty.toLowerCase()}`, p.difficulty));
  for (const tag of p.tags) head.append(el("span", "tag", tag));
  main.append(head);
  if (p.notes) main.append(el("p", "insight", p.notes));
  item.append(main);

  const side = el("div", "problem-side");
  side.append(el("span", `status ${status.kind}`, status.label));
  const actions = el("div", "problem-actions");
  if (p.url) {
    const source = el("a", null, "Problem page");
    Object.assign(source, { href: p.url, target: "_blank", rel: "noopener" });
    actions.append(source);
  }
  if (p.is_shared) actions.append(actionButton("Copy link", () => copy(replayLink(p))));
  actions.append(actionButton("Delete", () => remove(p)));
  side.append(actions);
  item.append(side);
  return item;
}

function actionButton(text, onClick) {
  const b = el("button", "link", text);
  b.type = "button";
  b.onclick = onClick;
  return b;
}

async function copy(link) {
  try {
    await navigator.clipboard.writeText(link);
    showBanner("Link copied.", "warn");
  } catch {
    showBanner(`Copy this link: ${link}`, "warn");
  }
}

async function remove(p) {
  if (!confirm(`Delete “${p.title}”? Its review history goes too. This can't be undone.`)) return;
  try {
    await deleteProblem(p.id);
    problems = problems.filter((x) => x.id !== p.id);
    renderHome();
    refreshProgress();
  } catch (err) {
    showBanner(err.message);
  }
}

// ---------- review flow ----------
function startReview() {
  Object.assign(session, { queue: dueProblems(), index: 0, done: 0, xpBefore: xpNow() });
  $("home").hidden = true;
  $("review").hidden = false;
  $("banner").hidden = true;
  showCard();
}

function showCard() {
  const p = session.queue[session.index];
  if (!p) return showDone();
  $("review-card").hidden = false;
  $("review-done").hidden = true;
  $("review-progress").textContent = `${session.index + 1} of ${session.queue.length}`;
  $("review-title").textContent = p.title;
  const chips = [];
  if (p.difficulty) chips.push(el("span", `difficulty ${p.difficulty.toLowerCase()}`, p.difficulty));
  for (const tag of p.tags) chips.push(el("span", "tag", tag));
  $("review-chips").replaceChildren(...chips);
  $("review-page").hidden = !p.url;
  if (p.url) $("review-page").href = p.url;
  $("review-replay").href = replayLink(p);
  $("recall").hidden = false;
  $("answer").hidden = true;
  $("review-notes").textContent =
    p.notes || "No insight saved for this one. Replay your solution, then add one with Save → Key insight.";
  const gaps = nextIntervals(p);
  $("ratings").replaceChildren(
    ...RATINGS.map((rating, i) => {
      const b = el("button", `rating ${rating}`);
      b.type = "button";
      b.append(el("span", "rating-name", RATING_LABEL[rating]), el("span", "rating-hint", RATING_HINT[rating]),
        el("span", "rating-gap", `Next in ${formatDays(gaps[rating])}`), el("kbd", null, String(i + 1)));
      b.onclick = () => rate(rating);
      return b;
    }),
  );
  $("reveal").focus();
}

function reveal() {
  $("recall").hidden = true;
  $("answer").hidden = false;
  $("ratings").querySelector(".good").focus();
}

async function rate(rating) {
  const p = session.queue[session.index];
  const buttons = [...$("ratings").querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  try {
    const updated = await recordReview(p, rating);
    problems = problems.map((x) => (x.id === p.id ? { ...x, ...updated } : x));
    reviews = [{ rating, reviewed_at: new Date().toISOString() }, ...reviews];
    session.done++;
    session.index++;
    showCard();
    refreshProgress();
  } catch (err) {
    showBanner(err.message);
    buttons.forEach((b) => (b.disabled = false));
  }
}

function showDone() {
  $("review-card").hidden = true;
  $("review-done").hidden = false;
  $("review-progress").textContent = "";
  const gained = xpNow() - session.xpBefore;
  const { rank } = rankFor(xpNow());
  $("done-title").textContent = session.done ? `Done: ${session.done} reviewed` : "Nothing to review right now";
  $("done-detail").textContent = session.done
    ? `+${gained} XP. You're a ${rank.name}. See you tomorrow.`
    : "Everything is scheduled for later. Solve a new problem in the meantime.";
  $("done-back").focus();
}

function exitReview() {
  $("review").hidden = true;
  $("home").hidden = false;
  renderHome();
}

// ---------- wiring ----------
$("start-review").onclick = startReview;
$("reveal").onclick = reveal;
$("review-exit").onclick = exitReview;
$("done-back").onclick = exitReview;
$("search").addEventListener("input", renderLibrary);
$("difficulty").addEventListener("change", renderLibrary);
document.addEventListener("keydown", (e) => {
  if ($("review").hidden || e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") return exitReview();
  if (!$("recall").hidden && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    return reveal();
  }
  const rating = RATINGS[Number(e.key) - 1];
  if (rating && !$("answer").hidden && !$("review-card").hidden) rate(rating);
});
main();
