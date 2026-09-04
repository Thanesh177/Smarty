import { useMemo, useState } from "react";
import "../GameStyles.css";

const ROUNDS = [
  {
    title: "Science Connections",
    pairs: {
      gravity: "force",
      neuron: "brain",
      habitat: "animal",
    },
  },
  {
    title: "Technology Connections",
    pairs: {
      react: "frontend",
      lambda: "serverless",
      dynamodb: "database",
    },
  },
  {
    title: "Memory Boss",
    pairs: {
      chunking: "memory",
      repetition: "retention",
      pattern: "recognition",
    },
  },
];

export default function PatternMatchGame({ onComplete }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [matches, setMatches] = useState({});
  const [activeLeft, setActiveLeft] = useState(null);
  const [activeRight, setActiveRight] = useState(null);
  const [results, setResults] = useState([]);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const round = ROUNDS[roundIndex];
  const correctPairs = round.pairs;
  const left = Object.keys(correctPairs);
  const right = useMemo(
    () => [...Object.values(correctPairs)].sort(() => Math.random() - 0.5),
    [roundIndex]
  );

  const connectPair = (leftItem, rightItem) => {
    setMatches((previous) => {
      const nextMatches = Object.fromEntries(
        Object.entries(previous).filter(
          ([key, value]) => key !== leftItem && value !== rightItem,
        ),
      );

      return { ...nextMatches, [leftItem]: rightItem };
    });
    setActiveLeft(null);
    setActiveRight(null);
  };

  const chooseLeft = (item) => {
    if (locked) return;

    if (activeRight) {
      connectPair(item, activeRight);
      return;
    }

    setActiveLeft((current) => current === item ? null : item);
  };

  const chooseRight = (item) => {
    if (locked) return;

    if (activeLeft) {
      connectPair(activeLeft, item);
      return;
    }

    setActiveRight((current) => current === item ? null : item);
  };

  const checkMatches = () => {
    const totalMatches = left.length;
    let correctMatches = 0;
    for (const key of left) {
      if (matches[key] && correctPairs[key] === matches[key]) {
        correctMatches++;
      }
    }
    const scorePercent = Math.round((correctMatches / totalMatches) * 100);
    const success = correctMatches >= Math.ceil(totalMatches * 0.67);
    const result = {
      success,
      scorePercent,
      correctMatches,
      totalMatches,
      title: round.title,
    };
    setLocked(true);
    setFeedback(result);
    setResults((prev) => [...prev, result]);
  };

  const nextRound = () => {
    setRoundIndex((i) => i + 1);
    setMatches({});
    setActiveLeft(null);
    setActiveRight(null);
    setLocked(false);
    setFeedback(null);
  };

  const finishGame = () => {
    const allResults = [...results];
    // If current round hasn't been checked, include its result
    if (!locked && feedback == null) {
      // If user hasn't checked, auto-check
      const totalMatches = left.length;
      let correctMatches = 0;
      for (const key of left) {
        if (matches[key] && correctPairs[key] === matches[key]) {
          correctMatches++;
        }
      }
      const scorePercent = Math.round((correctMatches / totalMatches) * 100);
      const success = correctMatches >= Math.ceil(totalMatches * 0.67);
      allResults.push({
        success,
        scorePercent,
        correctMatches,
        totalMatches,
        title: round.title,
      });
    }
    const passedRounds = allResults.filter((r) => r.success).length;
    const averageScore =
      allResults.reduce((sum, r) => sum + r.scorePercent, 0) /
      allResults.length;
    onComplete?.({
      success: passedRounds >= 2,
      xp: passedRounds >= 2 ? 18 : 6,
      score: averageScore,
      message:
        passedRounds >= 2
          ? `Excellent pattern recognition. Passed ${passedRounds}/${ROUNDS.length} rounds.`
          : `Keep training pattern recognition skills.`,
      category: "memory",
      game: "pattern-match",
      rounds: allResults,
    });
  };

  return (
    <div className="brain-game">
      <p className="game-kicker">MATCH GAME</p>
      <h2>Connect related ideas</h2>
      <p className="memory-round-label">
        Round {roundIndex + 1}/{ROUNDS.length} · {round.title}
      </p>
      <p className="game-hint match-instruction">
        Tap one idea from each side. You can start on either side and change a pair before checking.
      </p>

      <div className="match-grid">
        <div className="match-column">
          {left.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={activeLeft === item}
              className={[
                "match-tile",
                activeLeft === item ? "active" : "",
                matches[item] ? "matched" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => chooseLeft(item)}
              disabled={locked}
            >
              <span>{item}</span>
              {matches[item] && <small aria-hidden="true">Connected</small>}
            </button>
          ))}
        </div>

        <div className="match-column">
          {right.map((item) => {
            const matched = Object.values(matches).includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={activeRight === item}
                className={[
                  "match-tile",
                  activeRight === item ? "active" : "",
                  matched ? "matched" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => chooseRight(item)}
                disabled={locked}
              >
                <span>{item}</span>
                {matched && <small aria-hidden="true">Connected</small>}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.success
              ? "memory-result success"
              : "memory-result"
          }
        >
          <strong>
            {feedback.correctMatches}/{feedback.totalMatches} correct
          </strong>
          <span>{feedback.scorePercent}% score</span>
        </div>
      )}

      {!locked && (
        <button
          className="game-main-btn"
          type="button"
          onClick={checkMatches}
          disabled={locked || Object.keys(matches).length !== left.length}
        >
          {Object.keys(matches).length === left.length
            ? "Check Matches"
            : `Connect ${left.length - Object.keys(matches).length} more`}
        </button>
      )}
      {locked && roundIndex < ROUNDS.length - 1 && (
        <button
          className="game-main-btn"
          type="button"
          onClick={nextRound}
        >
          Next Round
        </button>
      )}
      {locked && roundIndex === ROUNDS.length - 1 && (
        <button
          className="game-main-btn"
          type="button"
          onClick={finishGame}
        >
          Finish Game
        </button>
      )}
    </div>
  );
}
