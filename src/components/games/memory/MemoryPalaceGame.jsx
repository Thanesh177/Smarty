import { useEffect, useMemo, useState } from "react";
import "../GameStyles.css";

const ITEM_POOL = [
  "Key",
  "Book",
  "Apple",
  "Clock",
  "River",
  "Train",
  "Ocean",
  "Tiger",
  "Moon",
  "Chair",
  "Car",
  "Tree",
  "Phone",
  "Bottle",
  "Laptop",
  "Bridge",
  "Compass",
  "Candle",
  "Guitar",
  "Camera",
  "Helmet",
  "Rocket",
  "Flower",
  "Pencil",
];

const DISTRACTORS = [
  "Glass",
  "Cloud",
  "Wallet",
  "Planet",
  "Door",
  "Mirror",
  "Spoon",
  "Castle",
  "Basket",
  "Lamp",
  "Robot",
  "Feather",
];

const ROUNDS = [
  {
    id: "warmup",
    label: "Warm-up",
    itemCount: 5,
    distractorCount: 4,
    studySeconds: 7,
    requiredCorrect: 4,
    allowedWrong: 1,
  },
  {
    id: "focus",
    label: "Focus round",
    itemCount: 6,
    distractorCount: 5,
    studySeconds: 6,
    requiredCorrect: 5,
    allowedWrong: 1,
  },
  {
    id: "boss",
    label: "Boss round",
    itemCount: 7,
    distractorCount: 6,
    studySeconds: 5,
    requiredCorrect: 6,
    allowedWrong: 1,
  },
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildRound(roundIndex) {
  const config = ROUNDS[roundIndex] || ROUNDS[0];
  const items = shuffle(ITEM_POOL).slice(0, config.itemCount);
  const recallOptions = shuffle([
    ...items,
    ...shuffle(DISTRACTORS.filter((item) => !items.includes(item))).slice(0, config.distractorCount),
  ]);

  return {
    ...config,
    items,
    recallOptions,
  };
}

export default function MemoryPalaceGame({ onComplete }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => buildRound(0));
  const [phase, setPhase] = useState("study");
  const [selected, setSelected] = useState([]);
  const [timeLeft, setTimeLeft] = useState(round.studySeconds);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [roundScores, setRoundScores] = useState([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isLastRound = roundIndex >= ROUNDS.length - 1;

  useEffect(() => {
    if (phase !== "study") return undefined;

    setTimeLeft(round.studySeconds);

    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setPhase("recall");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, round.studySeconds]);

  const toggle = (item) => {
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
    const success = correct >= round.requiredCorrect && wrong <= round.allowedWrong;

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

  const finish = () => {
    if (locked || selected.length === 0) return;

    const result = evaluateRound();
    const nextScores = [...roundScores, result];

    setLocked(true);
    setFeedback(result);
    setRoundScores(nextScores);
  };

  const moveToNextRound = () => {
    const nextRoundIndex = roundIndex + 1;
    const nextRound = buildRound(nextRoundIndex);

    setRoundIndex(nextRoundIndex);
    setRound(nextRound);
    setPhase("study");
    setSelected([]);
    setLocked(false);
    setFeedback(null);
    setTimeLeft(nextRound.studySeconds);
  };

  const completeGame = () => {
    const results = roundScores.length ? roundScores : [evaluateRound()];
    const totalScore = Math.round(
      results.reduce((sum, item) => sum + item.score, 0) / results.length
    );
    const successfulRounds = results.filter((item) => item.success).length;
    const success = successfulRounds >= 2;
    const totalCorrect = results.reduce((sum, item) => sum + item.correct, 0);
    const totalWrong = results.reduce((sum, item) => sum + item.wrong, 0);

    onComplete?.({
      success,
      xp: success ? 18 : 6,
      score: totalScore,
      message: success
        ? `Memory palace cleared. You passed ${successfulRounds}/${ROUNDS.length} rounds.`
        : `Good practice. You passed ${successfulRounds}/${ROUNDS.length} rounds. Try linking each item to a vivid image or room location.`,
      category: "memory",
      game: "memory-palace",
      rounds: results,
      successfulRounds,
      totalRounds: ROUNDS.length,
      totalCorrect,
      totalWrong,
    });
  };

  const restartRound = () => {
    const freshRound = buildRound(roundIndex);

    setRound(freshRound);
    setPhase("study");
    setSelected([]);
    setLocked(false);
    setFeedback(null);
    setTimeLeft(freshRound.studySeconds);
  };

  return (
    <div className="brain-game serious-game memory-palace-game">
      <div className="memory-game-top">
        <div>
          <p className="game-kicker">MEMORY PALACE</p>
          <h2>{phase === "study" ? "Memorize the room" : "Select what you remember"}</h2>
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
          ? "Build a quick mental story using these objects before time runs out."
          : `Pick only the ${round.items.length} objects you saw. Wrong picks reduce your score.`}
      </p>

      {phase === "study" ? (
        <div className="memory-palace-grid">
          {round.items.map((item, index) => (
            <div key={item} className="memory-tile study" style={{ animationDelay: `${index * 70}ms` }}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="memory-palace-grid">
            {round.recallOptions.map((item, index) => {
              const isSelected = selectedSet.has(item);
              const isCorrect = feedback?.correctItems.includes(item);
              const isWrong = feedback?.wrongItems.includes(item);
              const isMissed = feedback?.missedItems.includes(item);

              return (
                <button
                  key={item}
                  type="button"
                  className={[
                    "memory-tile",
                    isSelected ? "selected" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                    isMissed ? "missed" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={isSelected}
                  disabled={locked}
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => toggle(item)}
                >
                  <span>{item}</span>
                </button>
              );
            })}
          </div>

          <p className="game-feedback">
            {feedback
              ? `${feedback.correct} correct · ${feedback.wrong} wrong · ${feedback.score}% score`
              : `${selected.length} selected · aim for accuracy, not guessing.`}
          </p>

          {feedback && (
            <div className={feedback.success ? "memory-result success" : "memory-result"}>
              <strong>{feedback.success ? "Round cleared" : "Keep training"}</strong>
              <span>
                {feedback.success
                  ? "Your recall accuracy was strong."
                  : "Try creating a stronger story between the objects."}
              </span>
            </div>
          )}

          <div className="memory-game-actions">
            {!feedback ? (
              <button
                type="button"
                className="game-main-btn"
                disabled={selected.length === 0 || locked}
                onClick={finish}
              >
                Submit Recall
              </button>
            ) : isLastRound ? (
              <button
                type="button"
                className="game-main-btn"
                onClick={completeGame}
              >
                Finish Game
              </button>
            ) : (
              <button
                type="button"
                className="game-main-btn"
                onClick={moveToNextRound}
              >
                Next Round
              </button>
            )}

            {feedback && !isLastRound && (
              <button
                type="button"
                className="secondary-btn"
                onClick={restartRound}
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