// The solve timer above the editor: start it when you begin a problem; Save fills in the time.
import { formatDuration, stopwatch } from "./timer.js";

const watch = stopwatch();
let ticker = null;

export function initSolveTimer() {
  const display = document.getElementById("timer-display");
  const toggle = document.getElementById("timer-toggle");
  const reset = document.getElementById("timer-reset");
  const paint = () => {
    display.textContent = formatDuration(watch.seconds());
    toggle.textContent = watch.running ? "Pause" : watch.seconds() ? "Resume" : "Start timer";
    toggle.classList.toggle("primary", !watch.running && watch.seconds() === 0);
    reset.hidden = watch.seconds() === 0;
    display.classList.toggle("running", watch.running);
  };
  toggle.onclick = () => {
    if (watch.running) {
      watch.pause();
      clearInterval(ticker);
    } else {
      watch.start();
      ticker = setInterval(paint, 1000);
    }
    paint();
  };
  reset.onclick = () => {
    watch.reset();
    clearInterval(ticker);
    paint();
  };
  paint();
}

/** Seconds on the timer (whole), or null if it was never started. */
export function solveSeconds() {
  const s = Math.round(watch.seconds());
  return s > 0 ? s : null;
}
