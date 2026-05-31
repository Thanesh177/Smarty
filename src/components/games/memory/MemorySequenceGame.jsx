import { useEffect, useMemo, useState } from "react";
import "../GameStyles.css";

const ITEM_POOL = [
  "Apple",
  "Train",
  "Ocean",
  "Tiger",
  "Moon",
  "Chair",
  "River",
  "Clock",
  "Key",
  "Book",
  "Bridge",
  "Rocket",
  "Camera",
  "Guitar",
  "Compass",
  "Flower",
];

const DISTRACTORS = [
  "Car",
  "Tree",
  "Phone",
  "Glass",
  "Wallet",
  "Cloud",
  "Robot",
  "Door",
  "Bottle",
  "Planet",
];

const ROUNDS = [
  {
    id: "starter",
    label: "Starter recall",
    itemCount: 5,
    distractorCount: 3,
    studySeconds: 5,
    requiredCorrect: 4,
  },
  {
    id: "focus",
    label: "Focus recall",
    itemCount: 6,
    distractorCount: 4,
    studySeconds: 4,
    requiredCorrect: 5,
  },
  {
    id: "speed",
    label: "Speed recall",
    itemCount: 7,
    distractorCount: 5,
    studySeconds: 4,
    requiredCorrect: 6,
  },
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildRound(roundIndex) {
  const config = ROUNDS[roundIndex] || ROUNDS[0];
  const items = shuffle(ITEM_POOL).slice(0, config.itemCount);
  const options = shuffle([
    ...items,
    ...shuffle(DISTRACTORS.filter((item) => !items.includes(item))).slice(
      0,
      config.distractorCount
    ),
  ]);

  return {
    ...config,
    items,
    options,
  };
}

export default function MemoryRetentionGame({ onComplete }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => buildRound(0));
  const [phase, setPhase] = useState("study");
  const [selected, setSelected] = useState([]);
  const [timeLeft, setTimeLeft] = useState(round.studySeconds);
  const [feedback, setFeedback] = useState(null);
  const [locked, setLocked] = useState(false);
  const [roundResults, setRoundResults] = useState([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isLastRound = roundIndex >= ROUNDS.length - 1;

  useEffect(() => {
    if (phase !== "study") return undefined;

    setTimeLeft(round.studySeconds);

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setPhase("recall");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, round.studySeconds]);

  const toggleSelected = (item) => {
    if (locked || phase !== "recall") return;

    setSelected((prev) => {
      if (prev.includes(item)) {
        return prev.filter((x) => x !== item);
      }

      if (prev.length >= round.items.length) {
        return prev;
      }

      return [...prev, item];
    });
  };

  const evaluateRound = () => {
    const correctItems = selected.filter((item) => round.items.includes(item));
    const wrongItems = selected.filter((item) => !round.items.includes(item));
    const missedItems = round.items.filter((item) => !selected.includes(item));
    const correct = correctItems.length;
    const wrong = wrongItems.length;
    const rawScore = Math.max(0, correct - wrong);
    const score = Math.round((rawScore / round.items.length) * 100);
    const success = correct >= round.requiredCorrect && wrong <= 1;

    return {
      success,
      score,
      correct,
      wrong,
      correctItems,
      wrongItems,
      missedItems,
      selectedItems: selected,
      targetItems: round.items,
      roundId: round.id,
      roundLabel: round.label,
    };
  };

  const submitRound = () => {
    if (locked || selected.length === 0) return;

    const result = evaluateRound();
    setLocked(true);
    setFeedback(result);
    setRoundResults((prev) => [...prev, result]);
  };

  const nextRound = () => {
    const nextRoundIndex = roundIndex + 1;
    const next = buildRound(nextRoundIndex);

    setRoundIndex(nextRoundIndex);
    setRound(next);
    setPhase("study");
    setSelected([]);
    setFeedback(null);
    setLocked(false);
    setTimeLeft(next.studySeconds);
  };

  const retryRound = () => {
    const fresh = buildRound(roundIndex);

    setRound(fresh);
    setPhase("study");
    setSelected([]);
    setFeedback(null);
    setLocked(false);
    setTimeLeft(fresh.studySeconds);
  };

  const finishGame = () => {
    const results = roundResults.length ? roundResults : [evaluateRound()];
    const totalScore = Math.round(
      results.reduce((sum, item) => sum + item.score, 0) / results.length
    );
    const successfulRounds = results.filter((item) => item.success).length;
    const success = successfulRounds >= 2;
    const totalCorrect = results.reduce((sum, item) => sum + item.correct, 0);
    const totalWrong = results.reduce((sum, item) => sum + item.wrong, 0);

    onComplete?.({
      success,
      xp: success ? 16 : 5,
      score: totalScore,
      message: success
        ? `Strong recall. You passed ${successfulRounds}/${ROUNDS.length} rounds.`
        : `You passed ${successfulRounds}/${ROUNDS.length} rounds. Try chunking items into a story before recall.`,
      category: "memory",
      game: "memory-sequence",
      rounds: results,
      successfulRounds,
      totalRounds: ROUNDS.length,
      totalCorrect,
      totalWrong,
    });
  };

  return (
    <div className="brain-game serious-game memory-sequence-game">
      <div className="memory-game-top">
        <div>
          <p className="game-kicker">MEMORY TRAINING</p>
          <h2>{phase === "study" ? "Memorize these" : "Select what you remember"}</h2>
          <p className="memory-round-label">
            Round {roundIndex + 1}/{ROUNDS.length} · {round.label}
          </p>
        </div>

        <span className={phase === "study" ? "memory-timer" : "memory-timer recall"}>
          {phase === "study" ? `${timeLeft}s` : `${selected.length}/${round.items.length}`}
        </span>
      </div>

      <div className="memory-progress-track" aria-hidden="true">
        <span style={{ width: `${((roundIndex + 1) / ROUNDS.length) * 100}%` }} />
      </div>

      <p className="game-hint">
        {phase === "study"
          ? "Read quickly and group the items into a mental story."
          : `Choose only the ${round.items.length} items you saw. Wrong choices reduce your score.`}
      </p>

      {phase === "study" && (
        <div className="memory-palace-grid">
          {round.items.map((item, index) => (
            <div
              key={item}
              className="memory-tile study"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {phase === "recall" && (
        <>
          <div className="decision-row memory-choice-grid">
            {round.options.map((item, index) => {
              const isSelected = selectedSet.has(item);
              const isCorrect = feedback?.correctItems.includes(item);
              const isWrong = feedback?.wrongItems.includes(item);
              const isMissed = feedback?.missedItems.includes(item);

              return (
                <button
                  type="button"
                  key={item}
                  className={[
                    "decision-btn",
                    isSelected ? "selected" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                    isMissed ? "missed" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={isSelected}
                  disabled={locked}
                  style={{ animationDelay: `${index * 35}ms` }}
                  onClick={() => toggleSelected(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <p className="game-feedback">
            {feedback
              ? `${feedback.correct} correct · ${feedback.wrong} wrong · ${feedback.score}% score`
              : `${selected.length} selected · pick carefully.`}
          </p>

          {feedback && (
            <div className={feedback.success ? "memory-result success" : "memory-result"}>
              <strong>{feedback.success ? "Round cleared" : "Practice round"}</strong>
              <span>
                {feedback.success
                  ? "Your recall accuracy was strong."
                  : "Try chunking items into smaller groups before recall."}
              </span>
            </div>
          )}

          <div className="memory-game-actions">
            {!feedback ? (
              <button
                type="button"
                className="game-main-btn"
                disabled={selected.length === 0 || locked}
                onClick={submitRound}
              >
                Submit
              </button>
            ) : isLastRound ? (
              <button
                type="button"
                className="game-main-btn"
                onClick={finishGame}
              >
                Finish Game
              </button>
            ) : (
              <button
                type="button"
                className="game-main-btn"
                onClick={nextRound}
              >
                Next Round
              </button>
            )}

            {feedback && !isLastRound && (
              <button
                type="button"
                className="secondary-btn"
                onClick={retryRound}
              >
                Retry round
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}