"""Names LeetCode's Python 3 editor provides without imports, plus the code that builds
arguments, calls Solution, and prints the answer. Runs untraced before the user's code;
everything defined here is hidden in the viewer."""
import bisect
import collections
import functools
import heapq
import inspect
import itertools
import json
import math
import operator
import re
import string
from bisect import *
from collections import *
from functools import *
from heapq import *
from itertools import *
from math import ceil, comb, factorial, floor, gcd, inf, isqrt, lcm, log, log2, perm, sqrt
from typing import *


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def _lc_call(g, args_json):
    args = json.loads(args_json)
    solution_cls = g.get("Solution")
    if not isinstance(solution_cls, type):
        raise NameError("No `class Solution` found in your code")
    method = _lc_pick_method(solution_cls, args)
    sig = inspect.signature(method)
    params = list(sig.parameters.values())[1:]  # drop self
    if isinstance(args, list):
        args = {p.name: v for p, v in zip(params, args)}
    by_name = {p.name: p for p in params}
    kwargs = {n: _lc_build(v, by_name[n].annotation, g) for n, v in args.items()}
    result = method(solution_cls(), **kwargs)
    if result is None and sig.return_annotation in (None, type(None)) and kwargs:
        result = next(iter(kwargs.values()))  # "modify in place": LeetCode shows the first argument
    print(json.dumps(_lc_dump(result), separators=(",", ":")))


def _lc_pick_method(cls, args):
    methods = {n: f for n, f in vars(cls).items() if callable(f) and not n.startswith("_")}
    for name, f in methods.items():
        params = list(inspect.signature(f).parameters)[1:]
        fits = len(params) == len(args) if isinstance(args, list) else set(params) == set(args)
        if fits:
            return f
    raise TypeError(f"No method of Solution takes these arguments; found: {', '.join(methods) or 'none'}")


def _lc_build(value, annotation, g):
    ann = str(annotation).replace("typing.", "")
    if value is None or ("ListNode" not in ann and "TreeNode" not in ann):
        return value
    if ann.startswith(("List[", "list[")):
        inner = ann[ann.index("[") + 1 : -1]
        return [_lc_build(v, inner, g) for v in value]
    return _lc_linked(value, g["ListNode"]) if "ListNode" in ann else _lc_tree(value, g["TreeNode"])


def _lc_linked(values, node_cls):
    dummy = tail = node_cls()
    for v in values:
        tail.next = tail = node_cls(v)
    return dummy.next


def _lc_tree(values, node_cls):
    """LeetCode level order: [3,9,20,null,null,15,7]."""
    if not values or values[0] is None:
        return None
    root = node_cls(values[0])
    queue, i = [root], 1
    for node in queue:  # the list grows while we walk it
        if i >= len(values):
            break
        if values[i] is not None:
            node.left = node_cls(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = node_cls(values[i])
            queue.append(node.right)
        i += 1
    return root


def _lc_dump(value, limit=10_000):
    kind = type(value).__name__
    if kind == "ListNode":
        out = []
        while value is not None and len(out) < limit:  # limit stops a cyclic list
            out.append(value.val)
            value = value.next
        return out
    if kind == "TreeNode":
        out, queue = [], [value]
        for node in queue:
            out.append(None if node is None else node.val)
            if node is not None:
                queue += [node.left, node.right]
        while out and out[-1] is None:
            out.pop()
        return out
    if isinstance(value, (list, tuple)):
        return [_lc_dump(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value
