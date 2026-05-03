import { useState } from "react";
import { calculateReward } from "./rewardEngine";
import { updatePlayerStats } from "../../../lib/progressStore";

export default function GameShell({ title, mode = "scenario", children, onComplete }) {
  const [finished, setFinished] = useState(false);

  const finishGame = ({ success, message, streak = 0 }) => {
    if (finished) return;

    const reward = calculateReward({ success, mode, streak });

    updatePlayerStats({
      totalXP: (JSON.parse(localStorage.getItem("smarty-player-stats") || "{}").totalXP || 0) + reward.xp,
      coins: (JSON.parse(localStorage.getItem("smarty-player-stats") || "{}").coins || 0) + reward.coins,
      wins: (JSON.parse(localStorage.getItem("smarty-player-stats") || "{}").wins || 0) + (success ? 1 : 0),
      losses: (JSON.parse(localStorage.getItem("smarty-player-stats") || "{}").losses || 0) + (success ? 0 : 1),
    });

    setFinished(true);

    onComplete({
      success,
      xp: reward.xp,
      coins: reward.coins,
      message,
    });
  };

  return children({ finishGame, finished });
}