"use client";

import { useEffect, useState } from "react";
import type { BoxScoreLine, GameBoxScore } from "@/lib/box-score";

const columns: Array<[keyof BoxScoreLine, string]> = [
  ["minutes", "MIN"], ["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"],
  ["fieldGoals", "FG"], ["threePointers", "3PT"], ["freeThrowsMade", "FT"],
  ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TO"], ["fouls", "PF"], ["plusMinus", "+/−"],
];

export function BoxScoreView({ gameId, onOpenPlayer }: { gameId: string; onOpenPlayer: (id: string) => void }) {
  const [box, setBox] = useState<GameBoxScore | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/box-score`, { signal: controller.signal });
        if (!response.ok) throw new Error("Box scores are temporarily unavailable.");
        const payload = await response.json() as { data: GameBoxScore };
        if (controller.signal.aborted) return;
        setBox(payload.data);
        setError("");
        // Short server cache makes this inexpensive while a game is in progress.
        timer = setTimeout(() => void load(), 60_000);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load box scores.");
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [gameId, attempt]);

  const cells = (line: BoxScoreLine) => columns.map(([key]) => <td key={key}>{line[key] ?? "—"}</td>);
  return <section className="box-score-panel" aria-label="Game box scores">
    <div className="section-heading"><div><p className="overline">GAME STATISTICS</p><h2>Box score</h2></div><button className="text-button" onClick={() => setAttempt((value) => value + 1)}>Refresh</button></div>
    {error ? <p role="alert">{error} Use Refresh to try again.</p> : !box ? <p role="status">Loading box scores…</p> : box.status !== "available" ? <p role="status">{box.status === "pending" ? "Box scores will be available after tip-off." : "Box scores are not available for this game yet. Try again shortly."}</p> : <>
      <p className="panel-copy">FG and 3PT show makes–attempts. FT shows free throws made. Updated {new Date(box.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</p>
      {box.teams.map((team) => <div key={team.teamId} className="box-score-team"><h3>{team.name}</h3><div className="box-score-scroll" tabIndex={0} role="region" aria-label={`${team.name} box score`}><table><caption>{team.name} player statistics</caption><thead><tr><th scope="col">Player</th>{columns.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{team.players.map((player, index) => <tr key={player.playerId ?? `${player.name}-${index}`}><th scope="row">{player.playerId ? <button onClick={() => onOpenPlayer(player.playerId!)}>{player.name}</button> : player.name}{player.comment && <small>{player.comment}</small>}</th>{cells(player)}</tr>)}</tbody>{team.totals && <tfoot><tr><th scope="row">Team totals</th>{cells(team.totals)}</tr></tfoot>}</table></div></div>)}
    </>}
  </section>;
}
