"""Usage: python -m tracer solution.py < input.txt > trace.json"""
import json
import sys

from .runner import run_trace


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        with open(argv[1], encoding="utf-8") as f:
            code = f.read()
    except OSError as e:
        print(f"Cannot read {argv[1]}: {e.strerror}", file=sys.stderr)
        return 1
    json.dump(run_trace(code, sys.stdin.read()), sys.stdout, allow_nan=False)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
