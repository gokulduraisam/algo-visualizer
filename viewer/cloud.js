// Accounts and saved problems, stored in Supabase. Optional: with an empty viewer/config.js
// `cloudEnabled` is false and the site works as before. Privacy rules live in the database
// (supabase/schema.sql), not here.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
const COLUMNS = "id, title, url, difficulty, tags, notes, is_shared, mode, code, input, updated_at";

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let clientPromise = null;

/** The Supabase client, loaded from the CDN the first time it's needed. */
function client() {
  if (!cloudEnabled) return Promise.reject(new Error("Accounts aren't set up on this site."));
  clientPromise ??= import(SUPABASE_JS).then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      // pkce: Google sends back ?code=…, leaving the #… part free for share links
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    }),
  );
  return clientPromise;
}

function check({ data, error }, action) {
  if (error) throw new Error(`${action} failed: ${error.message}`);
  return data;
}

/** The signed-in user, or null. Also finishes a Google sign-in that just redirected back. */
export async function currentUser() {
  const sb = await client();
  const session = check(await sb.auth.getSession(), "Checking your login").session;
  const url = new URL(location.href);
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code"); // the one-time login code is used up; keep it out of bookmarks
    history.replaceState(null, "", url);
  }
  return session?.user ?? null;
}

export async function onUserChange(callback) {
  const sb = await client();
  sb.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
}

export async function signInWithGoogle() {
  const sb = await client();
  check(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }), "Signing in");
}

export async function signOut() {
  const sb = await client();
  check(await sb.auth.signOut(), "Signing out");
}

/** Insert a new problem, or update `id` if given. Returns the saved row. */
export async function saveProblem(row, id = null) {
  const sb = await client();
  const query = id ? sb.from("problems").update(row).eq("id", id) : sb.from("problems").insert(row);
  return check(await query.select(COLUMNS).single(), "Saving");
}

export async function listProblems() {
  const sb = await client();
  return check(await sb.from("problems").select(COLUMNS).order("updated_at", { ascending: false }), "Loading your problems");
}

/** Your own problem (owned: true), else someone's shared one (owned: false), else null. */
export async function loadProblem(id) {
  const sb = await client();
  if (await currentUser()) {
    const own = check(await sb.from("problems").select(COLUMNS).eq("id", id).maybeSingle(), "Loading the problem");
    if (own) return { ...own, owned: true };
  }
  const [shared] = check(await sb.rpc("get_shared_problem", { problem_id: id }), "Loading the shared problem") ?? [];
  return shared ? { ...shared, id, is_shared: true, owned: false } : null;
}

export async function deleteProblem(id) {
  const sb = await client();
  check(await sb.from("problems").delete().eq("id", id), "Deleting");
}
