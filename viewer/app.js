import { initSave } from "./account.js";
import { buildCallTree, hasNestedCalls, layoutCallTree, renderCallTree } from "./calltree.js";
import { cloudEnabled, loadProblem } from "./cloud.js";
import { mountNav } from "./nav.js";
import { renderMemory } from "./render.js";
import { decodeShare, encodeShare } from "./share.js";
import { lineHits, nextRun } from "./steps.js";

const $ = (id) => document.getElementById(id);
const TIMEOUT_MS = 10_000;
const MAX_STEPS = 5000;

const EXAMPLES = {
  stdin: {
    code: "n = int(input())\na = list(map(int, input().split()))\nbest = cur = a[0]\nfor x in a[1:]:\n    cur = max(x, cur + x)\n    best = max(best, cur)\nprint(best)\n",
    input: "5\n-2 1 -3 4 -1\n",
    label: "Input (stdin)",
  },
  leetcode: {
    code: "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n",
    input: "nums = [2,7,11,15], target = 9",
    label: "Example input (nums = [...], target = 9) or one value per line",
  },
};

let worker = null;
let ready = false;
let timer = null;
let result = null;
let stepIndex = 0;
let callTree = null; // laid-out recursion tree, or null when the run has no nested calls
let lastRun = null; // {mode, code, input} of the run being shown, for the Share button
let runWhenReady = false; // a share link asked to run as soon as Python has loaded
let currentProblem = null; // the saved problem on screen (from #p=… or Save), or null
let problemPage = null; // the problem's own page, when the extension passed it

// ---------- saved drafts (per viewer; fine if storage is unavailable) ----------
function loadDraft(mode) {
  try {
    return JSON.parse(localStorage.getItem(`draft:${mode}`)) || EXAMPLES[mode];
  } catch {
    return EXAMPLES[mode];
  }
}
function saveDraft(mode) {
  try {
    localStorage.setItem(`draft:${mode}`, JSON.stringify({ code: $("code").value, input: $("input").value }));
  } catch {
    /* private window etc.: drafts just aren't remembered */
  }
}

const currentMode = () => document.querySelector('input[name="mode"]:checked').value;

function showMode(mode) {
  const draft = loadDraft(mode);
  $("code").value = draft.code;
  $("input").value = draft.input;
  $("input-label").textContent = EXAMPLES[mode].label;
  updateGutter();
}

// ---------- editor line numbers ----------
let errorLine = null;

function updateGutter() {
  const count = $("code").value.split("\n").length;
  const rows = [];
  for (let n = 1; n <= count; n++) {
    const row = document.createElement("div");
    row.textContent = n;
    if (n === errorLine) row.className = "err";
    rows.push(row);
  }
  $("gutter").replaceChildren(...rows);
  $("gutter").scrollTop = $("code").scrollTop;
}

/** Select line `n` in the editor and scroll it into view. */
function jumpToLine(n) {
  const code = $("code");
  const lines = code.value.split("\n");
  const line = Math.min(Math.max(n, 1), lines.length);
  const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
  code.focus();
  code.setSelectionRange(start, start + lines[line - 1].length);
  const lineHeight = parseFloat(getComputedStyle(code).lineHeight);
  code.scrollTop = Math.max(0, (line - 1) * lineHeight - code.clientHeight / 3);
  $("gutter").scrollTop = code.scrollTop;
}

function markErrorLine(n) {
  errorLine = n;
  updateGutter();
  if (n) jumpToLine(n);
}

// ---------- worker ----------
function startWorker() {
  ready = false;
  setStatus("Loading Python… (first time takes a few seconds)");
  worker = new Worker("worker.js");
  worker.onmessage = ({ data }) => {
    if (data.type === "ready") {
      ready = true;
      setStatus("");
      if (runWhenReady) {
        runWhenReady = false;
        run();
      }
    } else if (data.type === "fatal") {
      setStatus(`Could not start Python: ${data.message}`);
    } else {
      clearTimeout(timer);
      timer = null;
      if (data.type === "error") {
        showBanner(`The tracer crashed: ${data.message}`, "error");
        restartWorker();
      } else {
        showResult(data.result);
      }
    }
    updateRunButton();
  };
  worker.onerror = (e) => setStatus(`Could not start Python: ${e.message}`);
  updateRunButton();
}

function restartWorker() {
  worker.terminate();
  startWorker();
}

function run() {
  hideBanner();
  markErrorLine(null);
  saveDraft(currentMode());
  timer = setTimeout(() => {
    timer = null;
    restartWorker();
    showBanner(`Stopped after ${TIMEOUT_MS / 1000} seconds. Is there an infinite loop?`, "error");
  }, TIMEOUT_MS);
  lastRun = { mode: currentMode(), code: $("code").value, input: $("input").value };
  worker.postMessage({ ...lastRun, maxSteps: MAX_STEPS });
  updateRunButton();
}

