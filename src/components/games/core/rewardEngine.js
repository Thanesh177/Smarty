export function calculateReward({ success, mode, streak = 0 }) {
  let xp = success ? 10 : 0;
  let coins = success ? 5 : 1;

  if (mode === "boss") {
    xp += success ? 25 : 0;
    coins += success ? 15 : 0;
  }

  if (mode === "survival") {
    xp += streak * 2;
    coins += streak;
  }

  return { xp, coins };
}