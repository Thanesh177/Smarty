import { useEffect, useMemo, useRef, useState } from "react";
import "../GameStyles.css";

const TILE_COUNT = 4;
const MAX_LEVEL = 6;
const TILE_FLASH_MS = 520;
const TILE_GAP_MS = 180;

function buildSequence(level) {
  return Array.from({ length: level }, () => Math.floor(Math.random() * TILE_COUNT));
}

export default function SequenceGame({ onComplete }) {
  const [level, setLevel] = useState(3);
  const [sequence, setSequence] = useState(() => buildSequence(3));
  const [userInput, setUserInput] = useState([]);
  const [phase, setPhase] = useState("show");
  const [activeTile, setActiveTile] = useState(null);
  const [feedback, setFeedback] = useState("Watch the glowing tiles.");
  const [locked, setLocked] = useState(false);
  const timersRef = useRef([]);

  const progressPercent = useMemo(
    () => Math.round((userInput.length / sequence.length) * 100),
    [sequence.length, userInput.length]
  );

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const startRound = (nextLevel = level) => {
    clearTimers();

    const nextSequence = buildSequence(nextLevel);
    setLevel(nextLevel);
    setSequence(nextSequence);
    setUserInput([]);
    setPhase("show");
    setActiveTile(null);
    setFeedback("Watch the glowing tiles.");
    setLocked(true);

    nextSequence.forEach((tile, index) => {
      const startTimer = window.setTimeout(() => {
        setActiveTile(tile);
      }, index * (TILE_FLASH_MS + TILE_GAP_MS));

      const stopTimer = window.setTimeout(() => {
        setActiveTile(null);
      }, index * (TILE_FLASH_MS + TILE_GAP_MS) + TILE_FLASH_MS);

      timersRef.current.push(startTimer, stopTimer);
    });

    const inputTimer = window.setTimeout(() => {
      setPhase("input");
      setLocked(false);
      setFeedback("Repeat the pattern in the same order.");
    }, nextSequence.length * (TILE_FLASH_MS + TILE_GAP_MS));

    timersRef.current.push(inputTimer);
  };

  useEffect(() => {
    startRound(3);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishGame = ({ success, score, message }) => {
    clearTimers();
    setLocked(true);

    window.setTimeout(() => {
      onComplete?.({
        success,
        xp: success ? 18 : Math.max(3, score * 2),
        score,
        message,
        category: "memory",
        game: "sequence-training",
        level,
        sequenceLength: sequence.length,
      });
    }, 550);
  };

  const handleClick = (num) => {
    if (locked || phase !== "input") return;

    const updated = [...userInput, num];
    const expected = sequence[updated.length - 1];

    setUserInput(updated);
    setActiveTile(num);

    const flashTimer = window.setTimeout(() => {
      setActiveTile(null);
    }, 180);
    timersRef.current.push(flashTimer);

    if (expected !== num) {
      setPhase("result");
      setFeedback(`Wrong tile. You reached ${updated.length - 1}/${sequence.length}.`);
      finishGame({
        success: false,
        score: Math.max(0, updated.length - 1),
        message: `Sequence broken at step ${updated.length}. Train by chunking the pattern into smaller groups.`,
      });
      return;
    }

    if (updated.length === sequence.length) {
      if (level >= MAX_LEVEL) {
        setPhase("result");
        setFeedback("Perfect sequence. Boss level cleared.");
        finishGame({
          success: true,
          score: 100,
          message: `Excellent sequence memory. You cleared level ${level}.`,
        });
        return;
      }

      setLocked(true);
      setPhase("result");
      setFeedback(`Level ${level} cleared. Preparing next sequence...`);

      const nextTimer = window.setTimeout(() => {
        startRound(level + 1);
      }, 900);
      timersRef.current.push(nextTimer);
    }
  };

  const replaySequence = () => {
    if (phase === "show") return;
    startRound(level);
  };

  return (
    <div className="brain-game serious-game sequence-game">
      <div className="memory-game-top">
        <div>
          <p className="game-kicker">SEQUENCE TRAINING</p>
          <h2>Remember the pattern</h2>
          <p className="memory-round-label">
            Level {level}/{MAX_LEVEL} · {sequence.length} tiles
          </p>
        </div>

        <span className={phase === "show" ? "memory-timer" : "memory-timer recall"}>
          {phase === "show" ? "Watch" : `${userInput.length}/${sequence.length}`}
        </span>
      </div>

      <div className="memory-progress-track" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <p className="game-hint">{feedback}</p>

      <div className="sequence-grid" aria-label="Sequence memory tiles">
        {Array.from({ length: TILE_COUNT }).map((_, i) => (
          <button
            type="button"
            key={i}
            className={[
              "sequence-cell",
              activeTile === i ? "active" : "",
              phase === "input" ? "ready" : "",
            ].filter(Boolean).join(" ")}
            aria-label={`Tile ${i + 1}`}
            aria-pressed={activeTile === i}
            disabled={locked || phase !== "input"}
            onClick={() => handleClick(i)}
          />
        ))}
      </div>

      <div className="memory-game-actions">
        <button
          type="button"
          className="secondary-btn"
          disabled={phase === "show"}
          onClick={replaySequence}
        >
          Replay level
        </button>
      </div>

      <p className="game-feedback">
        Level {level} · {userInput.length}/{sequence.length} entered
      </p>
    </div>
  );
}