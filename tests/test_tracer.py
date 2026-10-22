import json
import sys
import unittest

from tracer import run_trace
from tracer.encoder import MAX_ITEMS, MAX_STR


def final(result):
    return result["trace"][-1]


def deref(step, ref):
    """Look up the heap entry that a ["REF", id] value points to."""
    return step["heap"][str(ref[1])]


class HeapAndAliasing(unittest.TestCase):
    def test_two_names_share_one_list(self):
        r = run_trace("x = [1, 2]\ny = x\ny.append(3)\n")
        self.assertIsNone(r["error"])
        self.assertEqual([s["line"] for s in r["trace"]], [1, 2, 3, 3])
        last = final(r)
        self.assertEqual(last["globals"]["x"], last["globals"]["y"])
        self.assertEqual(deref(last, last["globals"]["x"]), ["LIST", 1, 2, 3])

    def test_dict_entries(self):
        last = final(run_trace("d = {'a': 1}\n"))
        self.assertEqual(deref(last, last["globals"]["d"]), ["DICT", ["a", 1]])

    def test_self_referencing_list_does_not_loop(self):
        last = final(run_trace("a = []\na.append(a)\n"))
        ref = last["globals"]["a"]
        self.assertEqual(deref(last, ref), ["LIST", ref])


class StdinMode(unittest.TestCase):
    def test_reads_sample_input_and_prints(self):
        code = "n = int(input())\na = list(map(int, input().split()))\nprint(sum(a))\n"
        r = run_trace(code, "3\n1 2 3\n")
        self.assertIsNone(r["error"])
        self.assertEqual(r["stdout"], "6\n")
        self.assertEqual(final(r)["stdout"], "6\n")

    def test_fast_readline_idiom(self):
        code = "import sys\ninput = sys.stdin.readline\nn = int(input())\nprint(n * 2)\n"
        r = run_trace(code, "21\n")
        self.assertEqual(r["stdout"], "42\n")
        self.assertNotIn("sys", final(r)["globals"])  # modules are noise

    def test_binary_buffer_idiom(self):
        code = "import sys\ndata = sys.stdin.buffer.read().split()\nprint(len(data))\n"
        self.assertEqual(run_trace(code, "1 2 3\n4\n")["stdout"], "4\n")


class Functions(unittest.TestCase):
    def test_function_frame_and_return_value(self):
        code = "def add(a, b):\n    s = a + b\n    return s\nprint(add(2, 3))\n"
        r = run_trace(code)
        ret = next(s for s in r["trace"] if s["event"] == "return" and s["func_name"] == "add")
        frame = ret["stack"][-1]
        self.assertEqual(frame["func_name"], "add")
        self.assertEqual(frame["locals"]["s"], 5)
        self.assertEqual(frame["locals"]["__return__"], 5)
        self.assertEqual(ret["globals"]["add"], ["FUNCTION", "add"])

    def test_class_body_frames_are_marked(self):
        r = run_trace("class S:\n    x = 1\ndef f():\n    return 2\nf()\n")
        frames = [f for s in r["trace"] for f in s["stack"]]
        self.assertTrue(all(f.get("is_class_body") for f in frames if f["func_name"] == "S"))
        self.assertTrue(all("is_class_body" not in f for f in frames if f["func_name"] == "f"))

    def test_recursion_stacks_frames(self):
        code = "def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nfact(3)\n"
        r = run_trace(code)
        self.assertEqual(max(len(s["stack"]) for s in r["trace"]), 3)