// ---------- share links ----------
/** Run now if Python is ready, otherwise as soon as it is. */
function runSoon() {
  if (ready && timer === null) run();
  else runWhenReady = true;
}

/** Put a mode, code and input into the editor (code null = keep the saved draft). */
function fillEditor(mode, code, input) {
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  showMode(mode);
  if (code !== null) $("code").value = code;
  $("input").value = input;
  updateGutter();
  saveDraft(mode);
}

/** Apply a share link: #m=…&c=…&i=… (e.g. from the extension) or #p=<saved problem id>. */
function applySharedLink() {
  const shared = decodeShare(location.hash);
  if (!shared) return;
  history.replaceState(null, "", location.pathname + location.search); // refreshing keeps later edits
  if (shared.problemId) {
    openSavedProblem(shared.problemId);
    return;
  }
  currentProblem = null;
  problemPage = shared.page ?? null;
  fillEditor(shared.mode, shared.code, shared.input);
  if (shared.run) runSoon();
}

async function openSavedProblem(id) {
  if (!cloudEnabled) return showBanner("This link points to a saved problem, but accounts aren't set up on this site.", "error");
  setStatus("Loading the saved problem…");
  try {
    const problem = await loadProblem(id);
    if (!problem) {
      showBanner("This problem isn't shared, or it was deleted. If it's yours, sign in and open it again.", "error");
      return;
    }
    currentProblem = problem;
    problemPage = problem.url;
    fillEditor(problem.mode, problem.code, problem.input);
    setStatus(problem.owned ? `Your saved problem: ${problem.title}` : `Shared problem: ${problem.title}`);
    runSoon();
  } catch (err) {
    showBanner(err.message, "error");
  }
}

/** Short #p=<id> link for a shared saved problem that's unchanged; otherwise code and input in the link. */
async function copyShareLink() {
  const p = currentProblem;
  const unchanged = p && p.is_shared && p.mode === lastRun.mode && p.code === lastRun.code && p.input === lastRun.input;
  const link = location.origin + location.pathname + encodeShare(unchanged ? { problemId: p.id } : { ...lastRun, run: true });
  try {
    await navigator.clipboard.writeText(link);
    setStatus(unchanged ? "Short link copied." : "Link copied. It contains this code and input.");
  } catch {
    showBanner(`Copy this link: ${link}`, "warn");
  }
}

function updateRunButton() {
  $("run").disabled = !ready || timer !== null;
  $("run").textContent = timer !== null ? "Running…" : "Visualize";
}

// ---------- results ----------
function errorText(err) {
  const where = err.line ? ` (line ${err.line})` : "";
  return `${err.type}${where}: ${err.message}`;
}

function showResult(r) {
  if (!r.trace.length) {
    // Nothing ran (syntax or input error): stay in the editor and point at the line.
    const line = r.error?.line;
    showBanner(r.error ? errorText(r.error) : "Nothing ran: the program has no steps.", "error", line);
    markErrorLine(line);
    return;
  }
  result = r;
  if (r.truncated) showBanner(`Showing only the first ${r.trace.length} steps.`, "warn");
  const roots = buildCallTree(r.trace);
  callTree = hasNestedCalls(roots) ? layoutCallTree(roots) : null;
  $("calltree-panel").hidden = !callTree;
  buildCodeView(r.code);
  $("edit").hidden = true;
  $("view").hidden = false;
  $("slider").max = r.trace.length - 1;
  go(0);
}

function buildCodeView(code) {
  const lines = code.replace(/\n$/, "").split("\n");
  $("codeview").replaceChildren(
    ...lines.map((text, i) => {
      const row = document.createElement("div");
      row.className = "line";
      row.dataset.line = i + 1;
      const num = document.createElement("span");
      num.className = "ln";
      num.textContent = i + 1;
      const hits = document.createElement("span");
      hits.className = "hits";
      row.append(num, hits, document.createTextNode(text || " "));
      row.title = "Click to jump to the next time this line runs";
      row.onclick = () => {
        const target = nextRun(result.trace, i + 1, stepIndex);
        if (target >= 0) go(target);
      };
      return row;
    }),
  );
}

