"""Function mode: trace a LeetCode `class Solution` against one example input."""
import json
import re
from pathlib import Path

from tracer.runner import MAX_STEPS, new_result, run_trace

PRELUDE = Path(__file__).with_name("leetcode_prelude.py").read_text(encoding="utf-8")
_NAME = re.compile(r"\s*([A-Za-z_]\w*)\s*=\s*")
_SEPARATOR = re.compile(r"\s*,?\s*")
_DECODER = json.JSONDecoder()


def parse_example(text):
    """'nums = [2,7], target = 9' -> {"nums": [2, 7], "target": 9}
    '[2,7]\\n9' (one value per line) -> [[2, 7], 9]"""
    text = re.sub(r"^\s*Input:\s*", "", text).strip()
    if _NAME.match(text):
        return _parse_named(text)
    return [_decode(line, f"line {n}") for n, line in enumerate(text.splitlines(), 1) if line.strip()]


def _parse_named(text):
    args, pos = {}, 0
    while pos < len(text):
        m = _NAME.match(text, pos)
        if not m:
            raise ValueError(f"Expected `name = value` near: {text[pos:pos + 30]!r}")
        name = m.group(1)
        try:
            args[name], pos = _DECODER.raw_decode(text, m.end())
        except json.JSONDecodeError as e:
            raise ValueError(f"Can't read the value of `{name}`: {e.msg}") from None
        pos = _SEPARATOR.match(text, pos).end()
    return args


def _decode(raw, where):
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Can't read {where}: {e.msg}") from None


def run_leetcode(code, example_text, max_steps=MAX_STEPS):
    try:
        args = parse_example(example_text)
    except ValueError as e:
        return new_result(code, {"type": "InputError", "message": str(e), "line": None})
    epilogue = f"_lc_call(globals(), {json.dumps(args)!r})\n"
    return run_trace(code, "", max_steps, prelude=PRELUDE, epilogue=epilogue)
