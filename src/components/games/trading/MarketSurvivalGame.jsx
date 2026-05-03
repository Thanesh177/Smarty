import { useEffect, useMemo, useRef, useState } from "react";
import GameShell from "../core/GameShell";
import "../GameStyles.css";

const ROUND_TIME = 8;

const ROUNDS = [
  {
    title: "Fake breakout",
    situation: "Price jumps suddenly but volume is weak.",
    correct: "wait",
    lesson: "Fake breakouts trap impatient traders. Waiting protects capital.",
  },
  {
    title: "Clean trend",
    situation: "Higher highs, strong green candles, clear momentum.",
    correct: "buy",
    lesson: "Trend-following works better when momentum and structure agree.",
  },
  {
    title: "Panic drop",
    situation: "Price falls sharply after bad news.",
    correct: "wait",
    lesson: "Panic markets are dangerous. Let volatility settle first.",
  },
];

export default function MarketSurvivalGame({ onComplete }) {
  const rounds = useMemo(() => [...ROUNDS].sort(() => Math.random() - 0.5), []);

  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [locked, setLocked] = useState(false);

  const finishRef = useRef(null);
  const current = rounds[index];

  useEffect(() => {
    if (locked) return undefined;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setLocked(true);

          if (finishRef.current) {
            finishRef.current({
              success: false,
              streak,
              message: "Time ran out. In fast markets, hesitation can be costly.",
            });
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [index, locked, streak]);

  return (
    <GameShell title="Market Survival" mode="survival" onComplete={onComplete}>
      {({ finishGame }) => {
        finishRef.current = finishGame;

        return (
          <div className="brain-game serious-game market-survival-game">
            <p className="game-kicker">SURVIVAL MODE</p>
            <h2>{current.title}</h2>
            <p className="game-hint">{current.situation}</p>

            <div className="survival-timer">
              <span>⏱ Time</span>
              <strong>{timeLeft}s</strong>
            </div>

            <div className="decision-row">
              {["buy", "sell", "wait"].map((choice) => (
                <button
                  key={choice}
                  className="decision-btn"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;

                    const correct = choice === current.correct;
                    const nextStreak = correct ? streak + 1 : 0;

                    if (index + 1 >= rounds.length) {
                      setLocked(true);
                      finishGame({
                        success: nextStreak >= 2,
                        streak: nextStreak,
                        message:
                          nextStreak >= 2
                            ? "You survived the market. Strong discipline."
                            : `${current.lesson} Try again with better patience.`,
                      });
                      return;
                    }

                    setStreak(nextStreak);
                    setIndex((prev) => prev + 1);
                    setTimeLeft(ROUND_TIME);
                  }}
                >
                  {choice.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="survival-status">
              <span>🔥 Streak</span>
              <strong>
                {streak}/{rounds.length}
              </strong>
            </div>
          </div>
        );
      }}
    </GameShell>
  );
}