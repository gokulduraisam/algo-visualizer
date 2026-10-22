import unittest

from harness.leetcode import parse_example, run_leetcode


class ParseExample(unittest.TestCase):
    def test_named_arguments(self):
        self.assertEqual(parse_example("nums = [2,7,11,15], target = 9"), {"nums": [2, 7, 11, 15], "target": 9})

    def test_input_prefix_and_comma_inside_string(self):
        self.assertEqual(parse_example('Input: s = "a, b = 1", k = 2'), {"s": "a, b = 1", "k": 2})

    def test_one_value_per_line_like_the_testcase_box(self):
        self.assertEqual(parse_example("[2,7,11,15]\n9\n"), [[2, 7, 11, 15], 9])

    def test_null_values(self):
        self.assertEqual(parse_example("root = [1,null,2]"), {"root": [1, None, 2]})

    def test_bad_value_gives_readable_error(self):
        with self.assertRaisesRegex(ValueError, "target"):
            parse_example("nums = [1,2], target = oops")


TWO_SUM = """
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
"""

MAX_DEPTH = """
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))
"""

REVERSE_LIST = """
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        while head:
            head.next, prev, head = prev, head, head.next
        return prev
"""

ROTATE_IN_PLACE = """
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        k %= len(nums)
        nums[:] = nums[-k:] + nums[:-k]
"""

MERGE_K = """
class Solution:
    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:
        heap = [(node.val, i, node) for i, node in enumerate(lists) if node]
        heapify(heap)
        dummy = tail = ListNode()
        while heap:
            _, i, node = heappop(heap)
            tail.next = tail = node
            if node.next:
                heappush(heap, (node.next.val, i, node.next))
        return dummy.next
"""

WITH_HELPER = """
class Solution:
    def helper(self, x):
        return x * 2
    def double(self, n: int) -> int:
        return self.helper(n)
"""


class RunLeetCode(unittest.TestCase):
    def test_two_sum(self):
        r = run_leetcode(TWO_SUM, "nums = [2,7,11,15], target = 9")
        self.assertIsNone(r["error"])
        self.assertEqual(r["stdout"], "[0,1]\n")
        self.assertTrue(any(s["func_name"] == "twoSum" for s in r["trace"]))

    def test_prelude_names_hidden(self):
        r = run_leetcode(TWO_SUM, "nums = [2,7], target = 9")
        self.assertEqual(list(r["trace"][-1]["globals"]), ["Solution"])

    def test_tree_built_from_level_order(self):
        r = run_leetcode(MAX_DEPTH, "root = [3,9,20,null,null,15,7]")
        self.assertIsNone(r["error"])
        self.assertEqual(r["stdout"], "3\n")

    def test_linked_list_in_and_out(self):
        r = run_leetcode(REVERSE_LIST, "head = [1,2,3]")
        self.assertEqual(r["stdout"], "[3,2,1]\n")
        entries = [e for s in r["trace"] for e in s["heap"].values()]
        self.assertTrue(any(e[:2] == ["INSTANCE", "ListNode"] for e in entries))

    def test_in_place_problem_prints_first_argument(self):
        r = run_leetcode(ROTATE_IN_PLACE, "nums = [1,2,3], k = 1")
        self.assertEqual(r["stdout"], "[3,1,2]\n")

    def test_list_of_linked_lists_positional_input(self):
        r = run_leetcode(MERGE_K, "[[1,4],[2]]")
        self.assertIsNone(r["error"])
        self.assertEqual(r["stdout"], "[1,2,4]\n")

    def test_picks_method_by_argument_names(self):
        self.assertEqual(run_leetcode(WITH_HELPER, "n = 4")["stdout"], "8\n")

    def test_missing_solution_class(self):
        r = run_leetcode("x = 1\n", "n = 1")
        self.assertIn("class Solution", r["error"]["message"])

    def test_bad_example_is_an_error_not_a_crash(self):
        r = run_leetcode(TWO_SUM, "nums = [1,")
        self.assertEqual(r["error"]["type"], "InputError")
        self.assertEqual(r["trace"], [])
