import assert from "node:assert/strict";
import { test } from "node:test";

import { activityGrid, practiceSummary, rankFor, RANKS, streak, xpFor } from "../viewer/progress.js";

const day = (s) => new Date(`${s}T15:00:00`); // local time, like the browser

test("streak counts consecutive days with a review, ending today or yesterday", () => {
  const today = day("2026-10-22");
  assert.equal(streak([day("2026-10-22"), day("2026-10-21"), day("2026-10-21"), day("2026-10-20")], today), 3);
  assert.equal(streak([day("2026-10-21"), day("2026-10-20")], today), 2); // not broken until today ends
  assert.equal(streak([day("2026-10-19")], today), 0);
  assert.equal(streak([], today), 0);
});

test("xp: 5 per saved problem, plus 1/2/3/3 per review by rating", () => {
  assert.equal(xpFor(2, ["again", "hard", "good", "easy"]), 10 + 1 + 2 + 3 + 3);
});

test("ranks follow Codeforces names and climb with xp", () => {
  assert.equal(RANKS[0].name, "Newbie");
  assert.deepEqual(rankFor(0), { rank: RANKS[0], next: RANKS[1], progress: 0, toNext: 50 });
  const pupil = rankFor(75);
  assert.equal(pupil.rank.name, "Pupil");
  assert.equal(pupil.next.name, "Specialist");
  assert.equal(pupil.toNext, 75);
  assert.equal(pupil.progress, 0.25);
  const top = rankFor(99_999);
  assert.equal(top.rank.name, "Grandmaster");
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
});

test("activityGrid: a column per week, Monday first, counts per day, today last", () => {
  const today = day("2026-10-22"); // a Thursday
  const grid = activityGrid([day("2026-10-22"), day("2026-10-22"), day("2026-10-19")], today, 2);
  assert.equal(grid.length, 2);
  assert.equal(grid[1].length, 4); // Mon..Thu of this week
  assert.deepEqual(grid[1].map((d) => d.count), [1, 0, 0, 2]);
  assert.equal(grid[0].length, 7);
  assert.equal(grid[1][3].date, "2026-10-22");
});

test("practiceSummary: this week's reviews, long-term count, and the topic forgotten most", () => {
  const today = day("2026-10-22"); // Thursday; the week starts Monday the 19th
  const problems = [
    { tags: ["dp"], lapses: 2, interval_days: 3 },
    { tags: ["dp", "graph"], lapses: 1, interval_days: 30 },
    { tags: ["graph"], lapses: 0, interval_days: 25 },
  ];
  const reviews = [day("2026-10-22"), day("2026-10-19"), day("2026-10-18")];
  assert.deepEqual(practiceSummary(problems, reviews, today), {
    thisWeek: 2,
    longTerm: 2,
    weakest: { tag: "dp", lapses: 3 },
  });
  assert.equal(practiceSummary([{ tags: ["dp"], lapses: 0, interval_days: 1 }], [], today).weakest, null);
});
