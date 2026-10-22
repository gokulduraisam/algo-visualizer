// "My problems": everything you saved, newest first, with search and a difficulty filter.
import { cloudEnabled, currentUser, deleteProblem, listProblems, signInWithGoogle } from "./cloud.js";
import { encodeShare } from "./share.js";

const $ = (id) => document.getElementById(id);
let problems = [];

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

const linkTo = (problem) => new URL(`./${encodeShare({ problemId: problem.id })}`, location.href).href;

async function main() {
  if (!cloudEnabled) return showBanner("Accounts aren't set up on this site yet.", "warn");
  try {
    const user = await currentUser();
    if (!user) return showSignIn();
    $("who").textContent = user.email;
    problems = await listProblems();
    render();
  } catch (err) {
    showBanner(err.message);
  }
}

function showSignIn() {
  const button = el("button", "primary", "Sign in with Google");
  button.onclick = () => signInWithGoogle().catch((err) => showBanner(err.message));
  $("list").replaceChildren(el("li", "empty", "Sign in to see the problems you saved."), button);
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const difficulty = $("difficulty").value;
  const shown = problems.filter(
    (p) =>
      (!difficulty || p.difficulty === difficulty) &&
      (!query || [p.title, p.notes, ...p.tags].join(" ").toLowerCase().includes(query)),
  );
  $("count").textContent = problems.length ? `${shown.length} of ${problems.length}` : "";
  if (!problems.length) {
    $("list").replaceChildren(el("li", "empty", "Nothing saved yet. Visualize a solution, then click 💾 Save."));
    return;
  }
  $("list").replaceChildren(...shown.map(card));
}

function card(p) {
  const item = el("li", "problem");
  const head = el("div", "problem-head");
  const title = el("a", "problem-title", p.title);
  title.href = linkTo(p);
  title.title = "Open in the visualizer";
  head.append(title);
  if (p.difficulty) head.append(el("span", `difficulty ${p.difficulty.toLowerCase()}`, p.difficulty));
  for (const tag of p.tags) head.append(el("span", "tag", tag));
  item.append(head);
  if (p.notes) item.append(el("p", "insight", p.notes));

  const meta = el("div", "problem-meta");
  meta.append(el("span", "muted", `Saved ${new Date(p.updated_at).toLocaleDateString()}`));
  if (p.url) {
    const source = el("a", null, "Problem page ↗");
    source.href = p.url;
    source.target = "_blank";
    source.rel = "noopener";
    meta.append(source);
  }
  if (p.is_shared) meta.append(actionButton("🔗 Copy link", () => copy(linkTo(p))));
  meta.append(actionButton("Delete", () => remove(p)));
  item.append(meta);
  return item;
}

function actionButton(text, onClick) {
  const b = el("button", null, text);
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
  if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
  try {
    await deleteProblem(p.id);
    problems = problems.filter((x) => x.id !== p.id);
    render();
  } catch (err) {
    showBanner(err.message);
  }
}

$("search").addEventListener("input", render);
$("difficulty").addEventListener("change", render);
main();
