import unittest
from unittest.mock import patch
from fastapi import HTTPException
import app


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.teams = [{"id": "gsw", "short": "GSW", "name": "Warriors"},
                      {"id": "lal", "short": "LAL", "name": "Lakers"}]
        self.row = {"gameId": "0022600001", "gameDateEst": "2026-10-20T00:00:00Z",
                    "gameDateTimeUTC": "2026-10-21T02:00:00Z", "gameStatus": 3,
                    "homeTeam_teamId": 1610612744, "homeTeam_teamTricode": "GSW",
                    "awayTeam_teamId": 1610612747, "awayTeam_teamTricode": "LAL",
                    "homeTeam_score": 120, "awayTeam_score": 110}

    def test_native_ids_and_canonical_teams(self):
        game = app._schedule_game(self.row, self.teams)
        self.assertEqual(game["id"], "nba-0022600001")
        self.assertEqual(game["home"]["id"], "gsw")
        self.assertEqual(game["status"], "final")
        self.assertEqual(game["homeScore"], 120)
        self.assertEqual(game["startsAt"], "2026-10-21T02:00:00Z")

    def test_scheduled_does_not_invent_scores(self):
        game = app._schedule_game({**self.row, "gameStatus": 1}, self.teams)
        self.assertNotIn("homeScore", game)
        self.assertNotIn("homeScore", app._schedule_game({**self.row, "homeTeam_score": None}, self.teams))
        self.assertIsNone(app._schedule_game(self.row, []))

    def test_range_and_team_filter(self):
        with patch.object(app, "_schedule_rows", return_value=[self.row]):
            games = app.team_games({"from": "2026-10-01", "to": "2026-10-31", "teams": self.teams, "teamId": "gsw"})
            self.assertEqual(len(games), 1)
            self.assertEqual(app.team_games({"from": "2026-11-01", "to": "2026-11-30", "teams": self.teams}), [])
            self.assertEqual(app.get_game({"gameId": games[0]["id"], "teams": self.teams})["id"], games[0]["id"])

    def test_rejects_bad_range_and_foreign_ids(self):
        with self.assertRaises(HTTPException):
            app.team_games({"from": "2026-10-31", "to": "2026-10-01", "teams": self.teams})
        with self.assertRaises(HTTPException):
            app.get_game({"gameId": "bdl-42", "teams": self.teams})


if __name__ == "__main__":
    unittest.main()
