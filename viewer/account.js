// The Save dialog (visualizer page). Sign-in lives in the top bar (nav.js).
import { cloudEnabled, currentUser, saveProblem } from "./cloud.js";
import { refreshProgress } from "./nav.js";
import { problemRow, titleFromUrl } from "./problem-form.js";

const $ = (id) => document.getElementById(id);

/**
 * hooks: getRun() -> {mode, code, input} of the run on screen (or null),
 *        getProblem() -> the saved problem on screen (or null), setProblem(problem),
 *        getPage() -> the problem's page link if known, notify(text), fail(text)
 */
export function initSave(hooks) {
  if (!cloudEnabled) return;
  $("save-btn").hidden = false;
  $("save-btn").onclick = () => openSaveDialog(hooks).catch((err) => hooks.fail(err.message));
  $("save-cancel").onclick = () => $("save-dialog").close();
  $("save-form").onsubmit = (event) => {
    event.preventDefault();
    submitSave(hooks);
  };
}

async function openSaveDialog(hooks) {
  if (!(await currentUser())) return hooks.fail("Sign in with Google (top right) to save problems.");
  const form = $("save-form");
  const problem = hooks.getProblem();
  const own = problem?.owned ? problem : null; // someone else's shared problem is saved as your own copy
  const page = problem?.url ?? hooks.getPage() ?? "";
  form.elements.title.value = problem?.title ?? titleFromUrl(page);
  form.elements.url.value = page;
  form.elements.difficulty.value = problem?.difficulty ?? "";
  form.elements.tags.value = (problem?.tags ?? []).join(", ");
  form.elements.notes.value = problem?.notes ?? "";
  form.elements.shared.checked = own?.is_shared ?? false;
  $("save-error").textContent = "";
  $("save-title").textContent = own ? "Update saved problem" : "Save problem";
  $("save-dialog").showModal();
}

async function submitSave(hooks) {
  const form = $("save-form");
  const submit = form.querySelector('button[type="submit"]');
  const own = hooks.getProblem()?.owned ? hooks.getProblem() : null;
  try {
    const run = hooks.getRun();
    if (!run) throw new Error("Visualize your code first, then save it.");
    const row = problemRow(
      {
        title: form.elements.title.value,
        url: form.elements.url.value,
        difficulty: form.elements.difficulty.value,
        tags: form.elements.tags.value,
        notes: form.elements.notes.value,
        shared: form.elements.shared.checked,
      },
      run,
    );
    submit.disabled = true;
    const saved = await saveProblem(row, own?.id);
    hooks.setProblem({ ...saved, owned: true });
    $("save-dialog").close();
    hooks.notify(own ? "Updated in Practice." : "Saved. It's due for its first review tomorrow.");
    refreshProgress();
  } catch (err) {
    $("save-error").textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}
