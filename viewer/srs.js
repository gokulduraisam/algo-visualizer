// Spaced repetition (a simplified SM-2, the method behind Anki): after each review you rate
// how well you remembered, and the next review is pushed further out the better it went.

const DAY_MS = 86_400_000;
const MIN_EASE = 1.3;
const MAX_EASE = 3;
const MAX_DAYS = 365;
const MASTERED_DAYS = 21; // a gap this long means it's in long-term memory
const FIRST_GAP = { hard: 1, good: 3, easy: 5 };

export const RATINGS = ["again", "hard", "good", "easy"];

const round2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** The card's next state after a review. `card` holds interval_days, ease, reps, lapses. */
export function schedule(card, rating, now = new Date()) {
  const { interval_days: gap, ease, reps, lapses } = card;
  let next;
  if (rating === "again") {
    next = { interval_days: 1, ease: ease - 0.2, reps: 0, lapses: lapses + 1 };
  } else {
    const grown = {
      hard: Math.max(gap + 1, Math.round(gap * 1.2)),
      good: Math.round(gap * ease),
      easy: Math.round(gap * ease * 1.3),
    }[rating];
    const easeChange = { hard: -0.15, good: 0, easy: 0.15 }[rating];
    next = { interval_days: reps === 0 ? FIRST_GAP[rating] : grown, ease: ease + easeChange, reps: reps + 1, lapses };
  }
  const interval = clamp(next.interval_days, 1, MAX_DAYS);
  return {
    ...next,
    interval_days: interval,
    ease: clamp(round2(next.ease), MIN_EASE, MAX_EASE),
    due_at: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

/** Days until the next review for each rating, for the buttons ("Good · 1 week"). */
export function nextIntervals(card, now = new Date()) {
  return Object.fromEntries(RATINGS.map((r) => [r, schedule(card, r, now).interval_days]));
}

export function formatDays(days) {
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.round(days / 7), "week");
  if (days < 365) return plural(Math.round(days / 30), "month");
  return plural(Math.round(days / 365), "year");
}

/** {kind: "due" | "scheduled" | "mastered", label} for a saved problem. */
export function reviewStatus(problem, now = new Date()) {
  const until = Math.ceil((new Date(problem.due_at) - now) / DAY_MS);
  if (until <= 0) return { kind: "due", label: "Due now" };
  if (problem.interval_days >= MASTERED_DAYS) return { kind: "mastered", label: `Remembered, next in ${formatDays(until)}` };
  return { kind: "scheduled", label: `In ${formatDays(until)}` };
}
