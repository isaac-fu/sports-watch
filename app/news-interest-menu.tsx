"use client";
import { useRef, useState } from "react";

export function NewsInterestMenu({ articleId, onSaved }: { articleId: string; onSaved: () => Promise<void> }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function vote(interest: "interested" | "not-interested") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/news/${encodeURIComponent(articleId)}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interest }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save feedback.");
      setMessage("Preference saved.");
      try { await onSaved(); } catch { setMessage("Preference saved. Refresh to update your recommendations."); }
      if (menu.current) menu.current.open = false;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save feedback."); }
    finally { setBusy(false); }
  }
  return <div className="news-interest"><details ref={menu}><summary aria-label="News preferences" title="News preferences">⋯</summary><div className="news-interest-options"><button disabled={busy} onClick={() => void vote("interested")}>Interested</button><button disabled={busy} onClick={() => void vote("not-interested")}>Not interested</button><small>Shapes your feed; has a stronger effect on Catch Me Up.</small></div></details>{message && <small role="status">{message}</small>}</div>;
}
