import { useEffect, useMemo, useState } from "react";
import GameShell from "../core/GameShell";
import "../GameStyles.css";

const ROUND_TIME = 12;
const STARTING_CAPITAL = 10000;
const STARTING_LIVES = 3;

const MARKET_SCENARIOS = [
  {
    id: "fake-breakout",
    title: "Fake breakout",
    marketType: "Breakout trap",
    situation: "Price breaks above resistance, but volume is weak and the next candle has a long upper wick.",
    chart: [42, 44, 45, 47, 52, 49],
    signals: ["Weak volume", "Upper wick", "Near resistance"],
    risk: "High",
    correct: "wait",
    impact: {
      buy: -900,
      sell: -350,
      wait: 450,
    },
    lesson: "A breakout without volume confirmation can be a trap. Waiting protects capital.",
  },
  {
    id: "clean-trend",
    title: "Clean trend continuation",
    marketType: "Momentum trend",
    situation: "Price is making higher highs and higher lows with strong volume supporting the move.",
    chart: [31, 34, 33, 37, 40, 44],
    signals: ["Higher highs", "Strong volume", "Trend support"],
    risk: "Medium",
    correct: "buy",
    impact: {
      buy: 850,
      sell: -800,
      wait: 150,
    },
    lesson: "When trend structure and volume agree, following momentum has better probability.",
  },
  {
    id: "panic-drop",
    title: "Panic drop",
    marketType: "News shock",
    situation: "Price drops sharply after negative news. Candles are large, emotional, and unstable.",
    chart: [62, 60, 57, 49, 43, 45],
    signals: ["High volatility", "News reaction", "Unstable candles"],
    risk: "Very high",
    correct: "wait",
    impact: {
      buy: -1000,
      sell: -500,
      wait: 350,
    },
    lesson: "During panic moves, spreads and volatility can punish rushed entries. Let the market stabilize.",
  },
  {
    id: "resistance-rejection",
    title: "Resistance rejection",
    marketType: "Reversal setup",
    situation: "Price tests a major resistance zone and closes below it with strong selling pressure.",
    chart: [48, 51, 54, 56, 55, 50],
    signals: ["Resistance zone", "Rejection candle", "Seller pressure"],
    risk: "Medium",
    correct: "sell",
    impact: {
      buy: -750,
      sell: 800,
      wait: 100,
    },
    lesson: "A strong rejection at resistance can show that sellers are defending the level.",
  },
  {
    id: "low-volume-chop",
    title: "Low-volume chop",
    marketType: "Sideways market",
    situation: "Price is moving sideways with small candles, weak volume, and no clear direction.",
    chart: [40, 41, 39, 41, 40, 39],
    signals: ["Sideways", "Low volume", "No structure"],
    risk: "Medium",
    correct: "wait",
    impact: {
      buy: -300,
      sell: -300,
      wait: 300,
    },
    lesson: "Choppy markets often create false signals. No trade is sometimes the best trade.",
  },
  {
    id: "support-bounce",
    title: "Support bounce",
    marketType: "Bounce setup",
    situation: "Price taps support, rejects lower prices, and buyers step in with increasing volume.",
    chart: [55, 52, 49, 47, 50, 54],
    signals: ["Support zone", "Buyer reaction", "Volume rising"],
    risk: "Medium",
    correct: "buy",
    impact: {
      buy: 700,
      sell: -650,
      wait: 120,
    },
    lesson: "A bounce from support is stronger when buyers appear with volume confirmation.",
  },
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function formatMoney(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function getDecisionQuality(choice, correctChoice) {
  if (choice === correctChoice) return "Excellent";
  if (correctChoice === "wait") return "Too aggressive";
  if (choice === "wait") return "Too cautious";
  return "Wrong direction";
}

function Sparkline({ values = [] }) {
  const width = 220;
  const height = 86;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="market-mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Market price movement">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MarketSurvivalGame({ onComplete }) {
  const rounds = useMemo(() => shuffle(MARKET_SCENARIOS).slice(0, 5), []);

  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [capital, setCapital] = useState(STARTING_CAPITAL);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [locked, setLocked] = useState(false);

  const current = rounds[index];
  const isLastRound = index >= rounds.length - 1;
  const capitalChange = capital - STARTING_CAPITAL;
  const progress = ((index + 1) / rounds.length) * 100;

  useEffect(() => {
    if (locked || feedback) return undefined;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          resolveDecision("timeout");
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, locked, feedback]);

  const resolveDecision = (choice) => {
    if (locked || feedback) return;

    const timedOut = choice === "timeout";
    const isCorrect = !timedOut && choice === current.correct;
    const impact = timedOut ? -250 : current.impact[choice] || 0;
    const nextCapital = Math.max(0, capital + impact);
    const nextLives = isCorrect ? lives : Math.max(0, lives - 1);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextBestStreak = Math.max(bestStreak, nextStreak);

    const result = {
      roundId: current.id,
      title: current.title,
      marketType: current.marketType,
      choice,
      correctChoice: current.correct,
      success: isCorrect,
      timedOut,
      impact,
      capitalAfter: nextCapital,
      livesAfter: nextLives,
      lesson: current.lesson,
      quality: timedOut ? "Timed out" : getDecisionQuality(choice, current.correct),
    };

    setSelectedChoice(choice);
    setCapital(nextCapital);
    setLives(nextLives);
    setStreak(nextStreak);
    setBestStreak(nextBestStreak);
    setLocked(true);
    setFeedback(result);
    setResults((existing) => [...existing, result]);
  };

  const goNext = () => {
    setIndex((prev) => prev + 1);
    setTimeLeft(ROUND_TIME);
    setSelectedChoice("");
    setFeedback(null);
    setLocked(false);
  };

  const completeGame = (finishGame) => {
    const finalCapital = capital;
    const correctDecisions = results.filter((result) => result.success).length;
    const accuracy = Math.round((correctDecisions / rounds.length) * 100);
    const survived = lives > 0 && finalCapital >= STARTING_CAPITAL * 0.85 && correctDecisions >= 3;

    finishGame({
      success: survived,
      streak: bestStreak,
      score: accuracy,
      message: survived
        ? `You survived with ${accuracy}% accuracy and ${formatMoney(finalCapital - STARTING_CAPITAL)} P/L.`
        : `You finished with ${accuracy}% accuracy and ${formatMoney(finalCapital - STARTING_CAPITAL)} P/L. Review risk control and patience.`,
      category: "trading",
      game: "market-survival",
      totalCorrect: correctDecisions,
      totalRounds: rounds.length,
      finalCapital,
      profitLoss: finalCapital - STARTING_CAPITAL,
      livesRemaining: lives,
      results,
    });
  };

  return (
    <GameShell title="Market Survival" mode="survival" onComplete={onComplete}>
      {({ finishGame }) => (
        <div className="brain-game serious-game market-survival-game">
          <div className="memory-game-top survival-status-row">
            <div>
              <p className="game-kicker">TRADING SURVIVAL</p>
              <h2>{current.title}</h2>
              <p className="memory-round-label">
                Round {index + 1}/{rounds.length} · {current.marketType}
              </p>
            </div>

            <span className={timeLeft <= 3 ? "memory-timer danger" : "memory-timer"}>
              {timeLeft}s
            </span>
          </div>

          <div className="memory-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="market-survival-dashboard">
            <div className="market-stat-card">
              <span>Capital</span>
              <strong>${capital.toLocaleString()}</strong>
              <small className={capitalChange >= 0 ? "positive" : "negative"}>{formatMoney(capitalChange)} P/L</small>
            </div>

            <div className="market-stat-card">
              <span>Lives</span>
              <strong>{"♥".repeat(lives)}{"♡".repeat(STARTING_LIVES - lives)}</strong>
              <small>Risk mistakes left</small>
            </div>

            <div className="market-stat-card">
              <span>Best streak</span>
              <strong>{bestStreak}</strong>
              <small>Discipline chain</small>
            </div>
          </div>

          <div className="market-scenario-card">
            <Sparkline values={current.chart} />

            <div>
              <p className="game-hint">{current.situation}</p>

              <div className="market-signal-row">
                {current.signals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
                <span className="risk-pill">Risk: {current.risk}</span>
              </div>
            </div>
          </div>

          <div className="decision-row market-decision-row">
            {["buy", "sell", "wait"].map((choice) => {
              const isSelected = selectedChoice === choice;
              const isCorrectChoice = feedback && choice === current.correct;
              const isWrongChoice = feedback && isSelected && choice !== current.correct;

              return (
                <button
                  key={choice}
                  type="button"
                  className={[
                    "decision-btn",
                    isSelected ? "selected" : "",
                    isCorrectChoice ? "correct" : "",
                    isWrongChoice ? "wrong" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={isSelected}
                  disabled={locked}
                  onClick={() => resolveDecision(choice)}
                >
                  <strong>{choice.toUpperCase()}</strong>
                  <small>
                    {choice === "buy" ? "Enter long" : choice === "sell" ? "Enter short" : "Protect capital"}
                  </small>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={feedback.success ? "memory-result success" : "memory-result"}>
              <strong>
                {feedback.success ? "Good trade" : feedback.timedOut ? "Time ran out" : feedback.quality}
              </strong>
              <span>
                {formatMoney(feedback.impact)} impact · Correct move: {feedback.correctChoice.toUpperCase()}. {feedback.lesson}
              </span>
            </div>
          )}

          {feedback && (
            <div className="memory-game-actions">
              {isLastRound || lives <= 0 ? (
                <button
                  type="button"
                  className="game-main-btn"
                  onClick={() => completeGame(finishGame)}
                >
                  Finish Game
                </button>
              ) : (
                <button
                  type="button"
                  className="game-main-btn"
                  onClick={goNext}
                >
                  Next Market
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </GameShell>
  );
}