import { useEffect, useMemo, useState } from "react";
import "../GameStyles.css";

const WORD_POOL = [
  "river",
  "planet",
  "mirror",
  "forest",
  "signal",
  "window",
  "engine",
  "flower",
  "castle",
  "camera",
  "rocket",
  "garden",
  "bridge",
  "pencil",
  "thunder",
  "island",
  "market",
  "silver",
  "compass",
  "lantern",
];

const DISTRACTORS = [
  "cloud",
  "wallet",
  "dragon",
  "button",
  "helmet",
  "blanket",
  "station",
  "circle",
  "battery",
  "library",
  "hammer",
  "cookie",
];

const ROUNDS = [
  {
    id: "starter",
    label: "Starter recall",
    wordCount: 5,
    distractorCount: 3,
    studySeconds: 5,
    requiredCorrect: 4,
  },
  {
    id: "focus",
    label: "Focus recall",
    wordCount: 6,
    distractorCount: 4,
    studySeconds: 5,
    requiredCorrect: 5,
  },
  {
    id: "boss",
    label: "Boss recall",
    wordCount: 7,
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
  const words = shuffle(WORD_POOL).slice(0, config.wordCount);
  const choices = shuffle([
    ...words,
    ...shuffle(DISTRACTORS.filter((word) => !words.includes(word))).slice(
      0,
      config.distractorCount
    ),
  ]);

  return {
    ...config,
    words,
    choices,
  };
}

export default function WordRecallGame({ onComplete }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => buildRound(0));
  const [phase, setPhase] = useState("show");
  const [selected, setSelected] = useState([]);
  const [timeLeft, setTimeLeft] = useState(round.studySeconds);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [roundResults, setRoundResults] = useState([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isLastRound = roundIndex >= ROUNDS.length - 1;

  useEffect(() => {
    if (phase !== "show") return undefined;

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

  const toggle = (word) => {
    if (locked || phase !== "recall") return;

    setSelected((prev) => {
      if (prev.includes(word)) {
        return prev.filter((item) => item !== word);
      }

      if (prev.length >= round.words.length) {
        return prev;
      }

      return [...prev, word];
    });
  };

  const evaluateRound = () => {
    const correctWords = selected.filter((word) => round.words.includes(word));
    const wrongWords = selected.filter((word) => !round.words.includes(word));
    const missedWords = round.words.filter((word) => !selected.includes(word));
    const correct = correctWords.length;
    const wrong = wrongWords.length;
    const rawScore = Math.max(0, correct - wrong);
    const score = Math.round((rawScore / round.words.length) * 100);
    const success = correct >= round.requiredCorrect && wrong <= 1;

    return {
      success,
      score,
      correct,
      wrong,
      correctWords,
      wrongWords,
      missedWords,
      selectedWords: selected,
      targetWords: round.words,
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
    setPhase("show");
    setSelected([]);
    setLocked(false);
    setFeedback(null);
    setTimeLeft(next.studySeconds);
  };

  const retryRound = () => {
    const fresh = buildRound(roundIndex);

    setRound(fresh);
    setPhase("show");
    setSelected([]);
    setLocked(false);
    setFeedback(null);
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
        ? `Strong word recall. You passed ${successfulRounds}/${ROUNDS.length} rounds.`
        : `You passed ${successfulRounds}/${ROUNDS.length} rounds. Try grouping words into a short mental story.`,
      category: "memory",
      game: "word-recall",
      rounds: results,
      successfulRounds,
      totalRounds: ROUNDS.length,
      totalCorrect,
      totalWrong,
    });
  };

  return (
    <div className="brain-game serious-game word-recall-game">
      <div className="memory-game-top">
        <div>
          <p className="game-kicker">RECALL GAME</p>
          <h2>{phase === "show" ? "Memorize these words" : "Pick the words you saw"}</h2>
          <p className="memory-round-label">
            Round {roundIndex + 1}/{ROUNDS.length} · {round.label}
          </p>
        </div>

        <span className={phase === "show" ? "memory-timer" : "memory-timer recall"}>
          {phase === "show" ? `${timeLeft}s` : `${selected.length}/${round.words.length}`}
        </span>
      </div>

      <div className="memory-progress-track" aria-hidden="true">
        <span style={{ width: `${((roundIndex + 1) / ROUNDS.length) * 100}%` }} />
      </div>

      <p className="game-hint">
        {phase === "show"
          ? "Read the words and group them into a quick mental image."
          : `Select only the ${round.words.length} words you saw. Wrong picks lower your score.`}
      </p>

      {phase === "show" ? (
        <div className="word-list memory-word-grid">
          {round.words.map((word, index) => (
            <span
              key={word}
              className="word-chip study"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              {word}
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="word-list memory-word-grid">
            {round.choices.map((word, index) => {
              const isSelected = selectedSet.has(word);
              const isCorrect = feedback?.correctWords.includes(word);
              const isWrong = feedback?.wrongWords.includes(word);
              const isMissed = feedback?.missedWords.includes(word);

              return (
                <button
                  key={word}
                  type="button"
                  className={[
                    "word-chip",
                    isSelected ? "active" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                    isMissed ? "missed" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={isSelected}
                  disabled={locked}
                  style={{ animationDelay: `${index * 35}ms` }}
                  onClick={() => toggle(word)}
                >
                  {word}
                </button>
              );
            })}
          </div>

          <p className="game-feedback">
            {feedback
              ? `${feedback.correct} correct · ${feedback.wrong} wrong · ${feedback.score}% score`
              : `${selected.length} selected · choose carefully.`}
          </p>

          {feedback && (
            <div className={feedback.success ? "memory-result success" : "memory-result"}>
              <strong>{feedback.success ? "Round cleared" : "Keep training"}</strong>
              <span>
                {feedback.success
                  ? "Your word recall was accurate."
                  : "Try making a short story that contains every word."}
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
                Submit Recall
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