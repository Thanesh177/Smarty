import { useEffect, useState } from "react";
import "../GameStyles.css";
export default function SequenceGame({ onComplete }) {
  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [phase, setPhase] = useState("show"); // show / input
  const [level, setLevel] = useState(3);

  useEffect(() => {
    const newSeq = Array.from({ length: level }, () =>
      Math.floor(Math.random() * 4)
    );
    setSequence(newSeq);

    setTimeout(() => {
      setPhase("input");
    }, 1500);
  }, []);

  const handleClick = (num) => {
    const updated = [...userInput, num];
    setUserInput(updated);

    if (sequence[updated.length - 1] !== num) {
      onComplete({ success: false, score: updated.length });
      return;
    }

    if (updated.length === sequence.length) {
      onComplete({ success: true, score: level });
    }
  };

return (
  <div className="brain-game serious-game">
    <p className="game-kicker">SEQUENCE TRAINING</p>
    <h2>Remember the pattern</h2>

    <p className="game-hint">
      {phase === "show"
        ? "Watch the glowing tiles."
        : "Repeat the pattern in the same order."}
    </p>

    <div className="sequence-grid">
      {[0, 1, 2, 3].map((i) => (
        <button
          type="button"
          key={i}
          className={`sequence-cell ${
            phase === "show" && sequence.includes(i) ? "active" : ""
          }`}
          onClick={() => phase === "input" && handleClick(i)}
        />
      ))}
    </div>

    <p className="game-feedback">
      Level {level} · {userInput.length}/{sequence.length} entered
    </p>
  </div>
);
}