// Sign-in button (header) and the Save dialog. Only shown when accounts are set up (cloud.js).
import { cloudEnabled, currentUser, onUserChange, saveProblem, signInWithGoogle, signOut } from "./cloud.js";
import { problemRow, titleFromUrl } from "./problem-form.js";

const $ = (id) => document.getElementById(id);
let user = null;

/**
 * hooks: getRun() -> {mode, code, input} of the run on screen (or null),
 *        getProblem() -> the saved problem on screen (or null), setProblem(problem),
 *        getPage() -> the problem's page link if known, beforeSignIn(), notify(text), fail(text)
 */
export async function initAccount(hooks) {
  if (!cloudEnabled) return;
  $("account").hidden = false;
  $("save-btn").hidden = false;
  $("save-btn").onclick = () => openSaveDialog(hooks);
  $("save-cancel").onclick = () => $("save-dialog").close();
  $("save-form").onsubmit = (event) => {
    event.preventDefault();
    submitSave(hooks);
  };
  try {
    showUser(await currentUser(), hooks);
    await onUserChange((u) => showUser(u, hooks));
  } catch (err) {
    hooks.fail(err.message);
  }
}

function button(text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = onClick;
  return b;
}

function showUser(u, hooks) {
  user = u;
  const box = $("account");
  if (!u) {
    box.replaceChildren(
      button("Sign in with Google", () => {
        hooks.beforeSignIn();
        signInWithGoogle().catch((err) => hooks.fail(err.message));
      }),
    );
    return;
  }
  const mine = Object.assign(document.createElement("a"), { href: "problems.html", textContent: "📚 My problems" });
  const who = Object.assign(document.createElement("span"), { className: "who", textContent: u.email });
  box.replaceChildren(mine, who, button("Sign out", () => signOut().catch((err) => hooks.fail(err.message))));
}

function openSaveDialog(hooks) {
  if (!user) return hooks.fail("Sign in with Google (top right) to save problems.");
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
  $("save-dialog").querySelector("h2").textContent = own ? "Update saved problem" : "Save problem";
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
    hooks.notify(own ? "Updated in My problems." : "Saved to My problems.");
  } catch (err) {
    $("save-error").textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}
