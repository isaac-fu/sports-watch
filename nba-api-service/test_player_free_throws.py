import unittest
from unittest.mock import patch
import app


class FreeThrowTests(unittest.TestCase):
    player = {"id": "player", "name": "Player", "teamId": "gsw", "teamName": "Warriors"}

    def test_season_percentage_uses_api_value(self):
        stat = app._player_stat(self.player, 2026, {"FT_PCT": .875, "GP": 3})
        self.assertEqual(stat["freeThrowPercentage"], 87.5)
        self.assertNotIn("freeThrowPercentage", app._player_stat(self.player, 2026, {}))

    def test_history_retains_free_throw_percentage(self):
        history = app._season_history(self.player, 2026, [{"SEASON_ID": "2025-26", "GP": 50, "FT_PCT": .9}], [])
        self.assertEqual(history[0]["freeThrowPercentage"], 90)

    def test_last_ten_includes_made_attempted_and_preserves_missing(self):
        rows = [{"GAME_ID": "0022600001", "GAME_DATE": "2026-10-21", "MATCHUP": "GSW vs. LAL", "WL": "W", "FTM": 5, "FTA": 6},
                {"GAME_ID": "0022600002", "GAME_DATE": "2026-10-20", "MATCHUP": "GSW vs. LAL", "WL": "L"}]
        with patch.object(app, "_player_game_rows", side_effect=[rows, []]), patch.object(app, "_league_game_rows", return_value=[]):
            games = app._last_ten(1, 2026, [])
            self.assertEqual(games[0]["freeThrows"], "5-6")
            self.assertNotIn("freeThrows", games[1])


if __name__ == "__main__":
    unittest.main()