function go(i) {
  if (!result) return;
  stepIndex = Math.max(0, Math.min(i, result.trace.length - 1));
  const step = result.trace[stepIndex];
  const prev = result.trace[stepIndex - 1];
  const hits = lineHits(result.trace, stepIndex);
  for (const row of $("codeview").children) {
    const line = Number(row.dataset.line);
    row.querySelector(".cond-badge")?.remove();
    row.classList.toggle("cur", line === step.line);
    row.classList.toggle("prev", !!prev && line === prev.line && prev.line !== step.line);
    const count = hits.get(line) || 0;
    row.querySelector(".hits").textContent = count ? `×${count}` : "";
  }
  $("codeview").querySelector(".cur")?.scrollIntoView({ block: "nearest" });

  const last = stepIndex === result.trace.length - 1;
  $("counter").textContent = `Step ${stepIndex + 1} of ${result.trace.length}${last ? " (done)" : ""}`;
  $("slider").value = stepIndex;
  // The last step comes before the harness prints LeetCode's answer, so show the full output there.
  let out = last ? result.stdout : step.stdout;
  if (step.exception) out += `\n⚠ ${step.exception}`;
  if (last && result.error) out += `\n✖ ${errorText(result.error)}`;
  $("stdout").textContent = out || "(no output yet)";
  showCondition(step);
  renderMemory($("memory"), step, prev);
  if (callTree) renderCallTree($("calltree"), callTree, stepIndex, go);
}

/** For if/elif/while lines: `nums[m] <= nums[r]` → `2 <= 5` → ✅ True, plus a mark on the code line. */
function showCondition(step) {
  const c = step.condition;
  const box = $("condition");
  box.hidden = !c;
  const line = $("codeview").querySelector(".cur");
  if (!c) return;
  const verdict = c.error ? "⚠️ error" : c.value ? "✅ True" : "❌ False";
  box.className = `condition ${c.error ? "err" : c.value ? "yes" : "no"}`;
  const part = (cls, text) => Object.assign(document.createElement("span"), { className: cls, textContent: text });
  const parts = [part("cond-src", c.source)];
  if (c.shown && c.shown !== c.source) parts.push(part("cond-arrow", "→"), part("cond-shown", c.shown));
  parts.push(part("cond-arrow", "→"), part("cond-verdict", verdict));
  if (c.error) parts.push(part("cond-error", c.error));
  box.replaceChildren(...parts);
  line?.append(part("cond-badge", c.error ? "⚠️" : c.value ? "✅" : "❌"));
}

// ---------- banner / status ----------
function showBanner(text, kind, line) {
  $("banner").textContent = text;
  if (line) {
    const go = document.createElement("button");
    go.textContent = `Go to line ${line}`;
    go.onclick = () => jumpToLine(line);
    $("banner").append(go);
  }
  $("banner").className = `banner ${kind}`;
  $("banner").hidden = false;
}
const hideBanner = () => ($("banner").hidden = true);
const setStatus = (text) => ($("status").textContent = text);

// ---------- wiring ----------
function wire() {
  $("run").onclick = run;
  $("share-btn").onclick = copyShareLink;
  $("edit-btn").onclick = () => {
    $("view").hidden = true;
    $("edit").hidden = false;
    $("memory").replaceChildren();
    $("condition").hidden = true;
    $("calltree-panel").hidden = true;
    hideBanner();
    result = null;
  };
  $("first").onclick = () => go(0);
  $("prev").onclick = () => go(stepIndex - 1);
  $("next").onclick = () => go(stepIndex + 1);
  $("last").onclick = () => go(Infinity);
  $("slider").oninput = (e) => go(Number(e.target.value));

  let lastMode = currentMode();
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.onchange = () => {
      saveDraft(lastMode);
      currentProblem = null; // a different mode means different code
      problemPage = null;
      lastMode = currentMode();
      showMode(lastMode);
      $("edit-btn").click();
    };
  }

  document.addEventListener("keydown", (e) => {
    if (!result || e.target.closest("textarea, input")) return;
    if (e.key === "ArrowRight") go(stepIndex + 1);
    if (e.key === "ArrowLeft") go(stepIndex - 1);
  });

  // Tab inserts spaces instead of leaving the editor (Python needs indentation).
  $("code").addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    e.target.setRangeText("    ", e.target.selectionStart, e.target.selectionEnd, "end");
    updateGutter();
  });
  $("code").addEventListener("input", () => {
    errorLine = null; // the code changed, so the old error line may be wrong
    updateGutter();
  });
  $("code").addEventListener("scroll", () => ($("gutter").scrollTop = $("code").scrollTop), { passive: true });

  // A share link pasted into a tab that already has the site open only changes the hash.
  window.addEventListener("hashchange", () => {
    if (!decodeShare(location.hash)) return;
    $("edit-btn").click();
    applySharedLink();
  });
  window.addEventListener("resize", () => result && go(stepIndex));
  $("memory").addEventListener("scroll", () => result && go(stepIndex), { passive: true });
}

showMode(currentMode());
applySharedLink();
wire();
startWorker();
mountNav({
  beforeSignIn: () => saveDraft(currentMode()), // signing in leaves the page; keep unsaved edits
  onError: (text) => showBanner(text, "error"),
});
initSave({
  getRun: () => (result ? lastRun : null),
  getProblem: () => currentProblem,
  setProblem: (problem) => (currentProblem = problem),
  getPage: () => problemPage,
  notify: setStatus,
  fail: (text) => showBanner(text, "error"),
});
