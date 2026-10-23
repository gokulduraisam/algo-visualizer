// Turns the Save form into a database row, with the same limits the database enforces
// (supabase/*.sql), so problems show up as readable messages instead of API errors.
import { parseDuration } from "./timer.js";

export const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const LIMITS = { title: 200, url: 2000, tags: 20, tag: 30, notes: 20_000, code: 100_000, input: 100_000 };

/** "Two Sum" from a LeetCode link, "Codeforces 1900B" from a Codeforces one, else "". */
export function titleFromUrl(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return "";
  }
  const leetcode = url.hostname.endsWith("leetcode.com") && /^\/problems\/([^/]+)/.exec(url.pathname);
  if (leetcode) return leetcode[1].split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const codeforces = url.hostname.endsWith("codeforces.com") && /\/(?:problem|contest|gym)\/(\d+)\/(?:problem\/)?(\w+)$/.exec(url.pathname);
  return codeforces ? `Codeforces ${codeforces[1]}${codeforces[2]}` : "";
}

export function parseTags(text) {
  const tags = text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [...new Set(tags)];
}

/** form: {title, url, difficulty, tags (comma text), notes, shared, time ("m:ss", optional)};
 *  run: {mode, code, input}. Throws on invalid input. */
export function problemRow(form, run) {
  const title = form.title.trim();
  const url = form.url.trim();
  const tags = parseTags(form.tags);
  if (!title) throw new Error("Give the problem a title.");
  if (title.length > LIMITS.title) throw new Error(`The title is too long (max ${LIMITS.title} characters).`);
  if (url && (!/^https?:\/\//i.test(url) || url.length > LIMITS.url)) throw new Error("The link must start with http:// or https://.");
  if (tags.length > LIMITS.tags || tags.some((t) => t.length > LIMITS.tag)) {
    throw new Error(`Use at most ${LIMITS.tags} tags of up to ${LIMITS.tag} characters.`);
  }
  if (form.notes.length > LIMITS.notes) throw new Error(`Notes are too long (max ${LIMITS.notes} characters).`);
  if (run.code.length > LIMITS.code || run.input.length > LIMITS.input) throw new Error("The code or input is too long to save.");
  const solveSeconds = parseDuration(form.time ?? "");
  if (solveSeconds !== null && solveSeconds > 86_400) throw new Error("The time must be under 24 hours.");
  return {
    title,
    url: url || null,
    difficulty: DIFFICULTIES.includes(form.difficulty) ? form.difficulty : null,
    tags,
    notes: form.notes.trim(),
    is_shared: Boolean(form.shared),
    mode: run.mode,
    code: run.code,
    input: run.input,
    solve_seconds: solveSeconds,
  };
}
