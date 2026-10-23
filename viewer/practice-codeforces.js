// Practice page: your Codeforces rating, rank, solves, and the rating band to practise next.
import { getProfile, saveProfile } from "./cloud.js";
import {
  bucketByRating, CF_RANK_COLORS, fetchCodeforces, practiceRange, problemLink, problemsetLink,
} from "./codeforces.js";

const $ = (id) => document.getElementById(id);
const CACHE_MINUTES = 30;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Per-browser cache, so reloading Practice doesn't hit the Codeforces API every time.
function cached(handle) {
  try {
    const entry = JSON.parse(localStorage.getItem(`cf:${handle.toLowerCase()}`));
    return entry && Date.now() - entry.at < CACHE_MINUTES * 60_000 ? entry.data : null;
  } catch {
    return null;
  }
}
function remember(handle, data) {
  try {
    localStorage.setItem(`cf:${handle.toLowerCase()}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or blocked: just fetch next time */
  }
}

export async function initCodeforces() {
  $("cf-card").hidden = false;
  $("cf-form").onsubmit = (e) => {
    e.preventDefault();
    connect($("cf-handle").value.trim());
  };
  $("cf-change").onclick = () => showForm("");
  try {
    const { codeforces_handle: handle } = await getProfile();
    if (handle) await show(handle);
    else showForm("");
  } catch (err) {
    showForm(err.message);
  }
}

function showForm(message) {
  $("cf-form").hidden = false;
  $("cf-stats").hidden = true;
  $("cf-message").textContent = message;
}

async function connect(handle) {
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(handle)) return showForm("Enter your Codeforces handle (3–24 letters, digits, _ . -).");
  $("cf-message").textContent = "Checking Codeforces…";
  try {
    const data = await load(handle);
    await saveProfile({ codeforces_handle: data.info.handle });
    render(data);
  } catch (err) {
    showForm(err.message);
  }
}

async function show(handle) {
  $("cf-message").textContent = "Loading your Codeforces stats…";
  try {
    render(await load(handle));
  } catch (err) {
    showForm(err.message);
  }
}

async function load(handle) {
  const hit = cached(handle);
  if (hit) return hit;
  const data = await fetchCodeforces(handle);
  remember(handle, data);
  return data;
}

function render({ info, solved, history }) {
  $("cf-form").hidden = true;
  $("cf-stats").hidden = false;
  const color = CF_RANK_COLORS[info.rank] ?? "var(--muted)";
  $("cf-card").style.setProperty("--cf", color);

  const name = el("a", "cf-handle", info.handle);
  Object.assign(name, { href: `https://codeforces.com/profile/${info.handle}`, target: "_blank", rel: "noopener" });
  $("cf-name").replaceChildren(name);
  $("cf-rating").textContent = info.rating ?? "Unrated";
  $("cf-rank").textContent = info.rank ? `${info.rank[0].toUpperCase()}${info.rank.slice(1)}. Best: ${info.maxRating}, ${info.maxRank}` : "Play a rated contest to get a rating";
  $("cf-solved").textContent = `${solved.length} problem${solved.length === 1 ? "" : "s"} solved`;

  const range = practiceRange(info.rating ?? 0);
  const practise = el("a", "button primary", `Practise ${range.min}–${range.max} problems`);
  Object.assign(practise, { href: problemsetLink(range), target: "_blank", rel: "noopener" });
  $("cf-next").replaceChildren(practise);

  renderHistory(history.map((h) => h.newRating));
  renderBuckets(bucketByRating(solved).filter((b) => b.rating !== null));
  $("cf-recent").replaceChildren(
    ...solved.slice(0, 5).map((p) => {
      const item = el("li");
      const link = el("a", null, `${p.id}. ${p.name}`);
      Object.assign(link, { href: problemLink(p), target: "_blank", rel: "noopener" });
      item.append(link);
      if (p.rating) item.append(el("span", "muted", ` ${p.rating}`));
      return item;
    }),
  );
}

/** Rating over contests as a small line. */
function renderHistory(ratings) {
  const svg = $("cf-history");
  svg.replaceChildren();
  svg.hidden = ratings.length < 2;
  if (svg.hidden) return;
  const [w, h] = [300, 70];
  const lo = Math.min(...ratings);
  const hi = Math.max(...ratings);
  const x = (i) => (i / (ratings.length - 1)) * w;
  const y = (r) => h - 4 - ((r - lo) / Math.max(1, hi - lo)) * (h - 8);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", ratings.map((r, i) => `${x(i)},${y(r)}`).join(" "));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("aria-label", `Rating over ${ratings.length} contests, from ${ratings[0]} to ${ratings[ratings.length - 1]}`);
  svg.append(line);
}

/** How many problems you've solved at each rating. */
function renderBuckets(buckets) {
  const most = Math.max(1, ...buckets.map((b) => b.count));
  $("cf-buckets").replaceChildren(
    ...buckets.map((b) => {
      const col = el("div", "bucket");
      const bar = el("span", "bucket-bar");
      bar.style.height = `${Math.max(4, (b.count / most) * 100)}%`;
      col.title = `${b.count} solved at ${b.rating}`;
      col.append(bar, el("span", "bucket-label", String(b.rating)));
      return col;
    }),
  );
}
