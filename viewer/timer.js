// Solve timer: how long a problem took, shown as m:ss (or h:mm:ss).

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "18:05" / "1:02:05" / "25" / "25m" -> seconds; "" -> null. Throws on anything else. */
export function parseDuration(text) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let m = /^(\d+)\s*m?$/.exec(t);
  if (m) return Number(m[1]) * 60;
  m = /^(\d+):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  throw new Error("Enter the time as minutes (25) or m:ss (18:05).");
}

/** A pausable stopwatch; `now` is injectable for tests. */
export function stopwatch(now = () => performance.now()) {
  let startedAt = null;
  let banked = 0;
  return {
    get running() {
      return startedAt !== null;
    },
    seconds: () => (banked + (startedAt === null ? 0 : now() - startedAt)) / 1000,
    start() {
      if (startedAt === null) startedAt = now();
    },
    pause() {
      if (startedAt !== null) banked += now() - startedAt;
      startedAt = null;
    },
    reset() {
      startedAt = null;
      banked = 0;
    },
  };
}
