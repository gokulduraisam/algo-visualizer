// Share links: mode, code and input travel in the URL hash (#m=...&c=...&i=...), which
// browsers never send to the server. The extension builds the same format (extension/extract.js).

const MODES = new Set(["stdin", "leetcode"]);

export function encodeShare({ mode, code, input, run = false }) {
  const params = new URLSearchParams({ m: mode });
  if (code != null) params.set("c", code);
  if (input != null) params.set("i", input);
  if (run) params.set("run", "1");
  return `#${params}`;
}

/** {mode, code (null = keep the editor's), input, run} from a hash, or null if it isn't a share link. */
export function decodeShare(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const mode = params.get("m");
  if (!MODES.has(mode)) return null;
  return { mode, code: params.get("c"), input: params.get("i") ?? "", run: params.get("run") === "1" };
}
