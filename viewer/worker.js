// Runs Python (Pyodide) off the main thread, so an infinite loop can be stopped with worker.terminate().
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");

const PY_FILES = [
  "tracer/__init__.py",
  "tracer/conditions.py",
  "tracer/encoder.py",
  "tracer/runner.py",
  "harness/__init__.py",
  "harness/leetcode.py",
  "harness/leetcode_prelude.py",
];

const RUN = `
import json
from tracer import run_trace
from harness.leetcode import run_leetcode
req = json.loads(req_json)

def run_one(text):
    if req["mode"] == "leetcode":
        return run_leetcode(req["code"], text, req["maxSteps"])
    # stdin programs read whole lines, so the last line needs its newline
    return run_trace(req["code"], text if text.endswith("\n") else text + "\n", req["maxSteps"])

json.dumps([run_one(text) for text in req["inputs"]], allow_nan=False)
`;

const ready = (async () => {
  const py = await loadPyodide();
  for (const path of PY_FILES) {
    const res = await fetch(`../${path}`);
    if (!res.ok) throw new Error(`could not load ${path} (HTTP ${res.status})`);
    py.FS.mkdirTree(`/app/${path.split("/")[0]}`);
    py.FS.writeFile(`/app/${path}`, await res.text());
  }
  py.runPython("import sys; sys.path.insert(0, '/app')");
  return py;
})();

ready.then(
  () => postMessage({ type: "ready" }),
  (err) => postMessage({ type: "fatal", message: String(err.message || err) }),
);

self.onmessage = async ({ data }) => {
  try {
    const py = await ready;
    py.globals.set("req_json", JSON.stringify(data));
    postMessage({ type: "result", result: JSON.parse(py.runPython(RUN)) });
  } catch (err) {
    // Usually a bug in our Python code or a crashed interpreter (e.g. JS stack overflow).
    postMessage({ type: "error", message: String(err.message || err) });
  }
};
