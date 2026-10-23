import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDays, nextIntervals, reviewStatus, schedule } from "../viewer/srs.js";

const NOW = new Date("2026-10-22T12:00:00Z");
const NEW = { interval_days: 0, ease: 2.5, reps: 0, lapses: 0 };
const days = (card) => Math.round((new Date(card.due_at) - NOW) / 86_400_000);

test("first review: hard 1 day, good 3, easy 5", () => {
  assert.equal(days(schedule(NEW, "hard", NOW)), 1);
  assert.equal(days(schedule(NEW, "good", NOW)), 3);
  assert.equal(days(schedule(NEW, "easy", NOW)), 5);
});

test("good keeps multiplying the gap by the ease: 3 → 8 → 20 days", () => {
  let card = schedule(NEW, "good", NOW);
  card = schedule(card, "good", NOW);
  assert.equal(card.interval_days, 8);
  card = schedule(card, "good", NOW);
  assert.equal(card.interval_days, 20);
  assert.equal(card.reps, 3);
});

test("again resets the gap to 1 day, counts a lapse and lowers the ease", () => {
  const learned = { interval_days: 20, ease: 2.5, reps: 3, lapses: 0 };
  const card = schedule(learned, "again", NOW);
  assert.deepEqual([card.interval_days, card.reps, card.lapses, card.ease], [1, 0, 1, 2.3]);
});

test("hard grows the gap a little and lowers the ease; easy raises it", () => {
  const card = { interval_days: 10, ease: 2.5, reps: 2, lapses: 0 };
  const hard = schedule(card, "hard", NOW);
  assert.equal(hard.interval_days, 12);
  assert.equal(hard.ease, 2.35);
  assert.equal(schedule(card, "easy", NOW).ease, 2.65);
});

test("ease stays between 1.3 and 3, gaps stay between 1 day and a year", () => {
  let card = { interval_days: 1, ease: 1.35, reps: 1, lapses: 0 };
  card = schedule(card, "again", NOW);
  assert.equal(card.ease, 1.3);
  const old = schedule({ interval_days: 300, ease: 3, reps: 9, lapses: 0 }, "easy", NOW);
  assert.equal(old.interval_days, 365);
  assert.ok(schedule({ interval_days: 365, ease: 3, reps: 9, lapses: 0 }, "easy", NOW).ease <= 3);
});

test("schedule returns a new object and leaves the input alone", () => {
  const card = { ...NEW };
  const next = schedule(card, "good", NOW);
  assert.notEqual(next, card);
  assert.deepEqual(card, NEW);
  assert.equal(next.last_reviewed_at, NOW.toISOString());
});

test("nextIntervals previews each button", () => {
  assert.deepEqual(nextIntervals(NEW), { again: 1, hard: 1, good: 3, easy: 5 });
});

test("formatDays reads like a person would say it", () => {
  assert.deepEqual(
    [1, 3, 6, 7, 13, 14, 30, 45, 365].map(formatDays),
    ["1 day", "3 days", "6 days", "1 week", "2 weeks", "2 weeks", "1 month", "2 months", "1 year"],
  );
});

test("reviewStatus: due, scheduled, or remembered long-term", () => {
  assert.deepEqual(reviewStatus({ due_at: "2026-10-22T11:00:00Z", interval_days: 3 }, NOW), { kind: "due", label: "Due now" });
  assert.deepEqual(reviewStatus({ due_at: "2026-10-25T12:00:00Z", interval_days: 3 }, NOW), { kind: "scheduled", label: "In 3 days" });
  assert.deepEqual(reviewStatus({ due_at: "2026-12-01T12:00:00Z", interval_days: 40 }, NOW), { kind: "mastered", label: "Remembered, next in 1 month" });
});
