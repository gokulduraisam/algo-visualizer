"""Explain `if` / `elif` / `while` conditions at the moment they are checked:
`nums[m] <= nums[r]`  ->  "1 <= 3"  ->  True.

Explaining means evaluating the condition a second time, so only side-effect-free
expressions are allowed: names, constants, indexing, attributes, arithmetic,
comparisons, and/or/not, and a few pure builtins. Anything else (method calls,
user functions, walrus, defaultdict lookups that would insert a key) is skipped,
so explaining can never change what the program does.
"""
import ast
import builtins
import collections
import operator
import reprlib

PURE_BUILTINS = {"len", "abs", "min", "max", "int", "float", "str", "bool", "ord", "chr",
                 "isinstance", "sorted", "round"}
_SAFE_NODES = (
    ast.Compare, ast.BoolOp, ast.UnaryOp, ast.BinOp, ast.Name, ast.Constant, ast.Subscript,
    ast.Slice, ast.Attribute, ast.Tuple, ast.List, ast.Call, ast.keyword,
    ast.boolop, ast.cmpop, ast.unaryop, ast.operator, ast.expr_context,
)
_COMPARE = {
    ast.Eq: ("==", operator.eq), ast.NotEq: ("!=", operator.ne),
    ast.Lt: ("<", operator.lt), ast.LtE: ("<=", operator.le),
    ast.Gt: (">", operator.gt), ast.GtE: (">=", operator.ge),
    ast.Is: ("is", operator.is_), ast.IsNot: ("is not", operator.is_not),
    ast.In: ("in", lambda a, b: a in b), ast.NotIn: ("not in", lambda a, b: a not in b),
}
_SHORT = reprlib.Repr()
_SHORT.maxstring = _SHORT.maxother = 30
_SHORT.maxlist = _SHORT.maxtuple = _SHORT.maxset = _SHORT.maxdeque = 6
_SHORT.maxdict = 4


def condition_lines(code):
    """Line number -> test expression of every if / elif / while statement."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return {}
    return {n.lineno: n.test for n in ast.walk(tree) if isinstance(n, (ast.If, ast.While))}


def explain(test, frame):
    """Return {source, shown, value} (or {source, shown: None, value: None, error}), or None if unsafe."""
    env = _Frame(frame)
    if not _is_safe(test, env):
        return None
    source = ast.unparse(test)
    try:
        shown, value = _show(test, env)
        return {"source": source, "shown": shown, "value": bool(value)}
    except Exception as e:
        return {"source": source, "shown": None, "value": None, "error": f"{type(e).__name__}: {e}"}


class _Frame:
    def __init__(self, frame):
        self.globals = frame.f_globals
        self.locals = dict(frame.f_locals)
        self._compiled = {}

    def eval(self, node):
        # eval is intended: `node` is a sub-expression of the user's own code that _is_safe has
        # already restricted to side-effect-free operations, run in the same sandbox as the code.
        code = self._compiled.get(id(node))
        if code is None:
            expr = ast.fix_missing_locations(ast.Expression(body=node))
            code = self._compiled[id(node)] = compile(expr, "<condition>", "eval")
        return eval(code, self.globals, self.locals)

    def lookup(self, name):
        for scope in (self.locals, self.globals, vars(builtins)):
            if name in scope:
                return scope[name]
        return None


def _is_safe(test, env):
    nodes = list(ast.walk(test))
    for node in nodes:
        if not isinstance(node, _SAFE_NODES):
            return False
        if isinstance(node, ast.Call):
            func = node.func
            if not (isinstance(func, ast.Name) and func.id in PURE_BUILTINS):
                return False
            if env.lookup(func.id) is not getattr(builtins, func.id):
                return False  # the user redefined it
    # Second pass: evaluating subscript bases is only harmless once the whole tree is known safe
    # (ast.walk is breadth-first, so `f()[0]` reaches the Subscript before the Call).
    return not any(isinstance(n, ast.Subscript) and _is_defaultdict(n.value, env) for n in nodes)


def _is_defaultdict(node, env):
    try:
        return isinstance(env.eval(node), collections.defaultdict)
    except Exception:
        return False  # can't tell yet (e.g. guarded by short-circuit); the real eval will decide


def _show(node, env):
    """(text with values substituted, value), evaluating the way Python would."""
    if isinstance(node, ast.BoolOp):
        is_and = isinstance(node.op, ast.And)
        parts, result, stopped = [], None, False
        for value_node in node.values:
            if stopped:
                parts.append("…")
                continue
            text, result = _show(value_node, env)
            parts.append(f"({text})" if isinstance(value_node, ast.BoolOp) else text)
            stopped = bool(result) != is_and  # `and` stops at falsy, `or` at truthy
        return f" {'and' if is_and else 'or'} ".join(parts), result
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        text, value = _show(node.operand, env)
        return f"not {text}", not value
    if isinstance(node, ast.Compare):
        left = env.eval(node.left)
        text, result = _short(left), True
        for op, right_node in zip(node.ops, node.comparators):
            symbol, compare = _COMPARE[type(op)]
            if not result:  # a chain like 0 <= i < n stops at the first False
                text += f" {symbol} …"
                continue
            right = env.eval(right_node)
            text += f" {symbol} {_short(right)}"
            result = compare(left, right)
            left = right
        return text, result
    value = env.eval(node)
    return _short(value), value


def _short(value):
    """Compact repr; node-like objects (anything with .val) show as ListNode(3)."""
    if hasattr(value, "val") and not isinstance(value, (int, float, str, bytes)):
        return f"{type(value).__name__}({_short(value.val)})"
    try:
        return _SHORT.repr(value)
    except Exception:
        return f"<{type(value).__name__}>"
