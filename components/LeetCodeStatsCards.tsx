"use client";

import { useEffect, useState } from "react";

type Stats = {
  currentStreak?: number;
  longestStreak?: number;
  totalSolved?: number;
  totalActiveDays?: number;
};

export default function LeetCodeStatsCards({ connected }: { connected: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    fetch("/api/leetcode/stats", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load stats.");
        if (!cancelled) setStats(payload?.stats || null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [connected]);

  const current = connected ? (stats?.currentStreak ?? (failed ? "—" : "…")) : "—";
  const longest = connected ? (stats?.longestStreak ?? (failed ? "—" : "…")) : "—";
  const solved = connected ? (stats?.totalSolved ?? (failed ? "—" : "…")) : "—";

  return (
    <>
      <article className="stat-card accent">
        <div className="stat-icon">🔥</div>
        <div>
          <span>LeetCode streak</span>
          <strong>{current}</strong>
          <small>{!connected ? "connect LeetCode" : failed ? "unable to load account streak" : stats ? "official daily streak" : "loading from LeetCode"}</small>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon">🏆</div>
        <div>
          <span>Max streak</span>
          <strong>{longest}</strong>
          <small>{!connected ? "real account stat" : failed ? "try refreshing later" : stats ? "LeetCode profile calendar" : "loading"}</small>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon">✓</div>
        <div>
          <span>Problems solved</span>
          <strong>{solved}</strong>
          <small>{stats ? `${stats.totalActiveDays ?? 0} active days` : connected ? (failed ? "LeetCode account" : "loading") : "LeetCode account"}</small>
        </div>
      </article>
    </>
  );
}
