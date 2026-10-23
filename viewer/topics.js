// Topic ladder: the NeetCode 150 topics in their study order, with your progress on each.
// `target` is how many of the 150 problems are in that topic (https://neetcode.io/practice).

export const TOPICS = [
  { name: "Arrays & Hashing", target: 9, aliases: ["hash map", "hashmap", "hash table", "hashing", "hash set", "array", "arrays", "prefix sum", "counting", "sorting", "string", "strings"] },
  { name: "Two Pointers", target: 5, aliases: ["two pointers", "two pointer"] },
  { name: "Sliding Window", target: 6, aliases: ["sliding window"] },
  { name: "Stack", target: 7, aliases: ["stack", "monotonic stack"] },
  { name: "Binary Search", target: 7, aliases: ["binary search"] },
  { name: "Linked List", target: 11, aliases: ["linked list", "linked lists"] },
  { name: "Trees", target: 15, aliases: ["tree", "trees", "binary tree", "bst", "binary search tree"] },
  { name: "Heap / Priority Queue", target: 7, aliases: ["heap", "priority queue", "heap (priority queue)", "heaps"] },
  { name: "Backtracking", target: 9, aliases: ["backtracking", "recursion"] },
  { name: "Tries", target: 3, aliases: ["trie", "tries"] },
  { name: "Graphs", target: 13, aliases: ["graph", "graphs", "dfs", "bfs", "depth-first search", "breadth-first search", "union find", "topological sort"] },
  { name: "Advanced Graphs", target: 6, aliases: ["shortest path", "dijkstra", "minimum spanning tree", "mst", "advanced graphs"] },
  { name: "1-D Dynamic Programming", target: 12, aliases: ["dp", "dynamic programming", "1d dp", "1-d dp", "memoization"] },
  { name: "2-D Dynamic Programming", target: 11, aliases: ["2d dp", "2-d dp", "2d dynamic programming"] },
  { name: "Greedy", target: 8, aliases: ["greedy"] },
  { name: "Intervals", target: 6, aliases: ["intervals", "interval", "line sweep"] },
  { name: "Math & Geometry", target: 8, aliases: ["math", "geometry", "number theory"] },
  { name: "Bit Manipulation", target: 7, aliases: ["bit manipulation", "bits", "bitmask"] },
];

const BY_ALIAS = new Map(TOPICS.flatMap((t) => [t.name.toLowerCase(), ...t.aliases].map((a) => [a, t.name])));
const EARLY = 4; // cover the first few roadmap topics before chasing weak spots
const SHAKY_LAPSES = 2;
const REMEMBERED_DAYS = 21;

/** The roadmap topic a tag belongs to, or null. */
export const topicOf = (tag) => BY_ALIAS.get(tag.trim().toLowerCase().replace(/\s+/g, " ")) ?? null;

/** {rows: [{topic, solved, remembered, lapses}] in roadmap order, next: {topic, reason} | null}. */
export function ladder(problems) {
  const rows = TOPICS.map(({ name }) => {
    const mine = problems.filter((p) => p.tags.some((tag) => topicOf(tag) === name));
    return {
      topic: name,
      solved: mine.length,
      remembered: mine.filter((p) => p.interval_days >= REMEMBERED_DAYS).length,
      lapses: mine.reduce((sum, p) => sum + p.lapses, 0),
    };
  });
  const untouched = rows.findIndex((r) => r.solved === 0);
  const shakiest = rows.filter((r) => r.lapses >= SHAKY_LAPSES).sort((a, b) => b.lapses - a.lapses)[0];
  let next = null;
  if (untouched !== -1 && (untouched < EARLY || !shakiest)) next = { topic: rows[untouched].topic, reason: "next on the roadmap" };
  else if (shakiest) next = { topic: shakiest.topic, reason: "you forget it most" };
  return { rows, next };
}