class LimitsAndErrors(unittest.TestCase):
    def test_infinite_loop_is_cut_off(self):
        r = run_trace("while True:\n    pass\n", max_steps=50)
        self.assertTrue(r["truncated"])
        self.assertEqual(len(r["trace"]), 50)

    def test_except_exception_cannot_swallow_the_limit(self):
        code = "while True:\n    try:\n        pass\n    except Exception:\n        pass\n"
        r = run_trace(code, max_steps=30)
        self.assertTrue(r["truncated"])

    def test_runtime_error_reports_line(self):
        r = run_trace("x = 1\ny = x / 0\n")
        self.assertEqual(r["error"]["type"], "ZeroDivisionError")
        self.assertEqual(r["error"]["line"], 2)

    def test_syntax_error_has_no_steps(self):
        r = run_trace("def f(:\n")
        self.assertEqual(r["error"]["type"], "SyntaxError")
        self.assertEqual(r["trace"], [])

    def test_restores_stdin_stdout_and_tracer(self):
        before = (sys.stdin, sys.stdout, sys.gettrace())
        run_trace("print('hi')\n")
        self.assertEqual((sys.stdin, sys.stdout, sys.gettrace()), before)


class JsonSafety(unittest.TestCase):
    def test_infinity_and_big_ints_survive_json(self):
        r = run_trace("INF = float('inf')\nbig = 10**20\n")
        g = final(r)["globals"]
        self.assertEqual(g["INF"], ["FLOAT", "inf"])
        self.assertEqual(g["big"], ["INT", "100000000000000000000"])
        json.dumps(r, allow_nan=False)  # raises if anything isn't strict JSON

    def test_big_list_is_capped(self):
        last = final(run_trace("a = list(range(1000))\n"))
        entry = deref(last, last["globals"]["a"])
        self.assertEqual(len(entry), 1 + MAX_ITEMS + 1)
        self.assertEqual(entry[-1], ["MORE", 1000 - MAX_ITEMS])

    def test_long_string_is_capped(self):
        last = final(run_trace("s = 'a' * 5000\n"))
        self.assertEqual(last["globals"]["s"], ["STR", "a" * MAX_STR, 5000])


class ContestIdioms(unittest.TestCase):
    def test_thread_for_bigger_stack_runs_inline(self):
        code = (
            "import sys, threading\n"
            "sys.setrecursionlimit(10**6)\n"
            "threading.stack_size(1 << 27)\n"
            "def main():\n"
            "    print('ran')\n"
            "t = threading.Thread(target=main)\n"
            "t.start()\n"
            "t.join()\n"
        )
        limit = sys.getrecursionlimit()
        r = run_trace(code)
        self.assertIsNone(r["error"])
        self.assertEqual(r["stdout"], "ran\n")
        self.assertTrue(any(f["func_name"] == "main" for s in r["trace"] for f in s["stack"]))
        self.assertEqual(sys.getrecursionlimit(), limit)

    def test_prelude_names_are_hidden_and_untraced(self):
        r = run_trace("y = helper(2)\n", prelude="def helper(x):\n    return x * 10\n")
        self.assertIsNone(r["error"])
        self.assertEqual(list(final(r)["globals"]), ["y"])
        self.assertEqual(final(r)["globals"]["y"], 20)
        self.assertTrue(all(s["func_name"] != "helper" for s in r["trace"]))

    def test_epilogue_calls_into_traced_user_code(self):
        r = run_trace("def f(n):\n    return n + 1\n", epilogue="print(f(1))\n")
        self.assertEqual(r["stdout"], "2\n")
        self.assertTrue(any(s["func_name"] == "f" for s in r["trace"]))


class UserObjects(unittest.TestCase):

    def test_linked_list_node_shows_its_fields(self):
        code = (
            "class ListNode:\n"
            "    def __init__(self, val, next=None):\n"
            "        self.val = val\n"
            "        self.next = next\n"
            "head = ListNode(1, ListNode(2))\n"
        )
        last = final(run_trace(code))
        self.assertEqual(last["globals"]["ListNode"], ["CLASS", "ListNode"])
        head = deref(last, last["globals"]["head"])
        self.assertEqual(head[:3], ["INSTANCE", "ListNode", ["val", 1]])
        self.assertEqual(head[3][0], "next")
        self.assertEqual(deref(last, head[3][1]), ["INSTANCE", "ListNode", ["val", 2], ["next", None]])
