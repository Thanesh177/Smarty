const MODE_MULTIPLIERS = {
  scenario: { xp: 1, coins: 1 },
  memory: { xp: 1.1, coins: 1.1 },
  quiz: { xp: 1.2, coins: 1.2 },
  survival: { xp: 1.4, coins: 1.4 },
  boss: { xp: 2, coins: 2 },
};

export function calculateReward({
  success,
  mode = 'scenario',
  streak = 0,
}) {
  const safeStreak = Math.max(0, Number(streak) || 0);

  if (!success) {
    return {
      xp: Math.min(5, Math.floor(safeStreak / 2)),
      coins: 1,
    };
  }

  const multiplier =
    MODE_MULTIPLIERS[mode] || MODE_MULTIPLIERS.scenario;

  let xp = 15;
  let coins = 5;

  xp += Math.min(safeStreak * 2, 50);
  coins += Math.min(safeStreak, 25);

  xp = Math.round(xp * multiplier.xp);
  coins = Math.round(coins * multiplier.coins);

  return {
    xp,
    coins,
  }
}