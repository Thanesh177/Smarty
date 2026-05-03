import MemorySequenceGame from "./memory/MemorySequenceGame";
import WordRecallGame from "./memory/WordRecallGame";
import PatternMatchGame from "./memory/PatternMatchGame";
import TradingCandleGame from "./trading/TradingCandleGame";
import DecisionGame from "./life/DecisionGame";
import MarketSurvivalGame from "./trading/MarketSurvivalGame";
import LifeCrisisGame from "./life/LifeCrisisGame";
import MemoryPalaceGame from "./memory/MemoryPalaceGame";
import ScienceLabGame from "./science/ScienceLabGame";
import "./GameStyles.css";

export default function BrainGameEngine({ game, onComplete }) {
  if (game.gameType === "sequence") {
    return <MemorySequenceGame game={game} onComplete={onComplete} />;
  }

  if (game.gameType === "lifeCrisis") {
    return <LifeCrisisGame onComplete={onComplete} />;
  }

  if (game.gameType === "memoryPalace") {
    return <MemoryPalaceGame onComplete={onComplete} />;
  }

  if (game.gameType === "scienceLab") {
    return <ScienceLabGame onComplete={onComplete} />;
  }

  if (game.gameType === "marketSurvival") {
    return <MarketSurvivalGame onComplete={onComplete} />;
  }

  if (game.gameType === "wordRecall") {
    return <WordRecallGame game={game} onComplete={onComplete} />;
  }

  if (game.gameType === "patternMatch") {
    return <PatternMatchGame game={game} onComplete={onComplete} />;
  }

  if (game.gameType === "tradingCandle") {
    return <TradingCandleGame game={game} onComplete={onComplete} />;
  }

  if (game.gameType === "decision") {
    return <DecisionGame game={game} onComplete={onComplete} />;
  }

  return (
    <div className="brain-game">
      <p className="game-kicker">GAME ERROR</p>
      <h2>Game not found</h2>
      <p className="game-hint">This challenge type is not connected yet.</p>
    </div>
  );
}