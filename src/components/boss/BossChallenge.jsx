import { useState } from "react";
import MemorySequenceGame from "../games/memory/MemorySequenceGame";
import WordRecallGame from "../games/memory/WordRecallGame";
import PatternMatchGame from "../games/memory/PatternMatchGame";

import TradingCandleGame from "../games/trading/TradingCandleGame";
import MarketSurvivalGame from "../games/trading/MarketSurvivalGame";

import LifeCrisisGame from "../games/life/LifeCrisisGame";
import DecisionGame from "../games/life/DecisionGame";

import ScienceLabGame from "../games/science/ScienceLabGame";

import "../games/GameStyles.css";

function MemoryWordleBoss({ onComplete }) {
  const targetWord = "BRAIN";
  const maxAttempts = 6;
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [status, setStatus] = useState("Guess the hidden memory word.");
  const [finished, setFinished] = useState(false);

  const normalizeGuess = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, targetWord.length);

  const submitGuess = () => {
    if (finished) return;

    const cleanGuess = normalizeGuess(guess);

    if (cleanGuess.length !== targetWord.length) {
      setStatus(`Enter a ${targetWord.length}-letter word.`);
      return;
    }

    const nextAttempts = [...attempts, cleanGuess];
    const solved = cleanGuess === targetWord;
    const outOfAttempts = nextAttempts.length >= maxAttempts;

    setAttempts(nextAttempts);
    setGuess("");

    if (solved) {
      setFinished(true);
      setStatus("Correct. Memory boss defeated.");
      onComplete?.({ success: true, score: 100, game: "memory-wordle" });
      return;
    }

    if (outOfAttempts) {
      setFinished(true);
      setStatus(`Boss escaped. The word was ${targetWord}.`);
      onComplete?.({ success: false, score: 40, game: "memory-wordle" });
      return;
    }

    setStatus("Good try. Use the colours and guess again.");
  };

  const getTileState = (letter, index, word) => {
    if (!letter) return "empty";

    if (targetWord[index] === letter) return "correct";
    if (targetWord.includes(letter)) return "present";

    return "missing";
  };

  const rows = [...attempts];

  if (!finished && rows.length < maxAttempts) {
    rows.push(guess.padEnd(targetWord.length, " "));
  }

  while (rows.length < maxAttempts) {
    rows.push("".padEnd(targetWord.length, " "));
  }

  return (
    <div className="brain-game memory-wordle-game">
      <p className="game-kicker">MEMORY WORDLE</p>
      <h2>Guess the hidden word</h2>
      <p className="game-hint">
        Use memory and logic. Green means correct spot, yellow means correct letter,
        and dark means the letter is not in the word.
      </p>

      <div className="memory-wordle-board" aria-label="Memory word guessing board">
        {rows.map((word, rowIndex) => {
          const isSubmittedRow = rowIndex < attempts.length;

          return (
            <div className="memory-wordle-row" key={`row-${rowIndex}`}>
              {Array.from({ length: targetWord.length }).map((_, index) => {
                const letter = word[index]?.trim() || "";
                const tileState = isSubmittedRow
                  ? getTileState(letter, index, word)
                  : letter
                    ? "active"
                    : "empty";

                return (
                  <span
                    key={`tile-${rowIndex}-${index}`}
                    className={`memory-wordle-tile ${tileState}`}
                  >
                    {letter}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="memory-wordle-controls">
        <input
          value={guess}
          disabled={finished}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          maxLength={targetWord.length}
          placeholder="BRAIN"
          onChange={(event) => setGuess(normalizeGuess(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitGuess();
            }
          }}
        />

        <button
          type="button"
          className="game-main-btn"
          disabled={finished}
          onClick={submitGuess}
        >
          Guess
        </button>
      </div>

      <p className="game-hint memory-wordle-status">{status}</p>
    </div>
  );
}

export default function BossChallenge({ topicId, onComplete }) {
  const bossMap = {
    memory: <MemoryWordleBoss onComplete={onComplete} />,
    daily: <MemorySequenceGame onComplete={onComplete} />,
    psychology: <WordRecallGame onComplete={onComplete} />,

    trading: <MarketSurvivalGame onComplete={onComplete} />,
    personal_finance: <LifeCrisisGame onComplete={onComplete} />,
    career_skills: <DecisionGame onComplete={onComplete} />,

    physics: <ScienceLabGame onComplete={onComplete} />,
    ai_technology: <ScienceLabGame onComplete={onComplete} />,
    cybersecurity: <DecisionGame onComplete={onComplete} />,

    critical_thinking: <PatternMatchGame onComplete={onComplete} />,
    media_literacy: <PatternMatchGame onComplete={onComplete} />,
    law_rights: <DecisionGame onComplete={onComplete} />,

    animals: <PatternMatchGame onComplete={onComplete} />,
    health_fitness: <LifeCrisisGame onComplete={onComplete} />,
    world_history: <WordRecallGame onComplete={onComplete} />,
    geography_world: <PatternMatchGame onComplete={onComplete} />,
    communication: <DecisionGame onComplete={onComplete} />,
  };

  return (
    <div className="boss-stage">
      <div className="boss-header">
        <p className="game-kicker">BOSS CHALLENGE</p>
        <h2>Prove your mastery</h2>
      </div>

      {bossMap[topicId] || <MemorySequenceGame onComplete={onComplete} />}
    </div>
  );
}