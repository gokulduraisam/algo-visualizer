// Share links, in the URL hash (browsers never send it to the server):
//   #p=<id>                      a saved problem (signed-in Save + Share); short
//   #m=...&c=...&i=...&run=1     code and input in the link itself; works without an account
// The extension builds the long form too (extension/extract.js), plus page=<problem link>.

const MODES = new Set(["stdin", "leetcode"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeShare({ problemId, mode, code, input, run = false }) {
  if (problemId) return `#p=${problemId}`;
  const params = new URLSearchParams({ m: mode });
  if (code != null) params.set("c", code);
  if (input != null) params.set("i", input);
  if (run) params.set("run", "1");
  return `#${params}`;
}

/** {problemId} or {mode, code (null = keep the editor's), input, run, page?}, or null if it isn't a share link. */
export function decodeShare(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const problemId = params.get("p");
  if (problemId) return UUID.test(problemId) ? { problemId } : null;
  const mode = params.get("m");
  if (!MODES.has(mode)) return null;
  const shared = { mode, code: params.get("c"), input: params.get("i") ?? "", run: params.get("run") === "1" };
  if (params.has("page")) shared.page = params.get("page");
  if (params.has("d")) shared.difficulty = params.get("d");
  if (params.has("t")) shared.tags = params.get("t").split(",").map((t) => t.trim()).filter(Boolean);
  return shared;
}
