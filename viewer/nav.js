// The top bar's right side on every page: your rank, how many reviews are due (on the
// Practice link), and sign in / out. Hidden when accounts aren't set up (cloud.js).
import { cloudEnabled, countDue, countProblems, currentUser, listReviews, onUserChange, signInWithGoogle, signOut } from "./cloud.js";
import { rankFor, xpFor } from "./progress.js";

const $ = (id) => document.getElementById(id);

/** Show the account area; resolves to the signed-in user or null. */
export async function mountNav({ beforeSignIn = () => {}, onError = () => {} } = {}) {
  if (!cloudEnabled) return null;
  $("account").hidden = false;
  try {
    const user = await currentUser();
    await render(user, beforeSignIn, onError);
    await onUserChange((u) => render(u, beforeSignIn, onError));
    return user;
  } catch (err) {
    onError(err.message);
    return null;
  }
}

async function render(user, beforeSignIn, onError) {
  const box = $("account");
  if (!user) {
    const signIn = button("Sign in with Google", () => {
      beforeSignIn();
      signInWithGoogle().catch((err) => onError(err.message));
    });
    signIn.className = "primary";
    box.replaceChildren(signIn);
    setDue(0);
    return;
  }
  const out = button("Sign out", () => signOut().catch((err) => onError(err.message)));
  out.className = "quiet";
  const who = Object.assign(document.createElement("span"), { className: "who", textContent: user.email });
  box.replaceChildren(who, out);
  await refreshProgress();
}

/** Re-read the due count and rank, e.g. after a review. */
export async function refreshProgress() {
  try {
    const [due, saved, reviews] = await Promise.all([countDue(), countProblems(), listReviews()]);
    setDue(due);
    const { rank } = rankFor(xpFor(saved, reviews.map((r) => r.rating)));
    let chip = $("account").querySelector(".rank-chip");
    if (!chip) {
      chip = Object.assign(document.createElement("a"), { className: "rank-chip", href: "practice.html" });
      $("account").prepend(chip);
    }
    chip.textContent = rank.name;
    chip.title = "Your rank: it climbs as you save and review problems";
    chip.style.setProperty("--rank", rank.color);
  } catch {
    // Practice explains problems loudly (e.g. a missing database update); the top bar stays quiet.
  }
}

function setDue(count) {
  const badge = $("due-count");
  if (!badge) return;
  badge.hidden = count === 0;
  badge.textContent = String(count);
  badge.title = `${count} problem${count === 1 ? "" : "s"} due for review`;
}

function button(text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = onClick;
  return b;
}
