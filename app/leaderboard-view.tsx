"use client";
import { useEffect, useMemo, useState } from "react";
import type { PlayerStat, TeamStat } from "@/lib/models";
import { hasMetric, leaderboardMetrics, rankLeaderboardPlayers, rankLeaderboardTeams, type LeaderboardMetric } from "@/lib/leaderboard";
import "./leaderboard.css";

type Data = { players: PlayerStat[]; teams: TeamStat[]; seasonLabel: string; source: string; updatedAt: string; stale: boolean };
export function LeaderboardView({ metric, selectedPlayerId, onMetricChange, onOpenPlayer, onOpenTeam }: {
  metric: LeaderboardMetric; selectedPlayerId: string | null; onMetricChange: (metric: LeaderboardMetric) => void;
  onOpenPlayer: (id: string) => void; onOpenTeam: (id: string) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/leaderboard", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load leaderboard.");
      setData(payload.data);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message || "Could not load leaderboard."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  const players = useMemo(() => rankLeaderboardPlayers(data?.players ?? [], metric), [data, metric]);
  const teams = useMemo(() => rankLeaderboardTeams(data?.teams ?? []), [data]);
  const visiblePlayers = players.filter((player) => `${player.playerName} ${player.teamName}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    if (data && selectedPlayerId) document.getElementById(`leader-player-${selectedPlayerId}`)?.scrollIntoView({ block: "center" });
  }, [data, selectedPlayerId]);
  const label = leaderboardMetrics.find(([key]) => key === metric)![1];
  return <div className="leaderboard-page">
    <div className="page-heading"><p className="overline">AROUND THE LEAGUE</p><h1>Leaderboard</h1><p className="subhead">{data?.seasonLabel ?? "Current season"} regular-season standings and player averages.</p></div>
    {loading && <p role="status">Loading league statistics…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry((value) => value + 1)}>Retry leaderboard</button></div>}
    {data && <>{data.stale && <p role="status">Showing cached statistics while the provider is unavailable.</p>}
      <section className="leaderboard-panel"><h2>Team record</h2><p>Sorted by win percentage, then wins. Equal percentages share a rank.</p>
        <div className="leaderboard-scroll" tabIndex={0} aria-label="Team record leaderboard"><table><thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>WIN%</th></tr></thead><tbody>{teams.map((team) => <tr key={team.teamId}><td>{team.rank ?? "—"}</td><th scope="row"><button onClick={() => onOpenTeam(team.teamId)}>{team.teamName}</button></th><td>{team.wins}</td><td>{team.losses}</td><td>{team.winPercentage === null ? "—" : `${(team.winPercentage * 100).toFixed(1)}%`}</td></tr>)}</tbody></table>{!teams.length && <p>No current-season team records are available.</p>}</div>
      </section>
      <section className="leaderboard-panel"><h2>Player leaderboard · {label}</h2><p>Players with at least 1 game played. No official NBA shooting minimums applied. Ties share a rank; missing values are not ranked.</p>
        <label className="leaderboard-search">Search players or teams<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Player or team name" /></label>
        <div className="leaderboard-scroll" tabIndex={0} aria-label="Player statistics leaderboard"><table><thead><tr><th>Rank</th><th>Player</th>{leaderboardMetrics.map(([key, title]) => <th key={key} aria-sort={metric === key ? "descending" : "none"}><button onClick={() => onMetricChange(key)} aria-label={`Sort by ${title}`}>{title}{metric === key ? " ↓" : ""}</button></th>)}</tr></thead><tbody>{visiblePlayers.map((player) => <tr id={`leader-player-${player.playerId}`} key={player.playerId} className={player.playerId === selectedPlayerId ? "selected-player" : ""}><td>{player.rank}</td><th scope="row"><button onClick={() => onOpenPlayer(player.playerId)}>{player.playerName}</button><small>{player.teamName} · {player.gamesPlayed} GP</small></th>{leaderboardMetrics.map(([key]) => <td key={key} className={metric === key ? "selected-stat" : ""}>{hasMetric(player[key]) ? `${player[key]!.toFixed(1)}${key.endsWith("Percentage") ? "%" : ""}` : "—"}</td>)}</tr>)}</tbody></table>{!visiblePlayers.length && <p>{query ? "No matching players." : "No player statistics are available for this category yet."}</p>}</div>
      </section><p className="provider-note">{data.source === "mock-repository" ? "Demo statistics" : data.source} · Updated {new Date(data.updatedAt).toLocaleString()}</p>
    </>}
  </div>;
}
