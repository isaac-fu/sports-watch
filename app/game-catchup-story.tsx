"use client";
import type { CatchUpMoment } from "@/lib/models";
import "./game-catchup-story.css";

export function GameCatchUpStory({ moment, gameId, onOpen }: { moment: CatchUpMoment; gameId: string; onOpen: (id: string) => void }) {
  const sections = moment.gameHighlights;
  return <div className="game-catchup-story" role="link" tabIndex={0} aria-label={`Open box score: ${moment.title}`} onClick={() => onOpen(gameId)} onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(gameId); }
  }}>
    <p className="game-story-status">{moment.context ?? "Game recap"}</p>
    <h3>{moment.title}</h3>
    {sections ? <>
      {sections.standouts.length > 0 && <section className="game-story-standouts"><h4>Standout performances</h4><ul>{sections.standouts.map((point, index) => <li key={index}><strong>{point.title}</strong><p>{point.detail}</p></li>)}</ul></section>}
      {sections.leaders.length > 0 && <section className="game-story-leaders"><h4>Statistical leaders</h4><ul>{sections.leaders.map((point, index) => <li key={index}><strong>{point.title}</strong><p>{point.detail}</p></li>)}</ul></section>}
      {!sections.standouts.length && !sections.leaders.length && <p className="slide-detail">Player highlights are unavailable. Open the box score to check the latest statistics.</p>}
    </> : <p className="slide-detail">{moment.detail}</p>}
    <span className="game-story-box-link">View full box score →</span>
  </div>;
}
