import unittest

from box_score_mapping import normalize_box_line


class BoxScoreMappingTests(unittest.TestCase):
    def test_missing_stats_are_not_fabricated_zeroes(self):
        line = normalize_box_line({"comment": "DNP - Coach's Decision"}, "Player")
        self.assertIsNone(line["points"])
        self.assertIsNone(line["plusMinus"])
        self.assertIsNone(line["fieldGoals"])
        self.assertIsNone(line["freeThrowsMade"])
        self.assertEqual(line["comment"], "DNP - Coach's Decision")

    def test_real_zeroes_and_shooting_are_preserved(self):
        line = normalize_box_line({"minutes": "32:10", "points": 0, "fieldGoalsMade": 0,
                                   "fieldGoalsAttempted": 7, "plusMinusPoints": -12, "freeThrowsMade": 0}, "Player")
        self.assertEqual(line["points"], 0)
        self.assertEqual(line["fieldGoals"], "0-7")
        self.assertEqual(line["plusMinus"], -12)
        self.assertEqual(line["minutes"], "32:10")
        self.assertEqual(line["freeThrowsMade"], 0)

    def test_partial_shooting_stats_remain_unknown(self):
        line = normalize_box_line({"freeThrowsMade": 2, "threePointersAttempted": 6}, "Team totals")
        self.assertIsNone(line["freeThrows"])
        self.assertEqual(line["freeThrowsMade"], 2)
        self.assertIsNone(line["threePointers"])


if __name__ == "__main__":
    unittest.main()
