import unittest

from tracer import run_trace


def conditions(result, line):
    return [s["condition"] for s in result["trace"] if s["line"] == line and "condition" in s]


class ExplainsConditions(unittest.TestCase):
    def test_binary_search_comparison(self):
        code = "nums = [4, 5, 1, 2, 3]\nl, r = 0, 4\nm = 2\nif nums[m] <= nums[r]:\n    x = 1\n"
        [c] = conditions(run_trace(code), 4)
        self.assertEqual(c, {"source": "nums[m] <= nums[r]", "shown": "1 <= 3", "value": True})

    def test_while_is_explained_on_every_check(self):
        r = run_trace("n = 3\nwhile n > 0:\n    n -= 1\n")
        cs = conditions(r, 2)
        self.assertEqual([c["shown"] for c in cs], ["3 > 0", "2 > 0", "1 > 0", "0 > 0"])
        self.assertEqual([c["value"] for c in cs], [True, True, True, False])

    def test_elif(self):
        [c] = conditions(run_trace("x = 5\nif x < 3:\n    pass\nelif x < 10:\n    pass\n"), 4)
        self.assertEqual((c["shown"], c["value"]), ("5 < 10", True))

    def test_short_circuit_skips_the_unsafe_right_side(self):
        [c] = conditions(run_trace("i = 5\na = [1]\nif i < len(a) and a[i] > 0:\n    pass\n"), 3)
        self.assertEqual((c["shown"], c["value"]), ("5 < 1 and …", False))

    def test_or_and_chained_comparison(self):
        [c] = conditions(run_trace("i, n = 2, 5\nif 0 <= i < n or i == 9:\n    pass\n"), 2)
        self.assertEqual((c["shown"], c["value"]), ("0 <= 2 < 5 or …", True))

    def test_not_and_plain_truthiness(self):
        [c] = conditions(run_trace("root = None\nif not root:\n    pass\n"), 2)
        self.assertEqual((c["shown"], c["value"]), ("not None", True))

    def test_membership_with_arithmetic(self):
        [c] = conditions(run_trace("seen = {2: 0}\nif 7 - 5 in seen:\n    pass\n"), 2)
        self.assertEqual((c["shown"], c["value"]), ("2 in {2: 0}", True))

    def test_node_objects_show_their_value(self):
        code = "class N:\n    def __init__(self, v):\n        self.val = v\nroot = N(3)\nif root:\n    pass\n"
        [c] = conditions(run_trace(code), 5)
        self.assertEqual((c["shown"], c["value"]), ("N(3)", True))

    def test_long_values_are_shortened(self):
        [c] = conditions(run_trace("a = list(range(100))\nif 50 in a:\n    pass\n"), 2)
        self.assertLess(len(c["shown"]), 60)
        self.assertTrue(c["value"])

    def test_error_while_checking_is_reported(self):
        r = run_trace("a = []\nif a[0] > 1:\n    pass\n")
        [c] = conditions(r, 2)
        self.assertIsNone(c["value"])
        self.assertTrue(c["error"].startswith("IndexError"))
        self.assertEqual(r["error"]["type"], "IndexError")


class NeverChangesTheProgram(unittest.TestCase):
    def test_method_calls_are_not_evaluated(self):
        r = run_trace("s = [3]\nif s.pop() > 1:\n    pass\nprint(s)\n")
        self.assertEqual(conditions(r, 2), [])
        self.assertEqual(r["stdout"], "[]\n")  # popped exactly once

    def test_user_functions_are_not_called_twice(self):
        code = "def f():\n    print('called')\n    return 1\nif f() > 0:\n    pass\n"
        r = run_trace(code)
        self.assertEqual(conditions(r, 4), [])
        self.assertEqual(r["stdout"], "called\n")

    def test_call_inside_an_index_is_not_evaluated(self):
        code = "def f():\n    print('called')\n    return [5]\nif f()[0] > 1:\n    pass\n"
        r = run_trace(code)
        self.assertEqual(conditions(r, 4), [])
        self.assertEqual(r["stdout"], "called\n")

    def test_shadowed_builtin_is_not_trusted(self):
        code = "def len(x):\n    print('mine')\n    return 0\na = [1]\nif len(a) > 0:\n    pass\n"
        r = run_trace(code)
        self.assertEqual(conditions(r, 5), [])
        self.assertEqual(r["stdout"], "mine\n")

    def test_defaultdict_lookup_is_not_evaluated(self):
        code = "from collections import defaultdict\nd = defaultdict(int)\nif d['k'] > 0:\n    pass\n"
        self.assertEqual(conditions(run_trace(code), 3), [])

    def test_walrus_is_not_evaluated(self):
        r = run_trace("n = 3\nwhile (n := n - 1) > 0:\n    pass\nprint(n)\n")
        self.assertEqual(conditions(r, 2), [])
        self.assertEqual(r["stdout"], "0\n")
