// Your progress: review streak, activity grid, and a rank that climbs with practice.
// Ranks borrow Codeforces' names and colours, the ladder competitive programmers know.

export const RANKS = [
  { name: "Newbie", min: 0, color: "#7d8590" },
  { name: "Pupil", min: 50, color: "#2e9d55" },
  { name: "Specialist", min: 150, color: "#0b9c97" },
  { name: "Expert", min: 350, color: "#2d5bff" },
  { name: "Candidate Master", min: 700, color: "#9b38c9" },
  { name: "Master", min: 1200, color: "#e07b00" },
  { name: "Grandmaster", min: 2000, color: "#d6333f" },
];

const XP_PER_SAVE = 5;
const XP_PER_REVIEW = { again: 1, hard: 2, good: 3, easy: 3 };

/** Local calendar day, so "today" means the learner's today. */
export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Consecutive days with at least one review, ending today (or yesterday, if today isn't done yet). */
export function streak(reviewDates, today = new Date()) {
  const days = new Set(reviewDates.map(dayKey));
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export const xpFor = (savedCount, ratings) =>
  savedCount * XP_PER_SAVE + ratings.reduce((sum, r) => sum + (XP_PER_REVIEW[r] ?? 0), 0);

/** {rank, next, progress (0..1 toward next), toNext (xp still needed)}. */
export function rankFor(xp) {
  const index = RANKS.findLastIndex((r) => xp >= r.min);
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  if (!next) return { rank, next, progress: 1, toNext: 0 };
  return { rank, next, progress: (xp - rank.min) / (next.min - rank.min), toNext: next.min - xp };
}

/** Weeks of days (Monday first), oldest week first; the last week ends today. */
export function activityGrid(reviewDates, today = new Date(), weeks = 16) {
  const counts = new Map();
  for (const d of reviewDates) counts.set(dayKey(d), (counts.get(dayKey(d)) ?? 0) + 1);
  const mondayOffset = (today.getDay() + 6) % 7; // 0 when today is Monday
  const start = addDays(today, -mondayOffset - (weeks - 1) * 7);
  const grid = Array.from({ length: weeks }, () => []);
  for (let i = 0; ; i++) {
    const date = addDays(start, i);
    if (date > today) break;
    grid[Math.floor(i / 7)].push({ date: dayKey(date), count: counts.get(dayKey(date)) ?? 0 });
  }
  return grid;
}

const LONG_TERM_DAYS = 21; // same threshold as "Remembered" in srs.js

/** {thisWeek: reviews since Monday, longTerm: problems with a 3+ week gap, weakest: {tag, lapses} | null}. */
export function practiceSummary(problems, reviewDates, today = new Date()) {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const thisWeek = reviewDates.filter((d) => new Date(d) >= monday).length;
  const longTerm = problems.filter((p) => p.interval_days >= LONG_TERM_DAYS).length;
  const lapsesByTag = new Map();
  for (const p of problems) for (const tag of p.tags) lapsesByTag.set(tag, (lapsesByTag.get(tag) ?? 0) + p.lapses);
  const [tag, lapses] = [...lapsesByTag].sort((a, b) => b[1] - a[1])[0] ?? [];
  return { thisWeek, longTerm, weakest: lapses > 0 ? { tag, lapses } : null };
}
