"""Run a program under sys.settrace and record a snapshot at every step."""
import builtins
import contextlib
import io
import sys
import threading
import types

from .encoder import HeapEncoder

USER_FILE = "<solution>"
HARNESS_FILE = "<harness>"  # prelude/epilogue code: runs, but never shows up as steps
MAX_STEPS = 5000


class StepLimitReached(BaseException):
    """BaseException so a user's `except Exception:` can't swallow it."""


def new_result(code, error=None):
    return {"code": code, "trace": [], "stdout": "", "truncated": False, "error": error}


def run_trace(code, stdin_text="", max_steps=MAX_STEPS, prelude="", epilogue=""):
    """Run `code` with `stdin_text` as its input. Returns a JSON-safe dict:
    {code, trace: [step, ...], stdout, truncated, error}.

    `prelude` runs first (untraced, its names hidden); `epilogue` runs after the
    user's code, e.g. to call Solution().method(...), and only user frames are traced."""
    result = new_result(code)
    try:
        compiled = compile(code, USER_FILE, "exec", dont_inherit=True)
    except SyntaxError as e:
        result["error"] = {"type": "SyntaxError", "message": e.msg, "line": e.lineno}
        return result
    harness_before = compile(prelude, HARNESS_FILE, "exec", dont_inherit=True)
    harness_after = compile(epilogue, HARNESS_FILE, "exec", dont_inherit=True)

    # Byte-backed streams so sys.stdin.buffer / sys.stdout.buffer idioms work too.
    out_bytes = io.BytesIO()
    # newline="\n": Windows would otherwise turn every "\n" into "\r\n"
    fake_out = io.TextIOWrapper(out_bytes, encoding="utf-8", newline="\n", write_through=True)
    fake_in = io.TextIOWrapper(io.BytesIO(stdin_text.encode("utf-8")), encoding="utf-8")
    user_globals = {"__name__": "__main__", "__builtins__": builtins}
    exec(harness_before, user_globals)
    hidden = dict(user_globals)  # prelude names stay hidden unless the user rebinds them
    encoder = HeapEncoder()
    steps = result["trace"]

    def stdout_text():
        return out_bytes.getvalue().decode("utf-8", "replace")

    def on_event(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None  # don't trace library code
        if not (event == "call" and frame.f_code.co_name == "<module>"):
            if len(steps) >= max_steps:
                # shortcut: a bare `except:` in user code can still catch this; the browser worker needs a timeout
                raise StepLimitReached
            steps.append(_snapshot(frame, event, arg, encoder, user_globals, hidden, stdout_text()))
        return on_event

    saved = (sys.stdin, sys.stdout, sys.gettrace(), sys.getrecursionlimit())
    sys.stdin, sys.stdout = fake_in, fake_out
    sys.settrace(on_event)
    try:
        with _threads_run_inline():
            exec(compiled, user_globals)
            exec(harness_after, user_globals)
    except StepLimitReached:
        result["truncated"] = True
    except SystemExit:
        pass  # exit() is a normal way to end a contest solution
    except Exception as e:
        result["error"] = {"type": type(e).__name__, "message": str(e), "line": _user_line(e.__traceback__)}
    finally:
        sys.settrace(saved[2])
        sys.stdin, sys.stdout = saved[0], saved[1]
        sys.setrecursionlimit(saved[3])
    result["stdout"] = stdout_text()
    return result


@contextlib.contextmanager
def _threads_run_inline():
    """Contest solutions start a Thread only to get a bigger stack. sys.settrace doesn't
    follow new threads (and Pyodide has none), so run the thread's target in place."""
    thread = threading.Thread
    saved = (thread.start, thread.join, threading.stack_size)
    thread.start = thread.run
    thread.join = lambda self, timeout=None: None
    threading.stack_size = lambda size=0: 0
    try:
        yield
    finally:
        thread.start, thread.join, threading.stack_size = saved


def _snapshot(frame, event, arg, encoder, user_globals, hidden, stdout):
    encoder.new_step()
    globals_ = {n: encoder.encode(v) for n, v in user_globals.items() if _is_visible(n, v, hidden)}
    stack = []
    f = frame
    while f is not None and f.f_code.co_filename == USER_FILE:
        if f.f_code.co_name != "<module>":
            stack.append({
                "func_name": f.f_code.co_name,
                "line": f.f_lineno,
                "locals": {n: encoder.encode(v) for n, v in f.f_locals.items()},
            })
        f = f.f_back
    stack.reverse()  # outermost call first
    if event == "return" and stack and frame.f_code.co_name != "<module>":
        stack[-1]["locals"]["__return__"] = encoder.encode(arg)
    step = {
        "line": frame.f_lineno,
        "event": event,
        "func_name": frame.f_code.co_name,
        "globals": globals_,
        "stack": stack,
        "heap": encoder.heap,
        "stdout": stdout,
    }
    if event == "exception":
        step["exception"] = f"{arg[0].__name__}: {arg[1]}"
    return step


_MISSING = object()


def _is_visible(name, value, hidden):
    return (
        not name.startswith("__")
        and not isinstance(value, types.ModuleType)
        and hidden.get(name, _MISSING) is not value
    )


def _user_line(tb):
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line
