import { useCallback, useMemo, useRef, useState } from "react";
import { calculateReward } from "./rewardEngine";
import { getPlayerStats, getProgressUserId, updatePlayerStats } from "../../../lib/progressStore";
import { useAuth } from "../../../contexts/AuthContext";

const DEFAULT_PLAYER_STATS = {
  totalXP: 0,
  coins: 0,
  wins: 0,
  losses: 0,
};

function normalizeRewardPayload(payload = {}) {
  return {
    success: Boolean(payload.success),
    message: String(payload.message || ""),
    streak: Number.isFinite(Number(payload.streak)) ? Number(payload.streak) : 0,
  };
}

export default function GameShell({
  title = "Game",
  mode = "scenario",
  children,
  onComplete,
}) {
  const { user } = useAuth();
  const progressUserId = useMemo(() => getProgressUserId(user), [user]);
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);

  const finishGame = useCallback(
    (payload = {}) => {
      if (finishedRef.current) return;

      const { success, message, streak } = normalizeRewardPayload(payload);
      const reward = calculateReward({ success, mode, streak });
      const currentStats = { ...DEFAULT_PLAYER_STATS, ...getPlayerStats(progressUserId) };

      const nextStats = {
        ...currentStats,
        totalXP: Number(currentStats.totalXP || 0) + Number(reward.xp || 0),
        coins: Number(currentStats.coins || 0) + Number(reward.coins || 0),
        wins: Number(currentStats.wins || 0) + (success ? 1 : 0),
        losses: Number(currentStats.losses || 0) + (success ? 0 : 1),
        lastPlayedAt: Date.now(),
        lastGameTitle: title,
        lastGameMode: mode,
      };

      try {
        updatePlayerStats(nextStats, progressUserId);
      } catch (error) {
        console.error("Failed to update player stats:", error);
      }

      finishedRef.current = true;
      setFinished(true);

      onComplete?.({
        success,
        xp: Number(reward.xp || 0),
        coins: Number(reward.coins || 0),
        message,
        streak,
        title,
        mode,
        stats: nextStats,
      });
    },
    [mode, onComplete, progressUserId, title]
  );

  if (typeof children !== "function") {
    return null;
  }

  return children({ finishGame, finished });
}
