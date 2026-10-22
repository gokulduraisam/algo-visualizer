"""Turn live Python objects into JSON-safe values for the trace.

Primitives are stored inline. Containers and objects go into a per-step heap and
are referenced as ["REF", id], so two names pointing at one list share an id.
"""
import collections
import itertools
import math
import types

# shortcut: big containers/strings are cut off to keep traces small; raise if the viewer needs more
MAX_ITEMS = 200
MAX_STR = 1000
JS_SAFE_INT = 2**53  # JavaScript silently rounds integers beyond this

_SEQUENCE_KINDS = (
    (list, "LIST"),
    (tuple, "TUPLE"),
    (collections.deque, "DEQUE"),
    ((set, frozenset), "SET"),
)
_FUNCTION_TYPES = (types.FunctionType, types.BuiltinFunctionType, types.MethodType)


def encode_instance(obj, encode):
    """Heap entry for an object of a user-defined class, e.g. ListNode or TreeNode.

    Return ["INSTANCE", class_name, [attr_name, encode(attr_value)], ...].
    `encode` turns a child value into its trace form (an inline value or ["REF", id]).
    """
    # Assignment order (val, left, right) suits drawing; _private fields stay visible for debugging.
    fields = [[name, encode(v)] for name, v in vars(obj).items() if not name.startswith("__")]
    return ["INSTANCE", type(obj).__name__, *fields]


class HeapEncoder:
    """Encodes values step by step, keeping object ids stable for the whole run."""

    def __init__(self):
        self._ids = {}
        self._alive = []  # keeps objects alive so id() is never reused for a different object
        self.heap = {}

    def new_step(self):
        self.heap = {}

    def encode(self, value):
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, int):
            return value if abs(value) < JS_SAFE_INT else ["INT", str(value)]
        if isinstance(value, float):
            return value if math.isfinite(value) else ["FLOAT", repr(value)]
        if isinstance(value, str):
            return value if len(value) <= MAX_STR else ["STR", value[:MAX_STR], len(value)]
        if isinstance(value, _FUNCTION_TYPES):
            return ["FUNCTION", getattr(value, "__qualname__", repr(value))]
        if isinstance(value, type):
            return ["CLASS", value.__name__]
        if isinstance(value, types.ModuleType):
            return ["MODULE", value.__name__]
        ref = self._ref(value)
        key = str(ref)
        if key not in self.heap:
            self.heap[key] = None  # placeholder: a cycle back to this object stops here
            self.heap[key] = self._heap_entry(value)
        return ["REF", ref]

    def _ref(self, value):
        key = id(value)
        if key not in self._ids:
            self._ids[key] = len(self._ids) + 1
            self._alive.append(value)
        return self._ids[key]

    def _heap_entry(self, value):
        if isinstance(value, dict):
            pairs = [[self.encode(k), self.encode(v)] for k, v in itertools.islice(value.items(), MAX_ITEMS)]
            return _capped("DICT", pairs, len(value))
        for cls, kind in _SEQUENCE_KINDS:
            if isinstance(value, cls):
                items = [self.encode(v) for v in itertools.islice(value, MAX_ITEMS)]
                return _capped(kind, items, len(value))
        if hasattr(value, "__dict__"):
            return encode_instance(value, self.encode)
        return ["OTHER", type(value).__name__, _safe_repr(value)]


def _capped(kind, items, total):
    entry = [kind, *items]
    if total > len(items):
        entry.append(["MORE", total - len(items)])
    return entry


def _safe_repr(value):
    try:
        return repr(value)[:80]
    except Exception:
        return "<repr failed>"
