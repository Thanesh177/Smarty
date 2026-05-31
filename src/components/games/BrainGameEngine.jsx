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

const GAME_COMPONENTS = {
  sequence: MemorySequenceGame,
  lifeCrisis: LifeCrisisGame,
  memoryPalace: MemoryPalaceGame,
  scienceLab: ScienceLabGame,
  marketSurvival: MarketSurvivalGame,
  wordRecall: WordRecallGame,
  patternMatch: PatternMatchGame,
  tradingCandle: TradingCandleGame,
  decision: DecisionGame,
};

export default function BrainGameEngine({ game, onComplete }) {
  const GameComponent = GAME_COMPONENTS?.[game?.gameType];

  if (!GameComponent) {
    return (
      <div className="brain-game">
        <p className="game-kicker">GAME ERROR</p>
        <h2>Game not found</h2>
        <p className="game-hint">
          This challenge type is not connected yet.
        </p>
      </div>
    );
  }

  return (
    <GameComponent
      game={game}
      onComplete={onComplete}
    />
  );
}