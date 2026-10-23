// Your progress through the roadmap (roadmap-data.js): which problems you've saved, how each
// is doing in review, the topic to focus on, and the next problem to solve.
import { ROADMAP } from "./roadmap-data.js";
import { reviewStatus } from "./srs.js";

const DONE_SHARE = 0.5; // move on once half a topic is solved; the rest comes back in review

/** "two-sum" from a LeetCode problem link, else null. */
export function slugFromUrl(url) {
  if (!url) return null;
  try {
    const { hostname, pathname } = new URL(url);
    if (!hostname.endsWith("leetcode.com")) return null;
    return /^\/problems\/([^/]+)/.exec(pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

const STATUS = { due: "due", mastered: "remembered", scheduled: "solved" };

/**
 * {topics: [{topic, know, total, solved, remembered, due, problems: [{...problem, status, saved}]}],
 *  solvedCount, total, current (topic index to focus on, or null), next: {topic, problem} | null}
 */
export function roadmapProgress(savedProblems, now = new Date()) {
  const bySlug = new Map();
  for (const p of savedProblems) {
    const slug = slugFromUrl(p.url);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, p);
  }
  const topics = ROADMAP.map(({ topic, know, problems }) => {
    const rows = problems.map((problem) => {
      const mine = bySlug.get(problem.slug) ?? null;
      return { ...problem, saved: mine, status: mine ? STATUS[reviewStatus(mine, now).kind] : "todo" };
    });
    const count = (status) => rows.filter((r) => r.status === status).length;
    return {
      topic,
      know,
      problems: rows,
      total: rows.length,
      solved: rows.filter((r) => r.saved).length,
      remembered: count("remembered"),
      due: count("due"),
    };
  });

  // Focus on the first topic under half solved that still has a problem the visualizer can run.
  const firstOpen = (t) => t.problems.find((p) => p.status === "todo" && !p.design);
  const current = topics.findIndex((t) => t.solved < Math.ceil(t.total * DONE_SHARE) && firstOpen(t));
  const fallback = current === -1 ? topics.findIndex((t) => firstOpen(t)) : current;
  const focus = current === -1 ? fallback : current;
  return {
    topics,
    solvedCount: topics.reduce((n, t) => n + t.solved, 0),
    total: topics.reduce((n, t) => n + t.total, 0),
    current: focus === -1 ? null : focus,
    next: focus === -1 ? null : { topic: topics[focus].topic, problem: firstOpen(topics[focus]) },
  };
}
