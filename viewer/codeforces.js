// Codeforces stats from its free public API (https://codeforces.com/apiHelp), which allows
// calls straight from the browser. Only public data: rating, rank, accepted submissions.

const API = "https://codeforces.com/api";

/** Codeforces rank colours (as on the site). */
export const CF_RANK_COLORS = {
  newbie: "#808080",
  pupil: "#008000",
  specialist: "#03a89e",
  expert: "#2d5bff",
  "candidate master": "#aa00aa",
  master: "#ff8c00",
  "international master": "#ff8c00",
  grandmaster: "#ff0000",
  "international grandmaster": "#ff0000",
  "legendary grandmaster": "#ff0000",
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, params, retried = false) {
  let res;
  try {
    res = await fetch(`${API}/${method}?${new URLSearchParams(params)}`);
  } catch {
    throw new Error("Couldn't reach Codeforces. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (body?.status === "OK") return body.result;
  const comment = body?.comment ?? `HTTP ${res.status}`;
  // Codeforces allows about one call every 2 seconds; wait once and retry.
  if (!retried && /call limit/i.test(comment)) {
    await pause(2200);
    return call(method, params, true);
  }
  throw new Error(/not found/i.test(comment) ? "No Codeforces user with that handle." : `Codeforces: ${comment}`);
}

/** {info, solved, history} for a handle. Calls run one after another to respect the rate limit. */
export async function fetchCodeforces(handle) {
  const [info] = await call("user.info", { handles: handle });
  const submissions = await call("user.status", { handle });
  const history = await call("user.rating", { handle });
  return { info, solved: solvedProblems(submissions), history };
}

/** Unique accepted problems, newest first (the API lists submissions newest first). */
export function solvedProblems(submissions) {
  const seen = new Set();
  const solved = [];
  for (const s of submissions) {
    if (s.verdict !== "OK") continue;
    const id = `${s.problem.contestId}${s.problem.index}`;
    if (seen.has(id)) continue;
    seen.add(id);
    solved.push({ id, name: s.problem.name, rating: s.problem.rating ?? null, contestId: s.problem.contestId, index: s.problem.index, solvedAt: s.creationTimeSeconds });
  }
  return solved;
}

/** [{rating, count}] ascending, unrated problems last. */
export function bucketByRating(solved) {
  const counts = new Map();
  for (const p of solved) counts.set(p.rating, (counts.get(p.rating) ?? 0) + 1);
  return [...counts].map(([rating, count]) => ({ rating, count })).sort((a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity));
}

/** The rating band to practise in: from your level up to 200 above (Codeforces problems go 800..3500). */
export function practiceRange(rating) {
  const base = Math.max(800, Math.floor(rating / 100) * 100);
  return { min: Math.min(base, 3400), max: Math.min(base + 200, 3500) };
}

export const problemsetLink = ({ min, max }) => `https://codeforces.com/problemset?tags=${min}-${max}`;
export const problemLink = (p) => `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
