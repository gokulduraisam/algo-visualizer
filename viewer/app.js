import { renderMemory } from "./render.js";

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
  worker.postMessage({ mode: currentMode(), code: $("code").value, input: $("input").value, maxSteps: MAX_STEPS });
  updateRunButton();
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
      row.append(num, document.createTextNode(text || " "));
      return row;
    }),
  );
}

function go(i) {
  if (!result) return;
  stepIndex = Math.max(0, Math.min(i, result.trace.length - 1));
  const step = result.trace[stepIndex];
  const prev = result.trace[stepIndex - 1];
  for (const row of $("codeview").children) {
    row.classList.toggle("cur", Number(row.dataset.line) === step.line);
    row.classList.toggle("prev", !!prev && Number(row.dataset.line) === prev.line && prev.line !== step.line);
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
  renderMemory($("memory"), step);
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
  $("edit-btn").onclick = () => {
    $("view").hidden = true;
    $("edit").hidden = false;
    $("memory").replaceChildren();
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

  window.addEventListener("resize", () => result && go(stepIndex));
  $("memory").addEventListener("scroll", () => result && go(stepIndex), { passive: true });
}

showMode(currentMode());
wire();
startWorker();
