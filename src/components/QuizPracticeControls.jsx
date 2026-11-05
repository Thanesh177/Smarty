import { Volume2, VolumeX } from 'lucide-react';

export const QUIZ_LEVELS = ['Easy', 'Medium', 'Hard', 'Challenge'];
export function getQuizPracticeLevel(level) {
  return { difficultyPreference: level === 'Challenge' ? 'Hard' : QUIZ_LEVELS.includes(level) ? level : 'Easy', challengeMode: level === 'Challenge' };
}

export default function QuizPracticeControls({ level, onLevel, mode, onMode, sound, onSound }) {
  return <section className="quiz-practice-controls" aria-label="Practice preferences">
    <h2>Difficulty</h2>
    <div className="quiz-level-choices" role="group" aria-label="Question difficulty">{QUIZ_LEVELS.map(value => <button key={value} type="button" aria-pressed={level === value} onClick={() => onLevel(value)}>{value}</button>)}</div>
    <p className="quiz-level-description">{level === 'Easy' ? 'Start with clear foundations.' : level === 'Medium' ? 'Apply what you know to new situations.' : level === 'Hard' ? 'Work through deeper reasoning and harder problems.' : 'Hard questions. Study notes stay closed until your review.'}</p>
    <h2>Play your way</h2>
    <div className="quiz-mode-picker" role="group" aria-label="Practice format">
      <button type="button" aria-pressed={mode === 'practice'} onClick={() => onMode('practice')}>Questions</button>
      <button type="button" aria-pressed={mode === 'mixed'} onClick={() => onMode('mixed')}>Questions + games</button>
    </div>
    <button type="button" className="quiz-sound-control" aria-pressed={sound} onClick={() => onSound(!sound)}>{sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}{sound ? 'Sound on' : 'Sound off'}</button>
  </section>;
}
